/**
 * Neue Gremiumssitzung anlegen — 3-Schritt-Wizard.
 * Steps: 1) Sitzungsdetails erfassen → 2) Tagesordnungspunkte hinzufügen → 3) Mitglieder einladen & Einladung versenden.
 * Reads: mitglieder. Writes: sitzungen (createSitzungenEntry), tagesordnungspunkte (createTagesordnungspunkteEntry), sitzungen (updateSitzungenEntry).
 * Composes: IntentWizardShell.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  IconCalendar,
  IconMapPin,
  IconUsers,
  IconPlus,
  IconTrash,
  IconCheck,
  IconClock,
  IconList,
  IconSend,
  IconCircleCheck,
} from '@tabler/icons-react';

interface AgendaItem {
  punkt_titel: string;
  reihenfolge: number;
  dauer: string;
  typKey: string;
  referentId: string;
  beschreibung: string;
}

export default function SitzungEinladenPage() {
  const { mitglieder, loading, error, fetchAll } = useDashboardData();

  // Step 1: Sitzung fields
  const [titel, setTitel] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [artKey, setArtKey] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [anmeldefrist, setAnmeldefrist] = useState('');
  const [maxTeilnehmer, setMaxTeilnehmer] = useState('');

  // Created sitzung id (after step 1)
  const [sitzungId, setSitzungId] = useState('');
  const [sitzungTitel, setSitzungTitel] = useState('');
  const [sitzungDatum, setSitzungDatum] = useState('');

  // Step 2: Tagesordnungspunkte
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [punktTitel, setPunktTitel] = useState('');
  const [punktReihenfolge, setPunktReihenfolge] = useState('');
  const [punktDauer, setPunktDauer] = useState('');
  const [punktTypKey, setPunktTypKey] = useState('');
  const [punktReferentId, setPunktReferentId] = useState('');
  const [punktBeschreibung, setPunktBeschreibung] = useState('');
  const [showAddForm, setShowAddForm] = useState(true);

  // Step 3: Mitglieder einladen
  const [selectedMitglieder, setSelectedMitglieder] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');

  // Wizard state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState('');
  const [done, setDone] = useState(false);
  const [invitedCount, setInvitedCount] = useState(0);

  const ART_OPTIONS = LOOKUP_OPTIONS['sitzungen']?.['art'] ?? [];
  const TYP_OPTIONS = LOOKUP_OPTIONS['tagesordnungspunkte']?.['typ'] ?? [];

  const aktiveMitglieder = mitglieder.filter(m => m.fields.status?.key === 'aktiv');

  const filteredMitglieder = aktiveMitglieder.filter(m => {
    const q = memberSearch.toLowerCase();
    const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.toLowerCase();
    return name.includes(q) || (m.fields.email ?? '').toLowerCase().includes(q) || (m.fields.funktion ?? '').toLowerCase().includes(q);
  });

  // --- Step 1: Sitzung anlegen ---
  const handleCreateSitzung = async () => {
    if (!titel.trim() || !datumUhrzeit || !artKey) {
      setStepError(tx('Bitte Titel, Datum/Uhrzeit und Art angeben.'));
      return;
    }
    setStepError('');
    setSubmitting(true);
    try {
      const result = await LivingAppsService.createSitzungenEntry({
        titel: titel.trim(),
        datum_uhrzeit: datumUhrzeit,
        ort: ort.trim() || undefined,
        art: artKey,
        beschreibung: beschreibung.trim() || undefined,
        anmeldefrist: anmeldefrist || undefined,
        max_teilnehmer: maxTeilnehmer ? Number(maxTeilnehmer) : undefined,
        einladungsstatus: 'entwurf',
      });
      setSitzungId(result.record_id);
      setSitzungTitel(titel.trim());
      setSitzungDatum(datumUhrzeit);
      setStep(2);
    } catch {
      setStepError(tx('Fehler beim Anlegen der Sitzung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Step 2: Tagesordnungspunkt hinzufügen ---
  const handleAddPunkt = () => {
    if (!punktTitel.trim()) return;
    const newItem: AgendaItem = {
      punkt_titel: punktTitel.trim(),
      reihenfolge: punktReihenfolge ? Number(punktReihenfolge) : agendaItems.length + 1,
      dauer: punktDauer,
      typKey: punktTypKey,
      referentId: punktReferentId,
      beschreibung: punktBeschreibung.trim(),
    };
    setAgendaItems(prev => [...prev, newItem]);
    setPunktTitel('');
    setPunktReihenfolge('');
    setPunktDauer('');
    setPunktTypKey('');
    setPunktReferentId('');
    setPunktBeschreibung('');
    setShowAddForm(false);
  };

  const handleRemovePunkt = (index: number) => {
    setAgendaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePunkte = async () => {
    if (!sitzungId) {
      setStep(1);
      return;
    }
    setStepError('');
    setSubmitting(true);
    try {
      for (const item of agendaItems) {
        await LivingAppsService.createTagesordnungspunkteEntry({
          sitzung: createRecordUrl(APP_IDS.SITZUNGEN, sitzungId),
          punkt_titel: item.punkt_titel,
          reihenfolge: item.reihenfolge,
          dauer: item.dauer ? Number(item.dauer) : undefined,
          typ: item.typKey || undefined,
          referent: item.referentId ? createRecordUrl(APP_IDS.MITGLIEDER, item.referentId) : undefined,
          beschreibung: item.beschreibung || undefined,
        });
      }
      await fetchAll();
      setStep(3);
    } catch {
      setStepError(tx('Fehler beim Speichern der Tagesordnungspunkte. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipPunkte = () => {
    setStep(3);
  };

  // --- Step 3: Mitglieder einladen ---
  const toggleMitglied = (id: string) => {
    setSelectedMitglieder(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMitglieder.size === filteredMitglieder.length) {
      setSelectedMitglieder(new Set());
    } else {
      setSelectedMitglieder(new Set(filteredMitglieder.map(m => m.record_id)));
    }
  };

  const handleSendInvitations = async () => {
    if (!sitzungId) {
      setStep(1);
      return;
    }
    if (selectedMitglieder.size === 0) {
      setStepError(tx('Bitte mindestens ein Mitglied auswählen.'));
      return;
    }
    setStepError('');
    setSubmitting(true);
    try {
      const urls = Array.from(selectedMitglieder).map(id => createRecordUrl(APP_IDS.MITGLIEDER, id));
      await LivingAppsService.updateSitzungenEntry(sitzungId, {
        eingeladene_mitglieder: urls,
        einladungsstatus: 'versandt',
      });
      await fetchAll();
      setInvitedCount(selectedMitglieder.size);
      setDone(true);
    } catch {
      setStepError(tx('Fehler beim Versenden der Einladungen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitel('');
    setDatumUhrzeit('');
    setOrt('');
    setArtKey('');
    setBeschreibung('');
    setAnmeldefrist('');
    setMaxTeilnehmer('');
    setSitzungId('');
    setSitzungTitel('');
    setSitzungDatum('');
    setAgendaItems([]);
    setPunktTitel('');
    setPunktReihenfolge('');
    setPunktDauer('');
    setPunktTypKey('');
    setPunktReferentId('');
    setPunktBeschreibung('');
    setShowAddForm(true);
    setSelectedMitglieder(new Set());
    setMemberSearch('');
    setStepError('');
    setDone(false);
    setInvitedCount(0);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Neue Sitzung einladen')}
      subtitle={tx('Sitzung anlegen, Tagesordnung erfassen und Mitglieder einladen')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Tagesordnung') },
        { label: tx('Einladen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Sitzungsdetails ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tx('Sitzungsdetails erfassen')}</h2>
            <p className="text-sm text-muted-foreground">{tx('Pflichtfelder: Titel, Datum/Uhrzeit und Art der Sitzung.')}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Titel */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tx('Titel')} <span className="text-destructive">*</span>
              </label>
              <Input
                value={titel}
                onChange={e => setTitel(e.target.value)}
                placeholder={tx('z. B. Vorstandssitzung Q3 2026')}
              />
            </div>

            {/* Datum & Uhrzeit */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tx('Datum & Uhrzeit')} <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <IconCalendar size={16} className="shrink-0 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={datumUhrzeit}
                  onChange={e => setDatumUhrzeit(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Art */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tx('Art der Sitzung')} <span className="text-destructive">*</span>
              </label>
              <Select value={artKey} onValueChange={setArtKey}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('Art wählen …')} />
                </SelectTrigger>
                <SelectContent>
                  {ART_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ort */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Ort')}</label>
              <div className="flex items-center gap-2">
                <IconMapPin size={16} className="shrink-0 text-muted-foreground" />
                <Input
                  value={ort}
                  onChange={e => setOrt(e.target.value)}
                  placeholder={tx('z. B. Konferenzraum A')}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Anmeldefrist & Max. Teilnehmer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{tx('Anmeldefrist')}</label>
                <div className="flex items-center gap-2">
                  <IconClock size={16} className="shrink-0 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={anmeldefrist}
                    onChange={e => setAnmeldefrist(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{tx('Max. Teilnehmer')}</label>
                <Input
                  type="number"
                  min="1"
                  value={maxTeilnehmer}
                  onChange={e => setMaxTeilnehmer(e.target.value)}
                  placeholder={tx('Unbegrenzt')}
                />
              </div>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Beschreibung')}</label>
              <Textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder={tx('Themen, Ziele oder Hinweise zur Sitzung …')}
                rows={3}
              />
            </div>
          </div>

          {stepError && (
            <p className="text-sm text-destructive">{stepError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleCreateSitzung}
              disabled={submitting || !titel.trim() || !datumUhrzeit || !artKey}
            >
              {submitting ? tx('Wird angelegt …') : tx('Sitzung anlegen & weiter')}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Tagesordnungspunkte ── */}
      {step === 2 && (
        <div className="space-y-6">
          {!sitzungId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}</p>
              <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{tx('Tagesordnungspunkte')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Punkte für die Sitzung hinzufügen. Dieser Schritt ist optional.')}
                </p>
              </div>

              {/* Vorhandene Punkte */}
              {agendaItems.length > 0 && (
                <div className="space-y-2">
                  {agendaItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {item.reihenfolge}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.punkt_titel}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {item.typKey && (
                            <Badge variant="secondary" className="text-xs">
                              {TYP_OPTIONS.find(o => o.key === item.typKey)?.label ?? item.typKey}
                            </Badge>
                          )}
                          {item.dauer && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconClock size={12} className="shrink-0" />
                              {item.dauer} {tx('Min.')}
                            </span>
                          )}
                          {item.referentId && (
                            <span className="text-xs text-muted-foreground">
                              {(() => {
                                const m = mitglieder.find(m => m.record_id === item.referentId);
                                return m ? `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() : '';
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePunkt(index)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                        aria-label={tx('Entfernen')}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formular für neuen Punkt */}
              {showAddForm ? (
                <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <IconList size={16} className="shrink-0 text-primary" />
                    {tx('Neuen Punkt hinzufügen')}
                  </p>

                  <div className="space-y-3">
                    <Input
                      value={punktTitel}
                      onChange={e => setPunktTitel(e.target.value)}
                      placeholder={tx('Titel des Tagesordnungspunkts *')}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        type="number"
                        min="1"
                        value={punktReihenfolge}
                        onChange={e => setPunktReihenfolge(e.target.value)}
                        placeholder={tx('Nr. (opt.)')}
                      />
                      <Input
                        type="number"
                        min="1"
                        value={punktDauer}
                        onChange={e => setPunktDauer(e.target.value)}
                        placeholder={tx('Dauer (Min.)')}
                      />
                      <Select value={punktTypKey || 'none'} onValueChange={v => setPunktTypKey(v === 'none' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Typ wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Kein Typ')}</SelectItem>
                          {TYP_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Select value={punktReferentId || 'none'} onValueChange={v => setPunktReferentId(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Referent wählen (opt.)')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('Kein Referent')}</SelectItem>
                        {aktiveMitglieder.map(m => (
                          <SelectItem key={m.record_id} value={m.record_id}>
                            {`${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim()}
                            {m.fields.funktion ? ` – ${m.fields.funktion}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Textarea
                      value={punktBeschreibung}
                      onChange={e => setPunktBeschreibung(e.target.value)}
                      placeholder={tx('Kurze Beschreibung (opt.)')}
                      rows={2}
                    />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(false)}
                      >
                        {tx('Abbrechen')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddPunkt}
                        disabled={!punktTitel.trim()}
                      >
                        <IconPlus size={16} className="shrink-0 mr-1" />
                        {tx('Hinzufügen')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                  className="w-full"
                >
                  <IconPlus size={16} className="shrink-0 mr-2" />
                  {tx('Weiteren Punkt hinzufügen')}
                </Button>
              )}

              {stepError && (
                <p className="text-sm text-destructive">{stepError}</p>
              )}

              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="outline" onClick={handleSkipPunkte} disabled={submitting}>
                  {tx('Schritt überspringen')}
                </Button>
                <Button
                  onClick={handleSavePunkte}
                  disabled={submitting || agendaItems.length === 0}
                >
                  {submitting
                    ? tx('Wird gespeichert …')
                    : agendaItems.length === 0
                      ? tx('Weiter ohne Punkte')
                      : tx(tx`${agendaItems.length} Punkt${agendaItems.length === 1 ? '' : 'e'} speichern & weiter`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Mitglieder einladen ── */}
      {step === 3 && (
        <div className="space-y-6">
          {!sitzungId ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}</p>
              <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
            </div>
          ) : done ? (
            /* Erfolg */
            <div className="flex flex-col items-center text-center py-10 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <IconCircleCheck size={40} className="text-emerald-500" stroke={1.5} />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{tx('Einladungen versendet!')}</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {tx('Die Einladung zur Sitzung wurde an')} <strong>{invitedCount}</strong> {tx('Mitglied(er) verschickt.')}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 w-full max-w-sm text-left space-y-2">
                <p className="text-sm font-medium truncate">{sitzungTitel}</p>
                {sitzungDatum && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <IconCalendar size={13} className="shrink-0" />
                    {format(new Date(sitzungDatum.replace('T', ' ')), "dd.MM.yyyy 'um' HH:mm 'Uhr'")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <IconUsers size={13} className="shrink-0" />
                  {invitedCount} {tx('Mitglied(er) eingeladen')}
                </p>
                {agendaItems.length > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <IconList size={13} className="shrink-0" />
                    {agendaItems.length} {tx('Tagesordnungspunkt(e)')}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset}>
                  {tx('Neue Sitzung anlegen')}
                </Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{tx('Mitglieder einladen')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Aktive Mitglieder auswählen, die zur Sitzung eingeladen werden sollen.')}
                </p>
              </div>

              {/* Auswahl-Zusammenfassung */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {selectedMitglieder.size > 0
                    ? tx(tx`${selectedMitglieder.size} von ${aktiveMitglieder.length} Mitgliedern ausgewählt`)
                    : tx(tx`${aktiveMitglieder.length} aktive Mitglieder`)}
                </span>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedMitglieder.size === filteredMitglieder.length && filteredMitglieder.length > 0
                    ? tx('Alle abwählen')
                    : tx('Alle auswählen')}
                </Button>
              </div>

              {/* Suche */}
              <Input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder={tx('Mitglied suchen …')}
              />

              {/* Mitgliederliste */}
              {filteredMitglieder.length === 0 ? (
                <div className="text-center py-8">
                  <IconUsers size={40} className="mx-auto text-muted-foreground mb-2" stroke={1.5} />
                  <p className="text-sm text-muted-foreground">
                    {memberSearch ? tx('Keine Mitglieder gefunden.') : tx('Keine aktiven Mitglieder vorhanden.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredMitglieder.map(m => {
                    const isSelected = selectedMitglieder.has(m.record_id);
                    const fullName = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim();
                    return (
                      <button
                        key={m.record_id}
                        type="button"
                        onClick={() => toggleMitglied(m.record_id)}
                        className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'bg-card hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isSelected ? 'border-primary bg-primary' : 'border-border'
                        }`}>
                          {isSelected && <IconCheck size={12} className="text-primary-foreground" stroke={2.5} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{fullName || m.record_id}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {m.fields.funktion && (
                              <span className="text-xs text-muted-foreground truncate">{m.fields.funktion}</span>
                            )}
                            {m.fields.email && (
                              <span className="text-xs text-muted-foreground truncate">{m.fields.email}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {stepError && (
                <p className="text-sm text-destructive">{stepError}</p>
              )}

              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                  {tx('Zurück')}
                </Button>
                <Button
                  onClick={handleSendInvitations}
                  disabled={submitting || selectedMitglieder.size === 0}
                >
                  <IconSend size={16} className="shrink-0 mr-2" />
                  {submitting
                    ? tx('Wird gesendet …')
                    : tx(tx`Einladung an ${selectedMitglieder.size} Mitglied(er) versenden`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
