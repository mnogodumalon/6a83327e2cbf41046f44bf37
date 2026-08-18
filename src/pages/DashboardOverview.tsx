import { useMemo, useState } from 'react';
import { format, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import type { CalendarEvent, CalendarTone } from '@/components/widgets/CalendarWidget';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatDateTime, lookupKey } from '@/lib/formatters';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import {
  IconCalendarEvent,
  IconSend,
  IconClipboardText,
  IconMessage,
  IconPlus,
  IconAlertTriangle,
  IconUsers,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    mitglieder, sitzungen, tagesordnungspunkte, protokolle, feedback, notizen,
    setSitzungen, setProtokolle,
    mitgliederMap, sitzungenMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'sitzungen') {
        const s = sitzungen.find(s => s.record_id === top.record.record_id);
        if (!s) return undefined;
        const einladungKey = lookupKey(s.fields.einladungsstatus);
        if (einladungKey === 'entwurf') {
          return {
            label: tx('Einladung versenden'),
            onClick: () => handleSendInvitation(s),
          };
        }
        if (einladungKey === 'versandt') {
          return {
            label: tx('Sitzung abschließen'),
            onClick: () => handleCloseSitzung(s),
          };
        }
      }
      if (top.type === 'protokolle') {
        const p = protokolle.find(p => p.record_id === top.record.record_id);
        if (!p) return undefined;
        const statusKey = lookupKey(p.fields.status);
        if (statusKey === 'entwurf') {
          return {
            label: tx('Protokoll freigeben'),
            onClick: () => handleFreigebenProtokoll(p),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedSitzungen = crud.enriched.sitzungen;
  const enrichedProtokolle = crud.enriched.protokolle;

  // ── Derived state for filters ──────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<'all' | 'entwurf' | 'versandt'>('all');

  const today = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  const naechsteSitzung = useMemo(() =>
    sitzungen
      .filter(s => s.fields.datum_uhrzeit && s.fields.datum_uhrzeit >= today)
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''))[0],
    [sitzungen, today]
  );

  const offeneEinladungen = useMemo(() =>
    sitzungen.filter(s => lookupKey(s.fields.einladungsstatus) === 'entwurf' &&
      s.fields.datum_uhrzeit && s.fields.datum_uhrzeit >= today),
    [sitzungen, today]
  );

  const entwurfProtokolle = useMemo(() =>
    protokolle.filter(p => lookupKey(p.fields.status) === 'entwurf'),
    [protokolle]
  );

  const aktiveMitglieder = useMemo(() =>
    mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder]
  );

  // ── CalendarWidget events ──────────────────────────────────────────────────
  const calendarEvents = useMemo((): CalendarEvent[] =>
    sitzungen
      .filter(s => !!s.fields.datum_uhrzeit)
      .map(s => {
        const einladungKey = lookupKey(s.fields.einladungsstatus);
        let tone: CalendarTone = 'default';
        if (einladungKey === 'entwurf') tone = 'warning';
        else if (einladungKey === 'versandt') tone = 'primary';
        else if (einladungKey === 'abgeschlossen') tone = 'success';
        return {
          id: `sitzung:${s.record_id}`,
          start: s.fields.datum_uhrzeit!,
          title: s.fields.titel ?? tx('Sitzung'),
          subtitle: s.fields.ort,
          tone,
        };
      }),
    [sitzungen]
  );

  // ── Aside: Einladungen ausstehend ──────────────────────────────────────────
  const filteredSitzungen = useMemo(() => {
    if (activeFilter === 'all') return enrichedSitzungen;
    return enrichedSitzungen.filter(s => lookupKey(s.fields.einladungsstatus) === activeFilter);
  }, [enrichedSitzungen, activeFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSendInvitation(s: typeof sitzungen[number]) {
    const prev = { ...s };
    const newStatus = lookupOption('sitzungen', 'einladungsstatus', 'versandt');
    setSitzungen(cur => cur.map(x => x.record_id === s.record_id
      ? { ...x, fields: { ...x.fields, einladungsstatus: newStatus } }
      : x
    ));
    undoToast(tx`${s.fields.titel ?? ''} — Einladung versandt`, async () => {
      setSitzungen(cur => cur.map(x => x.record_id === s.record_id ? prev : x));
      await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: 'entwurf' });
    });
    try {
      await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: 'versandt' });
    } catch {
      setSitzungen(cur => cur.map(x => x.record_id === s.record_id ? prev : x));
      await fetchAll();
    }
  }

  async function handleCloseSitzung(s: typeof sitzungen[number]) {
    const prev = { ...s };
    const newStatus = lookupOption('sitzungen', 'einladungsstatus', 'abgeschlossen');
    setSitzungen(cur => cur.map(x => x.record_id === s.record_id
      ? { ...x, fields: { ...x.fields, einladungsstatus: newStatus } }
      : x
    ));
    undoToast(tx`${s.fields.titel ?? ''} — abgeschlossen`, async () => {
      setSitzungen(cur => cur.map(x => x.record_id === s.record_id ? prev : x));
      await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: 'versandt' });
    });
    try {
      await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: 'abgeschlossen' });
    } catch {
      setSitzungen(cur => cur.map(x => x.record_id === s.record_id ? prev : x));
      await fetchAll();
    }
  }

  async function handleFreigebenProtokoll(p: typeof protokolle[number]) {
    const prev = { ...p };
    const newStatus = lookupOption('protokolle', 'status', 'freigegeben');
    setProtokolle(cur => cur.map(x => x.record_id === p.record_id
      ? { ...x, fields: { ...x.fields, status: newStatus } }
      : x
    ));
    const sName = p.fields.sitzung
      ? sitzungenMap.get(p.fields.sitzung.split('/').pop() ?? '')?.fields.titel ?? ''
      : '';
    undoToast(tx`${sName} — Protokoll freigegeben`, async () => {
      setProtokolle(cur => cur.map(x => x.record_id === p.record_id ? prev : x));
      await LivingAppsService.updateProtokolleEntry(p.record_id, { status: 'entwurf' });
    });
    try {
      await LivingAppsService.updateProtokolleEntry(p.record_id, { status: 'freigegeben' });
    } catch {
      setProtokolle(cur => cur.map(x => x.record_id === p.record_id ? prev : x));
      await fetchAll();
    }
  }

  // ── Hooks MUST be above early returns ──────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Computed context line ──────────────────────────────────────────────────
  const sitzungenThisWeek = sitzungen.filter(s => {
    if (!s.fields.datum_uhrzeit) return false;
    const d = s.fields.datum_uhrzeit;
    const weekEnd = format(addDays(clock, 7), 'yyyy-MM-dd');
    return d >= today && d <= weekEnd;
  });

  const naechsteNames = naechsteSitzung
    ? (naechsteSitzung.fields.titel ?? tx('Sitzung'))
    : null;

  const contextLine = sitzungen.length === 0
    ? tx('Noch keine Sitzungen angelegt — leg jetzt die erste an.')
    : naechsteSitzung
      ? tx`Nächste Sitzung: ${naechsteNames ?? ''} am ${formatDateTime(naechsteSitzung.fields.datum_uhrzeit)}.`
      : tx('Alle Sitzungen liegen in der Vergangenheit.');

  // ── Empty state ────────────────────────────────────────────────────────────
  if (sitzungen.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <IconCalendarEvent size={48} className="text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">{tx('Keine Sitzungen vorhanden')}</p>
            <p className="text-muted-foreground text-sm mt-1">{tx('Lege die erste Gremiumssitzung an, um loszulegen.')}</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => crud.sitzungen.openCreate({})}
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Erste Sitzung anlegen')}
          </button>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  // ── Hero: offene Einladungen ───────────────────────────────────────────────
  const hero = offeneEinladungen.length > 0 ? (
    <HeroBanner
      icon={<IconSend size={18} />}
      action={{
        label: tx('Einladung versenden'),
        onClick: () => handleSendInvitation(offeneEinladungen[0]),
      }}
    >
      <b>{namen(offeneEinladungen.map(s => s.fields.titel ?? ''))}</b>{' '}
      {offeneEinladungen.length === 1
        ? tx('— Einladung noch nicht versandt.')
        : tx('— Einladungen noch nicht versandt.')}
    </HeroBanner>
  ) : undefined;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const artOptions = LOOKUP_OPTIONS['sitzungen']?.['einladungsstatus'] ?? [];

  const kpis = (
    <StatStrip>
      <StatStripItem
        title={appLabel('sitzungen')}
        value={sitzungenThisWeek.length}
        icon={<IconCalendarEvent size={16} />}
        tone={sitzungenThisWeek.length > 0 ? 'primary' : 'default'}
        onClick={() => setActiveFilter(f => f === 'all' ? 'all' : 'all')}
      />
      <StatStripItem
        title={tx('Einladungen ausstehend')}
        value={offeneEinladungen.length}
        icon={<IconSend size={16} />}
        tone={offeneEinladungen.length > 0 ? 'warning' : 'default'}
        onClick={() => setActiveFilter(f => f === 'entwurf' ? 'all' : 'entwurf')}
        active={activeFilter === 'entwurf'}
      />
      <StatStripItem
        title={tx('Protokolle im Entwurf')}
        value={entwurfProtokolle.length}
        icon={<IconClipboardText size={16} />}
        tone={entwurfProtokolle.length > 0 ? 'warning' : 'default'}
      />
      <StatStripItem
        title={tx('Aktive Mitglieder')}
        value={aktiveMitglieder.length}
        icon={<IconUsers size={16} />}
        tone="default"
      />
      <StatStripItem
        title={tx('Feedback-Einträge')}
        value={feedback.length}
        icon={<IconMessage size={16} />}
        tone="default"
      />
    </StatStrip>
  );

  // ── Aside: Einladungen + Protokolle ausstehend ────────────────────────────
  const workListEinladungen = (
    <WorkList
      title={tx('Einladungen versenden')}
      items={enrichedSitzungen
        .filter(s => lookupKey(s.fields.einladungsstatus) === 'entwurf' && s.fields.datum_uhrzeit && s.fields.datum_uhrzeit >= today)
        .slice(0, 6)
        .map(s => ({
          id: s.record_id,
          title: s.fields.titel ?? tx('Sitzung'),
          secondLine: (
            <>
              <span className="text-amber-600 font-medium">{tx('Entwurf')}</span>
              {s.fields.datum_uhrzeit && (
                <span className="text-muted-foreground"> · {formatDateTime(s.fields.datum_uhrzeit)}</span>
              )}
            </>
          ),
          action: {
            label: tx('Versenden'),
            onClick: () => handleSendInvitation(s),
          },
        }))}
      onItemClick={id => {
        const s = sitzungen.find(x => x.record_id === id);
        if (s) crud.sitzungen.openDetail(s);
      }}
      empty={{
        text: naechsteSitzung
          ? tx`Alle Einladungen versandt — nächste Sitzung: ${naechsteSitzung.fields.titel ?? ''}`
          : tx('Alle Einladungen versandt.'),
        action: { label: tx('Neue Sitzung'), onClick: () => crud.sitzungen.openCreate({}) },
      }}
    />
  );

  const workListProtokolle = (
    <WorkList
      title={tx('Protokolle zur Freigabe')}
      items={enrichedProtokolle
        .filter(p => lookupKey(p.fields.status) === 'entwurf')
        .slice(0, 5)
        .map(p => ({
          id: p.record_id,
          title: p.sitzungName || tx('Sitzung'),
          secondLine: (
            <>
              <span className="text-amber-600 font-medium">{tx('Entwurf')}</span>
              {p.fields.erstellungsdatum && (
                <span className="text-muted-foreground"> · {formatDate(p.fields.erstellungsdatum)}</span>
              )}
              {p.protokollfuehrerName && (
                <span className="text-muted-foreground"> · {p.protokollfuehrerName}</span>
              )}
            </>
          ),
          action: {
            label: tx('Freigeben'),
            onClick: () => handleFreigebenProtokoll(protokolle.find(x => x.record_id === p.record_id)!),
          },
        }))}
      onItemClick={id => {
        const p = protokolle.find(x => x.record_id === id);
        if (p) crud.protokolle.openDetail(p);
      }}
      empty={{
        text: tx('Alle Protokolle sind freigegeben.'),
        action: {
          label: tx('Protokoll erstellen'),
          onClick: () => crud.protokolle.openCreate({}),
        },
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => crud.sitzungen.openCreate({})}
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">{tx('Neue Sitzung')}</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={kpis}
        aside={<>{workListEinladungen}{workListProtokolle}</>}
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="month"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const id = ev.id.split(':')[1] ?? '';
              const s = sitzungen.find(x => x.record_id === id);
              if (s) crud.sitzungen.openDetail(s);
            }}
            onEmptyClick={date => {
              crud.sitzungen.openCreate({
                datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
              });
            }}
          />
        }
      />

      {crud.surfaces}
    </div>
  );
}
