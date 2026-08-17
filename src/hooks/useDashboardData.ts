import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle, Feedback, Notizen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [mitglieder, setMitglieder] = useState<Mitglieder[]>([]);
  const [sitzungen, setSitzungen] = useState<Sitzungen[]>([]);
  const [tagesordnungspunkte, setTagesordnungspunkte] = useState<Tagesordnungspunkte[]>([]);
  const [protokolle, setProtokolle] = useState<Protokolle[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [notizen, setNotizen] = useState<Notizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [mitgliederData, sitzungenData, tagesordnungspunkteData, protokolleData, feedbackData, notizenData] = await Promise.all([
        LivingAppsService.getMitglieder(),
        LivingAppsService.getSitzungen(),
        LivingAppsService.getTagesordnungspunkte(),
        LivingAppsService.getProtokolle(),
        LivingAppsService.getFeedback(),
        LivingAppsService.getNotizen(),
      ]);
      setMitglieder(mitgliederData);
      setSitzungen(sitzungenData);
      setTagesordnungspunkte(tagesordnungspunkteData);
      setProtokolle(protokolleData);
      setFeedback(feedbackData);
      setNotizen(notizenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [mitgliederData, sitzungenData, tagesordnungspunkteData, protokolleData, feedbackData, notizenData] = await Promise.all([
          LivingAppsService.getMitglieder(),
          LivingAppsService.getSitzungen(),
          LivingAppsService.getTagesordnungspunkte(),
          LivingAppsService.getProtokolle(),
          LivingAppsService.getFeedback(),
          LivingAppsService.getNotizen(),
        ]);
        setMitglieder(mitgliederData);
        setSitzungen(sitzungenData);
        setTagesordnungspunkte(tagesordnungspunkteData);
        setProtokolle(protokolleData);
        setFeedback(feedbackData);
        setNotizen(notizenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const mitgliederMap = useMemo(() => {
    const m = new Map<string, Mitglieder>();
    mitglieder.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitglieder]);

  const sitzungenMap = useMemo(() => {
    const m = new Map<string, Sitzungen>();
    sitzungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [sitzungen]);

  const tagesordnungspunkteMap = useMemo(() => {
    const m = new Map<string, Tagesordnungspunkte>();
    tagesordnungspunkte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [tagesordnungspunkte]);

  const protokolleMap = useMemo(() => {
    const m = new Map<string, Protokolle>();
    protokolle.forEach(r => m.set(r.record_id, r));
    return m;
  }, [protokolle]);

  return { mitglieder, setMitglieder, sitzungen, setSitzungen, tagesordnungspunkte, setTagesordnungspunkte, protokolle, setProtokolle, feedback, setFeedback, notizen, setNotizen, loading, error, fetchAll, mitgliederMap, sitzungenMap, tagesordnungspunkteMap, protokolleMap };
}