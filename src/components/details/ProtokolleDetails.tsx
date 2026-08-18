import type { Protokolle, Sitzungen, Mitglieder, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ProtokolleDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Protokolle;
  /** N:1-Ziel „Sitzungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  sitzungenList: Sitzungen[];
  /** Klick auf die Sitzungen-Relation → overlay.push auf dessen Detail. */
  onOpenSitzungen?: (record: Sitzungen) => void;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** 1:N „Notizen": VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
}

export function ProtokolleDetails({
  record,
  sitzungenList,
  onOpenSitzungen,
  mitgliederList,
  onOpenMitglieder,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
}: ProtokolleDetailsProps) {
  const sitzungTarget = sitzungenList.find(r => r.record_id === extractRecordId(record.fields.sitzung));
  const protokollfuehrerTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.protokollfuehrer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('protokolle', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
        <RecordField label={fieldLabel('protokolle', 'anwesende_mitglieder')} value={Array.isArray(record.fields.anwesende_mitglieder) ? record.fields.anwesende_mitglieder.map((u: unknown) => mitgliederList.find(t => t.record_id === extractRecordId(u))?.fields.vorname ?? '—').join(', ') : null} format="text" />
        <RecordField label={fieldLabel('protokolle', 'zusammenfassung')} value={record.fields.zusammenfassung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('protokolle', 'beschluesse')} value={record.fields.beschluesse} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('protokolle', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('protokolle', 'protokolldatei')} className="md:col-span-2">
          {record.fields.protokolldatei ? (
            <MediaThumbnail src={record.fields.protokolldatei as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('protokolle', 'sitzung')}
          name={sitzungTarget?.fields.titel ?? '—'}
          meta={[sitzungTarget?.fields.ort].filter(Boolean).join(' · ') || undefined}
          onClick={sitzungTarget && onOpenSitzungen ? () => onOpenSitzungen!(sitzungTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('protokolle', 'protokollfuehrer')}
          name={protokollfuehrerTarget?.fields.vorname ?? '—'}
          meta={[protokollfuehrerTarget?.fields.email, protokollfuehrerTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={protokollfuehrerTarget && onOpenMitglieder ? () => onOpenMitglieder!(protokollfuehrerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.protokoll) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('notizen'), meta: r.fields.datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.PROTOKOLLE} recordId={record.record_id} />
    </>
  );
}
