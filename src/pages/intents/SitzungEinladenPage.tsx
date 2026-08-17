/**
 * Sitzung Einladen — 3-Schritt-Wizard.
 * Steps: 1) Sitzung wählen (nur Status 'entwurf' oder ohne Wert) →
 *        2) Mitglieder auswählen (nur aktive, Vorauswahl aus bestehender Liste) →
 *        3) Einladung versenden (updateSitzungenEntry + einladungsstatus 'versandt') + Erfolgsmeldung.
 * Reads: sitzungen, mitglieder.
 * Writes: sitzungen (updateSitzungenEntry — eingeladene_mitglieder + einladungsstatus).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Sitzungen, Mitglieder } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  IconCalendar,
  IconUsers,
  IconSend,
  IconCheck,
  IconCopy,
  IconMapPin,
} from '@tabler/icons-react';

export default function SitzungEinladenPage() {
  const data = useDashboardData();
  const { sitzungen, mitglieder, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedSitzung, setSelectedSitzung] = useState<Sitzungen | null>(null);
  const [selectedMitgliederIds, setSelectedMitgliederIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filter: nur Sitzungen mit einladungsstatus 'entwurf' oder ohne Wert
  const offeneSitzungen = sitzungen.filter(s => {
    const key = s.fields.einladungsstatus?.key;
    return !key || key === 'entwurf';
  });

  // Filter: nur aktive Mitglieder
  const aktiveMitglieder = mitglieder.filter(
    (m: Mitglieder) => m.fields.status?.key === 'aktiv'
  );

  const handleSitzungSelect = (id: string) => {
    const sitzung = sitzungen.find(s => s.record_id === id) ?? null;
    setSelectedSitzung(sitzung);

    // Vorauswahl: bereits eingeladene Mitglieder
    if (sitzung?.fields.eingeladene_mitglieder) {
      const vorauswahl = new Set<string>();
      sitzung.fields.eingeladene_mitglieder.forEach(url => {
        const id = extractRecordId(url);
        if (id) vorauswahl.add(id);
      });
      setSelectedMitgliederIds(vorauswahl);
    } else {
      setSelectedMitgliederIds(new Set());
    }

    setStep(2);
  };

  const toggleMitglied = (id: string) => {
    setSelectedMitgliederIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSenden = async () => {
    if (!selectedSitzung) return;
    setSending(true);
    setSendError(null);
    try {
      const urls = Array.from(selectedMitgliederIds).map(id =>
        createRecordUrl(APP_IDS.MITGLIEDER, id)
      );
      await LivingAppsService.updateSitzungenEntry(selectedSitzung.record_id, {
        eingeladene_mitglieder: urls.length > 0 ? urls : undefined,
        einladungsstatus: 'versandt',
      });
      await fetchAll();
      setDone(true);
      setStep(3);
    } catch (_err) {
      setSendError(tx('Fehler beim Versenden. Bitte erneut versuchen.'));
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setSelectedSitzung(null);
    setSelectedMitgliederIds(new Set());
    setSending(false);
    setSendError(null);
    setDone(false);
    setCopiedLink(false);
    setStep(1);
  };

  const eingeladeneNamen = aktiveMitglieder
    .filter(m => selectedMitgliederIds.has(m.record_id))
    .map(m => [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' '))
    .filter(Boolean);

  return (
    <IntentWizardShell
      title={tx('Sitzungseinladung versenden')}
      subtitle={tx('Mitglieder einladen und Einladungsstatus aktualisieren')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Mitglieder') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Sitzung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneSitzungen.map(s => ({
            id: s.record_id,
            title: s.fields.titel ?? tx('(Ohne Titel)'),
            subtitle: [
              s.fields.datum_uhrzeit ? formatDate(s.fields.datum_uhrzeit) : null,
              s.fields.ort ? s.fields.ort : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: s.fields.einladungsstatus
              ? { key: s.fields.einladungsstatus.key, label: s.fields.einladungsstatus.label }
              : { key: 'entwurf', label: tx('Entwurf') },
            stats: [
              {
                label: tx('Art'),
                value: s.fields.art?.label ?? '—',
              },
              {
                label: tx('Max. Teilnehmer'),
                value: s.fields.max_teilnehmer != null ? String(s.fields.max_teilnehmer) : '—',
              },
            ],
            icon: <IconCalendar size={20} className="text-primary" />,
          }))}
          onSelect={handleSitzungSelect}
          searchPlaceholder={tx('Sitzung suchen …')}
          emptyText={tx('Keine offenen Sitzungen gefunden. Alle Sitzungen wurden bereits eingeladen.')}
          emptyIcon={<IconCalendar size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Mitglieder auswählen */}
      {step === 2 && (
        selectedSitzung ? (
          <div className="space-y-6">
            {/* Sitzungs-Kontext */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{tx('Gewählte Sitzung')}</p>
              <p className="font-semibold text-foreground">{selectedSitzung.fields.titel}</p>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                {selectedSitzung.fields.datum_uhrzeit && (
                  <span className="flex items-center gap-1">
                    <IconCalendar size={14} className="shrink-0" />
                    {formatDate(selectedSitzung.fields.datum_uhrzeit)}
                  </span>
                )}
                {selectedSitzung.fields.ort && (
                  <span className="flex items-center gap-1">
                    <IconMapPin size={14} className="shrink-0" />
                    {selectedSitzung.fields.ort}
                  </span>
                )}
              </div>
            </div>

            {/* Mitglieder-Auswahl */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <IconUsers size={18} className="shrink-0 text-primary" />
                  {tx('Aktive Mitglieder')}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {tx(tx`${selectedMitgliederIds.size} ausgewählt`)}
                </span>
              </div>

              {aktiveMitglieder.length === 0 ? (
                <div className="rounded-2xl border bg-secondary p-8 text-center text-muted-foreground text-sm">
                  {tx('Keine aktiven Mitglieder vorhanden.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Alle auswählen / Keine */}
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedMitgliederIds(new Set(aktiveMitglieder.map(m => m.record_id)))
                      }
                    >
                      {tx('Alle auswählen')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMitgliederIds(new Set())}
                    >
                      {tx('Keine')}
                    </Button>
                  </div>

                  {aktiveMitglieder.map(m => {
                    const isSelected = selectedMitgliederIds.has(m.record_id);
                    const vollname = [m.fields.vorname, m.fields.nachname]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={m.record_id}
                        type="button"
                        onClick={() => toggleMitglied(m.record_id)}
                        className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-secondary'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground bg-background'
                          }`}
                        >
                          {isSelected && (
                            <IconCheck size={12} className="text-primary-foreground" stroke={2.5} />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-foreground truncate block">
                            {vollname || tx('(Kein Name)')}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block">
                            {[m.fields.funktion, m.fields.abteilung, m.fields.email]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <StatusBadge
                          statusKey={m.fields.status?.key}
                          label={m.fields.status?.label}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="sm:w-auto w-full"
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedMitgliederIds.size === 0}
                className="sm:flex-1"
              >
                <IconSend size={16} className="shrink-0" />
                {tx('Weiter zur Bestätigung')}
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

      {/* Step 3: Bestätigen & Erfolg */}
      {step === 3 && (
        selectedSitzung ? (
          <div className="space-y-6">
            {done ? (
              /* Erfolgsmeldung */
              <div className="space-y-6">
                <div className="rounded-2xl border bg-card p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <span className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                      <IconCheck size={28} className="text-emerald-600" stroke={2.5} />
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {tx('Einladungen versandt!')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {eingeladeneNamen.length > 0
                      ? tx(tx`${eingeladeneNamen.length} Mitglieder wurden zur Sitzung eingeladen.`)
                      : tx('Die Einladungsliste wurde aktualisiert.')}
                  </p>
                  {eingeladeneNamen.length > 0 && (
                    <p className="text-sm text-foreground font-medium">
                      {eingeladeneNamen.join(', ')}
                    </p>
                  )}
                </div>

                {/* Einlade-Link prominent */}
                {selectedSitzung.fields.einlade_link && (
                  <div className="rounded-2xl border bg-card p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {tx('Einlade-Link zum Weiterleiten')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx('Diesen Link per E-Mail oder Messenger an die eingeladenen Mitglieder weitergeben:')}
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-secondary p-3 min-w-0">
                      <span className="text-sm text-foreground truncate flex-1 min-w-0 font-mono select-all">
                        {selectedSitzung.fields.einlade_link}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => handleCopyLink(selectedSitzung.fields.einlade_link!)}
                      >
                        {copiedLink ? (
                          <IconCheck size={14} className="shrink-0 text-emerald-600" />
                        ) : (
                          <IconCopy size={14} className="shrink-0" />
                        )}
                        {copiedLink ? tx('Kopiert!') : tx('Kopieren')}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={handleReset} className="sm:flex-1">
                    {tx('Neue Einladung erstellen')}
                  </Button>
                  <a href="#/" className="sm:flex-1">
                    <Button className="w-full">
                      {tx('Zurück zum Dashboard')}
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              /* Bestätigung vor dem Senden */
              <div className="space-y-6">
                {/* Zusammenfassung */}
                <div className="rounded-2xl border bg-card p-4 space-y-4">
                  <h3 className="font-semibold text-foreground">{tx('Zusammenfassung')}</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32 shrink-0">{tx('Sitzung')}</span>
                      <span className="font-medium text-foreground truncate">
                        {selectedSitzung.fields.titel}
                      </span>
                    </div>
                    {selectedSitzung.fields.datum_uhrzeit && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">{tx('Datum')}</span>
                        <span className="text-foreground">
                          {formatDate(selectedSitzung.fields.datum_uhrzeit)}
                        </span>
                      </div>
                    )}
                    {selectedSitzung.fields.ort && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">{tx('Ort')}</span>
                        <span className="text-foreground">{selectedSitzung.fields.ort}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-32 shrink-0">{tx('Mitglieder')}</span>
                      <span className="text-foreground font-medium">
                        {tx(tx`${selectedMitgliederIds.size} ausgewählt`)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Liste der ausgewählten Mitglieder */}
                {eingeladeneNamen.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {tx('Einzuladende Mitglieder')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {eingeladeneNamen.map((name, i) => (
                        <span
                          key={i}
                          className="text-xs bg-secondary text-foreground rounded-full px-3 py-1"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hinweis */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground">
                  {tx('Nach dem Versenden wird der Einladungsstatus auf „Versandt" gesetzt. Den Einlade-Link kannst du danach kopieren und per E-Mail weitergeben.')}
                </div>

                {sendError && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-foreground">
                    {sendError}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={sending}
                    className="sm:w-auto w-full"
                  >
                    {tx('Zurück')}
                  </Button>
                  <Button
                    onClick={handleSenden}
                    disabled={sending || selectedMitgliederIds.size === 0}
                    className="sm:flex-1"
                  >
                    <IconSend size={16} className="shrink-0" />
                    {sending ? tx('Wird versandt …') : tx('Einladungen versenden')}
                  </Button>
                </div>
              </div>
            )}
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
