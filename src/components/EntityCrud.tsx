/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'mitglieder'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *   …
 *   crud.mitglieder.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.mitglieder.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.mitglieder.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.sitzungen              // memoized Enriched* arrays — reuse these,
 *                                       // never call enrich*() yourself in the page
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   mitglieder: vorname, nachname, email, telefon, funktion, abteilung, eintrittsdatum, status, …  ·  ← sitzungen (list + contextual +) · ← sitzungen (list + contextual +) · ← tagesordnungspunkte (list + contextual +) · ← protokolle (list + contextual +) · ← protokolle (list + contextual +) · ← feedback (list + contextual +) · ← notizen (list + contextual +) · ← notizen (list + contextual +)
 *   sitzungen: titel, datum_uhrzeit, ort, art, beschreibung, anmeldefrist, max_teilnehmer, einlade_link, …  ·  → mitglieder · ← tagesordnungspunkte (list + contextual +) · ← protokolle (list + contextual +) · ← notizen (list + contextual +)
 *   tagesordnungspunkte: sitzung, punkt_titel, beschreibung, reihenfolge, dauer, typ, referent, unterlagen  ·  → sitzungen · → mitglieder · ← feedback (list + contextual +) · ← notizen (list + contextual +)
 *   protokolle: sitzung, erstellungsdatum, protokollfuehrer, anwesende_mitglieder, zusammenfassung, beschluesse, status, protokolldatei  ·  → sitzungen · → mitglieder · ← notizen (list + contextual +)
 *   feedback: tagesordnungspunkt, mitglied, kategorie, bewertung, kommentar, datum  ·  → tagesordnungspunkte · → mitglieder
 *   notizen: titel, notiztext, datum, prioritaet, ersteller, sitzung, tagesordnungspunkt, protokoll, …  ·  → mitglieder · → sitzungen · → tagesordnungspunkte · → protokolle
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle, Feedback, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichSitzungen, enrichTagesordnungspunkte, enrichProtokolle, enrichFeedback, enrichNotizen } from '@/lib/enrich';
import type { EnrichedSitzungen, EnrichedTagesordnungspunkte, EnrichedProtokolle, EnrichedFeedback, EnrichedNotizen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { MitgliederDialog, type MitgliederDialogDefaults } from '@/components/dialogs/MitgliederDialog';
import { MitgliederDetails } from '@/components/details/MitgliederDetails';
import { SitzungenDialog, type SitzungenDialogDefaults } from '@/components/dialogs/SitzungenDialog';
import { SitzungenDetails } from '@/components/details/SitzungenDetails';
import { TagesordnungspunkteDialog, type TagesordnungspunkteDialogDefaults } from '@/components/dialogs/TagesordnungspunkteDialog';
import { TagesordnungspunkteDetails } from '@/components/details/TagesordnungspunkteDetails';
import { ProtokolleDialog, type ProtokolleDialogDefaults } from '@/components/dialogs/ProtokolleDialog';
import { ProtokolleDetails } from '@/components/details/ProtokolleDetails';
import { FeedbackDialog, type FeedbackDialogDefaults } from '@/components/dialogs/FeedbackDialog';
import { FeedbackDetails } from '@/components/details/FeedbackDetails';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'mitglieder'; record: Mitglieder }
  | { type: 'sitzungen'; record: EnrichedSitzungen }
  | { type: 'tagesordnungspunkte'; record: EnrichedTagesordnungspunkte }
  | { type: 'protokolle'; record: EnrichedProtokolle }
  | { type: 'feedback'; record: EnrichedFeedback }
  | { type: 'notizen'; record: EnrichedNotizen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  mitglieder: EntityCrudApi<Mitglieder, MitgliederDialogDefaults>;
  sitzungen: EntityCrudApi<Sitzungen, SitzungenDialogDefaults>;
  tagesordnungspunkte: EntityCrudApi<Tagesordnungspunkte, TagesordnungspunkteDialogDefaults>;
  protokolle: EntityCrudApi<Protokolle, ProtokolleDialogDefaults>;
  feedback: EntityCrudApi<Feedback, FeedbackDialogDefaults>;
  notizen: EntityCrudApi<Notizen, NotizenDialogDefaults>;
  /** Memoized Enriched* arrays — reuse these, never re-enrich in the page. */
  enriched: { sitzungen: EnrichedSitzungen[]; tagesordnungspunkte: EnrichedTagesordnungspunkte[]; protokolle: EnrichedProtokolle[]; feedback: EnrichedFeedback[]; notizen: EnrichedNotizen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [mitgliederDialog, setMitgliederDialog] = useState<{ defaults?: MitgliederDialogDefaults; editing?: Mitglieder } | null>(null);
  const [sitzungenDialog, setSitzungenDialog] = useState<{ defaults?: SitzungenDialogDefaults; editing?: Sitzungen } | null>(null);
  const [tagesordnungspunkteDialog, setTagesordnungspunkteDialog] = useState<{ defaults?: TagesordnungspunkteDialogDefaults; editing?: Tagesordnungspunkte } | null>(null);
  const [protokolleDialog, setProtokolleDialog] = useState<{ defaults?: ProtokolleDialogDefaults; editing?: Protokolle } | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<{ defaults?: FeedbackDialogDefaults; editing?: Feedback } | null>(null);
  const [notizenDialog, setNotizenDialog] = useState<{ defaults?: NotizenDialogDefaults; editing?: Notizen } | null>(null);
  const enrichedSitzungen = useMemo(() => enrichSitzungen(data.sitzungen, { mitgliederMap: data.mitgliederMap }), [data.sitzungen, data.mitgliederMap]);
  const enrichedTagesordnungspunkte = useMemo(() => enrichTagesordnungspunkte(data.tagesordnungspunkte, { sitzungenMap: data.sitzungenMap, mitgliederMap: data.mitgliederMap }), [data.tagesordnungspunkte, data.sitzungenMap, data.mitgliederMap]);
  const enrichedProtokolle = useMemo(() => enrichProtokolle(data.protokolle, { sitzungenMap: data.sitzungenMap, mitgliederMap: data.mitgliederMap }), [data.protokolle, data.sitzungenMap, data.mitgliederMap]);
  const enrichedFeedback = useMemo(() => enrichFeedback(data.feedback, { tagesordnungspunkteMap: data.tagesordnungspunkteMap, mitgliederMap: data.mitgliederMap }), [data.feedback, data.tagesordnungspunkteMap, data.mitgliederMap]);
  const enrichedNotizen = useMemo(() => enrichNotizen(data.notizen, { mitgliederMap: data.mitgliederMap, sitzungenMap: data.sitzungenMap, tagesordnungspunkteMap: data.tagesordnungspunkteMap, protokolleMap: data.protokolleMap }), [data.notizen, data.mitgliederMap, data.sitzungenMap, data.tagesordnungspunkteMap, data.protokolleMap]);

  function detailMitglieder(record: Mitglieder, push = false) {
    const item: OverlayItem = { type: 'mitglieder', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitglieder(fields: Mitglieder['fields']) {
    const editing = mitgliederDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitglieder(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitgliederEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitglieder')} — ${t('crud_updated')}`, async () => {
        data.setMitglieder(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitgliederEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitgliederEntry(fields);
      undoToast(`${appLabel('mitglieder')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailSitzungen(record: Sitzungen, push = false) {
    const rec = enrichedSitzungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'sitzungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitSitzungen(fields: Sitzungen['fields']) {
    const editing = sitzungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setSitzungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateSitzungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('sitzungen')} — ${t('crud_updated')}`, async () => {
        data.setSitzungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateSitzungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createSitzungenEntry(fields);
      undoToast(`${appLabel('sitzungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTagesordnungspunkte(record: Tagesordnungspunkte, push = false) {
    const rec = enrichedTagesordnungspunkte.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'tagesordnungspunkte', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTagesordnungspunkte(fields: Tagesordnungspunkte['fields']) {
    const editing = tagesordnungspunkteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTagesordnungspunkte(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTagesordnungspunkteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('tagesordnungspunkte')} — ${t('crud_updated')}`, async () => {
        data.setTagesordnungspunkte(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTagesordnungspunkteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTagesordnungspunkteEntry(fields);
      undoToast(`${appLabel('tagesordnungspunkte')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailProtokolle(record: Protokolle, push = false) {
    const rec = enrichedProtokolle.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'protokolle', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitProtokolle(fields: Protokolle['fields']) {
    const editing = protokolleDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setProtokolle(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateProtokolleEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('protokolle')} — ${t('crud_updated')}`, async () => {
        data.setProtokolle(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateProtokolleEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createProtokolleEntry(fields);
      undoToast(`${appLabel('protokolle')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailFeedback(record: Feedback, push = false) {
    const rec = enrichedFeedback.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'feedback', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitFeedback(fields: Feedback['fields']) {
    const editing = feedbackDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setFeedback(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateFeedbackEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('feedback')} — ${t('crud_updated')}`, async () => {
        data.setFeedback(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateFeedbackEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createFeedbackEntry(fields);
      undoToast(`${appLabel('feedback')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailNotizen(record: Notizen, push = false) {
    const rec = enrichedNotizen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'notizen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitNotizen(fields: Notizen['fields']) {
    const editing = notizenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setNotizen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateNotizenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('notizen')} — ${t('crud_updated')}`, async () => {
        data.setNotizen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateNotizenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createNotizenEntry(fields);
      undoToast(`${appLabel('notizen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <MitgliederDialog
        open={mitgliederDialog !== null}
        onClose={() => setMitgliederDialog(null)}
        onSubmit={submitMitglieder}
        defaultValues={mitgliederDialog?.defaults}
        recordId={mitgliederDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitglieder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitglieder']}
      />
      <SitzungenDialog
        open={sitzungenDialog !== null}
        onClose={() => setSitzungenDialog(null)}
        onSubmit={submitSitzungen}
        defaultValues={sitzungenDialog?.defaults}
        recordId={sitzungenDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Sitzungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Sitzungen']}
      />
      <TagesordnungspunkteDialog
        open={tagesordnungspunkteDialog !== null}
        onClose={() => setTagesordnungspunkteDialog(null)}
        onSubmit={submitTagesordnungspunkte}
        defaultValues={tagesordnungspunkteDialog?.defaults}
        recordId={tagesordnungspunkteDialog?.editing?.record_id}
        sitzungenList={data.sitzungen}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Tagesordnungspunkte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Tagesordnungspunkte']}
      />
      <ProtokolleDialog
        open={protokolleDialog !== null}
        onClose={() => setProtokolleDialog(null)}
        onSubmit={submitProtokolle}
        defaultValues={protokolleDialog?.defaults}
        recordId={protokolleDialog?.editing?.record_id}
        sitzungenList={data.sitzungen}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Protokolle']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Protokolle']}
      />
      <FeedbackDialog
        open={feedbackDialog !== null}
        onClose={() => setFeedbackDialog(null)}
        onSubmit={submitFeedback}
        defaultValues={feedbackDialog?.defaults}
        recordId={feedbackDialog?.editing?.record_id}
        tagesordnungspunkteList={data.tagesordnungspunkte}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Feedback']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Feedback']}
      />
      <NotizenDialog
        open={notizenDialog !== null}
        onClose={() => setNotizenDialog(null)}
        onSubmit={submitNotizen}
        defaultValues={notizenDialog?.defaults}
        recordId={notizenDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        sitzungenList={data.sitzungen}
        tagesordnungspunkteList={data.tagesordnungspunkte}
        protokolleList={data.protokolle}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'mitglieder') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('mitglieder')} subtitle={top.record.fields.eintrittsdatum ? formatDate(top.record.fields.eintrittsdatum) : undefined} />
                <MitgliederDetails
                  record={top.record}
                  sitzungenList={data.sitzungen}
                  onOpenSitzungen={(r) => detailSitzungen(r, true)}
                  onAddSitzungen={() => setSitzungenDialog({ defaults: { eingeladene_mitglieder: [createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id)] } })}
                  sitzungenAngemeldeteList={data.sitzungen}
                  onOpenSitzungenAngemeldete={(r) => detailSitzungen(r, true)}
                  onAddSitzungenAngemeldete={() => setSitzungenDialog({ defaults: { angemeldete_mitglieder: [createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id)] } })}
                  tagesordnungspunkteList={data.tagesordnungspunkte}
                  onOpenTagesordnungspunkte={(r) => detailTagesordnungspunkte(r, true)}
                  onAddTagesordnungspunkte={() => setTagesordnungspunkteDialog({ defaults: { referent: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  protokolleList={data.protokolle}
                  onOpenProtokolle={(r) => detailProtokolle(r, true)}
                  onAddProtokolle={() => setProtokolleDialog({ defaults: { protokollfuehrer: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  protokolleAnwesendeList={data.protokolle}
                  onOpenProtokolleAnwesende={(r) => detailProtokolle(r, true)}
                  onAddProtokolleAnwesende={() => setProtokolleDialog({ defaults: { anwesende_mitglieder: [createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id)] } })}
                  feedbackList={data.feedback}
                  onOpenFeedback={(r) => detailFeedback(r, true)}
                  onAddFeedback={() => setFeedbackDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  notizenList={data.notizen}
                  onOpenNotizen={(r) => detailNotizen(r, true)}
                  onAddNotizen={() => setNotizenDialog({ defaults: { ersteller: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  notizenMitgliedList={data.notizen}
                  onOpenNotizenMitglied={(r) => detailNotizen(r, true)}
                  onAddNotizenMitglied={() => setNotizenDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'sitzungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('sitzungen')} subtitle={top.record.fields.datum_uhrzeit ? formatDate(top.record.fields.datum_uhrzeit) : undefined} />
                <SitzungenDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  tagesordnungspunkteList={data.tagesordnungspunkte}
                  onOpenTagesordnungspunkte={(r) => detailTagesordnungspunkte(r, true)}
                  onAddTagesordnungspunkte={() => setTagesordnungspunkteDialog({ defaults: { sitzung: createRecordUrl(APP_IDS.SITZUNGEN, top.record.record_id) } })}
                  protokolleList={data.protokolle}
                  onOpenProtokolle={(r) => detailProtokolle(r, true)}
                  onAddProtokolle={() => setProtokolleDialog({ defaults: { sitzung: createRecordUrl(APP_IDS.SITZUNGEN, top.record.record_id) } })}
                  notizenList={data.notizen}
                  onOpenNotizen={(r) => detailNotizen(r, true)}
                  onAddNotizen={() => setNotizenDialog({ defaults: { sitzung: createRecordUrl(APP_IDS.SITZUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'tagesordnungspunkte') {
            return (
              <>
                <RecordHeader title={top.record.fields.punkt_titel ?? appLabel('tagesordnungspunkte')} subtitle={undefined} />
                <TagesordnungspunkteDetails
                  record={top.record}
                  sitzungenList={data.sitzungen}
                  onOpenSitzungen={(r) => detailSitzungen(r, true)}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                  feedbackList={data.feedback}
                  onOpenFeedback={(r) => detailFeedback(r, true)}
                  onAddFeedback={() => setFeedbackDialog({ defaults: { tagesordnungspunkt: createRecordUrl(APP_IDS.TAGESORDNUNGSPUNKTE, top.record.record_id) } })}
                  notizenList={data.notizen}
                  onOpenNotizen={(r) => detailNotizen(r, true)}
                  onAddNotizen={() => setNotizenDialog({ defaults: { tagesordnungspunkt: createRecordUrl(APP_IDS.TAGESORDNUNGSPUNKTE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'protokolle') {
            return (
              <>
                <RecordHeader title={appLabel('protokolle')} subtitle={top.record.fields.erstellungsdatum ? formatDate(top.record.fields.erstellungsdatum) : undefined} />
                <ProtokolleDetails
                  record={top.record}
                  sitzungenList={data.sitzungen}
                  onOpenSitzungen={(r) => detailSitzungen(r, true)}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                  notizenList={data.notizen}
                  onOpenNotizen={(r) => detailNotizen(r, true)}
                  onAddNotizen={() => setNotizenDialog({ defaults: { protokoll: createRecordUrl(APP_IDS.PROTOKOLLE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'feedback') {
            return (
              <>
                <RecordHeader title={appLabel('feedback')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <FeedbackDetails
                  record={top.record}
                  tagesordnungspunkteList={data.tagesordnungspunkte}
                  onOpenTagesordnungspunkte={(r) => detailTagesordnungspunkte(r, true)}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('notizen')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <NotizenDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                  sitzungenList={data.sitzungen}
                  onOpenSitzungen={(r) => detailSitzungen(r, true)}
                  tagesordnungspunkteList={data.tagesordnungspunkte}
                  onOpenTagesordnungspunkte={(r) => detailTagesordnungspunkte(r, true)}
                  protokolleList={data.protokolle}
                  onOpenProtokolle={(r) => detailProtokolle(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'mitglieder') setMitgliederDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'sitzungen') setSitzungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'tagesordnungspunkte') setTagesordnungspunkteDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'protokolle') setProtokolleDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'feedback') setFeedbackDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'notizen') setNotizenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    mitglieder: {
      openCreate: (defaults?: MitgliederDialogDefaults) => setMitgliederDialog({ defaults }),
      openEdit: (record: Mitglieder) => setMitgliederDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitglieder) => detailMitglieder(record, false),
    },
    sitzungen: {
      openCreate: (defaults?: SitzungenDialogDefaults) => setSitzungenDialog({ defaults }),
      openEdit: (record: Sitzungen) => setSitzungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Sitzungen) => detailSitzungen(record, false),
    },
    tagesordnungspunkte: {
      openCreate: (defaults?: TagesordnungspunkteDialogDefaults) => setTagesordnungspunkteDialog({ defaults }),
      openEdit: (record: Tagesordnungspunkte) => setTagesordnungspunkteDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Tagesordnungspunkte) => detailTagesordnungspunkte(record, false),
    },
    protokolle: {
      openCreate: (defaults?: ProtokolleDialogDefaults) => setProtokolleDialog({ defaults }),
      openEdit: (record: Protokolle) => setProtokolleDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Protokolle) => detailProtokolle(record, false),
    },
    feedback: {
      openCreate: (defaults?: FeedbackDialogDefaults) => setFeedbackDialog({ defaults }),
      openEdit: (record: Feedback) => setFeedbackDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Feedback) => detailFeedback(record, false),
    },
    notizen: {
      openCreate: (defaults?: NotizenDialogDefaults) => setNotizenDialog({ defaults }),
      openEdit: (record: Notizen) => setNotizenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Notizen) => detailNotizen(record, false),
    },
    enriched: { sitzungen: enrichedSitzungen, tagesordnungspunkte: enrichedTagesordnungspunkte, protokolle: enrichedProtokolle, feedback: enrichedFeedback, notizen: enrichedNotizen },
  };
}
