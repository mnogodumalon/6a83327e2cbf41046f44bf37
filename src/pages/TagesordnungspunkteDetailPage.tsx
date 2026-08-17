import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Tagesordnungspunkte, Sitzungen, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { TagesordnungspunkteDialog } from '@/components/dialogs/TagesordnungspunkteDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Tagesordnungspunkte';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function TagesordnungspunkteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Tagesordnungspunkte | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sitzungenList, setSitzungenList] = useState<Sitzungen[]>([]);
  const [mitgliederList, setMitgliederList] = useState<Mitglieder[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, sitzungenData, mitgliederData] = await Promise.all([
        LivingAppsService.getTagesordnungspunkte(),
        LivingAppsService.getSitzungen(),
        LivingAppsService.getMitglieder(),
      ]);
      setSitzungenList(sitzungenData);
      setMitgliederList(mitgliederData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Tagesordnungspunkte['fields']) {
    if (!record) return;
    await LivingAppsService.updateTagesordnungspunkteEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteTagesordnungspunkteEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/tagesordnungspunkte');
  }

  function getSitzungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return sitzungenList.find(r => r.record_id === refId)?.fields.titel ?? '—';
  }

  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/tagesordnungspunkte')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/tagesordnungspunkte')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.punkt_titel ?? appLabel('tagesordnungspunkte')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          sitzung: sitzungenList,
          referent: mitgliederList,
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
        <RecordField label={fieldLabel('tagesordnungspunkte', 'sitzung')} value={getSitzungenDisplayName(record.fields.sitzung)} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'punkt_titel')} value={record.fields.punkt_titel} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'reihenfolge')} value={record.fields.reihenfolge} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'dauer')} value={record.fields.dauer} format="text" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'typ')} value={record.fields.typ} format="pill" />
        <RecordField label={fieldLabel('tagesordnungspunkte', 'referent')} value={getMitgliederDisplayName(record.fields.referent)} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.TAGESORDNUNGSPUNKTE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <TagesordnungspunkteDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        sitzungenList={sitzungenList}
        mitgliederList={mitgliederList}
        enablePhotoScan={AI_PHOTO_SCAN['Tagesordnungspunkte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Tagesordnungspunkte']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('tagesordnungspunkte') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
