import type { Feedback, Tagesordnungspunkte, Mitglieder } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface FeedbackViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Feedback | null;
  onEdit: (record: Feedback) => void;
  tagesordnungspunkteList: Tagesordnungspunkte[];
  mitgliederList: Mitglieder[];
}

export function FeedbackViewDialog({ open, onClose, record, onEdit, tagesordnungspunkteList, mitgliederList }: FeedbackViewDialogProps) {
  function getTagesordnungspunkteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return tagesordnungspunkteList.find(r => r.record_id === id)?.fields.punkt_titel ?? '—';
  }

  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('feedback') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'tagesordnungspunkt')}</Label>
            <p className="text-sm">{getTagesordnungspunkteDisplayName(record.fields.tagesordnungspunkt)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'mitglied')}</Label>
            <p className="text-sm">{getMitgliederDisplayName(record.fields.mitglied)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'kategorie')}</Label>
            <Badge variant="secondary">{lookupLabel('feedback', 'kategorie', record.fields.kategorie?.key) ?? record.fields.kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'bewertung')}</Label>
            <Badge variant="secondary">{lookupLabel('feedback', 'bewertung', record.fields.bewertung?.key) ?? record.fields.bewertung?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'kommentar')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.kommentar ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('feedback', 'datum')}</Label>
            <p className="text-sm">{formatDate(record.fields.datum)}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.FEEDBACK} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}