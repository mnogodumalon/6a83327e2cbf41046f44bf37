// Auto-generated. Per-entity form-enhancements config for "Mitglieder".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    { row: ['vorname', 'nachname'] },
    'email',
    'telefon',
    'funktion',
    'abteilung',
    'eintrittsdatum',
    'status',
    'anmerkungen',
  ],
  defaults: {
    'eintrittsdatum': { kind: 'today' },
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
