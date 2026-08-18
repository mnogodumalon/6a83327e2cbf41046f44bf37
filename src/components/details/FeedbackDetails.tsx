import type { Feedback, Tagesordnungspunkte, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface FeedbackDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Feedback;
  /** N:1-Ziel „Tagesordnungspunkte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  tagesordnungspunkteList: Tagesordnungspunkte[];
  /** Klick auf die Tagesordnungspunkte-Relation → overlay.push auf dessen Detail. */
  onOpenTagesordnungspunkte?: (record: Tagesordnungspunkte) => void;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
}

export function FeedbackDetails({
  record,
  tagesordnungspunkteList,
  onOpenTagesordnungspunkte,
  mitgliederList,
  onOpenMitglieder,
}: FeedbackDetailsProps) {
  const tagesordnungspunktTarget = tagesordnungspunkteList.find(r => r.record_id === extractRecordId(record.fields.tagesordnungspunkt));
  const mitgliedTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.mitglied));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('feedback', 'kategorie')} value={record.fields.kategorie} format="pill" />
        <RecordField label={fieldLabel('feedback', 'bewertung')} value={record.fields.bewertung} format="pill" />
        <RecordField label={fieldLabel('feedback', 'kommentar')} value={record.fields.kommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('feedback', 'datum')} value={record.fields.datum} format="date" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('feedback', 'tagesordnungspunkt')}
          name={tagesordnungspunktTarget?.fields.punkt_titel ?? '—'}
          meta={undefined}
          onClick={tagesordnungspunktTarget && onOpenTagesordnungspunkte ? () => onOpenTagesordnungspunkte!(tagesordnungspunktTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('feedback', 'mitglied')}
          name={mitgliedTarget?.fields.vorname ?? '—'}
          meta={[mitgliedTarget?.fields.email, mitgliedTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitgliedTarget && onOpenMitglieder ? () => onOpenMitglieder!(mitgliedTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.FEEDBACK} recordId={record.record_id} />
    </>
  );
}
