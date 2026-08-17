import type { Notizen, Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface NotizenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Notizen;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** N:1-Ziel „Sitzungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  sitzungenList: Sitzungen[];
  /** Klick auf die Sitzungen-Relation → overlay.push auf dessen Detail. */
  onOpenSitzungen?: (record: Sitzungen) => void;
  /** N:1-Ziel „Tagesordnungspunkte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  tagesordnungspunkteList: Tagesordnungspunkte[];
  /** Klick auf die Tagesordnungspunkte-Relation → overlay.push auf dessen Detail. */
  onOpenTagesordnungspunkte?: (record: Tagesordnungspunkte) => void;
  /** N:1-Ziel „Protokolle": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  protokolleList: Protokolle[];
  /** Klick auf die Protokolle-Relation → overlay.push auf dessen Detail. */
  onOpenProtokolle?: (record: Protokolle) => void;
}

export function NotizenDetails({
  record,
  mitgliederList,
  onOpenMitglieder,
  sitzungenList,
  onOpenSitzungen,
  tagesordnungspunkteList,
  onOpenTagesordnungspunkte,
  protokolleList,
  onOpenProtokolle,
}: NotizenDetailsProps) {
  const erstellerTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.ersteller));
  const sitzungTarget = sitzungenList.find(r => r.record_id === extractRecordId(record.fields.sitzung));
  const tagesordnungspunktTarget = tagesordnungspunkteList.find(r => r.record_id === extractRecordId(record.fields.tagesordnungspunkt));
  const protokollTarget = protokolleList.find(r => r.record_id === extractRecordId(record.fields.protokoll));
  const mitgliedTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.mitglied));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('notizen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('notizen', 'notiztext')} value={record.fields.notiztext} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('notizen', 'datum')} value={record.fields.datum} format="date" />
        <RecordField label={fieldLabel('notizen', 'prioritaet')} value={record.fields.prioritaet} format="pill" />
        <RecordField label={fieldLabel('notizen', 'anhang')} className="md:col-span-2">
          {record.fields.anhang ? (
            <MediaThumbnail src={record.fields.anhang as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('notizen', 'ersteller')}
          name={erstellerTarget?.fields.vorname ?? '—'}
          meta={[erstellerTarget?.fields.email, erstellerTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={erstellerTarget && onOpenMitglieder ? () => onOpenMitglieder!(erstellerTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('notizen', 'sitzung')}
          name={sitzungTarget?.fields.titel ?? '—'}
          meta={[sitzungTarget?.fields.ort].filter(Boolean).join(' · ') || undefined}
          onClick={sitzungTarget && onOpenSitzungen ? () => onOpenSitzungen!(sitzungTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('notizen', 'tagesordnungspunkt')}
          name={tagesordnungspunktTarget?.fields.punkt_titel ?? '—'}
          meta={undefined}
          onClick={tagesordnungspunktTarget && onOpenTagesordnungspunkte ? () => onOpenTagesordnungspunkte!(tagesordnungspunktTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('notizen', 'protokoll')}
          name={protokollTarget?.fields.zusammenfassung ?? '—'}
          meta={undefined}
          onClick={protokollTarget && onOpenProtokolle ? () => onOpenProtokolle!(protokollTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('notizen', 'mitglied')}
          name={mitgliedTarget?.fields.vorname ?? '—'}
          meta={[mitgliedTarget?.fields.email, mitgliedTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitgliedTarget && onOpenMitglieder ? () => onOpenMitglieder!(mitgliedTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.NOTIZEN} recordId={record.record_id} />
    </>
  );
}
