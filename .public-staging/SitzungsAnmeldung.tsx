import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, isAfter } from 'date-fns';
import { de } from 'date-fns/locale';
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
import { APP_IDS } from '@/types/app';

// ─── helpers ────────────────────────────────────────────────────────────────

interface SitzungFields {
  titel: string | null;
  datum_uhrzeit: string | null;
  ort: string | null;
  art: string | null;
  beschreibung: string | null;
  anmeldefrist: string | null;
  max_teilnehmer: number | null;
  angemeldete_mitglieder: string[] | null;
}

function parseSitzung(r: PublicRecordResult): SitzungFields {
  const f = r.fields as Record<string, unknown>;
  return {
    titel: (f.titel as string) ?? null,
    datum_uhrzeit: (f.datum_uhrzeit as string) ?? null,
    ort: (f.ort as string) ?? null,
    art: (f.art as string) ?? null,
    beschreibung: (f.beschreibung as string) ?? null,
    anmeldefrist: (f.anmeldefrist as string) ?? null,
    max_teilnehmer: (f.max_teilnehmer as number) ?? null,
    angemeldete_mitglieder: Array.isArray(f.angemeldete_mitglieder)
      ? (f.angemeldete_mitglieder as string[])
      : null,
  };
}

function artLabel(key: string | null): string {
  if (!key) return '';
  const map: Record<string, string> = {
    ordentlich: 'Ordentliche Sitzung',
    ausserordentlich: 'Außerordentliche Sitzung',
    klausur: 'Klausursitzung',
    information: 'Informationssitzung',
  };
  return map[key] ?? key;
}

function fmtDatum(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de });
  } catch {
    return iso;
  }
}

function fmtFrist(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), "d. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  } catch {
    return iso;
  }
}

// ─── component ──────────────────────────────────────────────────────────────

type Step = 'loading' | 'no-param' | 'error' | 'closed' | 'full' | 'form' | 'submitting' | 'done';

export default function SitzungsAnmeldung() {
  const [searchParams] = useSearchParams();
  const sitzungId = searchParams.get('sitzung');

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);

  const [sitzung, setSitzung] = useState<{ id: string; fields: SitzungFields } | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // form fields
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  // load config
  useEffect(() => {
    loadPublicPagesConfig().then(c => {
      setCfg(c);
      setPage(c?.pages['sitzungsanmeldung'] ?? null);
      setCfgLoading(false);
    });
  }, []);

  // load sitzung once config is ready
  useEffect(() => {
    if (cfgLoading || !cfg || !page) return;
    if (!sitzungId) {
      setStep('no-param');
      return;
    }

    const listEp = page.endpoints?.find(e => e.op === 'list' && e.entity === 'sitzungen');
    if (!listEp) {
      setStep('error');
      setErrorMsg(tx('Seitenconfig ungültig.'));
      return;
    }

    listPublicRecords(cfg, page, { appId: listEp.app_id })
      .then(records => {
        const rec = records[sitzungId];
        if (!rec) {
          setStep('error');
          setErrorMsg(tx('Diese Sitzung wurde nicht gefunden oder ist nicht öffentlich zugänglich.'));
          return;
        }
        const fields = parseSitzung(rec);
        setSitzung({ id: sitzungId, fields });

        const now = new Date();

        // check anmeldefrist
        if (fields.anmeldefrist) {
          const frist = parseISO(fields.anmeldefrist);
          if (isAfter(now, frist)) {
            setStep('closed');
            return;
          }
        }

        // check max_teilnehmer
        const angemeldet = fields.angemeldete_mitglieder?.length ?? 0;
        if (fields.max_teilnehmer !== null && angemeldet >= fields.max_teilnehmer) {
          setStep('full');
          return;
        }

        setStep('form');
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setStep('error');
          setErrorMsg(tx('Diese Seite ist momentan nicht verfügbar.'));
        } else {
          setStep('error');
          setErrorMsg(tx('Fehler beim Laden der Sitzungsdaten. Bitte versuche es erneut.'));
        }
      });
  }, [cfgLoading, cfg, page, sitzungId]);

  // prepare challenge on first interaction
  function handleFirstInteraction() {
    if (!cfg || !page) return;
    const createMitgliedEp = page.endpoints?.find(e => e.op === 'create' && e.entity === 'mitglieder');
    if (createMitgliedEp) {
      prepareChallenge(cfg, page, 'POST', `/apps/${createMitgliedEp.app_id}/records`);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!vorname.trim()) errs.vorname = tx('Bitte Vorname eingeben.');
    if (!nachname.trim()) errs.nachname = tx('Bitte Nachname eingeben.');
    if (!email.trim()) errs.email = tx('Bitte E-Mail-Adresse eingeben.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = tx('Bitte eine gültige E-Mail-Adresse eingeben.');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !cfg || !page || !sitzung) return;

    setStep('submitting');
    setFieldErrors({});

    try {
      const createMitgliedEp = page.endpoints?.find(e => e.op === 'create' && e.entity === 'mitglieder');
      if (!createMitgliedEp) throw new Error('no mitglieder endpoint');

      // Step 1: create Mitglied
      const payload: Record<string, unknown> = {
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: email.trim(),
      };
      if (telefon.trim()) payload.telefon = telefon.trim();

      const newMitglied = await createPublicRecord(cfg, page, payload);

      // Step 2: append to angemeldete_mitglieder on the Sitzung
      const updateSitzungEp = page.endpoints?.find(e => e.op === 'update' && e.entity === 'sitzungen');
      if (updateSitzungEp) {
        const existing = sitzung.fields.angemeldete_mitglieder ?? [];
        const newRef = recordRef(cfg, page, APP_IDS.MITGLIEDER, newMitglied.id);
        const updated = [...existing, newRef];
        // PATCH the sitzung record via the grant endpoint
        const patchUrl = `${cfg.public_api_base}/grants/${page.grant_id}/apps/${updateSitzungEp.app_id}/records/${sitzung.id}`;
        await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ fields: { angemeldete_mitglieder: updated } }),
        });
      }

      setStep('done');
    } catch {
      setStep('form');
      setErrorMsg(tx('Anmeldung fehlgeschlagen. Bitte versuche es erneut oder wende dich an den Organisator.'));
    }
  }

  // ── guard: config loading ────────────────────────────────────────────────
  if (cfgLoading || (step === 'loading' && !cfgLoading && cfg === null)) {
    return <PublicShell loading={cfgLoading} unavailable={!cfgLoading && cfg === null} />;
  }
  if (!cfg || !page) {
    return <PublicShell unavailable />;
  }

  // ── no param ─────────────────────────────────────────────────────────────
  if (step === 'no-param') {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')}>
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          <p className="text-sm">{tx('Dieser Link ist unvollständig. Bitte nutze den Einlade-Link aus der Einladungs-E-Mail.')}</p>
        </div>
      </PublicShell>
    );
  }

  // ── still loading sitzung ────────────────────────────────────────────────
  if (step === 'loading') {
    return <PublicShell loading />;
  }

  // ── error ────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')}>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </div>
      </PublicShell>
    );
  }

  // ── sitzung info block (shared by closed/full/form/submitting) ───────────
  const SitzungInfo = () =>
    sitzung ? (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold leading-tight">{sitzung.fields.titel}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{artLabel(sitzung.fields.art)}</p>
          </div>
          {sitzung.fields.max_teilnehmer !== null && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {tx`${sitzung.fields.angemeldete_mitglieder?.length ?? 0} / ${sitzung.fields.max_teilnehmer} Plätze`}
            </span>
          )}
        </div>

        <div className="grid gap-1.5 text-sm">
          <div className="flex gap-2">
            <span className="w-4 shrink-0 text-muted-foreground">📅</span>
            <span>{fmtDatum(sitzung.fields.datum_uhrzeit)}</span>
          </div>
          {sitzung.fields.ort && (
            <div className="flex gap-2">
              <span className="w-4 shrink-0 text-muted-foreground">📍</span>
              <span>{sitzung.fields.ort}</span>
            </div>
          )}
          {sitzung.fields.anmeldefrist && (
            <div className="flex gap-2">
              <span className="w-4 shrink-0 text-muted-foreground">⏰</span>
              <span>
                {tx('Anmeldefrist')}: {fmtFrist(sitzung.fields.anmeldefrist)}
              </span>
            </div>
          )}
        </div>

        {sitzung.fields.beschreibung && (
          <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3 whitespace-pre-line">
            {sitzung.fields.beschreibung}
          </p>
        )}
      </div>
    ) : null;

  // ── anmeldefrist abgelaufen ───────────────────────────────────────────────
  if (step === 'closed') {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')}>
        <SitzungInfo />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm font-medium text-amber-800">{tx('Die Anmeldefrist für diese Sitzung ist abgelaufen.')}</p>
          <p className="text-xs text-amber-700 mt-1">{tx('Eine Anmeldung ist nicht mehr möglich. Bitte wende dich direkt an den Organisator.')}</p>
        </div>
      </PublicShell>
    );
  }

  // ── ausgebucht ────────────────────────────────────────────────────────────
  if (step === 'full') {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')}>
        <SitzungInfo />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm font-medium text-amber-800">{tx('Diese Sitzung ist bereits vollständig besetzt.')}</p>
          <p className="text-xs text-amber-700 mt-1">{tx('Es sind keine freien Plätze mehr verfügbar. Bitte wende dich an den Organisator.')}</p>
        </div>
      </PublicShell>
    );
  }

  // ── bestätigung ───────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <PublicShell title={tx('Anmeldung erfolgreich')}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-3">
          <div className="text-4xl">✓</div>
          <h2 className="text-lg font-semibold text-emerald-800">{tx('Du bist angemeldet!')}</h2>
          <p className="text-sm text-emerald-700">
            {sitzung
              ? tx`Deine Anmeldung für „${sitzung.fields.titel ?? ''}" wurde erfolgreich registriert.`
              : tx('Deine Anmeldung wurde erfolgreich registriert.')}
          </p>
          <p className="text-xs text-emerald-600 mt-2">
            {tx('Du erhältst keine automatische Bestätigungs-E-Mail. Bei Fragen wende dich bitte an den Organisator.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // ── form / submitting ────────────────────────────────────────────────────
  const isSubmitting = step === 'submitting';

  return (
    <PublicShell title={tx('Sitzungsanmeldung')} description={tx('Melde dich zur Sitzung an.')}>
      <SitzungInfo />

      {errorMsg && step === 'form' && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5"
        onFocus={handleFirstInteraction}
      >
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{tx('Deine Angaben')}</h3>

          {/* Vorname + Nachname side by side on wider screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="vorname" className="text-sm font-medium text-foreground">
                {tx('Vorname')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                ref={firstInputRef}
                id="vorname"
                type="text"
                autoComplete="given-name"
                required
                disabled={isSubmitting}
                value={vorname}
                onChange={e => setVorname(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
                  fieldErrors.vorname ? 'border-destructive' : 'border-input bg-background'
                }`}
                placeholder={tx('z. B. Maria')}
              />
              {fieldErrors.vorname && (
                <p className="text-xs text-destructive">{fieldErrors.vorname}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="nachname" className="text-sm font-medium text-foreground">
                {tx('Nachname')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="nachname"
                type="text"
                autoComplete="family-name"
                required
                disabled={isSubmitting}
                value={nachname}
                onChange={e => setNachname(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
                  fieldErrors.nachname ? 'border-destructive' : 'border-input bg-background'
                }`}
                placeholder={tx('z. B. Müller')}
              />
              {fieldErrors.nachname && (
                <p className="text-xs text-destructive">{fieldErrors.nachname}</p>
              )}
            </div>
          </div>

          {/* E-Mail */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {tx('E-Mail-Adresse')} <span className="text-destructive" aria-hidden>*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
                fieldErrors.email ? 'border-destructive' : 'border-input bg-background'
              }`}
              placeholder={tx('name@beispiel.de')}
            />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          {/* Telefon optional */}
          <div className="space-y-1.5">
            <label htmlFor="telefon" className="text-sm font-medium text-foreground">
              {tx('Telefonnummer')}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({tx('optional')})</span>
            </label>
            <input
              id="telefon"
              type="tel"
              autoComplete="tel"
              disabled={isSubmitting}
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              placeholder={tx('z. B. +49 151 12345678')}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? tx('Wird angemeldet …') : tx('Verbindlich anmelden')}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {tx('Mit der Anmeldung stimmst du der Speicherung deiner Kontaktdaten für die Organisation dieser Sitzung zu.')}
        </p>
      </form>
    </PublicShell>
  );
}
