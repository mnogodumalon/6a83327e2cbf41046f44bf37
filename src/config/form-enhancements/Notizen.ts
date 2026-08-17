// Auto-generated. Per-entity form-enhancements config for "Notizen".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'prioritaet',
    'datum',
    'notiztext',
    'ersteller',
    'sitzung',
    'tagesordnungspunkt',
    'protokoll',
    'mitglied',
  ],
  defaults: {
    'datum': { kind: 'today' },
    'prioritaet': { kind: 'lookup', key: 'mittel', label: 'Mittel' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
