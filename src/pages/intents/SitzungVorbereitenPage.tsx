/**
 * Sitzung vorbereiten — 3-Schritt-Wizard.
 * Steps: 1) Sitzung anlegen → 2) Tagesordnungspunkte hinzufügen → 3) Mitglieder einladen.
 * Reads: mitglieder. Writes: sitzungen (createSitzungenEntry, updateSitzungenEntry),
 *        tagesordnungspunkte (createTagesordnungspunkteEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconCalendar, IconMapPin, IconUsers, IconPlus, IconTrash, IconCheck, IconList } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface TopEntry {
  punkt_titel: string;
  beschreibung: string;
  reihenfolge: number;
  dauer: string;
  typKey: string;
  referentId: string;
}

export default function SitzungVorbereitenPage() {
  const { mitglieder, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Schritt 1: Sitzungsfelder
  const [titel, setTitel] = useState('');
  const [datumUhrzeit, setDatumUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [artKey, setArtKey] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [anmeldefrist, setAnmeldefrist] = useState('');
  const [maxTeilnehmer, setMaxTeilnehmer] = useState('');

  // Erstellte Sitzung id
  const [sitzungId, setSitzungId] = useState<string | null>(null);
  const [step1Saving, setStep1Saving] = useState(false);
  const [step1Error, setStep1Error] = useState('');

  // Schritt 2: TOP-Liste
  const [tops, setTops] = useState<TopEntry[]>([]);
  const [showTopForm, setShowTopForm] = useState(false);
  const [topTitel, setTopTitel] = useState('');
  const [topBeschreibung, setTopBeschreibung] = useState('');
  const [topDauer, setTopDauer] = useState('');
  const [topTypKey, setTopTypKey] = useState('');
  const [topReferentId, setTopReferentId] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Schritt 3: Mitglieder-Auswahl
  const [selectedMitglieder, setSelectedMitglieder] = useState<Set<string>>(new Set());
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState('');
  const [done, setDone] = useState(false);

  // Lookup-Optionen (innerhalb der Komponente, locale-aware)
  const ART_OPTIONS = LOOKUP_OPTIONS['sitzungen']?.['art'] ?? [];
  const TYP_OPTIONS = LOOKUP_OPTIONS['tagesordnungspunkte']?.['typ'] ?? [];

  // Aktive Mitglieder
  const aktiveMitglieder = mitglieder.filter(m => m.fields.status?.key === 'aktiv');

  // --- Schritt 1: Sitzung anlegen ---
  async function handleCreateSitzung() {
    if (!titel || !datumUhrzeit || !artKey) return;
    setStep1Error('');
    setStep1Saving(true);
    try {
      const result = await LivingAppsService.createSitzungenEntry({
        titel,
        datum_uhrzeit: datumUhrzeit,
        ort: ort || undefined,
        art: artKey,
        beschreibung: beschreibung || undefined,
        anmeldefrist: anmeldefrist || undefined,
        max_teilnehmer: maxTeilnehmer ? Number(maxTeilnehmer) : undefined,
        einladungsstatus: 'entwurf',
      });
      setSitzungId(result.record_id);
      await fetchAll();
      setStep(2);
    } catch {
      setStep1Error(tx('Fehler beim Anlegen der Sitzung. Bitte erneut versuchen.'));
    } finally {
      setStep1Saving(false);
    }
  }

  // --- Schritt 2: TOP hinzufügen ---
  function handleAddTopToList() {
    if (!topTitel) return;
    const newTop: TopEntry = {
      punkt_titel: topTitel,
      beschreibung: topBeschreibung,
      reihenfolge: tops.length + 1,
      dauer: topDauer,
      typKey: topTypKey,
      referentId: topReferentId,
    };
    setTops(prev => [...prev, newTop]);
    setTopTitel('');
    setTopBeschreibung('');
    setTopDauer('');
    setTopTypKey('');
    setTopReferentId('');
    setShowTopForm(false);
  }

  function handleRemoveTop(index: number) {
    setTops(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((t, i) => ({ ...t, reihenfolge: i + 1 }));
    });
  }

  async function handleSaveTops() {
    if (!sitzungId) return;
    setStep2Error('');
    setStep2Saving(true);
    try {
      for (const top of tops) {
        await LivingAppsService.createTagesordnungspunkteEntry({
          sitzung: createRecordUrl(APP_IDS.SITZUNGEN, sitzungId),
          punkt_titel: top.punkt_titel,
          beschreibung: top.beschreibung || undefined,
          reihenfolge: top.reihenfolge,
          dauer: top.dauer ? Number(top.dauer) : undefined,
          typ: top.typKey || undefined,
          referent: top.referentId ? createRecordUrl(APP_IDS.MITGLIEDER, top.referentId) : undefined,
        });
      }
      await fetchAll();
      setStep(3);
    } catch {
      setStep2Error(tx('Fehler beim Speichern der Tagesordnungspunkte. Bitte erneut versuchen.'));
    } finally {
      setStep2Saving(false);
    }
  }

  // --- Schritt 3: Mitglieder einladen ---
  function toggleMitglied(id: string) {
    setSelectedMitglieder(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedMitglieder.size === aktiveMitglieder.length) {
      setSelectedMitglieder(new Set());
    } else {
      setSelectedMitglieder(new Set(aktiveMitglieder.map(m => m.record_id)));
    }
  }

  async function handleSendEinladungen() {
    if (!sitzungId) return;
    setStep3Error('');
    setStep3Saving(true);
    try {
      const urls = Array.from(selectedMitglieder).map(id =>
        createRecordUrl(APP_IDS.MITGLIEDER, id)
      );
      await LivingAppsService.updateSitzungenEntry(sitzungId, {
        eingeladene_mitglieder: urls.length > 0 ? urls : undefined,
        einladungsstatus: 'versandt',
      });
      await fetchAll();
      setDone(true);
    } catch {
      setStep3Error(tx('Fehler beim Versenden der Einladungen. Bitte erneut versuchen.'));
    } finally {
      setStep3Saving(false);
    }
  }

  // --- Erfolgszustand ---
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-6">
              <IconCheck size={48} className="text-emerald-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{tx('Sitzung vorbereitet!')}</h1>
            <p className="text-muted-foreground">
              {tx('Einladungen wurden versandt und die Tagesordnung ist bereit.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setTitel('');
                setDatumUhrzeit('');
                setOrt('');
                setArtKey('');
                setBeschreibung('');
                setAnmeldefrist('');
                setMaxTeilnehmer('');
                setSitzungId(null);
                setTops([]);
                setSelectedMitglieder(new Set());
                setDone(false);
              }}
            >
              {tx('Neue Sitzung vorbereiten')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Sitzung vorbereiten')}
      subtitle={tx('Sitzung anlegen, Tagesordnung aufbauen und Mitglieder einladen')}
      steps={[
        { label: tx('Sitzung') },
        { label: tx('Tagesordnung') },
        { label: tx('Einladungen') },
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
            <h2 className="text-lg font-semibold">{tx('Neue Sitzung anlegen')}</h2>
            <p className="text-sm text-muted-foreground">{tx('Lege die Eckdaten für die Sitzung fest.')}</p>
          </div>

          <div className="space-y-4">
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
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconCalendar size={16} className="shrink-0 text-muted-foreground" />
                {tx('Datum & Uhrzeit')} <span className="text-destructive">*</span>
              </label>
              <Input
                type="datetime-local"
                value={datumUhrzeit}
                onChange={e => setDatumUhrzeit(e.target.value)}
              />
            </div>

            {/* Ort */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconMapPin size={16} className="shrink-0 text-muted-foreground" />
                {tx('Ort')}
              </label>
              <Input
                value={ort}
                onChange={e => setOrt(e.target.value)}
                placeholder={tx('z. B. Konferenzraum A')}
              />
            </div>

            {/* Art der Sitzung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tx('Art der Sitzung')} <span className="text-destructive">*</span>
              </label>
              <Select value={artKey || 'none'} onValueChange={v => setArtKey(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={tx('Bitte wählen …')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                  {ART_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Beschreibung')}</label>
              <Textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder={tx('Kurze Zusammenfassung der Sitzungsziele …')}
                rows={3}
              />
            </div>

            {/* Anmeldefrist */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Anmeldefrist')}</label>
              <Input
                type="datetime-local"
                value={anmeldefrist}
                onChange={e => setAnmeldefrist(e.target.value)}
              />
            </div>

            {/* Max. Teilnehmer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tx('Max. Teilnehmer')}</label>
              <Input
                type="number"
                min={1}
                value={maxTeilnehmer}
                onChange={e => setMaxTeilnehmer(e.target.value)}
                placeholder={tx('z. B. 20')}
              />
            </div>
          </div>

          {step1Error && (
            <p className="text-sm text-destructive">{step1Error}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              disabled={!titel || !datumUhrzeit || !artKey || step1Saving}
              onClick={handleCreateSitzung}
            >
              {step1Saving ? tx('Wird gespeichert …') : tx('Sitzung anlegen & weiter')}
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
                {tx('Füge die Punkte der Tagesordnung hinzu. Du kannst auch ohne Punkte fortfahren.')}
              </p>
            </div>

            {/* Liste der hinzugefügten TOPs */}
            {tops.length > 0 && (
              <div className="space-y-2">
                {tops.map((top, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {top.reihenfolge}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate font-medium text-sm">{top.punkt_titel}</p>
                      {top.beschreibung && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{top.beschreibung}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {top.typKey && (
                          <span className="text-xs text-muted-foreground">
                            {TYP_OPTIONS.find(o => o.key === top.typKey)?.label ?? top.typKey}
                          </span>
                        )}
                        {top.dauer && (
                          <span className="text-xs text-muted-foreground">{top.dauer} {tx('Min.')}</span>
                        )}
                        {top.referentId && (
                          <span className="text-xs text-muted-foreground">
                            {(() => {
                              const m = mitglieder.find(m => m.record_id === top.referentId);
                              return m ? `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() : '';
                            })()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveTop(i)}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {tops.length === 0 && !showTopForm && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center gap-3">
                <IconList size={32} className="text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">{tx('Noch keine Tagesordnungspunkte hinzugefügt.')}</p>
              </div>
            )}

            {/* Formular für neuen TOP */}
            {showTopForm && (
              <div className="rounded-2xl border bg-secondary/30 p-4 space-y-4">
                <h3 className="text-sm font-semibold">{tx('Neuer Tagesordnungspunkt')}</h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {tx('Titel')} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={topTitel}
                      onChange={e => setTopTitel(e.target.value)}
                      placeholder={tx('z. B. Genehmigung des Jahresberichts')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{tx('Beschreibung')}</label>
                    <Textarea
                      value={topBeschreibung}
                      onChange={e => setTopBeschreibung(e.target.value)}
                      placeholder={tx('Erläuterung des Punktes …')}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{tx('Typ')}</label>
                      <Select value={topTypKey || 'none'} onValueChange={v => setTopTypKey(v === 'none' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Typ wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Kein Typ')}</SelectItem>
                          {TYP_OPTIONS.map(opt => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{tx('Dauer (Min.)')}</label>
                      <Input
                        type="number"
                        min={1}
                        value={topDauer}
                        onChange={e => setTopDauer(e.target.value)}
                        placeholder="15"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{tx('Referent')}</label>
                    <Select value={topReferentId || 'none'} onValueChange={v => setTopReferentId(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Referent wählen')} />
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
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowTopForm(false);
                    setTopTitel('');
                    setTopBeschreibung('');
                    setTopDauer('');
                    setTopTypKey('');
                    setTopReferentId('');
                  }}>
                    {tx('Abbrechen')}
                  </Button>
                  <Button
                    disabled={!topTitel}
                    onClick={handleAddTopToList}
                  >
                    {tx('Hinzufügen')}
                  </Button>
                </div>
              </div>
            )}

            {!showTopForm && (
              <Button variant="outline" className="w-full" onClick={() => setShowTopForm(true)}>
                <IconPlus size={16} className="shrink-0 mr-2" />
                {tx('Punkt hinzufügen')}
              </Button>
            )}

            {step2Error && (
              <p className="text-sm text-destructive">{step2Error}</p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSaveTops}
                disabled={step2Saving}
              >
                {step2Saving
                  ? tx('Wird gespeichert …')
                  : tops.length > 0
                    ? tx('Punkte speichern & weiter')
                    : tx('Ohne Punkte weiter')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Sitzung aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
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
                {tx('Wähle die Mitglieder aus, die zur Sitzung eingeladen werden sollen.')}
              </p>
            </div>

            {aktiveMitglieder.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center gap-3">
                <IconUsers size={32} className="text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">{tx('Keine aktiven Mitglieder gefunden.')}</p>
              </div>
            ) : (
              <>
                {/* Alle auswählen */}
                <div className="flex items-center gap-3 rounded-xl border bg-secondary/30 p-3">
                  <Checkbox
                    id="alle"
                    checked={selectedMitglieder.size === aktiveMitglieder.length && aktiveMitglieder.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <label htmlFor="alle" className="text-sm font-medium cursor-pointer select-none">
                    {tx('Alle auswählen')}
                  </label>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {selectedMitglieder.size} / {aktiveMitglieder.length} {tx('ausgewählt')}
                  </span>
                </div>

                {/* Mitgliederliste */}
                <div className="space-y-2">
                  {aktiveMitglieder.map(m => {
                    const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || m.record_id;
                    const checked = selectedMitglieder.has(m.record_id);
                    return (
                      <div
                        key={m.record_id}
                        className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                          checked ? 'border-primary bg-primary/5' : 'bg-card hover:bg-secondary/30'
                        }`}
                        onClick={() => toggleMitglied(m.record_id)}
                      >
                        <Checkbox
                          id={`m-${m.record_id}`}
                          checked={checked}
                          onCheckedChange={() => toggleMitglied(m.record_id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {m.fields.funktion && (
                              <span className="text-xs text-muted-foreground truncate">{m.fields.funktion}</span>
                            )}
                            {m.fields.email && (
                              <span className="text-xs text-muted-foreground truncate">{m.fields.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {step3Error && (
              <p className="text-sm text-destructive">{step3Error}</p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              <Button
                disabled={step3Saving}
                onClick={handleSendEinladungen}
              >
                {step3Saving
                  ? tx('Wird gespeichert …')
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
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
