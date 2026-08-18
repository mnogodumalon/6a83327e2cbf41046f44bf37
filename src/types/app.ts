import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Mitglieder {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    funktion?: string;
    abteilung?: string;
    eintrittsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    profilbild?: string;
    anmerkungen?: string;
  };
}

export interface Sitzungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    datum_uhrzeit?: string; // Format: YYYY-MM-DD oder ISO String
    ort?: string;
    art?: LookupValue;
    beschreibung?: string;
    anmeldefrist?: string; // Format: YYYY-MM-DD oder ISO String
    max_teilnehmer?: number;
    einlade_link?: string;
    einladungsstatus?: LookupValue;
    eingeladene_mitglieder?: string[];
    angemeldete_mitglieder?: string[];
  };
}

export interface Tagesordnungspunkte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    sitzung?: string; // applookup -> URL zu 'Sitzungen' Record
    punkt_titel?: string;
    beschreibung?: string;
    reihenfolge?: number;
    dauer?: number;
    typ?: LookupValue;
    referent?: string; // applookup -> URL zu 'Mitglieder' Record
    unterlagen?: string;
  };
}

export interface Protokolle {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    sitzung?: string; // applookup -> URL zu 'Sitzungen' Record
    erstellungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    protokollfuehrer?: string; // applookup -> URL zu 'Mitglieder' Record
    anwesende_mitglieder?: string[];
    zusammenfassung?: string;
    beschluesse?: string;
    status?: LookupValue;
    protokolldatei?: string;
  };
}

export interface Feedback {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    tagesordnungspunkt?: string; // applookup -> URL zu 'Tagesordnungspunkte' Record
    mitglied?: string; // applookup -> URL zu 'Mitglieder' Record
    kategorie?: LookupValue;
    bewertung?: LookupValue;
    kommentar?: string;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Notizen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    notiztext?: string;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    prioritaet?: LookupValue;
    ersteller?: string; // applookup -> URL zu 'Mitglieder' Record
    sitzung?: string; // applookup -> URL zu 'Sitzungen' Record
    tagesordnungspunkt?: string; // applookup -> URL zu 'Tagesordnungspunkte' Record
    protokoll?: string; // applookup -> URL zu 'Protokolle' Record
    mitglied?: string; // applookup -> URL zu 'Mitglieder' Record
    anhang?: string;
  };
}

export const APP_IDS = {
  MITGLIEDER: '6a83324eb209b1d472054883',
  SITZUNGEN: '6a8332541add4699ccc0e8f8',
  TAGESORDNUNGSPUNKTE: '6a8332556c5494e5fd7e585a',
  PROTOKOLLE: '6a833255474a52f0bab4788c',
  FEEDBACK: '6a833256685a7a992dc3d607',
  NOTIZEN: '6a833256fee6f0da301ba9e4',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'mitglieder': {
    status: [{ key: "aktiv", get label() { return lookupLabel('mitglieder', 'status', "aktiv") ?? "Aktiv"; } }, { key: "inaktiv", get label() { return lookupLabel('mitglieder', 'status', "inaktiv") ?? "Inaktiv"; } }],
  },
  'sitzungen': {
    art: [{ key: "ordentlich", get label() { return lookupLabel('sitzungen', 'art', "ordentlich") ?? "Ordentliche Sitzung"; } }, { key: "ausserordentlich", get label() { return lookupLabel('sitzungen', 'art', "ausserordentlich") ?? "Außerordentliche Sitzung"; } }, { key: "klausur", get label() { return lookupLabel('sitzungen', 'art', "klausur") ?? "Klausursitzung"; } }, { key: "information", get label() { return lookupLabel('sitzungen', 'art', "information") ?? "Informationssitzung"; } }],
    einladungsstatus: [{ key: "entwurf", get label() { return lookupLabel('sitzungen', 'einladungsstatus', "entwurf") ?? "Entwurf"; } }, { key: "versandt", get label() { return lookupLabel('sitzungen', 'einladungsstatus', "versandt") ?? "Versandt"; } }, { key: "abgeschlossen", get label() { return lookupLabel('sitzungen', 'einladungsstatus', "abgeschlossen") ?? "Abgeschlossen"; } }],
  },
  'tagesordnungspunkte': {
    typ: [{ key: "information", get label() { return lookupLabel('tagesordnungspunkte', 'typ', "information") ?? "Information"; } }, { key: "beschluss", get label() { return lookupLabel('tagesordnungspunkte', 'typ', "beschluss") ?? "Beschluss"; } }, { key: "diskussion", get label() { return lookupLabel('tagesordnungspunkte', 'typ', "diskussion") ?? "Diskussion"; } }, { key: "sonstiges", get label() { return lookupLabel('tagesordnungspunkte', 'typ', "sonstiges") ?? "Sonstiges"; } }],
  },
  'protokolle': {
    status: [{ key: "entwurf", get label() { return lookupLabel('protokolle', 'status', "entwurf") ?? "Entwurf"; } }, { key: "freigegeben", get label() { return lookupLabel('protokolle', 'status', "freigegeben") ?? "Freigegeben"; } }],
  },
  'feedback': {
    kategorie: [{ key: "zustimmung", get label() { return lookupLabel('feedback', 'kategorie', "zustimmung") ?? "Zustimmung"; } }, { key: "ablehnung", get label() { return lookupLabel('feedback', 'kategorie', "ablehnung") ?? "Ablehnung"; } }, { key: "enthaltung", get label() { return lookupLabel('feedback', 'kategorie', "enthaltung") ?? "Enthaltung"; } }, { key: "anmerkung", get label() { return lookupLabel('feedback', 'kategorie', "anmerkung") ?? "Anmerkung"; } }],
    bewertung: [{ key: "bewertung_1", get label() { return lookupLabel('feedback', 'bewertung', "bewertung_1") ?? "1 – Sehr gut"; } }, { key: "bewertung_2", get label() { return lookupLabel('feedback', 'bewertung', "bewertung_2") ?? "2 – Gut"; } }, { key: "bewertung_3", get label() { return lookupLabel('feedback', 'bewertung', "bewertung_3") ?? "3 – Befriedigend"; } }, { key: "bewertung_4", get label() { return lookupLabel('feedback', 'bewertung', "bewertung_4") ?? "4 – Ausreichend"; } }, { key: "bewertung_5", get label() { return lookupLabel('feedback', 'bewertung', "bewertung_5") ?? "5 – Mangelhaft"; } }],
  },
  'notizen': {
    prioritaet: [{ key: "niedrig", get label() { return lookupLabel('notizen', 'prioritaet', "niedrig") ?? "Niedrig"; } }, { key: "mittel", get label() { return lookupLabel('notizen', 'prioritaet', "mittel") ?? "Mittel"; } }, { key: "hoch", get label() { return lookupLabel('notizen', 'prioritaet', "hoch") ?? "Hoch"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'mitglieder': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'funktion': 'string/text',
    'abteilung': 'string/text',
    'eintrittsdatum': 'date/date',
    'status': 'lookup/radio',
    'profilbild': 'file',
    'anmerkungen': 'string/textarea',
  },
  'sitzungen': {
    'titel': 'string/text',
    'datum_uhrzeit': 'date/datetimeminute',
    'ort': 'string/text',
    'art': 'lookup/select',
    'beschreibung': 'string/textarea',
    'anmeldefrist': 'date/datetimeminute',
    'max_teilnehmer': 'number',
    'einlade_link': 'string/url',
    'einladungsstatus': 'lookup/select',
    'eingeladene_mitglieder': 'multipleapplookup/select',
    'angemeldete_mitglieder': 'multipleapplookup/select',
  },
  'tagesordnungspunkte': {
    'sitzung': 'applookup/select',
    'punkt_titel': 'string/text',
    'beschreibung': 'string/textarea',
    'reihenfolge': 'number',
    'dauer': 'number',
    'typ': 'lookup/select',
    'referent': 'applookup/select',
    'unterlagen': 'file',
  },
  'protokolle': {
    'sitzung': 'applookup/select',
    'erstellungsdatum': 'date/date',
    'protokollfuehrer': 'applookup/select',
    'anwesende_mitglieder': 'multipleapplookup/select',
    'zusammenfassung': 'string/textarea',
    'beschluesse': 'string/textarea',
    'status': 'lookup/select',
    'protokolldatei': 'file',
  },
  'feedback': {
    'tagesordnungspunkt': 'applookup/select',
    'mitglied': 'applookup/select',
    'kategorie': 'lookup/radio',
    'bewertung': 'lookup/radio',
    'kommentar': 'string/textarea',
    'datum': 'date/date',
  },
  'notizen': {
    'titel': 'string/text',
    'notiztext': 'string/textarea',
    'datum': 'date/date',
    'prioritaet': 'lookup/radio',
    'ersteller': 'applookup/select',
    'sitzung': 'applookup/select',
    'tagesordnungspunkt': 'applookup/select',
    'protokoll': 'applookup/select',
    'mitglied': 'applookup/select',
    'anhang': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'mitglieder': [
    { field: 'eingeladene_mitglieder', entity: 'sitzungen' },
    { field: 'angemeldete_mitglieder', entity: 'sitzungen' },
    { field: 'referent', entity: 'tagesordnungspunkte' },
    { field: 'protokollfuehrer', entity: 'protokolle' },
    { field: 'anwesende_mitglieder', entity: 'protokolle' },
    { field: 'mitglied', entity: 'feedback' },
    { field: 'ersteller', entity: 'notizen' },
    { field: 'mitglied', entity: 'notizen' },
  ],
  'sitzungen': [
    { field: 'sitzung', entity: 'tagesordnungspunkte' },
    { field: 'sitzung', entity: 'protokolle' },
    { field: 'sitzung', entity: 'notizen' },
  ],
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitglieder = StripLookup<Mitglieder['fields']>;
export type CreateSitzungen = StripLookup<Sitzungen['fields']>;
export type CreateTagesordnungspunkte = StripLookup<Tagesordnungspunkte['fields']>;
export type CreateProtokolle = StripLookup<Protokolle['fields']>;
export type CreateFeedback = StripLookup<Feedback['fields']>;
export type CreateNotizen = StripLookup<Notizen['fields']>;