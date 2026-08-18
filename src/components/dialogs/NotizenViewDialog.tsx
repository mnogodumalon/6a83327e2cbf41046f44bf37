import type { Notizen, Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface NotizenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Notizen | null;
  onEdit: (record: Notizen) => void;
  mitgliederList: Mitglieder[];
  sitzungenList: Sitzungen[];
  tagesordnungspunkteList: Tagesordnungspunkte[];
  protokolleList: Protokolle[];
}

export function NotizenViewDialog({ open, onClose, record, onEdit, mitgliederList, sitzungenList, tagesordnungspunkteList, protokolleList }: NotizenViewDialogProps) {
  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  function getSitzungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return sitzungenList.find(r => r.record_id === id)?.fields.titel ?? '—';
  }

  function getTagesordnungspunkteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return tagesordnungspunkteList.find(r => r.record_id === id)?.fields.punkt_titel ?? '—';
  }

  function getProtokolleDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return protokolleList.find(r => r.record_id === id)?.fields.zusammenfassung ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('notizen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'titel')}</Label>
            <p className="text-sm">{record.fields.titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'notiztext')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notiztext ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'datum')}</Label>
            <p className="text-sm">{formatDate(record.fields.datum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'prioritaet')}</Label>
            <Badge variant="secondary">{lookupLabel('notizen', 'prioritaet', record.fields.prioritaet?.key) ?? record.fields.prioritaet?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'ersteller')}</Label>
            <p className="text-sm">{getMitgliederDisplayName(record.fields.ersteller)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'sitzung')}</Label>
            <p className="text-sm">{getSitzungenDisplayName(record.fields.sitzung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'tagesordnungspunkt')}</Label>
            <p className="text-sm">{getTagesordnungspunkteDisplayName(record.fields.tagesordnungspunkt)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'protokoll')}</Label>
            <p className="text-sm">{getProtokolleDisplayName(record.fields.protokoll)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'mitglied')}</Label>
            <p className="text-sm">{getMitgliederDisplayName(record.fields.mitglied)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('notizen', 'anhang')}</Label>
            {record.fields.anhang ? (
              <MediaThumbnail src={record.fields.anhang} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.NOTIZEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}