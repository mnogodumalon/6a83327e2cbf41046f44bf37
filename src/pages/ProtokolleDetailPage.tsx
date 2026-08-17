import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Protokolle, Sitzungen, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { ProtokolleDialog } from '@/components/dialogs/ProtokolleDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Protokolle';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function ProtokolleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Protokolle | null>(null);
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
        LivingAppsService.getProtokolle(),
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

  async function handleUpdate(fields: Protokolle['fields']) {
    if (!record) return;
    await LivingAppsService.updateProtokolleEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteProtokolleEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/protokolle');
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
          <Button variant="ghost" onClick={() => navigate('/protokolle')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/protokolle')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={appLabel('protokolle')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          sitzung: sitzungenList,
          protokollfuehrer: mitgliederList,
          anwesende_mitglieder: mitgliederList,
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
        <RecordField label={fieldLabel('protokolle', 'sitzung')} value={getSitzungenDisplayName(record.fields.sitzung)} format="text" />
        <RecordField label={fieldLabel('protokolle', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
        <RecordField label={fieldLabel('protokolle', 'protokollfuehrer')} value={getMitgliederDisplayName(record.fields.protokollfuehrer)} format="text" />
        <RecordField label={fieldLabel('protokolle', 'anwesende_mitglieder')} value={Array.isArray(record.fields.anwesende_mitglieder) ? record.fields.anwesende_mitglieder.map((u: unknown) => getMitgliederDisplayName(u)).join(', ') : null} format="text" />
        <RecordField label={fieldLabel('protokolle', 'zusammenfassung')} value={record.fields.zusammenfassung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('protokolle', 'beschluesse')} value={record.fields.beschluesse} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('protokolle', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PROTOKOLLE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <ProtokolleDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        sitzungenList={sitzungenList}
        mitgliederList={mitgliederList}
        enablePhotoScan={AI_PHOTO_SCAN['Protokolle']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Protokolle']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('protokolle') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
