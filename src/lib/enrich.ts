import type { EnrichedFeedback, EnrichedNotizen, EnrichedProtokolle, EnrichedSitzungen, EnrichedTagesordnungspunkte } from '@/types/enriched';
import type { Feedback, Mitglieder, Notizen, Protokolle, Sitzungen, Tagesordnungspunkte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface SitzungenMaps {
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichSitzungen(
  sitzungen: Sitzungen[],
  maps: SitzungenMaps
): EnrichedSitzungen[] {
  return sitzungen.map(r => ({
    ...r,
    eingeladene_mitgliederName: resolveDisplay(r.fields.eingeladene_mitglieder, maps.mitgliederMap, 'vorname', 'nachname'),
    angemeldete_mitgliederName: resolveDisplay(r.fields.angemeldete_mitglieder, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface TagesordnungspunkteMaps {
  sitzungenMap: Map<string, Sitzungen>;
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichTagesordnungspunkte(
  tagesordnungspunkte: Tagesordnungspunkte[],
  maps: TagesordnungspunkteMaps
): EnrichedTagesordnungspunkte[] {
  return tagesordnungspunkte.map(r => ({
    ...r,
    sitzungName: resolveDisplay(r.fields.sitzung, maps.sitzungenMap, 'titel'),
    referentName: resolveDisplay(r.fields.referent, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface ProtokolleMaps {
  sitzungenMap: Map<string, Sitzungen>;
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichProtokolle(
  protokolle: Protokolle[],
  maps: ProtokolleMaps
): EnrichedProtokolle[] {
  return protokolle.map(r => ({
    ...r,
    sitzungName: resolveDisplay(r.fields.sitzung, maps.sitzungenMap, 'titel'),
    protokollfuehrerName: resolveDisplay(r.fields.protokollfuehrer, maps.mitgliederMap, 'vorname', 'nachname'),
    anwesende_mitgliederName: resolveDisplay(r.fields.anwesende_mitglieder, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface FeedbackMaps {
  tagesordnungspunkteMap: Map<string, Tagesordnungspunkte>;
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichFeedback(
  feedback: Feedback[],
  maps: FeedbackMaps
): EnrichedFeedback[] {
  return feedback.map(r => ({
    ...r,
    tagesordnungspunktName: resolveDisplay(r.fields.tagesordnungspunkt, maps.tagesordnungspunkteMap, 'punkt_titel'),
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface NotizenMaps {
  mitgliederMap: Map<string, Mitglieder>;
  sitzungenMap: Map<string, Sitzungen>;
  tagesordnungspunkteMap: Map<string, Tagesordnungspunkte>;
  protokolleMap: Map<string, Protokolle>;
}

export function enrichNotizen(
  notizen: Notizen[],
  maps: NotizenMaps
): EnrichedNotizen[] {
  return notizen.map(r => ({
    ...r,
    erstellerName: resolveDisplay(r.fields.ersteller, maps.mitgliederMap, 'vorname', 'nachname'),
    sitzungName: resolveDisplay(r.fields.sitzung, maps.sitzungenMap, 'titel'),
    tagesordnungspunktName: resolveDisplay(r.fields.tagesordnungspunkt, maps.tagesordnungspunkteMap, 'punkt_titel'),
    protokollName: resolveDisplay(r.fields.protokoll, maps.protokolleMap, 'zusammenfassung'),
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}
