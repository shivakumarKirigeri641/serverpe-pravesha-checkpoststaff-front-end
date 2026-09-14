import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
import VehicleSheet from '../components/VehicleSheet.jsx';
import { clock, plateText } from '../lib/verdict';

/*
 * History — what this gate has already checked.
 *
 * Two questions get asked at a barrier all day: "did that car go through?" and
 * "what happened with this number?". The shift log answered the first, only for
 * today. This answers both, as far back as the gate has records.
 *
 * SEARCH IS THE POINT, so it is the first thing on the screen and it matches the
 * end of a plate — four digits, the way people read a number out. Tapping any
 * line opens everything this gate has seen of that vehicle.
 */

const VERDICTS = {
  valid: ['hEntered', 'bg-pass-50 text-pass-700'],
  valid_override: ['hAllowed', 'bg-warn-50 text-warn-700'],
  already_used: ['hAlreadyUsed', 'bg-stop-50 text-stop-700'],
  wrong_day: ['hWrongDay', 'bg-warn-50 text-warn-700'],
  wrong_slot: ['hOutsideSlot', 'bg-warn-50 text-warn-700'],
  unknown_ticket: ['hNoPass', 'bg-stop-50 text-stop-700'],
  not_paid: ['hNotPaid', 'bg-stop-50 text-stop-700'],
  watch_blocked: ['watchBlockedChip', 'bg-stop-50 text-stop-700'],
};

const FILTERS = [['', 'all'], ['entered', 'entered'], ['refused', 'refused']];

export default function History({ today }) {
  const { t, locale } = useT();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [verdict, setVerdict] = useState('');
  const [checks, setChecks] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plate, setPlate] = useState(null);
  const alive = useRef(0);

  /* Days as people say them: Today, Yesterday, then the date. */
  const dayLabel = (iso) => {
    const date = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (date === today) return t('today');
    const yesterday = new Date(new Date(`${today}T00:00:00+05:30`).getTime() - 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (date === yesterday) return t('yesterday');
    return new Date(iso).toLocaleDateString(locale, { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
  };

  /* Typing searches straight away; a breath's pause before asking the server. */
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async (before = null) => {
    const run = alive.current + 1;
    alive.current = run;
    setLoading(true);
    try {
      const d = await api.history({ q: term, verdict, before, limit: 30 });
      if (alive.current !== run) return;
      setChecks((old) => (before ? [...(old || []), ...d.checks] : d.checks));
      setCursor(d.nextCursor);
      setHasMore(d.hasMore);
      setError(null);
    } catch (e) {
      if (alive.current === run) setError(e.message);
    } finally {
      if (alive.current === run) setLoading(false);
    }
  }, [term, verdict]);

  useEffect(() => { setChecks(null); load(); }, [load]);

  let lastDay = null;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-brand px-4 pb-3 pt-3 text-white shadow-soft">
        <div className="mx-auto max-w-lg">
          <div className="text-[15px] font-bold">{t('earlierChecks')}</div>
          <input
            className="field mt-2 text-[17px] uppercase tracking-wide" value={q} inputMode="text"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            placeholder={t('historyPh')}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setVerdict(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${verdict === key ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-3">
        {error && <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}
        {!checks && !error && <p className="py-10 text-center text-muted">{t('looking')}</p>}
        {checks && checks.length === 0 && (
          <p className="card px-5 py-10 text-center text-[15px] text-muted">
            {term ? t('nothingMatchesGate') : t('noChecksGate')}
          </p>
        )}

        <ul className="space-y-2">
          {(checks || []).map((c) => {
            const [labelKey, tone] = VERDICTS[c.verdict] || [null, 'bg-shell text-muted'];
            const day = dayLabel(c.at);
            const header = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <li key={c.id}>
                {header && <div className="px-1 pb-1 pt-3 text-[13px] font-semibold uppercase tracking-wide text-muted">{header}</div>}
                <button type="button" onClick={() => setPlate(c.regNo)}
                  className="card press flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="plate text-[18px]">{plateText(c.regNo)}</div>
                    <div className="truncate text-[13px] text-muted">
                      {clock(c.at)}{c.by ? ` · ${c.by}` : ''}{c.type ? ` · ${c.type}` : ''}
                      {c.seconds !== null && c.seconds !== undefined ? ` · ${c.seconds}s` : ''}
                    </div>
                  </div>
                  <span className={`chip ${tone}`}>{labelKey ? t(labelKey) : c.verdict}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <button type="button" className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] font-semibold text-brand"
            disabled={loading} onClick={() => load(cursor)}>
            {loading ? t('loadingDots') : t('showEarlier')}
          </button>
        )}
      </main>

      {plate && <VehicleSheet regNo={plate} today={today} onClose={() => setPlate(null)} />}
    </div>
  );
}
