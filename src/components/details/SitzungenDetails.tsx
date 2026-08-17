import type { Sitzungen, Mitglieder, Tagesordnungspunkte, Protokolle, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface SitzungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Sitzungen;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Reserviert — Mitglieder ist hier nur über ein Mehrfach-Feld verknüpft (Text-Join, keine Einzel-Relation); Übergabe erlaubt, aber ohne Wirkung. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** 1:N „Tagesordnungspunkte": VOLLE Liste — der Block filtert auf diesen Record. */
  tagesordnungspunkteList: Tagesordnungspunkte[];
  /** Zeilen-Klick → overlay.push auf das Tagesordnungspunkte-Detail (nie der Edit-Dialog). */
  onOpenTagesordnungspunkte: (record: Tagesordnungspunkte) => void;
  /** Kontextuelles „+": öffnet den Tagesordnungspunkte-Dialog mit diesem Record vorgesetzt. */
  onAddTagesordnungspunkte: () => void;
  /** 1:N „Protokolle": VOLLE Liste — der Block filtert auf diesen Record. */
  protokolleList: Protokolle[];
  /** Zeilen-Klick → overlay.push auf das Protokolle-Detail (nie der Edit-Dialog). */
  onOpenProtokolle: (record: Protokolle) => void;
  /** Kontextuelles „+": öffnet den Protokolle-Dialog mit diesem Record vorgesetzt. */
  onAddProtokolle: () => void;
  /** 1:N „Notizen": VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
}

export function SitzungenDetails({
  record,
  mitgliederList,
  tagesordnungspunkteList,
  onOpenTagesordnungspunkte,
  onAddTagesordnungspunkte,
  protokolleList,
  onOpenProtokolle,
  onAddProtokolle,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
}: SitzungenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('sitzungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'datum_uhrzeit')} value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label={fieldLabel('sitzungen', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'art')} value={record.fields.art} format="pill" />
        <RecordField label={fieldLabel('sitzungen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('sitzungen', 'anmeldefrist')} value={record.fields.anmeldefrist} format="datetime" />
        <RecordField label={fieldLabel('sitzungen', 'max_teilnehmer')} value={record.fields.max_teilnehmer} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'einlade_link')} value={record.fields.einlade_link} format="url" />
        <RecordField label={fieldLabel('sitzungen', 'einladungsstatus')} value={record.fields.einladungsstatus} format="pill" />
        <RecordField label={fieldLabel('sitzungen', 'eingeladene_mitglieder')} value={Array.isArray(record.fields.eingeladene_mitglieder) ? record.fields.eingeladene_mitglieder.map((u: unknown) => mitgliederList.find(t => t.record_id === extractRecordId(u))?.fields.vorname ?? '—').join(', ') : null} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'angemeldete_mitglieder')} value={Array.isArray(record.fields.angemeldete_mitglieder) ? record.fields.angemeldete_mitglieder.map((u: unknown) => mitgliederList.find(t => t.record_id === extractRecordId(u))?.fields.vorname ?? '—').join(', ') : null} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('tagesordnungspunkte')}
        items={tagesordnungspunkteList.filter(r => extractRecordId(r.fields.sitzung) === record.record_id)}
        map={r => ({ name: r.fields.punkt_titel ?? appLabel('tagesordnungspunkte'), meta: undefined })}
        onOpen={onOpenTagesordnungspunkte}
        onAdd={onAddTagesordnungspunkte}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('protokolle')}
        items={protokolleList.filter(r => extractRecordId(r.fields.sitzung) === record.record_id)}
        map={r => ({ name: appLabel('protokolle'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenProtokolle}
        onAdd={onAddProtokolle}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.sitzung) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('notizen'), meta: r.fields.datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.SITZUNGEN} recordId={record.record_id} />
    </>
  );
}
