import type { Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle, Feedback, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface MitgliederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitglieder;
  /** 1:N „Sitzungen" (eingeladen): VOLLE Liste — der Block filtert auf diesen Record. */
  sitzungenList: Sitzungen[];
  /** Zeilen-Klick → overlay.push auf das Sitzungen-Detail (nie der Edit-Dialog). */
  onOpenSitzungen: (record: Sitzungen) => void;
  /** Kontextuelles „+": öffnet den Sitzungen-Dialog mit diesem Record vorgesetzt. */
  onAddSitzungen: () => void;
  /** 1:N „Sitzungen" (angemeldet): VOLLE Liste — der Block filtert auf diesen Record. */
  sitzungenAngemeldeteList: Sitzungen[];
  /** Zeilen-Klick → overlay.push auf das Sitzungen-Detail (nie der Edit-Dialog). */
  onOpenSitzungenAngemeldete: (record: Sitzungen) => void;
  /** Kontextuelles „+": öffnet den Sitzungen-Dialog mit diesem Record vorgesetzt. */
  onAddSitzungenAngemeldete: () => void;
  /** 1:N „Tagesordnungspunkte": VOLLE Liste — der Block filtert auf diesen Record. */
  tagesordnungspunkteList: Tagesordnungspunkte[];
  /** Zeilen-Klick → overlay.push auf das Tagesordnungspunkte-Detail (nie der Edit-Dialog). */
  onOpenTagesordnungspunkte: (record: Tagesordnungspunkte) => void;
  /** Kontextuelles „+": öffnet den Tagesordnungspunkte-Dialog mit diesem Record vorgesetzt. */
  onAddTagesordnungspunkte: () => void;
  /** 1:N „Protokolle" (Protokollführer): VOLLE Liste — der Block filtert auf diesen Record. */
  protokolleList: Protokolle[];
  /** Zeilen-Klick → overlay.push auf das Protokolle-Detail (nie der Edit-Dialog). */
  onOpenProtokolle: (record: Protokolle) => void;
  /** Kontextuelles „+": öffnet den Protokolle-Dialog mit diesem Record vorgesetzt. */
  onAddProtokolle: () => void;
  /** 1:N „Protokolle" (anwesend): VOLLE Liste — der Block filtert auf diesen Record. */
  protokolleAnwesendeList: Protokolle[];
  /** Zeilen-Klick → overlay.push auf das Protokolle-Detail (nie der Edit-Dialog). */
  onOpenProtokolleAnwesende: (record: Protokolle) => void;
  /** Kontextuelles „+": öffnet den Protokolle-Dialog mit diesem Record vorgesetzt. */
  onAddProtokolleAnwesende: () => void;
  /** 1:N „Feedback": VOLLE Liste — der Block filtert auf diesen Record. */
  feedbackList: Feedback[];
  /** Zeilen-Klick → overlay.push auf das Feedback-Detail (nie der Edit-Dialog). */
  onOpenFeedback: (record: Feedback) => void;
  /** Kontextuelles „+": öffnet den Feedback-Dialog mit diesem Record vorgesetzt. */
  onAddFeedback: () => void;
  /** 1:N „Notizen" (erstellt von): VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
  /** 1:N „Notizen" (Bezug Mitglied): VOLLE Liste — der Block filtert auf diesen Record. */
  notizenMitgliedList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizenMitglied: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizenMitglied: () => void;
}

export function MitgliederDetails({
  record,
  sitzungenList,
  onOpenSitzungen,
  onAddSitzungen,
  sitzungenAngemeldeteList,
  onOpenSitzungenAngemeldete,
  onAddSitzungenAngemeldete,
  tagesordnungspunkteList,
  onOpenTagesordnungspunkte,
  onAddTagesordnungspunkte,
  protokolleList,
  onOpenProtokolle,
  onAddProtokolle,
  protokolleAnwesendeList,
  onOpenProtokolleAnwesende,
  onAddProtokolleAnwesende,
  feedbackList,
  onOpenFeedback,
  onAddFeedback,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
  notizenMitgliedList,
  onOpenNotizenMitglied,
  onAddNotizenMitglied,
}: MitgliederDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('mitglieder', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('mitglieder', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'funktion')} value={record.fields.funktion} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'abteilung')} value={record.fields.abteilung} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'eintrittsdatum')} value={record.fields.eintrittsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('mitglieder', 'profilbild')} className="md:col-span-2">
          {record.fields.profilbild ? (
            <MediaThumbnail src={record.fields.profilbild as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('mitglieder', 'anmerkungen')} value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('sitzungen')}
        items={sitzungenList.filter(r => Array.isArray(r.fields.eingeladene_mitglieder) && r.fields.eingeladene_mitglieder.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: r.fields.titel ?? appLabel('sitzungen'), meta: r.fields.datum_uhrzeit })}
        onOpen={onOpenSitzungen}
        onAdd={onAddSitzungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('sitzungen')}
        items={sitzungenAngemeldeteList.filter(r => Array.isArray(r.fields.angemeldete_mitglieder) && r.fields.angemeldete_mitglieder.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: r.fields.titel ?? appLabel('sitzungen'), meta: r.fields.datum_uhrzeit })}
        onOpen={onOpenSitzungenAngemeldete}
        onAdd={onAddSitzungenAngemeldete}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('tagesordnungspunkte')}
        items={tagesordnungspunkteList.filter(r => extractRecordId(r.fields.referent) === record.record_id)}
        map={r => ({ name: r.fields.punkt_titel ?? appLabel('tagesordnungspunkte'), meta: undefined })}
        onOpen={onOpenTagesordnungspunkte}
        onAdd={onAddTagesordnungspunkte}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('protokolle')}
        items={protokolleList.filter(r => extractRecordId(r.fields.protokollfuehrer) === record.record_id)}
        map={r => ({ name: appLabel('protokolle'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenProtokolle}
        onAdd={onAddProtokolle}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('protokolle')}
        items={protokolleAnwesendeList.filter(r => Array.isArray(r.fields.anwesende_mitglieder) && r.fields.anwesende_mitglieder.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: appLabel('protokolle'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenProtokolleAnwesende}
        onAdd={onAddProtokolleAnwesende}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('feedback')}
        items={feedbackList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: appLabel('feedback'), meta: r.fields.datum })}
        onOpen={onOpenFeedback}
        onAdd={onAddFeedback}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.ersteller) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('notizen'), meta: r.fields.datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenMitgliedList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('notizen'), meta: r.fields.datum })}
        onOpen={onOpenNotizenMitglied}
        onAdd={onAddNotizenMitglied}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MITGLIEDER} recordId={record.record_id} />
    </>
  );
}
