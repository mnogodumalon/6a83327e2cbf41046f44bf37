/**
 * Protokoll anlegen — 3-Schritt-Wizard.
 * Steps: 1) Sitzung wählen → 2) Protokolldaten erfassen → 3) Bestätigen & gespeichert.
 * Reads: sitzungen, mitglieder, protokolle. Writes: protokolle (createProtokolleEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconFileText, IconUser, IconUsers, IconAlertCircle } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Sitzungen, Mitglieder } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProtokollAnlegenPage() {
  const data = useDashboardData();
  const { sitzungen, mitglieder, protokolle, loading, error, fetchAll } = data;

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1: Sitzung selection
  const [selectedSitzung, setSelectedSitzung] = useState<Sitzungen | null>(null);

  // Step 2: Protokoll fields
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [protokollfuehrerKey, setProtokollFuehrerKey] = useState<string>('none');
  const [anwesendeIds, setAnwesendeIds] = useState<Set<string>>(new Set());
  const [zusammenfassung, setZusammenfassung] = useState('');
  const [beschluesse, setBeschluesse] = useState('');

  // Step 3: result
  const [erstelltesProtokollId, setErstelltesProtokollId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filter: Sitzungen ohne freigegebenes Protokoll
  const freigegebeneSitzungsIds = useMemo(() => {
    const ids = new Set<string>();
    protokolle.forEach(p => {
      if (p.fields.status?.key === 'freigegeben' && p.fields.sitzung) {
        const id = extractRecordId(p.fields.sitzung);
        if (id) ids.add(id);
      }
    });
    return ids;
  }, [protokolle]);

  const eligibleSitzungen = useMemo(
    () => sitzungen.filter(s => !freigegebeneSitzungsIds.has(s.record_id)),
    [sitzungen, freigegebeneSitzungsIds]
  );

  // Aktive Mitglieder
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => m.fields.status?.key === 'aktiv'),
    [mitglieder]
  );

  // Vorauswahl: angemeldete_mitglieder der gewählten Sitzung
  const initialAnwesendeIds = useMemo(() => {
    if (!selectedSitzung) return new Set<string>();
    const ids = new Set<string>();
    (selectedSitzung.fields.angemeldete_mitglieder ?? []).forEach(url => {
      const id = extractRecordId(url);
      if (id) ids.add(id);
    });
    return ids;
  }, [selectedSitzung]);

  // Beim Wechsel zu Step 2: Vorauswahl setzen
  const handleSitzungSelect = (id: string) => {
    const sitzung = sitzungen.find(s => s.record_id === id) ?? null;
    setSelectedSitzung(sitzung);

    // Vorauswahl anwesende Mitglieder
    const ids = new Set<string>();
    (sitzung?.fields.angemeldete_mitglieder ?? []).forEach(url => {
      const rid = extractRecordId(url);
      if (rid) ids.add(rid);
    });
    setAnwesendeIds(ids);

    setStep(2);
  };

  const toggleAnwesend = (id: string) => {
    setAnwesendeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedSitzung) return;

    // Idempotenz: falls schon gespeichert, nur weiter
    if (erstelltesProtokollId) {
      setStep(3);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const anwesendUrls = Array.from(anwesendeIds).map(id =>
        createRecordUrl(APP_IDS.MITGLIEDER, id)
      );

      const payload: Record<string, unknown> = {
        sitzung: createRecordUrl(APP_IDS.SITZUNGEN, selectedSitzung.record_id),
        erstellungsdatum,
        zusammenfassung: zusammenfassung || undefined,
        beschluesse: beschluesse || undefined,
        status: 'entwurf',
        anwesende_mitglieder: anwesendUrls.length > 0 ? anwesendUrls : undefined,
      };

      if (protokollfuehrerKey && protokollfuehrerKey !== 'none') {
        payload.protokollfuehrer = createRecordUrl(APP_IDS.MITGLIEDER, protokollfuehrerKey);
      }

      const result = await LivingAppsService.createProtokolleEntry(payload as Parameters<typeof LivingAppsService.createProtokolleEntry>[0]);
      setErstelltesProtokollId(result.record_id);
      await fetchAll();
      setStep(3);
    } catch {
      setSaveError(tx('Fehler beim Speichern. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedSitzung(null);
    setStep(1);
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setProtokollFuehrerKey('none');
    setAnwesendeIds(new Set());
    setZusammenfassung('');
    setBeschluesse('');
    setErstelltesProtokollId(null);
    setSaveError(null);
  };

  const canSave = !!selectedSitzung && !!erstellungsdatum;

  return (
    <IntentWizardShell
      title={tx('Protokoll anlegen')}
      subtitle={tx('Sitzungsprotokoll Schritt für Schritt erstellen')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Protokolldaten') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ───── Schritt 1: Sitzung wählen ───── */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleSitzungen.map(s => ({
            id: s.record_id,
            title: s.fields.titel ?? tx('(Ohne Titel)'),
            subtitle: [
              s.fields.datum_uhrzeit ? formatDate(s.fields.datum_uhrzeit) : null,
              s.fields.ort ?? null,
            ].filter(Boolean).join(' · '),
            status: s.fields.einladungsstatus
              ? { key: s.fields.einladungsstatus.key, label: s.fields.einladungsstatus.label }
              : undefined,
            icon: <IconFileText size={20} className="text-primary" />,
          }))}
          onSelect={handleSitzungSelect}
          searchPlaceholder={tx('Sitzung suchen …')}
          emptyText={tx('Keine Sitzungen ohne freigegebenes Protokoll gefunden.')}
        />
      )}

      {/* ───── Schritt 2: Protokolldaten erfassen ───── */}
      {step === 2 && (
        selectedSitzung ? (
          <div className="space-y-6">
            {/* Kontext-Karte */}
            <div className="rounded-2xl border bg-secondary/30 p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{tx('Gewählte Sitzung')}</p>
              <p className="font-semibold text-foreground">{selectedSitzung.fields.titel ?? tx('(Ohne Titel)')}</p>
              {selectedSitzung.fields.datum_uhrzeit && (
                <p className="text-sm text-muted-foreground">{formatDate(selectedSitzung.fields.datum_uhrzeit)}</p>
              )}
            </div>

            {/* Erstellungsdatum */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {tx('Erstellungsdatum')} <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={erstellungsdatum}
                onChange={e => setErstellungsdatum(e.target.value)}
              />
            </div>

            {/* Protokollführer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <IconUser size={15} className="shrink-0 text-muted-foreground" />
                {tx('Protokollführer')}
              </label>
              <Select value={protokollfuehrerKey} onValueChange={setProtokollFuehrerKey}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('Mitglied auswählen …')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('Kein Protokollführer')}</SelectItem>
                  {aktiveMitglieder.map(m => (
                    <SelectItem key={m.record_id} value={m.record_id}>
                      {[m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || tx('(Unbekannt)')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Anwesende Mitglieder */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <IconUsers size={15} className="shrink-0 text-muted-foreground" />
                {tx('Anwesende Mitglieder')}
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  {anwesendeIds.size} {tx('ausgewählt')}
                </span>
              </label>
              <div className="rounded-xl border divide-y max-h-56 overflow-y-auto">
                {aktiveMitglieder.length === 0 && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">{tx('Keine aktiven Mitglieder gefunden.')}</p>
                )}
                {aktiveMitglieder.map(m => {
                  const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || tx('(Unbekannt)');
                  const checked = anwesendeIds.has(m.record_id);
                  return (
                    <button
                      key={m.record_id}
                      type="button"
                      onClick={() => toggleAnwesend(m.record_id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        checked ? 'bg-primary/8' : 'hover:bg-secondary/50'
                      }`}
                    >
                      <span className={`flex-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                      }`}>
                        {checked && <IconCheck size={13} className="text-primary-foreground" stroke={2.5} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{name}</span>
                        {m.fields.funktion && (
                          <span className="text-xs text-muted-foreground truncate block">{m.fields.funktion}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {initialAnwesendeIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {tx('Vorausgefüllt aus den angemeldeten Mitgliedern der Sitzung.')}
                </p>
              )}
            </div>

            {/* Zusammenfassung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{tx('Zusammenfassung')}</label>
              <Textarea
                value={zusammenfassung}
                onChange={e => setZusammenfassung(e.target.value)}
                placeholder={tx('Verlauf und Ergebnisse der Sitzung …')}
                rows={4}
              />
            </div>

            {/* Beschlüsse */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{tx('Beschlüsse')}</label>
              <Textarea
                value={beschluesse}
                onChange={e => setBeschluesse(e.target.value)}
                placeholder={tx('Gefasste Beschlüsse, Abstimmungsergebnisse …')}
                rows={4}
              />
            </div>

            {/* Fehlermeldung */}
            {saveError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {saveError}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="flex-1 sm:flex-none"
              >
                {saving ? tx('Speichert …') : tx('Protokoll speichern')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Sitzungsauswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ───── Schritt 3: Erfolg ───── */}
      {step === 3 && (
        erstelltesProtokollId ? (
          <div className="flex flex-col items-center text-center py-12 space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <IconCheck size={36} className="text-primary" stroke={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {tx('Protokoll erfolgreich angelegt')}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {tx('Das Protokoll zur Sitzung')}{' '}
                <strong>{selectedSitzung?.fields.titel ?? ''}</strong>{' '}
                {tx('wurde als Entwurf gespeichert.')}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button onClick={handleReset} variant="outline">
                {tx('Weiteres Protokoll anlegen')}
              </Button>
              <a href="#/">
                <Button>{tx('Zurück zum Dashboard')}</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Protokolldaten aus Schritt 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(2)}>{tx('Zurück zu Schritt 2')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
