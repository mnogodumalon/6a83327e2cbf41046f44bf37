// Auto-generated. Per-entity form-enhancements config for "Protokolle".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'sitzung',
    'erstellungsdatum',
    'status',
    'protokollfuehrer',
    'anwesende_mitglieder',
    'zusammenfassung',
    'beschluesse',
  ],
  defaults: {
    'erstellungsdatum': { kind: 'today' },
    'status': { kind: 'lookup', key: 'entwurf', label: 'Entwurf' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
