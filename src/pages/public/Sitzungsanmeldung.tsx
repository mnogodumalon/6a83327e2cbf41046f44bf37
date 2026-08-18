import { useEffect, useState } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { IconCalendar, IconMapPin, IconClock, IconUsers, IconCheck, IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  recordRef,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx } from '@/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SitzungFields {
  titel?: string;
  datum_uhrzeit?: string;
  ort?: string;
  art?: string;
  beschreibung?: string;
  anmeldefrist?: string;
  max_teilnehmer?: number | null;
  einladungsstatus?: string;
  angemeldete_mitglieder?: unknown[];
}

interface MitgliedFields {
  vorname?: string;
  nachname?: string;
  email?: string;
  status?: string;
}

type Step = 'loading' | 'detail' | 'form' | 'submitting' | 'success' | 'error' | 'closed' | 'not_found';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDatum(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy, HH:mm') + ' Uhr';
  } catch {
    return iso;
  }
}

function formatFrist(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy, HH:mm') + ' Uhr';
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Sitzungsanmeldung() {
  const ART_LABELS: Record<string, string> = {
  ordentlich: 'Ordentliche Sitzung',
  ausserordentlich: 'Außerordentliche Sitzung',
  klausur: 'Klausursitzung',
  information: 'Informationssitzung',
};

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [step, setStep] = useState<Step>('loading');

  // Sitzung state
  const [sitzung, setSitzung] = useState<PublicRecordResult | null>(null);
  const [sitzungId, setSitzungId] = useState<string | null>(null);
  const [angemeldeteCount, setAngemeldeteCount] = useState<number>(0);

  // Form state
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // App IDs from endpoints
  const [sitzungenAppId, setSitzungenAppId] = useState('');
  const [mitgliederAppId, setMitgliederAppId] = useState('');

  // All hooks above — now init
  useEffect(() => {
    loadPublicPagesConfig('sitzungsanmeldung').then(c => {
      if (!c) { setStep('error'); return; }
      const p = c.pages['sitzungsanmeldung'] ?? null;
      if (!p) { setStep('error'); return; }

      const sitzEp = p.endpoints?.find(e => e.op === 'list' && e.entity === 'sitzungen');
      const mitEp = p.endpoints?.find(e => e.op === 'list' && e.entity === 'mitglieder');
      setSitzungenAppId(sitzEp?.app_id ?? '');
      setMitgliederAppId(mitEp?.app_id ?? '');

      // Read sitzung_id from URL hash params
      const hash = window.location.hash || '';
      const q = hash.indexOf('?');
      const paramStr = q !== -1 ? hash.slice(q + 1) : '';
      const params = new URLSearchParams(paramStr);
      const sid = params.get('sitzung_id') ?? null;
      setSitzungId(sid);

      setCfg(c);
      setPage(p);

      if (!sid || !sitzEp?.app_id) {
        setStep('not_found');
        return;
      }

      // Load Sitzung
      listPublicRecords(c, p, { appId: sitzEp.app_id, limit: 200 })
        .then(records => {
          const found = records[sid] ?? null;
          if (!found) {
            setStep('not_found');
            return;
          }
          setSitzung(found);
          const fields = found.fields as SitzungFields;
          const amArr = Array.isArray(fields.angemeldete_mitglieder)
            ? fields.angemeldete_mitglieder
            : [];
          setAngemeldeteCount(amArr.length);
          setStep('detail');
        })
        .catch(err => {
          if (err instanceof PageUnavailableError) setStep('error');
          else setStep('not_found');
        });
    }).catch(() => setStep('error'));
  }, []);

  // Prepare challenge when user focuses the form
  function handleFormFocus() {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create' && e.entity === 'sitzungen');
    if (!ep) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg || !page || !sitzung || !sitzungId) return;

    setErrorMsg('');

    const fields = sitzung.fields as SitzungFields;
    const now = new Date();

    // Anmeldefrist prüfen
    if (fields.anmeldefrist) {
      try {
        const frist = parseISO(fields.anmeldefrist);
        if (isBefore(frist, now)) {
          setErrorMsg(tx('Die Anmeldefrist ist abgelaufen. Eine Anmeldung ist nicht mehr möglich.'));
          return;
        }
      } catch { /* ignore parse error */ }
    }

    // Max-Teilnehmer prüfen
    if (fields.max_teilnehmer != null && angemeldeteCount >= fields.max_teilnehmer) {
      setErrorMsg(tx('Die maximale Teilnehmerzahl ist erreicht. Eine Anmeldung ist leider nicht mehr möglich.'));
      return;
    }

    setStep('submitting');

    try {
      // Mitglied per E-Mail suchen
      const mitglieder = await listPublicRecords(cfg, page, { appId: mitgliederAppId, limit: 500 });
      const normalizedEmail = email.trim().toLowerCase();
      const mitgliedEntry = Object.entries(mitglieder).find(([, rec]) => {
        const mf = rec.fields as MitgliedFields;
        return (mf.email ?? '').trim().toLowerCase() === normalizedEmail;
      });

      if (!mitgliedEntry) {
        setErrorMsg(tx('Es wurde kein aktives Mitglied mit dieser E-Mail-Adresse gefunden. Bitte wende dich an die Geschäftsstelle.'));
        setStep('form');
        return;
      }

      const [mitgliedId] = mitgliedEntry;
      const createEp = page.endpoints?.find(e => e.op === 'create' && e.entity === 'sitzungen');
      if (!createEp) throw new Error(tx('no create endpoint'));

      // Mitglied in angemeldete_mitglieder eintragen
      const mitgliedRef = recordRef(cfg, page, mitgliederAppId, mitgliedId);
      await createPublicRecord(cfg, page, {
        angemeldete_mitglieder: [mitgliedRef],
      });

      setStep('success');
    } catch (err) {
      if (err instanceof PageUnavailableError) {
        setErrorMsg(tx('Dieser Dienst ist momentan nicht verfügbar. Bitte versuche es später erneut.'));
      } else if (err instanceof Error && err.message.includes(tx('aktives Mitglied'))) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(tx('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.'));
      }
      setStep('form');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (step === 'loading') {
    return <PublicShell loading />;
  }

  if (step === 'error') {
    return <PublicShell unavailable />;
  }

  if (step === 'not_found') {
    return (
      <PublicShell title={tx('Sitzung nicht gefunden')} wide>
        <div className="rounded-2xl bg-card shadow-sm border border-border p-6 text-center">
          <IconAlertCircle size={40} stroke={1.5} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {sitzungId
              ? tx('Diese Sitzung ist nicht verfügbar oder die Einladung ist nicht mehr aktiv.')
              : tx('Dieser Einlade-Link ist unvollständig. Bitte verwende den vollständigen Link aus der Einladungs-E-Mail.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  const fields = sitzung ? (sitzung.fields as SitzungFields) : null;
  const maxTn = fields?.max_teilnehmer ?? null;
  const freie = maxTn != null ? maxTn - angemeldeteCount : null;
  const isFull = maxTn != null && angemeldeteCount >= maxTn;

  const fristAbgelaufen = fields?.anmeldefrist
    ? (() => { try { return isBefore(parseISO(fields.anmeldefrist), new Date()); } catch { return false; } })()
    : false;

  const canRegister = !isFull && !fristAbgelaufen;

  // Success screen
  if (step === 'success') {
    return (
      <PublicShell wide>
        <div className="rounded-2xl bg-card shadow-sm border border-border p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-emerald-100 p-3">
              <IconCheck size={28} className="text-emerald-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2">{tx('Anmeldung erfolgreich!')}</h2>
          <p className="text-muted-foreground mb-6">
            {tx('Du bist jetzt für die folgende Sitzung angemeldet:')}
          </p>
          {fields && (
            <div className="rounded-xl bg-muted/40 p-4 text-left space-y-2 text-sm mb-6">
              <div className="font-medium text-base">{fields.titel}</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconCalendar size={15} className="shrink-0" />
                <span>{formatDatum(fields.datum_uhrzeit)}</span>
              </div>
              {fields.ort && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconMapPin size={15} className="shrink-0" />
                  <span>{fields.ort}</span>
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {tx('Wir freuen uns auf deine Teilnahme!')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // Detail + Form screen
  return (
    <PublicShell
      title={fields?.titel ?? tx('Sitzungsanmeldung')}
      description={fields?.art ? ART_LABELS[fields.art] ?? fields.art : undefined}
      wide
    >
      <div className="space-y-4">
        {/* Sitzungsdetails */}
        <div className="rounded-2xl bg-card shadow-sm border border-border p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {fields?.datum_uhrzeit && (
              <div className="flex items-center gap-1.5">
                <IconCalendar size={15} className="shrink-0" />
                <span>{formatDatum(fields.datum_uhrzeit)}</span>
              </div>
            )}
            {fields?.ort && (
              <div className="flex items-center gap-1.5">
                <IconMapPin size={15} className="shrink-0" />
                <span>{fields.ort}</span>
              </div>
            )}
            {maxTn != null && (
              <div className="flex items-center gap-1.5">
                <IconUsers size={15} className="shrink-0" />
                <span>
                  {freie != null && freie > 0
                    ? tx`${freie} freie Plätze`
                    : isFull
                    ? tx('Ausgebucht')
                    : tx`${angemeldeteCount} von ${maxTn} Plätzen belegt`}
                </span>
              </div>
            )}
            {fields?.anmeldefrist && (
              <div className="flex items-center gap-1.5">
                <IconClock size={15} className="shrink-0" />
                <span>
                  {tx('Anmeldefrist:')} {formatFrist(fields.anmeldefrist)}
                </span>
              </div>
            )}
          </div>

          {fields?.beschreibung && (
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line border-t border-border pt-3">
              {fields.beschreibung}
            </p>
          )}
        </div>

        {/* Status-Hinweis wenn geschlossen */}
        {!canRegister && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <IconAlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {isFull
                ? tx('Diese Sitzung ist ausgebucht. Eine Anmeldung ist nicht mehr möglich.')
                : tx('Die Anmeldefrist für diese Sitzung ist abgelaufen.')}
            </p>
          </div>
        )}

        {/* Anmeldeformular */}
        {canRegister && (step === 'detail' || step === 'form') && (
          <div className="rounded-2xl bg-card shadow-sm border border-border p-5 sm:p-6">
            <h2 className="text-base font-semibold mb-4">{tx('Zur Sitzung anmelden')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" onFocus={handleFormFocus}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="vorname">
                    {tx('Vorname')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="vorname"
                    type="text"
                    value={vorname}
                    onChange={e => setVorname(e.target.value)}
                    required
                    autoComplete="given-name"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="nachname">
                    {tx('Nachname')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="nachname"
                    type="text"
                    value={nachname}
                    onChange={e => setNachname(e.target.value)}
                    required
                    autoComplete="family-name"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={tx('Nachname')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="email">
                  {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="name@beispiel.de" /* i18n-exempt */
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {tx('Bitte gib die E-Mail-Adresse an, die bei deiner Mitgliedschaft hinterlegt ist.')}
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                  <IconAlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={(['submitting'] as string[]).includes(step)}
                className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {(step as string) === 'submitting' ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    {tx('Anmeldung wird verarbeitet…')}
                  </>
                ) : (
                  tx('Jetzt anmelden')
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
