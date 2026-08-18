import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Sitzungen, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { SitzungenDialog } from '@/components/dialogs/SitzungenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Sitzungen';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function SitzungenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Sitzungen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mitgliederList, setMitgliederList] = useState<Mitglieder[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, mitgliederData] = await Promise.all([
        LivingAppsService.getSitzungen(),
        LivingAppsService.getMitglieder(),
      ]);
      setMitgliederList(mitgliederData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Sitzungen['fields']) {
    if (!record) return;
    await LivingAppsService.updateSitzungenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteSitzungenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/sitzungen');
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
          <Button variant="ghost" onClick={() => navigate('/sitzungen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/sitzungen')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.titel ?? appLabel('sitzungen')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          eingeladene_mitglieder: mitgliederList,
          angemeldete_mitglieder: mitgliederList,
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
        <RecordField label={fieldLabel('sitzungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'datum_uhrzeit')} value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label={fieldLabel('sitzungen', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'art')} value={record.fields.art} format="pill" />
        <RecordField label={fieldLabel('sitzungen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('sitzungen', 'anmeldefrist')} value={record.fields.anmeldefrist} format="datetime" />
        <RecordField label={fieldLabel('sitzungen', 'max_teilnehmer')} value={record.fields.max_teilnehmer} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'einlade_link')} value={record.fields.einlade_link} format="url" />
        <RecordField label={fieldLabel('sitzungen', 'einladungsstatus')} value={record.fields.einladungsstatus} format="pill" />
        <RecordField label={fieldLabel('sitzungen', 'eingeladene_mitglieder')} value={Array.isArray(record.fields.eingeladene_mitglieder) ? record.fields.eingeladene_mitglieder.map((u: unknown) => getMitgliederDisplayName(u)).join(', ') : null} format="text" />
        <RecordField label={fieldLabel('sitzungen', 'angemeldete_mitglieder')} value={Array.isArray(record.fields.angemeldete_mitglieder) ? record.fields.angemeldete_mitglieder.map((u: unknown) => getMitgliederDisplayName(u)).join(', ') : null} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.SITZUNGEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <SitzungenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        mitgliederList={mitgliederList}
        enablePhotoScan={AI_PHOTO_SCAN['Sitzungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Sitzungen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('sitzungen') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
