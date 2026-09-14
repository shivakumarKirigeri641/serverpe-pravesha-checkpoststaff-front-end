import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import PassDetail from '../components/PassDetail.jsx';
import { clock, plateText } from '../lib/verdict';

/*
 * Passes for a day — the vehicles expected, and the ones already in.
 *
 * THE GATE SCREEN IS TODAY'S WORK; this is the record. Step back a day to
 * settle an argument about yesterday, or type a plate to see every pass that
 * vehicle has ever held here, whatever the date — a plate search deliberately
 * ignores the chosen day, because "has this car been here before?" is not a
 * question about one morning.
 *
 * EXPECTED FIRST, because that is the list somebody is working through; the
 * ones already in are a separate tab so they stop cluttering it. Tapping any
 * line opens the whole booking: who booked it, when, how, what they paid, and
 * who checked it in.
 */
const TABS = [['expected', 'Expected'], ['entered', 'Entered'], ['', 'All']];

const dayName = (iso) => new Date(`${iso}T06:00:00+05:30`)
  .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });

const shift = (iso, days) => new Date(new Date(`${iso}T06:00:00+05:30`).getTime() + days * 86400000)
  .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function Passes({ today }) {
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState('expected');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const run = useRef(0);

  useEffect(() => { const id = setTimeout(() => setTerm(q.trim()), 200); return () => clearTimeout(id); }, [q]);

  const load = useCallback(async () => {
    const mine = run.current + 1;
    run.current = mine;
    setLoading(true);
    try {
      const d = await api.passes({ date, status, q: term, limit: 100 });
      if (run.current !== mine) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (run.current === mine) { setError(e.message); setData(null); }
    } finally {
      if (run.current === mine) setLoading(false);
    }
  }, [date, status, term]);

  useEffect(() => { load(); }, [load]);

  /* A booking or an entry anywhere reloads the list within seconds, while the
     phone is looking at it. Not under an open booking sheet. */
  const beat = useRef(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive || document.visibilityState !== 'visible') return;
      try {
        const p = await api.pulse();
        if (!alive) return;
        const moved = beat.current !== null && p.pulse !== beat.current;
        beat.current = p.pulse;
        if (moved && !open) load();
      } catch { /* the next tick asks again */ }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [load, open]);

  const searching = term.replace(/[^A-Za-z0-9]/g, '').length >= 3;
  const list = data?.passes || [];

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-brand px-4 pb-3 pt-3 text-white shadow-soft">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Previous day" onClick={() => setDate((d) => shift(d, -1))}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-[15px] font-bold">‹</button>
            <div className="text-center">
              <div className="text-[15px] font-bold">{date === today ? 'Today' : dayName(date)}</div>
              <div className="text-[12px] text-white/70">
                {searching ? `every date · ${data?.total ?? 0} found` : `${data?.total ?? 0} pass${(data?.total ?? 0) === 1 ? '' : 'es'}`}
              </div>
            </div>
            <button type="button" aria-label="Next day" disabled={date >= today}
              onClick={() => setDate((d) => shift(d, 1))}
              className={`rounded-lg px-3 py-1.5 text-[15px] font-bold ${date >= today ? 'bg-white/5 text-white/30' : 'bg-white/15'}`}>›</button>
          </div>

          <input
            className="field mt-2 text-[17px] uppercase tracking-wide" value={q} inputMode="text"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            placeholder="Number plate, pass number or name"
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="mt-2 flex gap-2">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setStatus(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-[14px] font-semibold ${status === key ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-3">
        {error && <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}
        {!data && !error && <p className="py-10 text-center text-muted">Looking…</p>}
        {data && list.length === 0 && (
          <p className="card px-5 py-10 text-center text-[15px] text-muted">
            {searching
              ? 'No pass at this place matches that.'
              : status === 'entered' ? 'Nothing has come through on this day yet.'
                : status === 'expected' ? 'No vehicles still to come on this day.'
                  : 'No passes booked for this day.'}
          </p>
        )}

        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.ticketNo}>
              <button type="button" onClick={() => setOpen(p)}
                className="card flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[.995]">
                <div className="min-w-0 flex-1">
                  <div className="plate text-[18px]">{plateText(p.regNo)}</div>
                  <div className="truncate text-[13px] text-muted">
                    {p.booked?.by || p.visitor || 'No name'} · {p.category?.label} · ₹{p.paid?.total}
                    {searching && p.travelDate !== date ? ` · ${p.travelDate}` : ''}
                  </div>
                  <div className="truncate text-[12px] text-muted/80">
                    {p.booked?.how}{p.booked?.at ? ` · ${clock(p.booked.at)}` : ''}
                    {p.booked?.declared ? ' · type declared at the gate' : ''}
                  </div>
                </div>
                {p.entered
                  ? <span className="chip shrink-0 bg-pass-50 text-pass-700">In at {clock(p.entered.at)}</span>
                  : <span className="chip shrink-0 bg-shell text-muted">{p.slot?.label?.split(' ')[0] || 'Expected'}</span>}
              </button>
            </li>
          ))}
        </ul>

        {loading && data && <p className="py-4 text-center text-[13px] text-muted">Refreshing…</p>}
      </main>

      {open && <PassDetail pass={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
