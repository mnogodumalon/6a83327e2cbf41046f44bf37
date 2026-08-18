/**
 * Protokoll erfassen — 3-Schritt-Wizard.
 * Steps: 1) Sitzung wählen → 2) Protokoll erfassen → 3) Freigabe & Abschluss.
 * Reads: sitzungen, protokolle, mitglieder.
 * Writes: protokolle (createProtokolleEntry, updateProtokolleEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconFileText, IconUserCheck, IconUsers, IconCheck, IconSend } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export default function ProtokollErfassenPage() {
  const data = useDashboardData();
  const { sitzungen, protokolle, mitglieder, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [sitzungId, setSitzungId] = useState<string | null>(null);
  const [protokollId, setProtokollId] = useState<string | null>(null);

  // Schritt 2 Felder
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [protokollfuehrerSelectedId, setProtokollfuehrerSelectedId] = useState<string | null>(null);
  const [anwesendeIds, setAnwesendeIds] = useState<Set<string>>(new Set());
  const [zusammenfassung, setZusammenfassung] = useState('');
  const [beschluesse, setBeschluesse] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [freigegeben, setFreigegeben] = useState(false);
  const [freigabeLoading, setFreigabeLoading] = useState(false);

  // Sitzungen ohne freigegebenes Protokoll filtern
  const freigegebeneSitzungIds = new Set(
    protokolle
      .filter(p => p.fields.status?.key === 'freigegeben')
      .map(p => {
        const url = p.fields.sitzung;
        return url ? extractRecordId(url) : null;
      })
      .filter(Boolean) as string[]
  );

  const eligibleSitzungen = sitzungen.filter(
    s => !freigegebeneSitzungIds.has(s.record_id)
  );

  const selectedSitzung = sitzungen.find(s => s.record_id === sitzungId) ?? null;
  const selectedProtokollfuehrer = mitglieder.find(m => m.record_id === protokollfuehrerSelectedId) ?? null;

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

  const handleProtokollSpeichern = async () => {
    if (!sitzungId) return;
    setSaving(true);
    setSaveError(null);
    try {
      let pid = protokollId;
      if (!pid) {
        const anwesendeUrls = Array.from(anwesendeIds).map(id =>
          createRecordUrl(APP_IDS.MITGLIEDER, id)
        );
        const result = await LivingAppsService.createProtokolleEntry({
          sitzung: createRecordUrl(APP_IDS.SITZUNGEN, sitzungId),
          erstellungsdatum,
          protokollfuehrer: protokollfuehrerSelectedId
            ? createRecordUrl(APP_IDS.MITGLIEDER, protokollfuehrerSelectedId)
            : undefined,
          anwesende_mitglieder: anwesendeUrls.length > 0 ? anwesendeUrls : undefined,
          zusammenfassung: zusammenfassung || undefined,
          beschluesse: beschluesse || undefined,
          status: 'entwurf',
        });
        pid = result.record_id;
        setProtokollId(pid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setSaveError(tx('Das Protokoll konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFreigabe = async () => {
    if (!protokollId) return;
    setFreigabeLoading(true);
    try {
      await LivingAppsService.updateProtokolleEntry(protokollId, { status: 'freigegeben' });
      await fetchAll();
      setFreigegeben(true);
    } catch {
      setSaveError(tx('Freigabe fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setFreigabeLoading(false);
    }
  };

  const handleReset = () => {
    setSitzungId(null);
    setProtokollId(null);
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setProtokollfuehrerSelectedId(null);
    setAnwesendeIds(new Set());
    setZusammenfassung('');
    setBeschluesse('');
    setSaveError(null);
    setFreigegeben(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Protokoll erfassen')}
      subtitle={tx('Sitzungsprotokoll anlegen, Anwesende festhalten und freigeben')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Protokoll') },
        { label: tx('Freigabe') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Sitzung wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleSitzungen.map(s => ({
            id: s.record_id,
            title: s.fields.titel ?? tx('Unbenannte Sitzung'),
            subtitle: [
              s.fields.datum_uhrzeit ? formatDate(s.fields.datum_uhrzeit) : null,
              s.fields.ort,
              s.fields.art?.label,
            ]
              .filter(Boolean)
              .join(' · '),
            status: s.fields.einladungsstatus
              ? { key: s.fields.einladungsstatus.key, label: s.fields.einladungsstatus.label }
              : undefined,
            icon: <IconFileText size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSitzungId(id);
            setStep(2);
          }}
          searchPlaceholder={tx('Sitzung suchen …')}
          emptyText={tx('Alle Sitzungen haben bereits ein freigegebenes Protokoll.')}
          emptyIcon={<IconFileText size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Protokoll erfassen ── */}
      {step === 2 && (
        sitzungId ? (
          <div className="space-y-6">
            {/* Gewählte Sitzung */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-start gap-3">
              <IconFileText size={20} className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedSitzung?.fields.titel ?? ''}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedSitzung?.fields.datum_uhrzeit
                    ? formatDate(selectedSitzung.fields.datum_uhrzeit)
                    : ''}
                  {selectedSitzung?.fields.ort ? ` · ${selectedSitzung.fields.ort}` : ''}
                </p>
              </div>
            </div>

            {/* Erstellungsdatum */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Erstellungsdatum')}</label>
              <Input
                type="date"
                value={erstellungsdatum}
                onChange={e => setErstellungsdatum(e.target.value)}
              />
            </div>

            {/* Protokollführer */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconUserCheck size={16} className="shrink-0 text-muted-foreground" />
                {tx('Protokollführer')}
              </label>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {mitglieder.map(m => {
                  const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
                  const isSelected = protokollfuehrerSelectedId === m.record_id;
                  return (
                    <button
                      key={m.record_id}
                      type="button"
                      onClick={() => setProtokollfuehrerSelectedId(isSelected ? null : m.record_id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-secondary/50'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        {m.fields.funktion && (
                          <p className="text-xs text-muted-foreground truncate">{m.fields.funktion}</p>
                        )}
                      </div>
                      {isSelected && <IconCheck size={16} className="shrink-0 ml-auto text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Anwesende Mitglieder */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconUsers size={16} className="shrink-0 text-muted-foreground" />
                {tx('Anwesende Mitglieder')}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({anwesendeIds.size} {tx('ausgewählt')})
                </span>
              </label>
              <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                {mitglieder.map(m => {
                  const name = [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
                  const isChecked = anwesendeIds.has(m.record_id);
                  return (
                    <button
                      key={m.record_id}
                      type="button"
                      onClick={() => toggleAnwesend(m.record_id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        isChecked
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:bg-secondary/50'
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isChecked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}>
                        {isChecked && <IconCheck size={12} className="text-primary-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        {m.fields.abteilung && (
                          <p className="text-xs text-muted-foreground truncate">{m.fields.abteilung}</p>
                        )}
                      </div>
                      {m.fields.status && (
                        <StatusBadge
                          statusKey={m.fields.status.key}
                          label={m.fields.status.label}
                          className="ml-auto shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zusammenfassung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Zusammenfassung')}</label>
              <Textarea
                value={zusammenfassung}
                onChange={e => setZusammenfassung(e.target.value)}
                placeholder={tx('Kurze Zusammenfassung der Sitzung …')}
                rows={4}
              />
            </div>

            {/* Beschlüsse */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Beschlüsse')}</label>
              <Textarea
                value={beschluesse}
                onChange={e => setBeschluesse(e.target.value)}
                placeholder={tx('Gefasste Beschlüsse der Sitzung …')}
                rows={4}
              />
            </div>

            {saveError && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                {saveError}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
              <Button
                disabled={saving || !erstellungsdatum}
                onClick={handleProtokollSpeichern}
                className="flex-1 sm:flex-none"
              >
                {saving ? tx('Speichern …') : tx('Protokoll speichern')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Sitzung aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Freigabe & Abschluss ── */}
      {step === 3 && (
        protokollId ? (
          <div className="space-y-6">
            {freigegeben ? (
              /* Erfolgs-State */
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
                <div className="flex justify-center">
                  <IconCheck size={48} className="text-emerald-600" />
                </div>
                <h2 className="font-semibold text-lg">{tx('Protokoll freigegeben!')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Das Protokoll ist jetzt in der Anwendung zugänglich und für alle Mitglieder sichtbar.')}
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button variant="outline" onClick={handleReset}>
                    {tx('Neues Protokoll erfassen')}
                  </Button>
                  <a href="#/">
                    <Button>{tx('Zurück zum Dashboard')}</Button>
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Zusammenfassung */}
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h2 className="font-semibold text-base">{tx('Protokoll-Zusammenfassung')}</h2>

                  <div className="grid gap-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                        {tx('Sitzung')}
                      </span>
                      <span className="text-sm font-medium">
                        {selectedSitzung?.fields.titel ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                        {tx('Erstellungsdatum')}
                      </span>
                      <span className="text-sm">
                        {erstellungsdatum ? formatDate(erstellungsdatum) : '—'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                        {tx('Protokollführer')}
                      </span>
                      <span className="text-sm">
                        {selectedProtokollfuehrer
                          ? [selectedProtokollfuehrer.fields.vorname, selectedProtokollfuehrer.fields.nachname]
                              .filter(Boolean)
                              .join(' ') || '—'
                          : tx('Nicht angegeben')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                        {tx('Anwesende')}
                      </span>
                      <span className="text-sm">
                        {anwesendeIds.size > 0
                          ? tx`${anwesendeIds.size} Mitglieder`
                          : tx('Keine angegeben')}
                      </span>
                    </div>
                    {beschluesse && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                          {tx('Beschlüsse')}
                        </span>
                        <span className="text-sm whitespace-pre-line line-clamp-4">{beschluesse}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-32 shrink-0 pt-0.5">
                        {tx('Status')}
                      </span>
                      <StatusBadge statusKey="entwurf" label={tx('Entwurf')} />
                    </div>
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                    {saveError}
                  </p>
                )}

                {/* Aktionen */}
                <div className="rounded-2xl border bg-amber-50/50 border-amber-200/60 p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <IconSend size={16} className="text-amber-600 shrink-0" />
                    {tx('Protokoll freigeben')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx('Nach der Freigabe ist das Protokoll für alle Mitglieder zugänglich. Der Status wird auf „Freigegeben" gesetzt.')}
                  </p>
                  <Button
                    onClick={handleFreigabe}
                    disabled={freigabeLoading}
                    className="w-full sm:w-auto"
                  >
                    {freigabeLoading ? tx('Wird freigegeben …') : tx('Jetzt freigeben')}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    {tx('Protokoll bearbeiten')}
                  </Button>
                  <a href="#/">
                    <Button variant="outline">{tx('Als Entwurf belassen & zum Dashboard')}</Button>
                  </a>
                  <Button variant="ghost" onClick={handleReset}>
                    {tx('Neues Protokoll erfassen')}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht ein gespeichertes Protokoll aus Schritt 2.')}
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
