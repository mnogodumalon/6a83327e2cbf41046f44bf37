import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Notizen, Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { NotizenDialog } from '@/components/dialogs/NotizenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Notizen';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function NotizenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Notizen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mitgliederList, setMitgliederList] = useState<Mitglieder[]>([]);
  const [sitzungenList, setSitzungenList] = useState<Sitzungen[]>([]);
  const [tagesordnungspunkteList, setTagesordnungspunkteList] = useState<Tagesordnungspunkte[]>([]);
  const [protokolleList, setProtokolleList] = useState<Protokolle[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, mitgliederData, sitzungenData, tagesordnungspunkteData, protokolleData] = await Promise.all([
        LivingAppsService.getNotizen(),
        LivingAppsService.getMitglieder(),
        LivingAppsService.getSitzungen(),
        LivingAppsService.getTagesordnungspunkte(),
        LivingAppsService.getProtokolle(),
      ]);
      setMitgliederList(mitgliederData);
      setSitzungenList(sitzungenData);
      setTagesordnungspunkteList(tagesordnungspunkteData);
      setProtokolleList(protokolleData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Notizen['fields']) {
    if (!record) return;
    await LivingAppsService.updateNotizenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteNotizenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/notizen');
  }

  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  function getSitzungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return sitzungenList.find(r => r.record_id === refId)?.fields.titel ?? '—';
  }

  function getTagesordnungspunkteDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return tagesordnungspunkteList.find(r => r.record_id === refId)?.fields.punkt_titel ?? '—';
  }

  function getProtokolleDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return protokolleList.find(r => r.record_id === refId)?.fields.zusammenfassung ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/notizen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/notizen')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.titel ?? appLabel('notizen')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          ersteller: mitgliederList,
          sitzung: sitzungenList,
          tagesordnungspunkt: tagesordnungspunkteList,
          protokoll: protokolleList,
          mitglied: mitgliederList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('notizen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('notizen', 'notiztext')} value={record.fields.notiztext} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('notizen', 'datum')} value={record.fields.datum} format="date" />
        <RecordField label={fieldLabel('notizen', 'prioritaet')} value={record.fields.prioritaet} format="pill" />
        <RecordField label={fieldLabel('notizen', 'ersteller')} value={getMitgliederDisplayName(record.fields.ersteller)} format="text" />
        <RecordField label={fieldLabel('notizen', 'sitzung')} value={getSitzungenDisplayName(record.fields.sitzung)} format="text" />
        <RecordField label={fieldLabel('notizen', 'tagesordnungspunkt')} value={getTagesordnungspunkteDisplayName(record.fields.tagesordnungspunkt)} format="text" />
        <RecordField label={fieldLabel('notizen', 'protokoll')} value={getProtokolleDisplayName(record.fields.protokoll)} format="text" />
        <RecordField label={fieldLabel('notizen', 'mitglied')} value={getMitgliederDisplayName(record.fields.mitglied)} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.NOTIZEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <NotizenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        mitgliederList={mitgliederList}
        sitzungenList={sitzungenList}
        tagesordnungspunkteList={tagesordnungspunkteList}
        protokolleList={protokolleList}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('notizen') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
