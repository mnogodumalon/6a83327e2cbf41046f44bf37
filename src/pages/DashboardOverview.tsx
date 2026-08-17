import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { formatDate, formatDateTime, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, lookupOption } from '@/types/app';
import {
  IconCalendarEvent,
  IconUsers,
  IconFileText,
  IconSend,
  IconAlertTriangle,
  IconPlus,
  IconCheck,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    sitzungen, setSitzungen, tagesordnungspunkte, protokolle,
    mitglieder, notizen, feedback,
    sitzungenMap, protokolleMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'protokolle') {
        const p = protokolle.find(p => p.record_id === top.record.record_id);
        if (p && lookupKey(p.fields.status) === 'entwurf') {
          return {
            label: tx('Protokoll freigeben'),
            onClick: async () => {
              const prev = { ...p.fields };
              setSitzungen(s => s); // trigger render
              try {
                await LivingAppsService.updateProtokolleEntry(p.record_id, { status: 'freigegeben' });
                undoToast(tx('Protokoll freigegeben'), async () => {
                  await LivingAppsService.updateProtokolleEntry(p.record_id, { status: (lookupKey(prev.status) ?? 'entwurf') });
                  fetchAll();
                });
                fetchAll();
              } catch { fetchAll(); }
            },
          };
        }
      }
      if (top.type === 'sitzungen') {
        const s = sitzungen.find(s => s.record_id === top.record.record_id);
        if (s && lookupKey(s.fields.einladungsstatus) === 'entwurf') {
          return {
            label: tx('Einladung versenden'),
            onClick: async () => {
              const prev = lookupKey(s.fields.einladungsstatus) ?? 'entwurf';
              setSitzungen(all => all.map(x =>
                x.record_id === s.record_id
                  ? { ...x, fields: { ...x.fields, einladungsstatus: lookupOption('sitzungen', 'einladungsstatus', 'versandt') } }
                  : x
              ));
              try {
                await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: 'versandt' });
                undoToast(tx`Einladung für "${s.fields.titel}" versandt`, async () => {
                  setSitzungen(all => all.map(x =>
                    x.record_id === s.record_id
                      ? { ...x, fields: { ...x.fields, einladungsstatus: lookupOption('sitzungen', 'einladungsstatus', prev) } }
                      : x
                  ));
                  await LivingAppsService.updateSitzungenEntry(s.record_id, { einladungsstatus: prev });
                });
              } catch { fetchAll(); }
            },
          };
        }
      }
      return undefined;
    },
  });

  const enrichedSitzungen = crud.enriched.sitzungen;
  const enrichedProtokolle = crud.enriched.protokolle;
  const enrichedNotizen = crud.enriched.notizen;

  const [filter, setFilter] = useState<'all' | 'einladung' | 'protokoll'>('all');

  // All hooks must be before early returns
  const today = useMemo(() => startOfDay(clock), [clock]);
  const todayKey = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  const upcomingSitzungen = useMemo(
    () => enrichedSitzungen
      .filter(s => s.fields.datum_uhrzeit && !isBefore(parseISO(s.fields.datum_uhrzeit), today))
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? '')),
    [enrichedSitzungen, today]
  );

  const sitzungenEntwurf = useMemo(
    () => enrichedSitzungen.filter(s => lookupKey(s.fields.einladungsstatus) === 'entwurf' && s.fields.datum_uhrzeit && !isBefore(parseISO(s.fields.datum_uhrzeit), today)),
    [enrichedSitzungen, today]
  );

  const protokolleEntwurf = useMemo(
    () => enrichedProtokolle.filter(p => lookupKey(p.fields.status) === 'entwurf'),
    [enrichedProtokolle]
  );

  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder]
  );

  const naechsteSitzung = useMemo(() => upcomingSitzungen[0], [upcomingSitzungen]);

  const calendarEvents = useMemo<CalendarEvent[]>(
    () => enrichedSitzungen
      .filter(s => !!s.fields.datum_uhrzeit)
      .map(s => {
        const statusKey = lookupKey(s.fields.einladungsstatus);
        const tone: CalendarTone =
          statusKey === 'versandt' ? 'success'
          : statusKey === 'abgeschlossen' ? 'default'
          : 'warning';
        return {
          id: `sitzung:${s.record_id}`,
          start: s.fields.datum_uhrzeit!,
          allDay: false,
          title: s.fields.titel ?? tx('Sitzung'),
          subtitle: s.fields.ort ? s.fields.ort : (s.fields.art?.label ?? ''),
          tone,
        };
      }),
    [enrichedSitzungen]
  );

  const sendEinladung = useCallback(async (sitzungId: string) => {
    const s = sitzungen.find(x => x.record_id === sitzungId);
    if (!s) return;
    const prev = lookupKey(s.fields.einladungsstatus) ?? 'entwurf';
    setSitzungen(all => all.map(x =>
      x.record_id === sitzungId
        ? { ...x, fields: { ...x.fields, einladungsstatus: lookupOption('sitzungen', 'einladungsstatus', 'versandt') } }
        : x
    ));
    try {
      await LivingAppsService.updateSitzungenEntry(sitzungId, { einladungsstatus: 'versandt' });
      const titel = s.fields.titel ?? '';
      undoToast(tx`Einladung für "${titel}" versandt`, async () => {
        setSitzungen(all => all.map(x =>
          x.record_id === sitzungId
            ? { ...x, fields: { ...x.fields, einladungsstatus: lookupOption('sitzungen', 'einladungsstatus', prev) } }
            : x
        ));
        await LivingAppsService.updateSitzungenEntry(sitzungId, { einladungsstatus: prev });
      });
    } catch { fetchAll(); }
  }, [sitzungen, setSitzungen, fetchAll]);

  const recentNotizen = useMemo(
    () => [...enrichedNotizen]
      .sort((a, b) => (b.fields.datum ?? b.createdat).localeCompare(a.fields.datum ?? a.createdat))
      .slice(0, 5),
    [enrichedNotizen]
  );

  const filteredSitzungen = useMemo(() => {
    if (filter === 'einladung') return upcomingSitzungen.filter(s => lookupKey(s.fields.einladungsstatus) === 'entwurf');
    if (filter === 'protokoll') {
      const sitzungIdsWithEntwurf = new Set(protokolleEntwurf.map(p => extractRecordId(p.fields.sitzung)).filter(Boolean));
      return upcomingSitzungen.filter(s => sitzungIdsWithEntwurf.has(s.record_id) || protokolleEntwurf.some(p => extractRecordId(p.fields.sitzung) === s.record_id));
    }
    return upcomingSitzungen;
  }, [filter, upcomingSitzungen, protokolleEntwurf]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Plain derivations below ───

  const contextLine = naechsteSitzung
    ? naechsteSitzung.fields.datum_uhrzeit
      ? tx`Nächste Sitzung: ${naechsteSitzung.fields.titel ?? ''} am ${formatDateTime(naechsteSitzung.fields.datum_uhrzeit)}`
      : tx`Nächste Sitzung: ${naechsteSitzung.fields.titel ?? ''}`
    : sitzungen.length === 0
      ? tx('Noch keine Sitzungen geplant — leg die erste an.')
      : tx('Alle Sitzungen liegen in der Vergangenheit.');

  const hasUrgentEinladung = sitzungenEntwurf.length > 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-1">{contextLine}</p>
          </div>
          <button
            onClick={() => crud.sitzungen.openCreate({ einladungsstatus: 'entwurf' })}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Neue Sitzung')}
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hasUrgentEinladung ? (
          <HeroBanner
            icon={<IconSend size={18} />}
            action={{
              label: tx('Einladung versenden'),
              onClick: () => sendEinladung(sitzungenEntwurf[0].record_id),
            }}
          >
            {sitzungenEntwurf.length === 1
              ? tx`Einladung für "${sitzungenEntwurf[0].fields.titel ?? ''}" noch nicht versandt.`
              : tx`${sitzungenEntwurf.length} Sitzungen warten auf den Einladungsversand — zuerst: ${sitzungenEntwurf[0].fields.titel ?? ''}.`
            }
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={appLabel('sitzungen')}
              value={upcomingSitzungen.length}
              icon={<IconCalendarEvent size={16} className="shrink-0" />}
              tone="default"
              onClick={() => setFilter(f => f === 'all' ? 'all' : 'all')}
            />
            <StatStripItem
              title={tx('Einladungen ausstehend')}
              value={sitzungenEntwurf.length}
              icon={<IconSend size={16} className="shrink-0" />}
              tone={sitzungenEntwurf.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'einladung' ? 'all' : 'einladung')}
              active={filter === 'einladung'}
            />
            <StatStripItem
              title={tx('Protokolle im Entwurf')}
              value={protokolleEntwurf.length}
              icon={<IconFileText size={16} className="shrink-0" />}
              tone={protokolleEntwurf.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'protokoll' ? 'all' : 'protokoll')}
              active={filter === 'protokoll'}
            />
            <StatStripItem
              title={tx('Aktive Mitglieder')}
              value={aktiveMitglieder.length}
              icon={<IconUsers size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calendarEvents}
            defaultView="month"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1];
              if (!rid) return;
              const s = sitzungen.find(x => x.record_id === rid);
              if (s) crud.sitzungen.openDetail(s);
            }}
            onEmptyClick={(date) => {
              crud.sitzungen.openCreate({
                datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
                einladungsstatus: 'entwurf',
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Einladungen versenden')}
              items={sitzungenEntwurf.slice(0, 6).map(s => ({
                id: s.record_id,
                title: s.fields.titel ?? tx('Sitzung'),
                secondLine: (
                  <span className="text-muted-foreground text-xs">
                    {s.fields.datum_uhrzeit ? formatDateTime(s.fields.datum_uhrzeit) : '—'}
                    {s.fields.ort ? ` · ${s.fields.ort}` : ''}
                  </span>
                ),
                action: {
                  label: tx('Versenden'),
                  onClick: () => sendEinladung(s.record_id),
                },
              }))}
              onItemClick={id => {
                const s = sitzungen.find(x => x.record_id === id);
                if (s) crud.sitzungen.openDetail(s);
              }}
              empty={{
                text: tx('Alle Einladungen sind versandt.'),
                action: { label: tx('Neue Sitzung'), onClick: () => crud.sitzungen.openCreate({ einladungsstatus: 'entwurf' }) },
              }}
            />
            <WorkList
              title={tx('Protokolle freigeben')}
              items={protokolleEntwurf.slice(0, 6).map(p => {
                const sitzungTitel = p.sitzungName || (p.fields.sitzung ? formatDate(p.fields.erstellungsdatum) : '—');
                return {
                  id: p.record_id,
                  title: sitzungTitel || formatDate(p.fields.erstellungsdatum),
                  secondLine: (
                    <span className="text-amber-600 text-xs font-medium">
                      {tx('Entwurf')}
                      {p.protokollfuehrerName ? ` · ${p.protokollfuehrerName}` : ''}
                    </span>
                  ),
                  action: {
                    label: tx('Freigeben'),
                    onClick: async () => {
                      try {
                        await LivingAppsService.updateProtokolleEntry(p.record_id, { status: 'freigegeben' });
                        undoToast(tx('Protokoll freigegeben'), async () => {
                          await LivingAppsService.updateProtokolleEntry(p.record_id, { status: 'entwurf' });
                          fetchAll();
                        });
                        fetchAll();
                      } catch { fetchAll(); }
                    },
                  },
                };
              })}
              onItemClick={id => {
                const p = protokolle.find(x => x.record_id === id);
                if (p) crud.protokolle.openDetail(p);
              }}
              empty={{
                text: tx('Alle Protokolle sind freigegeben.'),
                action: { label: tx('Neues Protokoll'), onClick: () => crud.protokolle.openCreate({}) },
              }}
            />
          </>
        }
      />

      {/* Letzte Notizen */}
      {enrichedNotizen.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">{tx('Letzte Notizen')}</h2>
            <button
              onClick={() => crud.notizen.openCreate({})}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconPlus size={12} className="shrink-0" />
              {tx('Neue Notiz')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentNotizen.map(n => (
              <button
                key={n.record_id}
                onClick={() => crud.notizen.openDetail(n)}
                className="text-left rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{n.fields.titel}</span>
                  {n.fields.prioritaet?.key === 'hoch' && (
                    <IconAlertTriangle size={14} className="text-amber-500 shrink-0" />
                  )}
                  {n.fields.prioritaet?.key === 'niedrig' && (
                    <IconCheck size={14} className="text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.fields.notiztext}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {n.erstellerName && <span>{n.erstellerName}</span>}
                  {n.sitzungName && <span className="truncate">· {n.sitzungName}</span>}
                  {n.fields.datum && <span className="ml-auto shrink-0">{formatDate(n.fields.datum)}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
