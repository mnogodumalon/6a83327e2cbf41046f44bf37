import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { IconCalendar, IconMapPin, IconLoader2, IconCircleCheck, IconAlertCircle, IconUser } from '@tabler/icons-react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  recordRef,
  SubmitFailedError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx, dateFnsLocale } from '@/i18n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITZUNGEN_ENTITY = 'sitzungen';
const MITGLIEDER_ENTITY = 'mitglieder';

function formatDatum(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'EEEE, d. MMMM yyyy, HH:mm \'Uhr\'', { locale: dateFnsLocale() });
  } catch {
    return dateStr;
  }
}

function formatFrist(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'd. MMMM yyyy, HH:mm \'Uhr\'', { locale: dateFnsLocale() });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SitzungFields {
  titel?: string;
  datum_uhrzeit?: string;
  ort?: string;
  beschreibung?: string;
  anmeldefrist?: string;
  max_teilnehmer?: number | null;
  angemeldete_mitglieder?: unknown[];
}

interface MitgliedFields {
  vorname?: string;
  nachname?: string;
  email?: string;
}

interface FormState {
  vorname: string;
  nachname: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Update helper — PATCH angemeldete_mitglieder on the Sitzung record
// ---------------------------------------------------------------------------

interface UpdateEndpoint {
  op: string;
  entity: string;
  app_id: string;
  fields: string[];
}

async function appendMitgliedToSitzung(
  cfg: PublicPagesConfig,
  page: PublicPageConfig,
  sitzungId: string,
  mitgliedRef: string,
  currentRefs: unknown[],
): Promise<void> {
  const sitzEp = (page.endpoints as unknown as UpdateEndpoint[])?.find(
    e => e.op === 'update' && e.entity === SITZUNGEN_ENTITY
  );
  if (!sitzEp) throw new SubmitFailedError('update-endpoint nicht konfiguriert');

  const nextRefs = [...currentRefs.filter((r): r is string => typeof r === 'string'), mitgliedRef];

  const path = `/apps/${sitzEp.app_id}/records/${sitzungId}`;
  const body = JSON.stringify({ fields: { angemeldete_mitglieder: nextRefs } });

  if (cfg.preview) {
    const res = await fetch(tx`${cfg.preview_base}/records/${sitzungId}?app_id=${encodeURIComponent(sitzEp.app_id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    if (!res.ok) throw new SubmitFailedError(`HTTP ${res.status}`);
    return;
  }

  const res = await fetch(`${cfg.public_api_base}/grants/${page.grant_id}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });
  if (!res.ok) throw new SubmitFailedError(`HTTP ${res.status}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SitzungAnmeldung() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);

  // Sitzung
  const [sitzungId, setSitzungId] = useState<string | null>(null);
  const [sitzung, setSitzung] = useState<(PublicRecordResult & { fields: SitzungFields }) | null>(null);
  const [sitzungLoading, setSitzungLoading] = useState(false);
  const [sitzungError, setSitzungError] = useState(false);

  // Mitglieder (für duplicate-check)
  const [alleMitglieder, setAlleMitglieder] = useState<Record<string, PublicRecordResult>>({});

  // Form
  const [form, setForm] = useState<FormState>({ vorname: '', nachname: '', email: '' });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Config laden
  useEffect(() => {
    loadPublicPagesConfig('sitzung-anmeldung').then(c => {
      setCfg(c);
      setPage(c?.pages['sitzung-anmeldung'] ?? null);
      setCfgLoading(false);
    });
  }, []);

  // sitzung_id aus URL lesen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('sitzung_id');
    setSitzungId(id);
  }, []);

  // Sitzung + Mitglieder laden sobald cfg + sitzungId bekannt
  useEffect(() => {
    if (!cfg || !page) return;
    if (!sitzungId) return;

    setSitzungLoading(true);
    setSitzungError(false);

    Promise.all([
      listPublicRecords(cfg, page, { appId: page.endpoints?.find(e => e.entity === SITZUNGEN_ENTITY && e.op === 'list')?.app_id }),
      listPublicRecords(cfg, page, { appId: page.endpoints?.find(e => e.entity === MITGLIEDER_ENTITY && e.op === 'list')?.app_id }),
    ]).then(([sitzungen, mitglieder]) => {
      const found = sitzungen[sitzungId];
      if (found) {
        setSitzung(found as PublicRecordResult & { fields: SitzungFields });
      } else {
        setSitzungError(true);
      }
      setAlleMitglieder(mitglieder);
      setSitzungLoading(false);
    }).catch(() => {
      setSitzungError(true);
      setSitzungLoading(false);
    });
  }, [cfg, page, sitzungId]);

  // Challenge vorwärmen
  const handleFirstFocus = useCallback(() => {
    if (!cfg || !page) return;
    const mitEp = page.endpoints?.find(e => e.entity === MITGLIEDER_ENTITY && e.op === 'create');
    if (!mitEp) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${mitEp.app_id}/records`);
  }, [cfg, page]);

  // Validation
  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.vorname.trim()) next.vorname = tx('Bitte Vorname eingeben');
    if (!form.nachname.trim()) next.nachname = tx('Bitte Nachname eingeben');
    if (!form.email.trim()) {
      next.email = tx('Bitte E-Mail eingeben');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = tx('Bitte gültige E-Mail-Adresse eingeben');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!cfg || !page || !sitzung || !sitzungId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const emailNorm = form.email.trim().toLowerCase();

      // 1. Prüfe ob Mitglied schon existiert (email-Match)
      let mitgliedId: string | null = null;
      for (const [id, rec] of Object.entries(alleMitglieder)) {
        const mf = rec.fields as MitgliedFields;
        if (mf.email?.trim().toLowerCase() === emailNorm) {
          mitgliedId = id;
          break;
        }
      }

      const mitEp = page.endpoints?.find(e => e.entity === MITGLIEDER_ENTITY && e.op === 'create');
      const sitzEpList = page.endpoints?.find(e => e.entity === SITZUNGEN_ENTITY && e.op === 'list');

      if (!mitEp || !sitzEpList) {
        throw new SubmitFailedError(tx('Konfigurationsfehler: Endpunkt fehlt'));
      }

      // 2. Mitglied anlegen falls neu
      if (!mitgliedId) {
        const created = await createPublicRecord(cfg, page, {
          vorname: form.vorname.trim(),
          nachname: form.nachname.trim(),
          email: form.email.trim(),
        });
        mitgliedId = created.id;
      }

      // 3. Prüfe ob schon angemeldet
      const bereitsAngemeldet = (sitzung.fields.angemeldete_mitglieder ?? [])
        .some((ref) => typeof ref === 'string' && ref.endsWith(mitgliedId!));

      if (!bereitsAngemeldet) {
        // 4. Mitglied in angemeldete_mitglieder der Sitzung eintragen
        const mitRef = recordRef(cfg, page, mitEp.app_id, mitgliedId);
        await appendMitgliedToSitzung(
          cfg,
          page,
          sitzungId,
          mitRef,
          sitzung.fields.angemeldete_mitglieder ?? [],
        );
      }

      setDone(true);
    } catch (err) {
      if (err instanceof SubmitFailedError) {
        setSubmitError(tx('Die Anmeldung konnte nicht gespeichert werden. Bitte versuche es erneut.'));
      } else {
        setSubmitError(tx('Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (cfgLoading) {
    return <PublicShell loading />;
  }

  if (!cfg || !page) {
    return <PublicShell unavailable />;
  }

  // Kein sitzung_id-Parameter → Hinweis
  if (!sitzungId) {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')} wide>
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <IconAlertCircle size={40} className="mx-auto mb-3 text-muted-foreground" stroke={1.5} />
          <p className="text-base font-medium">{tx('Kein Einlade-Link erkannt')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {tx('Bitte nutze den Einlade-Link aus der Einladungs-E-Mail, um dich für eine Sitzung anzumelden.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  if (sitzungLoading) {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')} wide>
        <div className="flex justify-center pt-8">
          <IconLoader2 size={28} stroke={1.5} className="animate-spin text-muted-foreground" />
        </div>
      </PublicShell>
    );
  }

  if (sitzungError || !sitzung) {
    return (
      <PublicShell title={tx('Sitzungsanmeldung')} wide>
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <IconAlertCircle size={40} className="mx-auto mb-3 text-amber-500" stroke={1.5} />
          <p className="text-base font-medium">{tx('Sitzung nicht gefunden')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {tx('Der Einlade-Link ist ungültig oder die Sitzung wurde entfernt. Bitte wende dich an die Organisatoren.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  const sf = sitzung.fields;
  const teilnehmerAnzahl = (sf.angemeldete_mitglieder ?? []).length;
  const maxTeilnehmer = sf.max_teilnehmer ?? null;
  const fristAbgelaufen = sf.anmeldefrist ? new Date(sf.anmeldefrist) < new Date() : false;
  const istVoll = maxTeilnehmer !== null && teilnehmerAnzahl >= maxTeilnehmer;

  // Erfolgsmeldung
  if (done) {
    return (
      <PublicShell wide>
        <div className="rounded-2xl bg-card border border-border p-8 text-center">
          <IconCircleCheck size={48} className="mx-auto mb-4 text-emerald-500" stroke={1.5} />
          <h1 className="text-2xl font-medium mb-2">{tx('Anmeldung erfolgreich!')}</h1>
          <p className="text-muted-foreground mb-4">
            {tx('Du bist jetzt für die folgende Sitzung angemeldet:')}
          </p>
          <div className="bg-muted/50 rounded-xl p-4 text-left inline-block min-w-[280px]">
            <p className="font-medium text-base">{sf.titel}</p>
            {sf.datum_uhrzeit && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatDatum(sf.datum_uhrzeit)}
              </p>
            )}
            {sf.ort && (
              <p className="text-sm text-muted-foreground mt-1">
                {sf.ort}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            {tx('Wir freuen uns auf deine Teilnahme. Du erhältst alle weiteren Informationen rechtzeitig per E-Mail.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // Anmeldeschluss überschritten
  if (fristAbgelaufen) {
    return (
      <PublicShell title={sf.titel ?? tx('Sitzung')} wide>
        <SitzungInfo sf={sf} teilnehmerAnzahl={teilnehmerAnzahl} maxTeilnehmer={maxTeilnehmer} />
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
          <p className="text-sm font-medium text-amber-800">
            {tx('Die Anmeldefrist für diese Sitzung ist abgelaufen.')}
          </p>
          {sf.anmeldefrist && (
            <p className="text-sm text-amber-700 mt-1">
              {tx('Frist war:')} {formatFrist(sf.anmeldefrist)}
            </p>
          )}
        </div>
      </PublicShell>
    );
  }

  // Sitzung voll
  if (istVoll) {
    return (
      <PublicShell title={sf.titel ?? tx('Sitzung')} wide>
        <SitzungInfo sf={sf} teilnehmerAnzahl={teilnehmerAnzahl} maxTeilnehmer={maxTeilnehmer} />
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
          <p className="text-sm font-medium text-amber-800">
            {tx('Die maximale Teilnehmerzahl für diese Sitzung ist bereits erreicht.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // Normaler Flow: Formular anzeigen
  return (
    <PublicShell title={sf.titel ?? tx('Sitzungsanmeldung')} wide>
      {/* Sitzungsdetails */}
      <SitzungInfo sf={sf} teilnehmerAnzahl={teilnehmerAnzahl} maxTeilnehmer={maxTeilnehmer} />

      {/* Anmeldeformular */}
      <div className="mt-6 rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-5">
          <IconUser size={18} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-medium">{tx('Deine Angaben')}</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* Vorname */}
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="vorname">
                {tx('Vorname')} <span className="text-destructive">*</span>
              </label>
              <input
                id="vorname"
                type="text"
                autoComplete="given-name"
                value={form.vorname}
                onChange={e => setForm(f => ({ ...f, vorname: e.target.value }))}
                onFocus={handleFirstFocus}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring transition-shadow ${errors.vorname ? 'border-destructive' : 'border-input'}`}
                placeholder={tx('z. B. Maria')}
                disabled={submitting}
              />
              {errors.vorname && (
                <p className="text-xs text-destructive mt-1">{errors.vorname}</p>
              )}
            </div>

            {/* Nachname */}
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="nachname">
                {tx('Nachname')} <span className="text-destructive">*</span>
              </label>
              <input
                id="nachname"
                type="text"
                autoComplete="family-name"
                value={form.nachname}
                onChange={e => setForm(f => ({ ...f, nachname: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring transition-shadow ${errors.nachname ? 'border-destructive' : 'border-input'}`}
                placeholder={tx('z. B. Müller')}
                disabled={submitting}
              />
              {errors.nachname && (
                <p className="text-xs text-destructive mt-1">{errors.nachname}</p>
              )}
            </div>

            {/* E-Mail */}
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring transition-shadow ${errors.email ? 'border-destructive' : 'border-input'}`}
                placeholder={tx('name@organisation.de')}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Fehler gesamt */}
          {submitError && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
              <IconAlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Frist */}
          {sf.anmeldefrist && !fristAbgelaufen && (
            <p className="text-xs text-muted-foreground mt-4">
              {tx('Anmeldefrist:')} {formatFrist(sf.anmeldefrist)}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <IconLoader2 size={16} className="animate-spin shrink-0" />
                {tx('Anmeldung wird gespeichert …')}
              </>
            ) : (
              tx('Jetzt anmelden')
            )}
          </button>
        </form>
      </div>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// Sitzungsdetails-Block (shared between states)
// ---------------------------------------------------------------------------

function SitzungInfo({
  sf,
  teilnehmerAnzahl,
  maxTeilnehmer,
}: {
  sf: SitzungFields;
  teilnehmerAnzahl: number;
  maxTeilnehmer: number | null;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      {/* Datum */}
      {sf.datum_uhrzeit && (
        <div className="flex items-start gap-2.5 mb-3">
          <IconCalendar size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-sm">{formatDatum(sf.datum_uhrzeit)}</span>
        </div>
      )}

      {/* Ort */}
      {sf.ort && (
        <div className="flex items-start gap-2.5 mb-3">
          <IconMapPin size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-sm">{sf.ort}</span>
        </div>
      )}

      {/* Teilnehmer */}
      {maxTeilnehmer !== null && (
        <div className="flex items-center gap-2.5 mb-3">
          <IconUser size={16} className="text-muted-foreground shrink-0" />
          <span className="text-sm">
            {teilnehmerAnzahl} / {maxTeilnehmer} {tx('Teilnehmer angemeldet')}
          </span>
        </div>
      )}

      {/* Beschreibung */}
      {sf.beschreibung && (
        <p className="text-sm text-muted-foreground mt-2 pt-3 border-t border-border whitespace-pre-wrap leading-relaxed">
          {sf.beschreibung}
        </p>
      )}
    </div>
  );
}
