import type { Tagesordnungspunkte, Sitzungen, Mitglieder, Feedback, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface TagesordnungspunkteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Tagesordnungspunkte;
  /** N:1-Ziel „Sitzungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  sitzungenList: Sitzungen[];
  /** Klick auf die Sitzungen-Relation → overlay.push auf dessen Detail. */
  onOpenSitzungen?: (record: Sitzungen) => void;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** 1:N „Feedback": VOLLE Liste — der Block filtert auf diesen Record. */
  feedbackList: Feedback[];
  /** Zeilen-Klick → overlay.push auf das Feedback-Detail (nie der Edit-Dialog). */
  onOpenFeedback: (record: Feedback) => void;
  /** Kontextuelles „+": öffnet den Feedback-Dialog mit diesem Record vorgesetzt. */
  onAddFeedback: () => void;
  /** 1:N „Notizen": VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
}

export function TagesordnungspunkteDetails({
  record,
  sitzungenList,
  onOpenSitzungen,
  mitgliederList,
  onOpenMitglieder,
  feedbackList,
  onOpenFeedback,
  onAddFeedback,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
}: TagesordnungspunkteDetailsProps) {
  const sitzungTarget = sitzungenList.find(r => r.record_id === extractRecordId(record.fields.sitzung));
  const referentTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.referent));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('tagesordnungspunkte', 'punkt_titel')} value={record.fields.punkt_titel} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'reihenfolge')} value={record.fields.reihenfolge} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'dauer')} value={record.fields.dauer} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'typ')} value={record.fields.typ} format="pill" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'unterlagen')} className="md:col-span-2">
          {record.fields.unterlagen ? (
            <MediaThumbnail src={record.fields.unterlagen as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('tagesordnungspunkte', 'sitzung')}
          name={sitzungTarget?.fields.titel ?? '—'}
          meta={[sitzungTarget?.fields.ort].filter(Boolean).join(' · ') || undefined}
          onClick={sitzungTarget && onOpenSitzungen ? () => onOpenSitzungen!(sitzungTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('tagesordnungspunkte', 'referent')}
          name={referentTarget?.fields.vorname ?? '—'}
          meta={[referentTarget?.fields.email, referentTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={referentTarget && onOpenMitglieder ? () => onOpenMitglieder!(referentTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('feedback')}
        items={feedbackList.filter(r => extractRecordId(r.fields.tagesordnungspunkt) === record.record_id)}
        map={r => ({ name: appLabel('feedback'), meta: r.fields.datum })}
        onOpen={onOpenFeedback}
        onAdd={onAddFeedback}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.tagesordnungspunkt) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('notizen'), meta: r.fields.datum })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TAGESORDNUNGSPUNKTE} recordId={record.record_id} />
    </>
  );
}
