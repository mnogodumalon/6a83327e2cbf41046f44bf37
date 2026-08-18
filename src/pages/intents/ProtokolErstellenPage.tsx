/**
 * Protokoll erstellen — 2-Schritt-Wizard.
 * Steps: 1) Sitzung auswählen (vergangene, ohne freigegebenes Protokoll) →
 *        2) Protokoll erfassen (Anwesende, Zusammenfassung, Beschlüsse, Datei, Status).
 * Reads: sitzungen, mitglieder. Writes: protokolle (createProtokolleEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState, useMemo } from 'react';
import { format, isBefore } from 'date-fns';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { IconCalendar, IconUsers, IconCheck, IconFileText, IconUpload } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function ProtokolErstellenPage() {
  const data = useDashboardData();
  const { sitzungen, mitglieder, protokolle, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedSitzungId, setSelectedSitzungId] = useState<string | null>(null);

  // Step 2 form state
  const PROTOKOLL_STATUS = LOOKUP_OPTIONS['protokolle']?.['status'] ?? [];
  const today = format(new Date(), 'yyyy-MM-dd');
  const [erstellungsdatum, setErstellungsdatum] = useState(today);
  const [protokollfuehrerId, setProtokollfuehrerId] = useState('');
  const [anwesendeIds, setAnwesendeIds] = useState<Set<string>>(new Set());
  const [zusammenfassung, setZusammenfassung] = useState('');
  const [beschluesse, setBeschluesse] = useState('');
  const [statusKey, setStatusKey] = useState(PROTOKOLL_STATUS[0]?.key ?? 'entwurf');
  const [protokolldatei, setProtokolldatei] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Eligible sitzungen: datum_uhrzeit in the past
  const now = new Date();
  const eligibleSitzungen = useMemo(() => {
    return sitzungen
      .filter(s => {
        if (!s.fields.datum_uhrzeit) return false;
        return isBefore(new Date(s.fields.datum_uhrzeit), now);
      })
      .sort((a, b) => {
        const da = a.fields.datum_uhrzeit ?? '';
        const db = b.fields.datum_uhrzeit ?? '';
        return db.localeCompare(da);
      });
  }, [sitzungen]);

  // Active members for selection
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => m.fields.status?.key === 'aktiv'),
    [mitglieder]
  );

  // Selected sitzung object
  const selectedSitzung = useMemo(
    () => sitzungen.find(s => s.record_id === selectedSitzungId) ?? null,
    [sitzungen, selectedSitzungId]
  );

  // Pre-select angemeldete_mitglieder when sitzung is chosen
  const initAnwesende = (sitzung: typeof selectedSitzung) => {
    if (!sitzung) return;
    const urls = sitzung.fields.angemeldete_mitglieder ?? [];
    const ids = urls
      .map(url => {
        // extract record id from URL
        const parts = url.split('/');
        return parts[parts.length - 1] ?? '';
      })
      .filter(Boolean);
    setAnwesendeIds(new Set(ids));
  };

  const handleSitzungSelect = (id: string) => {
    setSelectedSitzungId(id);
    const sitzung = sitzungen.find(s => s.record_id === id) ?? null;
    initAnwesende(sitzung);
    setStep(2);
  };

  const toggleAnwesend = (memberId: string) => {
    setAnwesendeIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedSitzungId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const anwesendeUrls = Array.from(anwesendeIds).map(id =>
        createRecordUrl(APP_IDS.MITGLIEDER, id)
      );
      await LivingAppsService.createProtokolleEntry({
        sitzung: createRecordUrl(APP_IDS.SITZUNGEN, selectedSitzungId),
        erstellungsdatum,
        protokollfuehrer: protokollfuehrerId
          ? createRecordUrl(APP_IDS.MITGLIEDER, protokollfuehrerId)
          : undefined,
        anwesende_mitglieder: anwesendeUrls.length > 0 ? anwesendeUrls : undefined,
        zusammenfassung: zusammenfassung || undefined,
        beschluesse: beschluesse || undefined,
        status: statusKey,
        protokolldatei: protokolldatei ? protokolldatei.name : undefined,
      });
      await fetchAll();
      setDone(true);
    } catch (e) {
      setSubmitError(tx('Protokoll konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedSitzungId(null);
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setProtokollfuehrerId('');
    setAnwesendeIds(new Set());
    setZusammenfassung('');
    setBeschluesse('');
    setStatusKey(PROTOKOLL_STATUS[0]?.key ?? 'entwurf');
    setProtokolldatei(null);
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Protokoll erstellen')}
        subtitle={tx('Sitzungsprotokoll erfassen und speichern')}
        steps={[{ label: tx('Sitzung') }, { label: tx('Protokoll') }, { label: tx('Fertig') }]}
        currentStep={3}
        onStepChange={setStep}
        loading={false}
        error={null}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center py-16 gap-6">
          <div className="rounded-full bg-emerald-100 p-5">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">{tx('Protokoll gespeichert')}</h2>
            <p className="text-sm text-muted-foreground">
              {tx('Das Protokoll wurde erfolgreich angelegt.')}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={handleReset} variant="outline">
              {tx('Weiteres Protokoll erstellen')}
            </Button>
            <a href="#/">
              <Button>{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Protokoll erstellen')}
      subtitle={tx('Sitzungsprotokoll erfassen und speichern')}
      steps={[{ label: tx('Sitzung') }, { label: tx('Protokoll') }, { label: tx('Fertig') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Sitzung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleSitzungen.map(s => ({
            id: s.record_id,
            title: s.fields.titel ?? tx('(ohne Titel)'),
            subtitle: [
              s.fields.datum_uhrzeit ? formatDate(s.fields.datum_uhrzeit) : null,
              s.fields.ort,
              s.fields.art?.label,
            ]
              .filter(Boolean)
              .join(' · '),
            status: s.fields.art
              ? { key: s.fields.art.key, label: s.fields.art.label }
              : undefined,
            icon: <IconCalendar size={20} className="text-primary" />,
          }))}
          onSelect={handleSitzungSelect}
          searchPlaceholder={tx('Sitzung suchen …')}
          emptyText={tx('Keine vergangenen Sitzungen ohne Protokoll gefunden.')}
          emptyIcon={<IconCalendar size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Protokoll erfassen */}
      {step === 2 && (
        selectedSitzungId ? (
          <div className="space-y-6">
            {/* Sitzung summary */}
            {selectedSitzung && (
              <div className="rounded-2xl border bg-secondary/40 p-4 flex items-start gap-3">
                <IconCalendar size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedSitzung.fields.titel ?? tx('Sitzung')}</p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      selectedSitzung.fields.datum_uhrzeit
                        ? formatDate(selectedSitzung.fields.datum_uhrzeit)
                        : null,
                      selectedSitzung.fields.ort,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  className="ml-auto text-xs text-muted-foreground underline shrink-0"
                  onClick={() => setStep(1)}
                >
                  {tx('Ändern')}
                </button>
              </div>
            )}

            {/* Erstellungsdatum */}
            <div className="space-y-2">
              <Label htmlFor="erstellungsdatum">{tx('Erstellungsdatum')}</Label>
              <Input
                id="erstellungsdatum"
                type="date"
                value={erstellungsdatum}
                onChange={e => setErstellungsdatum(e.target.value)}
              />
            </div>

            {/* Protokollführer */}
            <div className="space-y-2">
              <Label>{tx('Protokollführer')}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border p-3">
                {aktiveMitglieder.map(m => {
                  const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || m.record_id;
                  const isSelected = protokollfuehrerId === m.record_id;
                  return (
                    <button
                      key={m.record_id}
                      onClick={() => setProtokollfuehrerId(isSelected ? '' : m.record_id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'hover:bg-secondary/60'
                      }`}
                    >
                      <IconUsers size={16} className="shrink-0" />
                      <span className="truncate">{name}</span>
                      {isSelected && <IconCheck size={14} className="ml-auto shrink-0" />}
                    </button>
                  );
                })}
                {aktiveMitglieder.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2 py-2">
                    {tx('Keine aktiven Mitglieder gefunden.')}
                  </p>
                )}
              </div>
            </div>

            {/* Anwesende Mitglieder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tx('Anwesende Mitglieder')}</Label>
                <Badge variant="secondary">
                  {anwesendeIds.size} {tx('ausgewählt')}
                </Badge>
              </div>
              <div className="rounded-xl border p-3 space-y-2 max-h-56 overflow-y-auto">
                {aktiveMitglieder.map(m => {
                  const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || m.record_id;
                  return (
                    <div key={m.record_id} className="flex items-center gap-3 py-1">
                      <Checkbox
                        id={`anwesend-${m.record_id}`}
                        checked={anwesendeIds.has(m.record_id)}
                        onCheckedChange={() => toggleAnwesend(m.record_id)}
                      />
                      <Label
                        htmlFor={`anwesend-${m.record_id}`}
                        className="font-normal cursor-pointer"
                      >
                        {name}
                        {m.fields.funktion && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            · {m.fields.funktion}
                          </span>
                        )}
                      </Label>
                    </div>
                  );
                })}
                {aktiveMitglieder.length === 0 && (
                  <p className="text-sm text-muted-foreground">{tx('Keine aktiven Mitglieder.')}</p>
                )}
              </div>
            </div>

            {/* Zusammenfassung */}
            <div className="space-y-2">
              <Label htmlFor="zusammenfassung">{tx('Zusammenfassung')}</Label>
              <Textarea
                id="zusammenfassung"
                value={zusammenfassung}
                onChange={e => setZusammenfassung(e.target.value)}
                placeholder={tx('Kurze Zusammenfassung der Sitzung …')}
                rows={4}
              />
            </div>

            {/* Beschlüsse */}
            <div className="space-y-2">
              <Label htmlFor="beschluesse">{tx('Beschlüsse')}</Label>
              <Textarea
                id="beschluesse"
                value={beschluesse}
                onChange={e => setBeschluesse(e.target.value)}
                placeholder={tx('Gefasste Beschlüsse …')}
                rows={4}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>{tx('Status')}</Label>
              <div className="flex gap-2 flex-wrap">
                {PROTOKOLL_STATUS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setStatusKey(opt.key)}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      statusKey === opt.key
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'hover:bg-secondary/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Protokolldatei */}
            <div className="space-y-2">
              <Label>{tx('Protokolldatei')}</Label>
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-dashed p-4 hover:bg-secondary/40 transition-colors">
                <IconUpload size={20} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {protokolldatei ? protokolldatei.name : tx('Datei auswählen …')}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={e => setProtokolldatei(e.target.files?.[0] ?? null)}
                />
              </label>
              {protokolldatei && (
                <button
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setProtokolldatei(null)}
                >
                  {tx('Datei entfernen')}
                </button>
              )}
            </div>

            {/* Error */}
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !erstellungsdatum}
                className="flex items-center gap-2"
              >
                <IconFileText size={16} className="shrink-0" />
                {submitting ? tx('Wird gespeichert …') : tx('Protokoll speichern')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
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
