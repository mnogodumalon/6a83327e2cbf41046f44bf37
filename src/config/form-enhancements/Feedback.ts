// Auto-generated. Per-entity form-enhancements config for "Feedback".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'tagesordnungspunkt',
    'mitglied',
    'kategorie',
    'bewertung',
    'kommentar',
    'datum',
  ],
  defaults: {
    'kategorie': { kind: 'lookup', key: 'anmerkung', label: 'Anmerkung' },
    'datum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
