/**
 * Sitzung Planen — 3-Schritt-Wizard.
 * Steps: 1) Sitzung anlegen (Basisdaten) → 2) Tagesordnungspunkte hinzufügen → 3) Mitglieder einladen & Einladungsstatus setzen.
 * Reads: mitglieder. Writes: sitzungen (createSitzungenEntry, updateSitzungenEntry), tagesordnungspunkte (createTagesordnungspunkteEntry).
 * Composes: IntentWizardShell, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconCalendarEvent,
  IconMapPin,
  IconUsers,
  IconPlus,
  IconTrash,
  IconCheck,
  IconSend,
  IconClipboardList,
} from '@tabler/icons-react';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface TopEntry {
  punkt_titel: string;
  typKey: string;
  dauer: string;
  referentId: string;
  beschreibung: string;
}

const ART_OPTIONS = LOOKUP_OPTIONS['sitzungen']?.['art'] ?? [];
const TOP_TYP_OPTIONS = LOOKUP_OPTIONS['tagesordnungspunkte']?.['typ'] ?? [];

export default function SitzungPlanenPage() {
  const data = useDashboardData();
  const { mitglieder, loading, error, fetchAll } = data;

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Sitzungsbasisdaten
  const [titel, setTitel] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [artKey, setArtKey] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [anmeldefrist, setAnmeldefrist] = useState('');
  const [maxTeilnehmer, setMaxTeilnehmer] = useState('');
  const [sitzungId, setSitzungId] = useState<string | null>(null);
  const [step1Saving, setStep1Saving] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // Step 2 — TOPs
  const [tops, setTops] = useState<TopEntry[]>([]);
  const [showTopForm, setShowTopForm] = useState(false);
  const [newTopTitel, setNewTopTitel] = useState('');
  const [newTopTypKey, setNewTopTypKey] = useState('');
  const [newTopDauer, setNewTopDauer] = useState('');
  const [newTopReferentId, setNewTopReferentId] = useState('');
  const [newTopBeschreibung, setNewTopBeschreibung] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Step 3 — Mitglieder einladen
  const [selectedMitglieder, setSelectedMitglieder] = useState<Set<string>>(new Set());
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState('');
  const [done, setDone] = useState(false);

  // Aktive Mitglieder filtern
  const aktiveMitglieder = mitglieder.filter(m => m.fields.status?.key === 'aktiv');

  // Step 1: Sitzung anlegen
  const handleCreateSitzung = async () => {
    if (!titel.trim() || !datumUhrzeit || !artKey) return;
    setStep1Error('');
    setStep1Saving(true);
    try {
      // Guard gegen Doppel-Klick: wenn schon angelegt, direkt weiter
      if (sitzungId) {
        setStep(2);
        return;
      }
      const payload: Record<string, unknown> = {
        titel: titel.trim(),
        datum_uhrzeit: datumUhrzeit,
        art: artKey,
      };
      if (ort.trim()) payload.ort = ort.trim();
      if (beschreibung.trim()) payload.beschreibung = beschreibung.trim();
      if (anmeldefrist) payload.anmeldefrist = anmeldefrist;
      if (maxTeilnehmer) payload.max_teilnehmer = parseInt(maxTeilnehmer, 10);

      const result = await LivingAppsService.createSitzungenEntry(payload as Parameters<typeof LivingAppsService.createSitzungenEntry>[0]);
      setSitzungId(result.record_id);
      await fetchAll();
      setStep(2);
    } catch {
      setStep1Error(tx('Fehler beim Anlegen der Sitzung. Bitte erneut versuchen.'));
    } finally {
      setStep1Saving(false);
    }
  };

  // Step 2: TOP hinzufügen
  const handleAddTop = () => {
    if (!newTopTitel.trim()) return;
    setTops(prev => [
      ...prev,
      {
        punkt_titel: newTopTitel.trim(),
        typKey: newTopTypKey,
        dauer: newTopDauer,
        referentId: newTopReferentId,
        beschreibung: newTopBeschreibung.trim(),
      },
    ]);
    setNewTopTitel('');
    setNewTopTypKey('');
    setNewTopDauer('');
    setNewTopReferentId('');
    setNewTopBeschreibung('');
    setShowTopForm(false);
  };

  const handleRemoveTop = (idx: number) => {
    setTops(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTops = async () => {
    if (!sitzungId) return;
    setStep2Error('');
    setStep2Saving(true);
    try {
      for (let i = 0; i < tops.length; i++) {
        const top = tops[i];
        const payload: Record<string, unknown> = {
          sitzung: createRecordUrl(APP_IDS.SITZUNGEN, sitzungId),
          punkt_titel: top.punkt_titel,
          reihenfolge: i + 1,
        };
        if (top.typKey && top.typKey !== 'none') payload.typ = top.typKey;
        if (top.dauer) payload.dauer = parseInt(top.dauer, 10);
        if (top.referentId && top.referentId !== 'none') {
          payload.referent = createRecordUrl(APP_IDS.MITGLIEDER, top.referentId);
        }
        if (top.beschreibung) payload.beschreibung = top.beschreibung;
        await LivingAppsService.createTagesordnungspunkteEntry(payload as Parameters<typeof LivingAppsService.createTagesordnungspunkteEntry>[0]);
      }
      await fetchAll();
      setStep(3);
    } catch {
      setStep2Error(tx('Fehler beim Speichern der Tagesordnungspunkte. Bitte erneut versuchen.'));
    } finally {
      setStep2Saving(false);
    }
  };

  // Step 3: Mitglieder einladen
  const toggleMitglied = (id: string) => {
    setSelectedMitglieder(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInvite = async () => {
    if (!sitzungId) return;
    setStep3Error('');
    setStep3Saving(true);
    try {
      const urls = Array.from(selectedMitglieder).map(id => createRecordUrl(APP_IDS.MITGLIEDER, id));
      await LivingAppsService.updateSitzungenEntry(sitzungId, {
        eingeladene_mitglieder: urls.length > 0 ? urls : undefined,
        einladungsstatus: 'versandt',
      });
      await fetchAll();
      setDone(true);
      setStep(4);
    } catch {
      setStep3Error(tx('Fehler beim Versenden der Einladungen. Bitte erneut versuchen.'));
    } finally {
      setStep3Saving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setTitel('');
    setDatumUhrzeit('');
    setOrt('');
    setArtKey('');
    setBeschreibung('');
    setAnmeldefrist('');
    setMaxTeilnehmer('');
    setSitzungId(null);
    setStep1Error('');
    setTops([]);
    setShowTopForm(false);
    setNewTopTitel('');
    setNewTopTypKey('');
    setNewTopDauer('');
    setNewTopReferentId('');
    setNewTopBeschreibung('');
    setStep2Error('');
    setSelectedMitglieder(new Set());
    setStep3Error('');
    setDone(false);
  };

  return (
    <IntentWizardShell
      title={tx('Sitzung planen')}
      subtitle={tx('Neue Gremiumssitzung Schritt für Schritt anlegen')}
      steps={[
        { label: tx('Basisdaten') },
        { label: tx('Tagesordnung') },
        { label: tx('Einladen') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Sitzung anlegen ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tx('Sitzung anlegen')}</h2>
            <p className="text-sm text-muted-foreground">
              {tx('Erfasse die Basisdaten der neuen Gremiumssitzung.')}
            </p>
          </div>

          <div className="grid gap-4">
            {/* Titel */}
            <div className="space-y-1.5">
              <Label htmlFor="titel">
                {tx('Titel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titel"
                value={titel}
                onChange={e => setTitel(e.target.value)}
                placeholder={tx('z. B. Vorstandssitzung Q3 2026')}
              />
            </div>

            {/* Datum & Uhrzeit */}
            <div className="space-y-1.5">
              <Label htmlFor="datum_uhrzeit">
                {tx('Datum & Uhrzeit')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="datum_uhrzeit"
                type="datetime-local"
                value={datumUhrzeit}
                onChange={e => setDatumUhrzeit(e.target.value)}
              />
            </div>

            {/* Art */}
            <div className="space-y-1.5">
              <Label>
                {tx('Art der Sitzung')} <span className="text-destructive">*</span>
              </Label>
              <Select value={artKey} onValueChange={setArtKey}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('Bitte wählen …')} />
                </SelectTrigger>
                <SelectContent>
                  {ART_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ort */}
            <div className="space-y-1.5">
              <Label htmlFor="ort">{tx('Ort')}</Label>
              <div className="relative">
                <IconMapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                <Input
                  id="ort"
                  className="pl-9"
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder={tx('z. B. Sitzungssaal A, Online')}
                />
              </div>
            </div>

            {/* Anmeldefrist & Max. Teilnehmer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="anmeldefrist">{tx('Anmeldefrist')}</Label>
                <Input
                  id="anmeldefrist"
                  type="datetime-local"
                  value={anmeldefrist}
                  onChange={e => setAnmeldefrist(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_teilnehmer">{tx('Max. Teilnehmer')}</Label>
                <Input
                  id="max_teilnehmer"
                  type="number"
                  min={1}
                  value={maxTeilnehmer}
                  onChange={e => setMaxTeilnehmer(e.target.value)}
                  placeholder={tx('z. B. 20')}
                />
              </div>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <Label htmlFor="beschreibung">{tx('Beschreibung')}</Label>
              <Textarea
                id="beschreibung"
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder={tx('Themen, Hintergrund, Hinweise …')}
                rows={3}
              />
            </div>
          </div>

          {step1Error && (
            <p className="text-sm text-destructive">{step1Error}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateSitzung}
              disabled={!titel.trim() || !datumUhrzeit || !artKey || step1Saving}
            >
              {step1Saving ? tx('Wird gespeichert …') : tx('Weiter: Tagesordnung')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 2: Tagesordnungspunkte ── */}
      {step === 2 && (
        sitzungId ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{tx('Tagesordnungspunkte')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Füge bis zu 5 Tagesordnungspunkte hinzu. Du kannst diesen Schritt auch überspringen.')}
              </p>
            </div>

            {/* Liste bereits hinzugefügter TOPs */}
            {tops.length > 0 && (
              <div className="space-y-2">
                {tops.map((top, idx) => {
                  const typLabel = TOP_TYP_OPTIONS.find(o => o.key === top.typKey)?.label;
                  const referentMitglied = aktiveMitglieder.find(m => m.record_id === top.referentId);
                  const referentName = referentMitglied
                    ? `${referentMitglied.fields.vorname ?? ''} ${referentMitglied.fields.nachname ?? ''}`.trim()
                    : '';
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border bg-card p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-muted-foreground shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="font-medium truncate">{top.punkt_titel}</span>
                          {typLabel && (
                            <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5">
                              {typLabel}
                            </span>
                          )}
                          {top.dauer && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {top.dauer} {tx('Min.')}
                            </span>
                          )}
                        </div>
                        {referentName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tx('Referent')}: {referentName}
                          </p>
                        )}
                        {top.beschreibung && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {top.beschreibung}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTop(idx)}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                        aria-label={tx('TOP entfernen')}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formular: neuer TOP */}
            {showTopForm && tops.length < 5 && (
              <div className="rounded-2xl border p-4 space-y-3">
                <p className="text-sm font-medium">{tx('Neuer Tagesordnungspunkt')}</p>

                <div className="space-y-1.5">
                  <Label htmlFor="top_titel">
                    {tx('Titel')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="top_titel"
                    value={newTopTitel}
                    onChange={e => setNewTopTitel(e.target.value)}
                    placeholder={tx('z. B. Jahresbericht 2025')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{tx('Typ')}</Label>
                    <Select value={newTopTypKey} onValueChange={setNewTopTypKey}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Typ wählen …')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('Kein Typ')}</SelectItem>
                        {TOP_TYP_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="top_dauer">{tx('Dauer (Min.)')}</Label>
                    <Input
                      id="top_dauer"
                      type="number"
                      min={1}
                      value={newTopDauer}
                      onChange={e => setNewTopDauer(e.target.value)}
                      placeholder={tx('z. B. 15')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{tx('Referent')}</Label>
                  <Select value={newTopReferentId} onValueChange={setNewTopReferentId}>
                    <SelectTrigger>
                      <SelectValue placeholder={tx('Referent wählen …')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Kein Referent')}</SelectItem>
                      {aktiveMitglieder.map(m => (
                        <SelectItem key={m.record_id} value={m.record_id}>
                          {`${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || m.record_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="top_beschreibung">{tx('Beschreibung')}</Label>
                  <Textarea
                    id="top_beschreibung"
                    value={newTopBeschreibung}
                    onChange={e => setNewTopBeschreibung(e.target.value)}
                    placeholder={tx('Kurze Beschreibung des Punktes …')}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddTop}
                    disabled={!newTopTitel.trim()}
                    size="sm"
                  >
                    <IconPlus size={16} className="shrink-0" />
                    {tx('Hinzufügen')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTopForm(false)}
                  >
                    {tx('Abbrechen')}
                  </Button>
                </div>
              </div>
            )}

            {/* Button: neuen TOP starten */}
            {!showTopForm && tops.length < 5 && (
              <Button
                variant="outline"
                onClick={() => setShowTopForm(true)}
                className="w-full"
              >
                <IconPlus size={16} className="shrink-0" />
                {tx('Tagesordnungspunkt hinzufügen')}
              </Button>
            )}

            {tops.length >= 5 && (
              <p className="text-xs text-muted-foreground text-center">
                {tx('Maximal 5 Tagesordnungspunkte erreicht.')}
              </p>
            )}

            {step2Error && (
              <p className="text-sm text-destructive">{step2Error}</p>
            )}

            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSaveTops}
                disabled={step2Saving}
              >
                {step2Saving
                  ? tx('Wird gespeichert …')
                  : tops.length > 0
                    ? tx('Speichern & Weiter')
                    : tx('Schritt überspringen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Mitglieder einladen ── */}
      {step === 3 && (
        sitzungId ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{tx('Mitglieder einladen')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Wähle die Mitglieder aus, die eingeladen werden sollen. Nur aktive Mitglieder werden angezeigt.')}
              </p>
            </div>

            {aktiveMitglieder.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <IconUsers size={40} className="mx-auto text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">{tx('Keine aktiven Mitglieder vorhanden.')}</p>
              </div>
            ) : (
              <>
                {/* Alle auswählen */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    id="alle"
                    checked={selectedMitglieder.size === aktiveMitglieder.length}
                    onCheckedChange={checked => {
                      if (checked) {
                        setSelectedMitglieder(new Set(aktiveMitglieder.map(m => m.record_id)));
                      } else {
                        setSelectedMitglieder(new Set());
                      }
                    }}
                  />
                  <Label htmlFor="alle" className="cursor-pointer font-medium">
                    {tx('Alle auswählen')} ({aktiveMitglieder.length})
                  </Label>
                </div>

                <div className="space-y-1">
                  {aktiveMitglieder.map(m => {
                    const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || m.record_id;
                    const isSelected = selectedMitglieder.has(m.record_id);
                    return (
                      <label
                        key={m.record_id}
                        className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-secondary/50'}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMitglied(m.record_id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {m.fields.funktion && (
                            <p className="text-xs text-muted-foreground truncate">{m.fields.funktion}</p>
                          )}
                        </div>
                        <StatusBadge statusKey={m.fields.status?.key} label={m.fields.status?.label} />
                      </label>
                    );
                  })}
                </div>

                <p className="text-sm text-muted-foreground">
                  {selectedMitglieder.size} {tx('von')} {aktiveMitglieder.length} {tx('Mitgliedern ausgewählt')}
                </p>
              </>
            )}

            {step3Error && (
              <p className="text-sm text-destructive">{step3Error}</p>
            )}

            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleInvite}
                disabled={step3Saving}
              >
                <IconSend size={16} className="shrink-0" />
                {step3Saving
                  ? tx('Wird gesendet …')
                  : selectedMitglieder.size > 0
                    ? tx('Einladungen versenden')
                    : tx('Ohne Einladungen abschließen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Abschluss ── */}
      {step === 4 && (
        done ? (
          <div className="text-center py-12 space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <IconCheck size={48} className="text-primary" stroke={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{tx('Sitzung erfolgreich angelegt!')}</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {selectedMitglieder.size > 0
                  ? `${selectedMitglieder.size} ${tx('Mitglieder wurden eingeladen und der Einladungsstatus auf „Versandt" gesetzt.')}`
                  : tx('Die Sitzung wurde angelegt. Einladungen können später versendet werden.')}
              </p>
              {tops.length > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <IconClipboardList size={16} className="shrink-0" />
                  <span>
                    {tops.length} {tx('Tagesordnungspunkte angelegt')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleReset}>
                {tx('Neue Sitzung planen')}
              </Button>
              <a href="#/">
                <Button variant="outline" className="w-full sm:w-auto">
                  {tx('Zurück zum Dashboard')}
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
