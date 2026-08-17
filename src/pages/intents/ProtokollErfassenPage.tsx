/**
 * Protokoll erfassen — 3-Schritt-Wizard.
 * Steps: 1) Sitzung wählen (nur vergangene, noch ohne Protokoll) →
 *        2) Anwesende bestätigen + Protokollführer wählen →
 *        3) Protokollinhalte erfassen & anlegen.
 * Reads: sitzungen, protokolle, mitglieder.
 * Writes: protokolle (createProtokolleEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState, useMemo } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconCalendar, IconUsers, IconFileText, IconCheck, IconMapPin } from '@tabler/icons-react';

export default function ProtokollErfassenPage() {
  const data = useDashboardData();
  const { sitzungen, protokolle, mitglieder, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);

  // Step 1: gewählte Sitzung
  const [selectedSitzungId, setSelectedSitzungId] = useState<string | null>(null);

  // Step 2: Anwesenheit + Protokollführer
  const [anwesendeIds, setAnwesendeIds] = useState<Set<string>>(new Set());
  const [protokollFuehrerId, setProtokollFuehrerId] = useState<string>('');

  // Step 3: Protokoll-Inhalte
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [zusammenfassung, setZusammenfassung] = useState('');
  const [beschluesse, setBeschluesse] = useState('');
  const [statusKey, setStatusKey] = useState(LOOKUP_OPTIONS['protokolle']?.['status']?.[0]?.key ?? 'entwurf');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdProtokollId, setCreatedProtokollId] = useState<string | null>(null);

  // Bereits protokollierte Sitzungs-IDs ermitteln
  const protokollierteSitzungIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of protokolle) {
      const sid = extractRecordId(p.fields.sitzung);
      if (sid) ids.add(sid);
    }
    return ids;
  }, [protokolle]);

  // Eligible Sitzungen: in der Vergangenheit + noch kein Protokoll
  const now = new Date();
  const eligibleSitzungen = useMemo(() => {
    return sitzungen.filter(s => {
      if (!s.fields.datum_uhrzeit) return false;
      const dt = parseISO(s.fields.datum_uhrzeit);
      if (!isBefore(dt, now)) return false;
      if (protokollierteSitzungIds.has(s.record_id)) return false;
      return true;
    });
  }, [sitzungen, protokollierteSitzungIds]);

  const selectedSitzung = useMemo(
    () => sitzungen.find(s => s.record_id === selectedSitzungId) ?? null,
    [sitzungen, selectedSitzungId],
  );

  // Angemeldete Mitglieder der gewählten Sitzung
  const angemeldeteIds = useMemo(() => {
    if (!selectedSitzung) return [];
    return (selectedSitzung.fields.angemeldete_mitglieder ?? [])
      .map(url => extractRecordId(url))
      .filter((id): id is string => id !== null);
  }, [selectedSitzung]);

  // Aktive Mitglieder für Protokollführer-Auswahl
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => m.fields.status?.key === 'aktiv'),
    [mitglieder],
  );

  // Schritt 1 → 2: Sitzung auswählen und Anwesenheit initialisieren
  const handleSelectSitzung = (id: string) => {
    setSelectedSitzungId(id);
    const sitzung = sitzungen.find(s => s.record_id === id);
    const ids = (sitzung?.fields.angemeldete_mitglieder ?? [])
      .map(url => extractRecordId(url))
      .filter((mid): mid is string => mid !== null);
    setAnwesendeIds(new Set(ids));
    setStep(2);
  };

  const toggleAnwesend = (id: string) => {
    setAnwesendeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Schritt 3: Protokoll anlegen (idempotenz-gesichert)
  const handleSubmit = async () => {
    if (!selectedSitzungId) return;
    if (createdProtokollId) {
      setStep(4);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const anwesendeUrls = Array.from(anwesendeIds).map(id =>
        createRecordUrl(APP_IDS.MITGLIEDER, id),
      );
      const result = await LivingAppsService.createProtokolleEntry({
        sitzung: createRecordUrl(APP_IDS.SITZUNGEN, selectedSitzungId),
        erstellungsdatum,
        protokollfuehrer: protokollFuehrerId
          ? createRecordUrl(APP_IDS.MITGLIEDER, protokollFuehrerId)
          : undefined,
        anwesende_mitglieder: anwesendeUrls.length > 0 ? anwesendeUrls : undefined,
        zusammenfassung: zusammenfassung || undefined,
        beschluesse: beschluesse || undefined,
        status: statusKey,
      });
      setCreatedProtokollId(result.record_id);
      await fetchAll();
      setStep(4);
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedSitzungId(null);
    setAnwesendeIds(new Set());
    setProtokollFuehrerId('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setZusammenfassung('');
    setBeschluesse('');
    setStatusKey(LOOKUP_OPTIONS['protokolle']?.['status']?.[0]?.key ?? 'entwurf');
    setSubmitError(null);
    setCreatedProtokollId(null);
    setStep(1);
  };

  const STATUS_OPTIONS = LOOKUP_OPTIONS['protokolle']?.['status'] ?? [];

  return (
    <IntentWizardShell
      title={tx('Protokoll erfassen')}
      subtitle={tx('Sitzungsprotokoll Schritt für Schritt anlegen')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Anwesende') },
        { label: tx('Protokoll') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Sitzung wählen ─────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleSitzungen.map(s => ({
            id: s.record_id,
            title: s.fields.titel ?? s.record_id,
            subtitle: [
              s.fields.datum_uhrzeit ? formatDate(s.fields.datum_uhrzeit) : null,
              s.fields.ort ?? null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: s.fields.art
              ? { key: s.fields.art.key, label: s.fields.art.label }
              : undefined,
            icon: <IconCalendar size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectSitzung}
          searchPlaceholder={tx('Sitzung suchen …')}
          emptyText={tx('Keine vergangenen Sitzungen ohne Protokoll gefunden.')}
          emptyIcon={<IconFileText size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Anwesende bestätigen ───────────────────────────────── */}
      {step === 2 && (
        selectedSitzung ? (
          <div className="space-y-6">
            {/* Sitzungskontext */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="font-semibold text-foreground">{selectedSitzung.fields.titel}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCalendar size={14} className="shrink-0" />
                <span>{selectedSitzung.fields.datum_uhrzeit ? formatDate(selectedSitzung.fields.datum_uhrzeit) : '—'}</span>
                {selectedSitzung.fields.ort && (
                  <>
                    <IconMapPin size={14} className="shrink-0" />
                    <span>{selectedSitzung.fields.ort}</span>
                  </>
                )}
              </div>
            </div>

            {/* Anwesenheitsliste */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <IconUsers size={16} className="shrink-0 text-primary" />
                <span>{tx('Anwesenheit bestätigen')}</span>
                <span className="ml-auto text-muted-foreground text-xs">
                  {anwesendeIds.size} {tx('anwesend')}
                </span>
              </div>

              {angemeldeteIds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {tx('Keine angemeldeten Mitglieder für diese Sitzung.')}
                </p>
              ) : (
                <div className="rounded-2xl border divide-y overflow-hidden">
                  {angemeldeteIds.map(mid => {
                    const m = mitglieder.find(x => x.record_id === mid);
                    if (!m) return null;
                    const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || mid;
                    return (
                      <label
                        key={mid}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                      >
                        <Checkbox
                          checked={anwesendeIds.has(mid)}
                          onCheckedChange={() => toggleAnwesend(mid)}
                        />
                        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{name}</span>
                        {m.fields.funktion && (
                          <span className="text-xs text-muted-foreground shrink-0">{m.fields.funktion}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Protokollführer */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx('Protokollführer')}</label>
              <Select value={protokollFuehrerId || 'none'} onValueChange={v => setProtokollFuehrerId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tx('Protokollführer wählen …')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                  {aktiveMitglieder.map(m => {
                    const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || m.record_id;
                    return (
                      <SelectItem key={m.record_id} value={m.record_id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={() => setStep(3)}>
              {tx('Weiter zu Protokollinhalten')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Protokollinhalte erfassen ──────────────────────────── */}
      {step === 3 && (
        selectedSitzung ? (
          <div className="space-y-6">
            {/* Zusammenfassung der bisherigen Auswahl */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <div className="font-semibold text-foreground">{selectedSitzung.fields.titel}</div>
              <div className="text-sm text-muted-foreground">
                {anwesendeIds.size} {tx('Anwesende')}
                {protokollFuehrerId && (() => {
                  const pf = mitglieder.find(m => m.record_id === protokollFuehrerId);
                  const pfName = pf ? [pf.fields.vorname, pf.fields.nachname].filter(Boolean).join(' ') : null;
                  return pfName ? ` · ${tx('Protokollführer')}: ${pfName}` : null;
                })()}
              </div>
            </div>

            {/* Erstellungsdatum */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx('Erstellungsdatum')}</label>
              <input
                type="date"
                value={erstellungsdatum}
                onChange={e => setErstellungsdatum(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Zusammenfassung */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx('Zusammenfassung')}</label>
              <Textarea
                value={zusammenfassung}
                onChange={e => setZusammenfassung(e.target.value)}
                placeholder={tx('Wesentliche Inhalte und Ergebnisse der Sitzung …')}
                rows={4}
              />
            </div>

            {/* Beschlüsse */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx('Beschlüsse')}</label>
              <Textarea
                value={beschluesse}
                onChange={e => setBeschluesse(e.target.value)}
                placeholder={tx('Gefasste Beschlüsse und Abstimmungsergebnisse …')}
                rows={4}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{tx('Status')}</label>
              <Select value={statusKey} onValueChange={setStatusKey}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {submitError && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {submitError}
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !erstellungsdatum}
            >
              {submitting ? tx('Protokoll wird angelegt …') : tx('Protokoll anlegen')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Erfolg ─────────────────────────────────────────────── */}
      {step === 4 && (
        createdProtokollId ? (
          <div className="flex flex-col items-center text-center py-12 space-y-6">
            <div className="rounded-full bg-emerald-100 p-4">
              <IconCheck size={40} className="text-emerald-600" stroke={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">{tx('Protokoll erfolgreich angelegt')}</h2>
              {selectedSitzung && (
                <p className="text-sm text-muted-foreground">
                  {tx('Für die Sitzung')}{' '}
                  <span className="font-medium text-foreground">{selectedSitzung.fields.titel}</span>
                  {' '}{tx('wurde ein Protokoll mit')}{' '}
                  <span className="font-medium text-foreground">{anwesendeIds.size}</span>{' '}
                  {tx('Anwesenden erstellt.')}
                </p>
              )}
              <div className="pt-1">
                <StatusBadge statusKey={statusKey} label={STATUS_OPTIONS.find(o => o.key === statusKey)?.label} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                {tx('Weiteres Protokoll anlegen')}
              </Button>
              <Button asChild className="flex-1">
                <a href="#/">{tx('Zurück zum Dashboard')}</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Kein Protokoll gefunden. Bitte starte den Vorgang neu.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
