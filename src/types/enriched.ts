import type { Feedback, Notizen, Protokolle, Sitzungen, Tagesordnungspunkte } from './app';

export type EnrichedSitzungen = Sitzungen & {
  eingeladene_mitgliederName: string;
  angemeldete_mitgliederName: string;
};

export type EnrichedTagesordnungspunkte = Tagesordnungspunkte & {
  sitzungName: string;
  referentName: string;
};

export type EnrichedProtokolle = Protokolle & {
  sitzungName: string;
  protokollfuehrerName: string;
  anwesende_mitgliederName: string;
};

export type EnrichedFeedback = Feedback & {
  tagesordnungspunktName: string;
  mitgliedName: string;
};

export type EnrichedNotizen = Notizen & {
  erstellerName: string;
  sitzungName: string;
  tagesordnungspunktName: string;
  protokollName: string;
  mitgliedName: string;
};
