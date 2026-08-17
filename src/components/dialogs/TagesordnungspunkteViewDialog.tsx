import type { Tagesordnungspunkte, Sitzungen, Mitglieder } from '@/types/app';
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
import { t, appLabel, fieldLabel, lookupLabel } from '@/i18n';

interface TagesordnungspunkteViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Tagesordnungspunkte | null;
  onEdit: (record: Tagesordnungspunkte) => void;
  sitzungenList: Sitzungen[];
  mitgliederList: Mitglieder[];
}

export function TagesordnungspunkteViewDialog({ open, onClose, record, onEdit, sitzungenList, mitgliederList }: TagesordnungspunkteViewDialogProps) {
  function getSitzungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return sitzungenList.find(r => r.record_id === id)?.fields.titel ?? '—';
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
          <DialogTitle>{t('view_entity', { entity: appLabel('tagesordnungspunkte') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'sitzung')}</Label>
            <p className="text-sm">{getSitzungenDisplayName(record.fields.sitzung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'punkt_titel')}</Label>
            <p className="text-sm">{record.fields.punkt_titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'beschreibung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'reihenfolge')}</Label>
            <p className="text-sm">{record.fields.reihenfolge ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'dauer')}</Label>
            <p className="text-sm">{record.fields.dauer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'typ')}</Label>
            <Badge variant="secondary">{lookupLabel('tagesordnungspunkte', 'typ', record.fields.typ?.key) ?? record.fields.typ?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'referent')}</Label>
            <p className="text-sm">{getMitgliederDisplayName(record.fields.referent)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('tagesordnungspunkte', 'unterlagen')}</Label>
            {record.fields.unterlagen ? (
              <MediaThumbnail src={record.fields.unterlagen} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.TAGESORDNUNGSPUNKTE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}