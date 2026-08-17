import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Feedback, Tagesordnungspunkte, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { FeedbackDialog } from '@/components/dialogs/FeedbackDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Feedback';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagesordnungspunkteList, setTagesordnungspunkteList] = useState<Tagesordnungspunkte[]>([]);
  const [mitgliederList, setMitgliederList] = useState<Mitglieder[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, tagesordnungspunkteData, mitgliederData] = await Promise.all([
        LivingAppsService.getFeedback(),
        LivingAppsService.getTagesordnungspunkte(),
        LivingAppsService.getMitglieder(),
      ]);
      setTagesordnungspunkteList(tagesordnungspunkteData);
      setMitgliederList(mitgliederData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Feedback['fields']) {
    if (!record) return;
    await LivingAppsService.updateFeedbackEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteFeedbackEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/feedback');
  }

  function getTagesordnungspunkteDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return tagesordnungspunkteList.find(r => r.record_id === refId)?.fields.punkt_titel ?? '—';
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
          <Button variant="ghost" onClick={() => navigate('/feedback')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/feedback')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={appLabel('feedback')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          tagesordnungspunkt: tagesordnungspunkteList,
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
        <RecordField label={fieldLabel('feedback', 'tagesordnungspunkt')} value={getTagesordnungspunkteDisplayName(record.fields.tagesordnungspunkt)} format="text" />
        <RecordField label={fieldLabel('feedback', 'mitglied')} value={getMitgliederDisplayName(record.fields.mitglied)} format="text" />
        <RecordField label={fieldLabel('feedback', 'kategorie')} value={record.fields.kategorie} format="pill" />
        <RecordField label={fieldLabel('feedback', 'bewertung')} value={record.fields.bewertung} format="pill" />
        <RecordField label={fieldLabel('feedback', 'kommentar')} value={record.fields.kommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('feedback', 'datum')} value={record.fields.datum} format="date" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.FEEDBACK} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <FeedbackDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        tagesordnungspunkteList={tagesordnungspunkteList}
        mitgliederList={mitgliederList}
        enablePhotoScan={AI_PHOTO_SCAN['Feedback']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Feedback']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('feedback') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
