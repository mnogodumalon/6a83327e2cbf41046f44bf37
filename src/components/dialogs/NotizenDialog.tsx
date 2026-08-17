/**
 * NotizenDialog — pre-generated create/edit dialog for Notizen.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * mitgliederList (full hook array — resolves the Mitglieder applookup),
 * sitzungenList (full hook array — resolves the Sitzungen applookup),
 * tagesordnungspunkteList (full hook array — resolves the Tagesordnungspunkte applookup),
 * protokolleList (full hook array — resolves the Protokolle applookup),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * NotizenDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Notizen['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<NotizenDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Notizen, Mitglieder, Sitzungen, Tagesordnungspunkte, Protokolle, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Notizen';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { t, appLabel, fieldLabel, lookupLabel, localeTag, CURRENCY } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/Combobox';
import { MitgliederDialog } from '@/components/dialogs/MitgliederDialog';
import { SitzungenDialog } from '@/components/dialogs/SitzungenDialog';
import { TagesordnungspunkteDialog } from '@/components/dialogs/TagesordnungspunkteDialog';
import { ProtokolleDialog } from '@/components/dialogs/ProtokolleDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

/** Widened prefill type for NotizenDialog.defaultValues — see file header. */
export type NotizenDialogDefaults = Omit<Notizen['fields'], 'prioritaet'> & {
    prioritaet?: LookupValue | string;
  };

interface NotizenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Notizen['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: NotizenDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  mitgliederList: Mitglieder[];
  sitzungenList: Sitzungen[];
  tagesordnungspunkteList: Tagesordnungspunkte[];
  protokolleList: Protokolle[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  prioritaet: LOOKUP_OPTIONS['notizen']?.['prioritaet'] ?? [],
};
const NORMALIZE_APPLOOKUPS: Record<string, string> = {
  ersteller: APP_IDS.MITGLIEDER,
  sitzung: APP_IDS.SITZUNGEN,
  tagesordnungspunkt: APP_IDS.TAGESORDNUNGSPUNKTE,
  protokoll: APP_IDS.PROTOKOLLE,
  mitglied: APP_IDS.MITGLIEDER,
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  for (const [k, appId] of Object.entries(NORMALIZE_APPLOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && !v.startsWith('http')) out[k] = createRecordUrl(appId, v);
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' && x !== '' && !x.startsWith('http') ? createRecordUrl(appId, x) : x));
  }
  return out;
}

export function NotizenDialog({ open, onClose, onSubmit, defaultValues, recordId, mitgliederList, sitzungenList, tagesordnungspunkteList, protokolleList, enablePhotoScan = true, enablePhotoLocation = true }: NotizenDialogProps) {
  const [fields, setFields] = useState<Partial<Notizen['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Inline-Create state for "Mitglieder" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraMitglieder` list, and select it in
  // the originating Combobox via the captured `createMitgliederField`.
  const [createMitgliederOpen, setCreateMitgliederOpen] = useState(false);
  const [createMitgliederInitial, setCreateMitgliederInitial] = useState('');
  const [createMitgliederField, setCreateMitgliederField] = useState<string>('');
  const [extraMitglieder, setExtraMitglieder] = useState< Mitglieder[]>([]);
  const mitgliederListAll = useMemo(
    () => [...mitgliederList, ...extraMitglieder],
    [mitgliederList, extraMitglieder],
  );
  function openCreateMitglieder(fieldKey: string, q: string) {
    setCreateMitgliederField(fieldKey);
    setCreateMitgliederInitial(q);
    setCreateMitgliederOpen(true);
  }
  // Inline-Create state for "Sitzungen" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraSitzungen` list, and select it in
  // the originating Combobox via the captured `createSitzungenField`.
  const [createSitzungenOpen, setCreateSitzungenOpen] = useState(false);
  const [createSitzungenInitial, setCreateSitzungenInitial] = useState('');
  const [createSitzungenField, setCreateSitzungenField] = useState<string>('');
  const [extraSitzungen, setExtraSitzungen] = useState< Sitzungen[]>([]);
  const sitzungenListAll = useMemo(
    () => [...sitzungenList, ...extraSitzungen],
    [sitzungenList, extraSitzungen],
  );
  function openCreateSitzungen(fieldKey: string, q: string) {
    setCreateSitzungenField(fieldKey);
    setCreateSitzungenInitial(q);
    setCreateSitzungenOpen(true);
  }
  // Inline-Create state for "Tagesordnungspunkte" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraTagesordnungspunkte` list, and select it in
  // the originating Combobox via the captured `createTagesordnungspunkteField`.
  const [createTagesordnungspunkteOpen, setCreateTagesordnungspunkteOpen] = useState(false);
  const [createTagesordnungspunkteInitial, setCreateTagesordnungspunkteInitial] = useState('');
  const [createTagesordnungspunkteField, setCreateTagesordnungspunkteField] = useState<string>('');
  const [extraTagesordnungspunkte, setExtraTagesordnungspunkte] = useState< Tagesordnungspunkte[]>([]);
  const tagesordnungspunkteListAll = useMemo(
    () => [...tagesordnungspunkteList, ...extraTagesordnungspunkte],
    [tagesordnungspunkteList, extraTagesordnungspunkte],
  );
  function openCreateTagesordnungspunkte(fieldKey: string, q: string) {
    setCreateTagesordnungspunkteField(fieldKey);
    setCreateTagesordnungspunkteInitial(q);
    setCreateTagesordnungspunkteOpen(true);
  }
  // Inline-Create state for "Protokolle" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraProtokolle` list, and select it in
  // the originating Combobox via the captured `createProtokolleField`.
  const [createProtokolleOpen, setCreateProtokolleOpen] = useState(false);
  const [createProtokolleInitial, setCreateProtokolleInitial] = useState('');
  const [createProtokolleField, setCreateProtokolleField] = useState<string>('');
  const [extraProtokolle, setExtraProtokolle] = useState< Protokolle[]>([]);
  const protokolleListAll = useMemo(
    () => [...protokolleList, ...extraProtokolle],
    [protokolleList, extraProtokolle],
  );
  function openCreateProtokolle(fieldKey: string, q: string) {
    setCreateProtokolleField(fieldKey);
    setCreateProtokolleInitial(q);
    setCreateProtokolleOpen(true);
  }
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['titel', 'notiztext'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'ersteller': mitgliederList,
      'sitzung': sitzungenList,
      'tagesordnungspunkt': tagesordnungspunkteList,
      'protokoll': protokolleList,
      'mitglied': mitgliederList,
    },
  }), [mitgliederList, sitzungenList, tagesordnungspunkteList, protokolleList, mitgliederList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Notizen['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'notizen');
      await onSubmit(clean as Notizen['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : t('submit_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="ersteller" entity="Mitglieder">\n${JSON.stringify(mitgliederList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="sitzung" entity="Sitzungen">\n${JSON.stringify(sitzungenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="tagesordnungspunkt" entity="Tagesordnungspunkte">\n${JSON.stringify(tagesordnungspunkteList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="protokoll" entity="Protokolle">\n${JSON.stringify(protokolleList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="mitglied" entity="Mitglieder">\n${JSON.stringify(mitgliederList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "titel": string | null, // Titel der Notiz\n  "notiztext": string | null, // Notiztext\n  "datum": string | null, // YYYY-MM-DD\n  "prioritaet": LookupValue | null, // Priorität (select one key: "niedrig" | "mittel" | "hoch") mapping: niedrig=Niedrig, mittel=Mittel, hoch=Hoch\n  "ersteller": string | null, // Display name from Mitglieder (see <available-records>)\n  "sitzung": string | null, // Display name from Sitzungen (see <available-records>)\n  "tagesordnungspunkt": string | null, // Display name from Tagesordnungspunkte (see <available-records>)\n  "protokoll": string | null, // Display name from Protokolle (see <available-records>)\n  "mitglied": string | null, // Display name from Mitglieder (see <available-records>)\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["ersteller", "sitzung", "tagesordnungspunkt", "protokoll", "mitglied"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const erstellerName = raw['ersteller'] as string | null;
        if (erstellerName) {
          const erstellerMatch = mitgliederList.find(r => matchName(erstellerName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (erstellerMatch) merged['ersteller'] = createRecordUrl(APP_IDS.MITGLIEDER, erstellerMatch.record_id);
        }
        const sitzungName = raw['sitzung'] as string | null;
        if (sitzungName) {
          const sitzungMatch = sitzungenList.find(r => matchName(sitzungName!, [String(r.fields.titel ?? '')]));
          if (sitzungMatch) merged['sitzung'] = createRecordUrl(APP_IDS.SITZUNGEN, sitzungMatch.record_id);
        }
        const tagesordnungspunktName = raw['tagesordnungspunkt'] as string | null;
        if (tagesordnungspunktName) {
          const tagesordnungspunktMatch = tagesordnungspunkteList.find(r => matchName(tagesordnungspunktName!, [String(r.fields.punkt_titel ?? '')]));
          if (tagesordnungspunktMatch) merged['tagesordnungspunkt'] = createRecordUrl(APP_IDS.TAGESORDNUNGSPUNKTE, tagesordnungspunktMatch.record_id);
        }
        const protokollName = raw['protokoll'] as string | null;
        if (protokollName) {
          const protokollMatch = protokolleList.find(r => matchName(protokollName!, [String(r.fields.zusammenfassung ?? '')]));
          if (protokollMatch) merged['protokoll'] = createRecordUrl(APP_IDS.PROTOKOLLE, protokollMatch.record_id);
        }
        const mitgliedName = raw['mitglied'] as string | null;
        if (mitgliedName) {
          const mitgliedMatch = mitgliederList.find(r => matchName(mitgliedName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (mitgliedMatch) merged['mitglied'] = createRecordUrl(APP_IDS.MITGLIEDER, mitgliedMatch.record_id);
        }
        return merged as Partial<Notizen['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, anhang: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error(`${t('scan_error')}:`, err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues
    ? t('edit_entity', { entity: appLabel('notizen') })
    : t('new_entity', { entity: appLabel('notizen') });

  const fieldBlocks: Record<string, React.ReactNode> = {
    'titel': (
      <div key="titel" className="space-y-1.5">
        <Label htmlFor="titel">{fieldLabel('notizen', 'titel')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="titel"
          placeholder="z. B. Nachbereitung Kassenbericht"
          value={fields.titel ?? ''}
          onChange={e => setFields(f => ({ ...f, titel: e.target.value }))}
          required
        />
        {showErrors && !fields.titel && (
          <p className="text-xs text-destructive mt-1">{t('required_hint')}</p>
        )}
      </div>
    ),
    'notiztext': (
      <div key="notiztext" className="space-y-1.5">
        <Label htmlFor="notiztext">{fieldLabel('notizen', 'notiztext')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Textarea
          id="notiztext"
          placeholder="Inhalt der Notiz, Erkenntnisse..."
          value={fields.notiztext ?? ''}
          onChange={e => setFields(f => ({ ...f, notiztext: e.target.value }))}
          rows={3}
        />
        {showErrors && !fields.notiztext && (
          <p className="text-xs text-destructive mt-1">{t('required_hint')}</p>
        )}
      </div>
    ),
    'datum': (
      <div key="datum" className="space-y-1.5">
        <Label htmlFor="datum">{fieldLabel('notizen', 'datum')}</Label>
        <DatePicker
          id="datum"
          placeholder="Wann wurde die Notiz erstellt?"
          mode="date"
          value={fields.datum ?? null}
          onChange={v => setFields(f => ({ ...f, datum: v ?? undefined }))}
        />
      </div>
    ),
    'prioritaet': (
      <div key="prioritaet" className="space-y-1.5">
        <Label htmlFor="prioritaet">{fieldLabel('notizen', 'prioritaet')}</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.prioritaet) === 'niedrig'}
            onClick={() => setFields(f => ({ ...f, prioritaet: (lookupKey(f.prioritaet) === 'niedrig' ? undefined : 'niedrig') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.prioritaet) === 'niedrig'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('notizen', 'prioritaet', 'niedrig') ?? 'Niedrig'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.prioritaet) === 'mittel'}
            onClick={() => setFields(f => ({ ...f, prioritaet: (lookupKey(f.prioritaet) === 'mittel' ? undefined : 'mittel') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.prioritaet) === 'mittel'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('notizen', 'prioritaet', 'mittel') ?? 'Mittel'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.prioritaet) === 'hoch'}
            onClick={() => setFields(f => ({ ...f, prioritaet: (lookupKey(f.prioritaet) === 'hoch' ? undefined : 'hoch') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.prioritaet) === 'hoch'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('notizen', 'prioritaet', 'hoch') ?? 'Hoch'}
          </button>
        </div>
      </div>
    ),
    'ersteller': (
      <div key="ersteller" className="space-y-1.5">
        <Label htmlFor="ersteller">{fieldLabel('notizen', 'ersteller')}</Label>
        <Combobox
          id="ersteller"
          placeholder="Wer hat diese Notiz erstellt?"
          items={mitgliederListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.vorname ?? r.record_id),
          }))}
          value={extractRecordId(fields.ersteller)}
          onChange={id => setFields(f => ({ ...f, ersteller: id ? createRecordUrl(APP_IDS.MITGLIEDER, id) : undefined }))}
          onCreateNew={(q) => openCreateMitglieder("ersteller", q)}
          createLabel={t('create_in', { entity: appLabel('mitglieder') })}
        />
      </div>
    ),
    'sitzung': (
      <div key="sitzung" className="space-y-1.5">
        <Label htmlFor="sitzung">{fieldLabel('notizen', 'sitzung')}</Label>
        <Combobox
          id="sitzung"
          placeholder="Zu welcher Sitzung gehört diese Notiz?"
          items={sitzungenListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.titel ?? r.record_id),
          }))}
          value={extractRecordId(fields.sitzung)}
          onChange={id => setFields(f => ({ ...f, sitzung: id ? createRecordUrl(APP_IDS.SITZUNGEN, id) : undefined }))}
          onCreateNew={(q) => openCreateSitzungen("sitzung", q)}
          createLabel={t('create_in', { entity: appLabel('sitzungen') })}
        />
      </div>
    ),
    'tagesordnungspunkt': (
      <div key="tagesordnungspunkt" className="space-y-1.5">
        <Label htmlFor="tagesordnungspunkt">{fieldLabel('notizen', 'tagesordnungspunkt')}</Label>
        <Combobox
          id="tagesordnungspunkt"
          placeholder="Zu welchem TOP gehört diese Notiz?"
          items={tagesordnungspunkteListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.punkt_titel ?? r.record_id),
          }))}
          value={extractRecordId(fields.tagesordnungspunkt)}
          onChange={id => setFields(f => ({ ...f, tagesordnungspunkt: id ? createRecordUrl(APP_IDS.TAGESORDNUNGSPUNKTE, id) : undefined }))}
          onCreateNew={(q) => openCreateTagesordnungspunkte("tagesordnungspunkt", q)}
          createLabel={t('create_in', { entity: appLabel('tagesordnungspunkte') })}
        />
      </div>
    ),
    'protokoll': (
      <div key="protokoll" className="space-y-1.5">
        <Label htmlFor="protokoll">{fieldLabel('notizen', 'protokoll')}</Label>
        <Combobox
          id="protokoll"
          placeholder="Zu welchem Protokoll gehört diese Notiz?"
          items={protokolleListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.zusammenfassung ?? r.record_id),
          }))}
          value={extractRecordId(fields.protokoll)}
          onChange={id => setFields(f => ({ ...f, protokoll: id ? createRecordUrl(APP_IDS.PROTOKOLLE, id) : undefined }))}
          onCreateNew={(q) => openCreateProtokolle("protokoll", q)}
          createLabel={t('create_in', { entity: appLabel('protokolle') })}
        />
      </div>
    ),
    'mitglied': (
      <div key="mitglied" className="space-y-1.5">
        <Label htmlFor="mitglied">{fieldLabel('notizen', 'mitglied')}</Label>
        <Combobox
          id="mitglied"
          placeholder="Zu welchem Mitglied gehört diese Notiz?"
          items={mitgliederListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.vorname ?? r.record_id),
          }))}
          value={extractRecordId(fields.mitglied)}
          onChange={id => setFields(f => ({ ...f, mitglied: id ? createRecordUrl(APP_IDS.MITGLIEDER, id) : undefined }))}
          onCreateNew={(q) => openCreateMitglieder("mitglied", q)}
          createLabel={t('create_in', { entity: appLabel('mitglieder') })}
        />
      </div>
    ),
    'anhang': (
      <div key="anhang" className="space-y-1.5">
        <Label htmlFor="anhang">{fieldLabel('notizen', 'anhang')}</Label>
        {fields.anhang ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.anhang}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.anhang.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {t('fr_change')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, anhang: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, anhang: undefined }))}
                >
                  {t('fr_remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('fr_upload_file')}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, anhang: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"titel": "Titel der Notiz", "notiztext": "Notiztext", "datum": "Datum", "prioritaet": "Priorität", "ersteller": "Erstellt von", "sitzung": "Bezug: Sitzung", "tagesordnungspunkt": "Bezug: Tagesordnungspunkt", "protokoll": "Bezug: Protokoll", "mitglied": "Bezug: Mitglied", "anhang": "Anhang"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"ersteller": {"vorname": "Vorname", "nachname": "Nachname", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "funktion": "Funktion im Gremium", "abteilung": "Abteilung / Organisation", "eintrittsdatum": "Eintrittsdatum", "status": "Status", "profilbild": "Profilbild", "anmerkungen": "Anmerkungen"}, "sitzung": {"titel": "Titel der Sitzung", "datum_uhrzeit": "Datum und Uhrzeit", "ort": "Ort / Raum", "art": "Art der Sitzung", "beschreibung": "Beschreibung / Agenda-Überblick", "anmeldefrist": "Anmeldefrist", "max_teilnehmer": "Maximale Teilnehmerzahl", "einlade_link": "Öffentlicher Einlade-Link", "einladungsstatus": "Status der Einladung", "eingeladene_mitglieder": "Eingeladene Mitglieder", "angemeldete_mitglieder": "Angemeldete Teilnehmer"}, "tagesordnungspunkt": {"sitzung": "Sitzung", "punkt_titel": "Titel des Tagesordnungspunkts", "beschreibung": "Beschreibung", "reihenfolge": "Reihenfolge / Nummer", "dauer": "Geplante Dauer (Minuten)", "typ": "Typ des Punktes", "referent": "Referent / Verantwortliche Person", "unterlagen": "Unterlagen / Anhänge"}, "protokoll": {"sitzung": "Sitzung", "erstellungsdatum": "Datum der Erstellung", "protokollfuehrer": "Protokollführer/in", "anwesende_mitglieder": "Anwesende Mitglieder", "zusammenfassung": "Zusammenfassung", "beschluesse": "Beschlüsse", "status": "Status des Protokolls", "protokolldatei": "Protokolldatei"}, "mitglied": {"vorname": "Vorname", "nachname": "Nachname", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "funktion": "Funktion im Gremium", "abteilung": "Abteilung / Organisation", "eintrittsdatum": "Eintrittsdatum", "status": "Status", "profilbild": "Profilbild", "anmerkungen": "Anmerkungen"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">{t('smart_fill')}</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('scan_header_sub')}</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  {t('useinfo_label')}
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? t('useinfo_loading') : `(${t('useinfo_more')})`}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">{t('profile_preamble')}</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">{t('useinfo_error')}</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_analyzing')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_analyzing_sub')}</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('scan_success')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_success_sub')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_upload')}</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />{t('scan_camera_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />{t('scan_file_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />{t('scan_doc_btn')}
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder={t('scan_text_placeholder')}
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title={t('paste')}
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />{t('scan_text_analyze')}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('missing_required')}
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.NOTIZEN} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">{t('cancel')}</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? t('saving') : defaultValues ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createMitgliederOpen && (
      <MitgliederDialog
        open={createMitgliederOpen}
        onClose={() => setCreateMitgliederOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createMitgliederEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Mitglieder;
            setExtraMitglieder(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.MITGLIEDER, result.id);
            setFields(prev => ({ ...prev, [createMitgliederField]: url } as any));
          }
          setCreateMitgliederOpen(false);
        }}
        defaultValues={createMitgliederInitial
          ? ({ vorname: createMitgliederInitial } as any)
          : undefined}
      />
    )}
    {createSitzungenOpen && (
      <SitzungenDialog
        open={createSitzungenOpen}
        onClose={() => setCreateSitzungenOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createSitzungenEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Sitzungen;
            setExtraSitzungen(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.SITZUNGEN, result.id);
            setFields(prev => ({ ...prev, [createSitzungenField]: url } as any));
          }
          setCreateSitzungenOpen(false);
        }}
        defaultValues={createSitzungenInitial
          ? ({ titel: createSitzungenInitial } as any)
          : undefined}
        mitgliederList={mitgliederList}
      />
    )}
    {createTagesordnungspunkteOpen && (
      <TagesordnungspunkteDialog
        open={createTagesordnungspunkteOpen}
        onClose={() => setCreateTagesordnungspunkteOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createTagesordnungspunkteEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Tagesordnungspunkte;
            setExtraTagesordnungspunkte(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.TAGESORDNUNGSPUNKTE, result.id);
            setFields(prev => ({ ...prev, [createTagesordnungspunkteField]: url } as any));
          }
          setCreateTagesordnungspunkteOpen(false);
        }}
        defaultValues={createTagesordnungspunkteInitial
          ? ({ punkt_titel: createTagesordnungspunkteInitial } as any)
          : undefined}
        sitzungenList={sitzungenList}
        mitgliederList={mitgliederList}
      />
    )}
    {createProtokolleOpen && (
      <ProtokolleDialog
        open={createProtokolleOpen}
        onClose={() => setCreateProtokolleOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createProtokolleEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Protokolle;
            setExtraProtokolle(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.PROTOKOLLE, result.id);
            setFields(prev => ({ ...prev, [createProtokolleField]: url } as any));
          }
          setCreateProtokolleOpen(false);
        }}
        defaultValues={createProtokolleInitial
          ? ({ zusammenfassung: createProtokolleInitial } as any)
          : undefined}
        sitzungenList={sitzungenList}
        mitgliederList={mitgliederList}
      />
    )}
    </>
  );
}