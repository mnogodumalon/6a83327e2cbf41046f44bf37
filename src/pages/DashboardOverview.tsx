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
import { extractRecordId } from '@/services/livingAppsService';
import { useState, useMemo } from 'react';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import {
  IconCalendar,
  IconUsers,
  IconFileText,
  IconAlertCircle,
  IconPlus,
  IconMail,
  IconNote,
  IconClipboardList,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    mitglieder, sitzungen, tagesordnungspunkte, protokolle, notizen,
    setSitzungen,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'sitzungen') {
        const s = sitzungen.find(x => x.record_id === top.record.record_id);
        const einladungKey = lookupKey(s?.fields.einladungsstatus);
        if (einladungKey === 'entwurf') {
          return {
            label: tx('Einladung als versandt markieren'),
            onClick: () => handleMarkVersandt(top.record.record_id),
          };
        }
      }
      if (top.type === 'protokolle') {
        const p = protokolle.find(x => x.record_id === top.record.record_id);
        const statusKey = lookupKey(p?.fields.status);
        if (statusKey === 'entwurf') {
          return {
            label: tx('Protokoll freigeben'),
            onClick: () => handleFreigebenProtokoll(top.record.record_id),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedSitzungen = crud.enriched.sitzungen;
  const enrichedProtokolle = crud.enriched.protokolle;
  const enrichedNotizen = crud.enriched.notizen;

  const clock = useClock();
  const [sitzungFilter, setSitzungFilter] = useState<'alle' | 'naechste' | 'ohne-protokoll'>('alle');

  // ─── Derivations ───────────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');
  const todayDate = startOfDay(clock);

  // Aktive Mitglieder
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder]
  );

  // Kommende Sitzungen (ab heute)
  const kommendeSitzungen = useMemo(
    () =>
      sitzungen
        .filter(s => s.fields.datum_uhrzeit && s.fields.datum_uhrzeit >= today)
        .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [sitzungen, today]
  );

  // Sitzungen ohne Protokoll
  const sitzungenOhneProtokoll = useMemo(() => {
    const sitzungIdsWithProtokoll = new Set(
      protokolle
        .map(p => extractRecordId(p.fields.sitzung))
        .filter(Boolean) as string[]
    );
    return sitzungen.filter(
      s =>
        s.fields.datum_uhrzeit &&
        s.fields.datum_uhrzeit < today &&
        !sitzungIdsWithProtokoll.has(s.record_id)
    );
  }, [sitzungen, protokolle, today]);

  // Einladungen im Entwurf-Status
  const entwurfEinladungen = useMemo(
    () =>
      sitzungen.filter(
        s =>
          s.fields.datum_uhrzeit &&
          s.fields.datum_uhrzeit >= today &&
          lookupKey(s.fields.einladungsstatus) === 'entwurf'
      ),
    [sitzungen, today]
  );

  // Protokolle im Entwurf
  const entwurfProtokolle = useMemo(
    () => protokolle.filter(p => lookupKey(p.fields.status) === 'entwurf'),
    [protokolle]
  );

  // Hochprioritäre Notizen
  const hochprioNotizen = useMemo(
    () =>
      enrichedNotizen
        .filter(n => lookupKey(n.fields.prioritaet) === 'hoch')
        .sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? '')),
    [enrichedNotizen]
  );

  // CalendarEvents aus Sitzungen bauen
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const filtered =
      sitzungFilter === 'ohne-protokoll'
        ? sitzungenOhneProtokoll
        : sitzungFilter === 'naechste'
        ? kommendeSitzungen.slice(0, 10)
        : sitzungen;

    return filtered
      .filter(s => s.fields.datum_uhrzeit)
      .map(s => {
        const artKey = lookupKey(s.fields.art);
        const tone: CalendarEvent['tone'] =
          artKey === 'ausserordentlich'
            ? 'warning'
            : artKey === 'klausur'
            ? 'primary'
            : 'default';
        const einladungsKey = lookupKey(s.fields.einladungsstatus);
        return {
          id: s.record_id,
          start: s.fields.datum_uhrzeit!,
          title: s.fields.titel ?? tx('Sitzung'),
          subtitle: s.fields.ort ?? undefined,
          tone: einladungsKey === 'entwurf' ? 'warning' : tone,
        };
      });
  }, [sitzungen, sitzungFilter, kommendeSitzungen, sitzungenOhneProtokoll]);

  // ─── Handler ──────────────────────────────────────────────────────────────

  async function handleMarkVersandt(sitzungId: string) {
    const prev = [...sitzungen];
    setSitzungen(curr =>
      curr.map(s =>
        s.record_id === sitzungId
          ? { ...s, fields: { ...s.fields, einladungsstatus: { key: 'versandt', label: tx('Versandt') } } }
          : s
      )
    );
    undoToast(tx('Einladungsstatus auf "Versandt" gesetzt'), async () => {
      setSitzungen(prev);
      await LivingAppsService.updateSitzungenEntry(sitzungId, { einladungsstatus: 'entwurf' });
    });
    try {
      await LivingAppsService.updateSitzungenEntry(sitzungId, { einladungsstatus: 'versandt' });
    } catch {
      setSitzungen(prev);
      fetchAll();
    }
  }

  async function handleFreigebenProtokoll(protokollId: string) {
    const prevProtokolle = [...protokolle];
    undoToast(tx('Protokoll freigegeben'), async () => {
      await LivingAppsService.updateProtokolleEntry(protokollId, { status: 'entwurf' });
      fetchAll();
    });
    try {
      await LivingAppsService.updateProtokolleEntry(protokollId, { status: 'freigegeben' });
      fetchAll();
    } catch {
      void prevProtokolle;
      fetchAll();
    }
  }

  // ─── Early returns (hooks above!) ─────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Kontext-Satz ─────────────────────────────────────────────────────────
  const kontextSatz = (() => {
    if (kommendeSitzungen.length === 0) {
      return tx('Noch keine Sitzungen geplant — plane jetzt die erste.');
    }
    const naechste = kommendeSitzungen[0];
    const naechsteName = naechste.fields.titel ?? tx('Sitzung');
    const naechstesDatum = formatDateTime(naechste.fields.datum_uhrzeit);
    if (entwurfEinladungen.length > 0) {
      return tx`${namen(entwurfEinladungen.map(s => s.fields.titel ?? ''))} — Einladung noch nicht versandt. Nächste: ${naechsteName} am ${naechstesDatum}.`;
    }
    return tx`Nächste Sitzung: ${naechsteName} am ${naechstesDatum}.`;
  })();

  // ─── Hero: unversandte Einladungen ────────────────────────────────────────
  const firstEntwurf = entwurfEinladungen[0];

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground truncate">{kontextSatz}</p>
        </div>
        <button
          onClick={() => crud.sitzungen.openCreate({ datum_uhrzeit: format(clock, "yyyy-MM-dd'T'HH:mm") })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          <span>{tx('Neue Sitzung')}</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          firstEntwurf ? (
            <HeroBanner
              icon={<IconMail size={18} />}
              action={{
                label: tx('Als versandt markieren'),
                onClick: () => handleMarkVersandt(firstEntwurf.record_id),
              }}
            >
              {entwurfEinladungen.length === 1
                ? tx`Einladung für „${firstEntwurf.fields.titel ?? ''}" noch nicht versandt.`
                : tx`${entwurfEinladungen.length} Einladungen noch nicht versandt.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={appLabel('sitzungen')}
              value={kommendeSitzungen.length}
              icon={<IconCalendar size={16} />}
              tone={kommendeSitzungen.length > 0 ? 'primary' : 'default'}
              onClick={() => setSitzungFilter(f => f === 'naechste' ? 'alle' : 'naechste')}
              active={sitzungFilter === 'naechste'}
            />
            <StatStripItem
              title={tx('Ohne Protokoll')}
              value={sitzungenOhneProtokoll.length}
              icon={<IconFileText size={16} />}
              tone={sitzungenOhneProtokoll.length > 0 ? 'warning' : 'default'}
              onClick={() => setSitzungFilter(f => f === 'ohne-protokoll' ? 'alle' : 'ohne-protokoll')}
              active={sitzungFilter === 'ohne-protokoll'}
            />
            <StatStripItem
              title={tx('Aktive Mitglieder')}
              value={aktiveMitglieder.length}
              icon={<IconUsers size={16} />}
            />
            <StatStripItem
              title={tx('Offene Protokoll-Entwürfe')}
              value={entwurfProtokolle.length}
              icon={<IconClipboardList size={16} />}
              tone={entwurfProtokolle.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="week"
            locale={dateFnsLocale()}
            weekDays={5}
            onEventClick={ev => {
              const s = sitzungen.find(x => x.record_id === ev.id);
              if (s) crud.sitzungen.openDetail(s);
            }}
            onEmptyClick={date => {
              crud.sitzungen.openCreate({
                datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Vergangene Sitzungen ohne Protokoll')}
              items={sitzungenOhneProtokoll.slice(0, 6).map(s => ({
                id: s.record_id,
                title: s.fields.titel ?? tx('Sitzung'),
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{formatDateTime(s.fields.datum_uhrzeit)}</span>
                    {s.fields.ort && (
                      <span className="text-muted-foreground"> · {s.fields.ort}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Protokoll erstellen'),
                  onClick: () =>
                    crud.protokolle.openCreate({ sitzung: s.record_id }),
                },
              }))}
              onItemClick={id => {
                const s = sitzungen.find(x => x.record_id === id);
                if (s) crud.sitzungen.openDetail(s);
              }}
              empty={{
                text: tx('Alle vergangenen Sitzungen haben ein Protokoll.'),
                action: {
                  label: tx('Neue Sitzung planen'),
                  onClick: () => crud.sitzungen.openCreate({}),
                },
              }}
            />
            <WorkList
              title={tx('Wichtige Notizen')}
              items={hochprioNotizen.slice(0, 5).map(n => ({
                id: n.record_id,
                title: n.fields.titel ?? tx('Notiz'),
                secondLine: (
                  <>
                    {n.erstellerName && (
                      <span className="font-medium text-foreground">{n.erstellerName}</span>
                    )}
                    {n.fields.datum && (
                      <span className="text-muted-foreground"> · {formatDate(n.fields.datum)}</span>
                    )}
                    {n.sitzungName && (
                      <span className="text-muted-foreground"> · {n.sitzungName}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Anzeigen'),
                  onClick: () => crud.notizen.openDetail(n),
                },
              }))}
              onItemClick={id => {
                const n = enrichedNotizen.find(x => x.record_id === id);
                if (n) crud.notizen.openDetail(n);
              }}
              empty={{
                text: tx('Keine wichtigen Notizen vorhanden.'),
                action: {
                  label: tx('Neue Notiz'),
                  onClick: () => crud.notizen.openCreate({ prioritaet: 'hoch' }),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
