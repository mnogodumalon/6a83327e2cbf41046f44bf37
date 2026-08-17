import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, isBefore } from 'date-fns';
import {
  IconCalendar,
  IconMapPin,
  IconClock,
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle,
} from '@tabler/icons-react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx, dateFnsLocale } from '@/i18n';

// App-IDs aus app_metadata.json
const APP_SITZUNGEN = '6a8332541add4699ccc0e8f8';
const APP_MITGLIEDER = '6a83324eb209b1d472054883';

interface SitzungFields {
  titel?: string;
  datum_uhrzeit?: string;
  ort?: string;
  art?: string;
  beschreibung?: string;
  anmeldefrist?: string;
  max_teilnehmer?: number;
  angemeldete_mitglieder?: string[];
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'EEEE, d. MMMM yyyy, HH:mm \'Uhr\'', { locale: dateFnsLocale() });
  } catch {
    return iso;
  }
}

function formatDeadline(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd. MMMM yyyy, HH:mm \'Uhr\'', { locale: dateFnsLocale() });
  } catch {
    return iso;
  }
}

function isDeadlinePassed(iso: string | undefined): boolean {
  if (!iso) return false;
  try {
    return isBefore(parseISO(iso), new Date());
  } catch {
    return false;
  }
}

export default function Sitzungsanmeldung() {
  const ART_LABELS: Record<string, string> = {
  ordentlich: 'Ordentliche Sitzung',
  ausserordentlich: 'Außerordentliche Sitzung',
  klausur: 'Klausursitzung',
  information: 'Informationssitzung',
};

  const [searchParams] = useSearchParams();
  const sitzungId = searchParams.get('sitzung_id');

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [sitzung, setSitzung] = useState<(PublicRecordResult & { fields: SitzungFields }) | null>(null);
  const [sitzungLoading, setSitzungLoading] = useState(false);
  const [sitzungNotFound, setSitzungNotFound] = useState(false);

  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ALL hooks before any early return
  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['sitzungsanmeldung'] ?? null);
        setCfgLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setCfgLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!cfg || !page || !sitzungId) return;
    setSitzungLoading(true);
    listPublicRecords(cfg, page, { appId: APP_SITZUNGEN, limit: 200 })
      .then(records => {
        const all = Object.values(records) as (PublicRecordResult & { fields: SitzungFields })[];
        const found = all.find(r => r.id === sitzungId);
        if (found) {
          setSitzung(found);
        } else {
          setSitzungNotFound(true);
        }
        setSitzungLoading(false);
      })
      .catch(() => {
        setSitzungNotFound(true);
        setSitzungLoading(false);
      });
  }, [cfg, page, sitzungId]);

  useEffect(() => {
    if (!cfg || !page) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${APP_MITGLIEDER}/records`);
  }, [cfg, page]);

  if (cfgLoading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  const artLabel = sitzung
    ? (ART_LABELS[sitzung.fields.art ?? ''] ?? sitzung.fields.art ?? '—')
    : '';
  const deadlinePassed = isDeadlinePassed(sitzung?.fields.anmeldefrist);
  const angemeldeteCount = sitzung?.fields.angemeldete_mitglieder?.length ?? 0;
  const maxTeilnehmer = sitzung?.fields.max_teilnehmer;
  const isFull = maxTeilnehmer != null && angemeldeteCount >= maxTeilnehmer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitzung || !cfg || !page) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createPublicRecord(cfg, page, {
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        email: email.trim().toLowerCase(),
      });
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Anmeldung fehlgeschlagen. Bitte versuche es erneut oder wende dich an den Veranstalter.'));
    } finally {
      setSubmitting(false);
    }
  };

  // No sitzung_id — show a note
  if (!sitzungId) {
    return (
      <PublicShell
        title={tx('Sitzungsanmeldung')}
        description={tx('Bitte öffne den persönlichen Einlade-Link aus deiner Einladung.')}
      >
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <IconInfoCircle size={48} className="text-muted-foreground" stroke={1.5} />
          <p className="text-muted-foreground text-sm max-w-sm">
            {tx('Diese Seite ist nur über einen persönlichen Einlade-Link zugänglich. Bitte prüfe deine E-Mail und öffne den dort enthaltenen Link.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  if (sitzungLoading) {
    return <PublicShell loading />;
  }

  if (sitzungNotFound) {
    return (
      <PublicShell
        title={tx('Sitzung nicht gefunden')}
        description={tx('Der Einlade-Link ist ungültig oder die Sitzung ist nicht mehr verfügbar.')}
      >
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <IconAlertCircle size={48} className="text-muted-foreground" stroke={1.5} />
          <p className="text-muted-foreground text-sm max-w-sm">
            {tx('Die Sitzung konnte nicht gefunden werden. Möglicherweise wurde der Link deaktiviert oder die Anmeldung ist bereits abgeschlossen.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  if (submitted) {
    return (
      <PublicShell title={sitzung?.fields.titel ?? tx('Sitzungsanmeldung')}>
        <div className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconCheck size={40} className="text-emerald-600" stroke={2} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {tx('Anmeldung erfolgreich!')}
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              {tx('Deine Teilnahme wurde registriert. Du erhältst ggf. weitere Informationen per E-Mail.')}
            </p>
          </div>
          {sitzung && (
            <div className="rounded-xl border bg-card p-4 text-left w-full max-w-sm space-y-2">
              <p className="font-medium text-foreground">{sitzung.fields.titel}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCalendar size={14} className="shrink-0" />
                <span>{formatDateTime(sitzung.fields.datum_uhrzeit)}</span>
              </div>
              {sitzung.fields.ort && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconMapPin size={14} className="shrink-0" />
                  <span>{sitzung.fields.ort}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={sitzung?.fields.titel ?? tx('Sitzungsanmeldung')}>
      <div className="space-y-6">
        {/* Sitzungsdetails */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <IconCalendar size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                {tx('Art der Sitzung')}
              </p>
              <p className="font-medium text-foreground">{artLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <IconClock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{tx('Datum & Uhrzeit')}</p>
                <p className="text-sm text-foreground">{formatDateTime(sitzung?.fields.datum_uhrzeit)}</p>
              </div>
            </div>

            {sitzung?.fields.ort && (
              <div className="flex items-start gap-3">
                <IconMapPin size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">{tx('Ort / Raum')}</p>
                  <p className="text-sm text-foreground">{sitzung.fields.ort}</p>
                </div>
              </div>
            )}

            {sitzung?.fields.anmeldefrist && (
              <div className="flex items-start gap-3">
                <IconClock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">{tx('Anmeldefrist')}</p>
                  <p className={`text-sm ${deadlinePassed ? 'text-rose-600 font-medium' : 'text-foreground'}`}>
                    {formatDeadline(sitzung.fields.anmeldefrist)}
                  </p>
                </div>
              </div>
            )}

            {maxTeilnehmer != null && (
              <div className="flex items-start gap-3">
                <IconUsers size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">{tx('Angemeldete Teilnehmer')}</p>
                  <p className={`text-sm ${isFull ? 'text-rose-600 font-medium' : 'text-foreground'}`}>
                    {isFull
                      ? tx('Keine freien Plätze')
                      : `${angemeldeteCount} / ${maxTeilnehmer}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {sitzung?.fields.beschreibung && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">{tx('Beschreibung / Agenda')}</p>
              <p className="text-sm text-foreground whitespace-pre-line">{sitzung.fields.beschreibung}</p>
            </div>
          )}
        </div>

        {/* Sperrhinweise */}
        {deadlinePassed && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
            <IconAlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">
              {tx('Die Anmeldefrist ist abgelaufen. Eine Anmeldung ist nicht mehr möglich.')}
            </p>
          </div>
        )}

        {!deadlinePassed && isFull && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <IconAlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              {tx('Diese Sitzung ist bereits ausgebucht. Es können keine weiteren Teilnehmer angemeldet werden.')}
            </p>
          </div>
        )}

        {/* Anmeldeformular */}
        {!deadlinePassed && !isFull && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              {tx('Deine Anmeldung')}
            </h2>

            <div className="space-y-3">
              <div>
                <label htmlFor="vorname" className="block text-sm font-medium text-foreground mb-1">
                  {tx('Vorname')} <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="vorname"
                  type="text"
                  required
                  autoComplete="given-name"
                  value={vorname}
                  onChange={e => setVorname(e.target.value)}
                  placeholder={tx('Dein Vorname')}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="nachname" className="block text-sm font-medium text-foreground mb-1">
                  {tx('Nachname')} <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="nachname"
                  type="text"
                  required
                  autoComplete="family-name"
                  value={nachname}
                  onChange={e => setNachname(e.target.value)}
                  placeholder={tx('Dein Nachname')}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                  {tx('E-Mail-Adresse')} <span className="text-rose-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={tx('deine@email.de')}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
                <IconAlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? tx('Wird angemeldet …') : tx('Jetzt anmelden')}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              {tx('Mit der Anmeldung erklärst du dich mit der Teilnahme an dieser Sitzung einverstanden.')}
            </p>
          </form>
        )}
      </div>
    </PublicShell>
  );
}
