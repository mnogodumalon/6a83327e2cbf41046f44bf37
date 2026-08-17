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
import type { CalendarEvent } from '@/components/widgets/CalendarWidget';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatDateTime, lookupKey } from '@/lib/formatters';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupOption } from '@/types/app';
import {
  IconCalendarEvent,
  IconUsers,
  IconFileDescription,
  IconMessage,
  IconAlertTriangle,
  IconCheck,
  IconMailForward,
  IconNote,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    sitzungen, mitglieder, protokolle, notizen, feedback,
    loading, error, fetchAll, setSitzungen, setProtokolle,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'sitzungen') {
        const s = top.record;
        const status = lookupKey(s.fields.einladungsstatus);
        if (status === 'entwurf') {
          return {
            label: tx('Einladung versenden'),
            onClick: () => handleSendInvitation(s),
          };
        }
      }
      if (top.type === 'protokolle') {
        const p = top.record;
        const status = lookupKey(p.fields.status);
        if (status === 'entwurf') {
          return {
            label: tx('Protokoll freigeben'),
            onClick: () => handleReleaseProtokoll(p),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedSitzungen = crud.enriched.sitzungen;
  const enrichedProtokolle = crud.enriched.protokolle;
  const enrichedNotizen = crud.enriched.notizen;
  const enrichedFeedback = crud.enriched.feedback;

  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Calendar events — useMemo must be ABOVE early returns
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const filtered = filterStatus
      ? enrichedSitzungen.filter(s => lookupKey(s.fields.einladungsstatus) === filterStatus)
      : enrichedSitzungen;
    return filtered
      .filter(s => s.fields.datum_uhrzeit)
      .map(s => {
        const status = lookupKey(s.fields.einladungsstatus);
        const tone: CalendarEvent['tone'] = status === 'abgeschlossen' ? 'success'
          : status === 'versandt' ? 'primary'
          : 'warning';
        return {
          id: s.record_id,
          start: s.fields.datum_uhrzeit!,
          title: s.fields.titel ?? tx('Sitzung'),
          subtitle: s.fields.ort,
          tone,
        };
      });
  }, [enrichedSitzungen, filterStatus]);

  // ── All hooks above this line ──────────────────────────────────────────────

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Plain derivations below ────────────────────────────────────────────────

  const today = startOfDay(clock);
  const todayStr = format(clock, 'yyyy-MM-dd');

  // Upcoming sessions (future or today)
  const upcomingSitzungen = enrichedSitzungen
    .filter(s => s.fields.datum_uhrzeit && !isBefore(parseISO(s.fields.datum_uhrzeit), today))
    .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''));

  // Past sessions
  const pastSitzungen = enrichedSitzungen
    .filter(s => s.fields.datum_uhrzeit && isBefore(parseISO(s.fields.datum_uhrzeit), today))
    .sort((a, b) => (b.fields.datum_uhrzeit ?? '').localeCompare(a.fields.datum_uhrzeit ?? ''));

  // Sessions without sent invitations (entwurf)
  const pendingInvitations = enrichedSitzungen.filter(s =>
    lookupKey(s.fields.einladungsstatus) === 'entwurf' &&
    s.fields.datum_uhrzeit &&
    !isBefore(parseISO(s.fields.datum_uhrzeit), today)
  );

  // Protocols in draft status
  const draftProtokolle = enrichedProtokolle.filter(p =>
    lookupKey(p.fields.status) === 'entwurf'
  );

  // Released protocols
  const releasedProtokolle = enrichedProtokolle.filter(p =>
    lookupKey(p.fields.status) === 'freigegeben'
  );

  // Active members
  const activeMembers = mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv');

  // Recent notes (last 7 days)
  const recentNotizen = enrichedNotizen
    .filter(n => n.fields.datum && !isBefore(parseISO(n.fields.datum), addDays(today, -7)))
    .sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''));

  // Context line
  const nextSession = upcomingSitzungen[0];
  const contextLine = (() => {
    if (enrichedSitzungen.length === 0) {
      return tx('Noch keine Sitzungen geplant. Lege die erste an!');
    }
    if (nextSession) {
      const memberNames = activeMembers.slice(0, 3).map(m =>
        [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ')
      );
      return tx`Nächste Sitzung: ${nextSession.fields.titel ?? ''} am ${formatDateTime(nextSession.fields.datum_uhrzeit)} — ${namen(memberNames)} und weitere Mitglieder.`;
    }
    return tx`${activeMembers.length} aktive Mitglieder im Gremium.`;
  })();

  // Send invitation handler
  async function handleSendInvitation(sitzung: typeof enrichedSitzungen[0]) {
    const prev = sitzungen.find(s => s.record_id === sitzung.record_id);
    const optimistic = lookupOption('sitzungen', 'einladungsstatus', 'versandt');
    setSitzungen(prev =>
      prev.map(s => s.record_id === sitzung.record_id
        ? { ...s, fields: { ...s.fields, einladungsstatus: optimistic } }
        : s
      )
    );
    try {
      await LivingAppsService.updateSitzungenEntry(sitzung.record_id, {
        einladungsstatus: 'versandt',
      });
      undoToast(
        tx`Einladung für ${sitzung.fields.titel ?? ''} versandt`,
        async () => {
          setSitzungen(prev =>
            prev.map(s => s.record_id === sitzung.record_id
              ? { ...s, fields: { ...s.fields, einladungsstatus: prev ? sitzungen.find(x => x.record_id === sitzung.record_id)?.fields.einladungsstatus : undefined } }
              : s
            )
          );
          await LivingAppsService.updateSitzungenEntry(sitzung.record_id, {
            einladungsstatus: prev?.fields.einladungsstatus ? lookupKey(prev.fields.einladungsstatus) : 'entwurf',
          });
        }
      );
    } catch {
      await fetchAll();
    }
  }

  // Release protocol handler
  async function handleReleaseProtokoll(protokoll: typeof enrichedProtokolle[0]) {
    const prev = protokolle.find(p => p.record_id === protokoll.record_id);
    const optimistic = lookupOption('protokolle', 'status', 'freigegeben');
    setProtokolle(prev =>
      prev.map(p => p.record_id === protokoll.record_id
        ? { ...p, fields: { ...p.fields, status: optimistic } }
        : p
      )
    );
    try {
      await LivingAppsService.updateProtokolleEntry(protokoll.record_id, {
        status: 'freigegeben',
      });
      undoToast(
        tx`Protokoll für ${protokoll.sitzungName ?? ''} freigegeben`,
        async () => {
          setProtokolle(prev =>
            prev.map(p => p.record_id === protokoll.record_id
              ? { ...p, fields: { ...p.fields, status: prev ? protokolle.find(x => x.record_id === protokoll.record_id)?.fields.status : undefined } }
              : p
            )
          );
          await LivingAppsService.updateProtokolleEntry(protokoll.record_id, {
            status: 'entwurf',
          });
        }
      );
    } catch {
      await fetchAll();
    }
  }

  // Hero: sessions with pending invitations
  const hero = pendingInvitations.length > 0 ? (
    <HeroBanner
      icon={<IconMailForward size={18} />}
      action={{
        label: tx('Einladung versenden'),
        onClick: () => handleSendInvitation(pendingInvitations[0]),
      }}
    >
      <b>{namen(pendingInvitations.map(s => s.fields.titel ?? ''))}</b>
      {' '}{tx('— Einladung noch nicht versandt.')}
    </HeroBanner>
  ) : undefined;

  // KPI strip
  const kpis = (
    <StatStrip>
      <StatStripItem
        title={appLabel('sitzungen')}
        value={upcomingSitzungen.length}
        icon={<IconCalendarEvent size={16} />}
        tone={upcomingSitzungen.length > 0 ? 'primary' : 'default'}
        onClick={() => setFilterStatus(f => f === null ? null : null)}
      />
      <StatStripItem
        title={tx('Einladungen offen')}
        value={pendingInvitations.length}
        icon={<IconMailForward size={16} />}
        tone={pendingInvitations.length > 0 ? 'warning' : 'default'}
        onClick={() => setFilterStatus(f => f === 'entwurf' ? null : 'entwurf')}
        active={filterStatus === 'entwurf'}
      />
      <StatStripItem
        title={appLabel('mitglieder')}
        value={activeMembers.length}
        icon={<IconUsers size={16} />}
        tone="default"
      />
      <StatStripItem
        title={tx('Protokolle im Entwurf')}
        value={draftProtokolle.length}
        icon={<IconFileDescription size={16} />}
        tone={draftProtokolle.length > 0 ? 'warning' : 'default'}
      />
      <StatStripItem
        title={tx('Feedback gesamt')}
        value={feedback.length}
        icon={<IconMessage size={16} />}
        tone="default"
      />
    </StatStrip>
  );

  // Primary surface: calendar
  const primary = (
    <CalendarWidget
      events={calendarEvents}
      defaultView="week"
      locale={dateFnsLocale()}
      onEventClick={(ev) => {
        const s = enrichedSitzungen.find(s => s.record_id === ev.id);
        if (s) crud.sitzungen.openDetail(s);
      }}
      onEmptyClick={(date) => {
        crud.sitzungen.openCreate({
          datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
        });
      }}
    />
  );

  // Aside: upcoming sessions worklist + protocols needing approval
  const aside = (
    <>
      <WorkList
        title={tx('Nächste Sitzungen')}
        items={upcomingSitzungen.slice(0, 5).map(s => ({
          id: s.record_id,
          title: s.fields.titel ?? tx('Sitzung'),
          secondLine: (
            <>
              <span className={
                lookupKey(s.fields.einladungsstatus) === 'versandt'
                  ? 'font-medium text-primary'
                  : lookupKey(s.fields.einladungsstatus) === 'abgeschlossen'
                  ? 'font-medium text-emerald-600'
                  : 'font-medium text-amber-600'
              }>
                {s.fields.einladungsstatus?.label ?? tx('Entwurf')}
              </span>
              <span className="text-muted-foreground"> · {formatDateTime(s.fields.datum_uhrzeit)}</span>
              {s.fields.ort && <span className="text-muted-foreground"> · {s.fields.ort}</span>}
            </>
          ),
          action: lookupKey(s.fields.einladungsstatus) === 'entwurf' ? {
            label: tx('Versenden'),
            onClick: () => handleSendInvitation(s),
          } : undefined,
        }))}
        onItemClick={(id) => {
          const s = enrichedSitzungen.find(s => s.record_id === id);
          if (s) crud.sitzungen.openDetail(s);
        }}
        empty={{
          text: tx('Keine kommenden Sitzungen — neue anlegen'),
          action: {
            label: tx('Sitzung anlegen'),
            onClick: () => crud.sitzungen.openCreate({}),
          },
        }}
      />

      <WorkList
        title={tx('Protokolle im Entwurf')}
        items={draftProtokolle.slice(0, 5).map(p => ({
          id: p.record_id,
          title: p.sitzungName || tx('Protokoll'),
          secondLine: (
            <>
              <span className="font-medium text-amber-600">{tx('Entwurf')}</span>
              <span className="text-muted-foreground"> · {formatDate(p.fields.erstellungsdatum)}</span>
              {p.protokollfuehrerName && (
                <span className="text-muted-foreground"> · {p.protokollfuehrerName}</span>
              )}
            </>
          ),
          action: {
            label: tx('Freigeben'),
            onClick: () => handleReleaseProtokoll(p),
          },
        }))}
        onItemClick={(id) => {
          const p = enrichedProtokolle.find(p => p.record_id === id);
          if (p) crud.protokolle.openDetail(p);
        }}
        empty={{
          text: releasedProtokolle.length > 0
            ? tx('Alle Protokolle freigegeben')
            : tx('Noch keine Protokolle — nach der Sitzung anlegen'),
          action: releasedProtokolle.length === 0 ? {
            label: tx('Protokoll anlegen'),
            onClick: () => crud.protokolle.openCreate({}),
          } : undefined,
        }}
      />
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {gruss(clock)}
        </h1>
        <p className="text-muted-foreground mt-1">{contextLine}</p>
      </div>

      <DashboardGrid
        variant="split"
        hero={hero}
        kpis={kpis}
        aside={aside}
        primary={primary}
      />

      {crud.surfaces}
    </div>
  );
}
