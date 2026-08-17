// Auto-generated. Per-entity form-enhancements config for "Tagesordnungspunkte".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'sitzung',
    'punkt_titel',
    'typ',
    'reihenfolge',
    'dauer',
    'referent',
    'beschreibung',
  ],
  defaults: {
    'reihenfolge': { kind: 'literal', value: 1 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
