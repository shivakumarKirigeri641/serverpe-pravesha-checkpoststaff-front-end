import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import VehicleSheet from '../components/VehicleSheet.jsx';
import { clock, spacedPlate } from '../lib/verdict';

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
  valid: ['Entered', 'bg-pass-50 text-pass-700'],
  valid_override: ['Allowed', 'bg-warn-50 text-warn-700'],
  already_used: ['Already used', 'bg-stop-50 text-stop-700'],
  wrong_day: ['Wrong day', 'bg-warn-50 text-warn-700'],
  wrong_slot: ['Outside slot', 'bg-warn-50 text-warn-700'],
  unknown_ticket: ['No pass', 'bg-stop-50 text-stop-700'],
  not_paid: ['Not paid', 'bg-stop-50 text-stop-700'],
};

const FILTERS = [['', 'All'], ['entered', 'Entered'], ['refused', 'Refused']];

/** Days as people say them: Today, Yesterday, then the date. */
function dayLabel(iso, today) {
  const date = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (date === today) return 'Today';
  const yesterday = new Date(new Date(`${today}T00:00:00+05:30`).getTime() - 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (date === yesterday) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
}

export default function History({ today }) {
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
          <div className="text-[15px] font-bold">Earlier checks</div>
          <input
            className="field mt-2 text-[17px] uppercase tracking-wide" value={q} inputMode="text"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            placeholder="Number plate or pass number"
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setVerdict(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${verdict === key ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-3">
        {error && <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}
        {!checks && !error && <p className="py-10 text-center text-muted">Looking…</p>}
        {checks && checks.length === 0 && (
          <p className="card px-5 py-10 text-center text-[15px] text-muted">
            {term ? 'Nothing checked at this gate matches that.' : 'No checks recorded at this gate yet.'}
          </p>
        )}

        <ul className="space-y-2">
          {(checks || []).map((c) => {
            const [label, tone] = VERDICTS[c.verdict] || [c.verdict, 'bg-shell text-muted'];
            const day = dayLabel(c.at, today);
            const header = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <li key={c.id}>
                {header && <div className="px-1 pb-1 pt-3 text-[13px] font-semibold uppercase tracking-wide text-muted">{header}</div>}
                <button type="button" onClick={() => setPlate(c.regNo)}
                  className="card flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[.995]">
                  <div className="min-w-0 flex-1">
                    <div className="plate text-[18px]">{spacedPlate(c.regNo)}</div>
                    <div className="truncate text-[13px] text-muted">
                      {clock(c.at)}{c.by ? ` · ${c.by}` : ''}{c.type ? ` · ${c.type}` : ''}
                      {c.seconds !== null && c.seconds !== undefined ? ` · ${c.seconds}s` : ''}
                    </div>
                  </div>
                  <span className={`chip ${tone}`}>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <button type="button" className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] font-semibold text-brand"
            disabled={loading} onClick={() => load(cursor)}>
            {loading ? 'Loading…' : 'Show earlier checks'}
          </button>
        )}
      </main>

      {plate && <VehicleSheet regNo={plate} today={today} onClose={() => setPlate(null)} />}
    </div>
  );
}
