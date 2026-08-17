// Auto-generated. Per-entity form-enhancements config for "Sitzungen".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'art',
    'datum_uhrzeit',
    'anmeldefrist',
    'ort',
    'max_teilnehmer',
    'beschreibung',
    'einladungsstatus',
    'einlade_link',
    'eingeladene_mitglieder',
    'angemeldete_mitglieder',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'anmeldefrist': { kind: 'todayOffset', days: 3, withTime: true },
    'art': { kind: 'lookup', key: 'ordentlich', label: 'Ordentliche Sitzung' },
    'einladungsstatus': { kind: 'lookup', key: 'entwurf', label: 'Entwurf' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
