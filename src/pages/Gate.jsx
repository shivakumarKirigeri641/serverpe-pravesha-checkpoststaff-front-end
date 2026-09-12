import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import PassSheet from '../components/PassSheet.jsx';
import { clock, spacedPlate } from '../lib/verdict';

/*
 * The gate screen. One job: get from a vehicle at the barrier to a recorded
 * entry in as few taps as possible.
 *
 * TYPING THE PLATE COMES FIRST, because staff can read it off the vehicle
 * without the visitor doing anything. Four digits are enough — the search
 * matches the end of the plate, which is how people read them out.
 *
 * SUGGESTIONS ARE INSTANT. Today's expected vehicles are already on the phone,
 * so the first character filters them with no network at all — at a barrier,
 * waiting 300ms for a server to answer what the device already knows is the
 * difference between one tap and a queue. The server is still asked, a moment
 * later, for anything not in today's list (yesterday's pass, another date), and
 * those results are added underneath. Nothing is approved by typing: a pass is
 * opened, validated, and only then recorded.
 *
 * THE LIST UNDERNEATH is today's expected vehicles, so a staff member can also
 * work by finding the visitor rather than typing. Pending first; the ones
 * already through move to their own tab and stop cluttering the queue.
 *
 * IT REFRESHES ON ITS OWN, quietly, because a second phone or the other gate may
 * have recorded an entry since this screen was drawn.
 */
export default function Gate() {
  const { me, signOut } = useSession();
  const [arrivals, setArrivals] = useState(null);
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);       // { ticketNo, typed }
  const [flash, setFlash] = useState(null);     // last recorded entry, shown as a ribbon
  const searchRef = useRef(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const d = await api.arrivals();
      setArrivals(d);
      if (!quiet) setError(null);
    } catch (e) {
      if (!quiet) setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* A slow, quiet refresh: often enough that two gates agree, rare enough that a
     phone on a hill is not kept awake talking to the network. */
  useEffect(() => {
    const id = setInterval(() => { if (!open && document.visibilityState === 'visible') load({ quiet: true }); }, 30000);
    const onShow = () => document.visibilityState === 'visible' && load({ quiet: true });
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [load, open]);

  /*
   * What the phone can answer by itself: today's arrivals, filtered as they
   * type. Exact plate first, then plates ending in what was typed — the way a
   * number is read out — then anything containing it, then pass numbers.
   */
  const typed = q.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suggestions = useMemo(() => {
    if (!typed) return null;
    const rank = (p) => {
      const plate = String(p.regNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (plate === typed) return 0;
      if (plate.endsWith(typed)) return 1;
      if (plate.includes(typed)) return 2;
      if (String(p.ticketNo || '').toUpperCase().includes(typed)) return 3;
      return 99;
    };
    return (arrivals?.passes || [])
      .map((p) => ({ p, r: rank(p) }))
      .filter((x) => x.r < 99)
      .sort((a, b) => a.r - b.r
        || (a.p.status === 'used') - (b.p.status === 'used')
        || String(a.p.regNo).localeCompare(String(b.p.regNo)))
      .map((x) => x.p);
  }, [typed, arrivals]);

  /* Search as they type, once the query is worth sending. */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults(null); setSearching(false); return undefined; }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const d = await api.search(term);
        setResults(d.passes || []);
        setError(null);
      } catch (e) {
        setResults([]);
        setError(e.message);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const onRecorded = (out) => {
    setFlash({ regNo: out.pass?.regNo, at: out.usedAt, override: out.verdict === 'valid_override' });
    load({ quiet: true });
  };

  const closeSheet = () => {
    setOpen(null);
    setQ('');
    setResults(null);
    searchRef.current?.focus();
  };

  const totals = arrivals?.totals;

  /* What is on the phone, then whatever the server adds that is not already
     there — so the list never jumps about as the answer arrives. */
  const merged = () => {
    const seen = new Set((suggestions || []).map((p) => p.ticketNo));
    const extra = (results || []).filter((p) => !seen.has(p.ticketNo));
    return [...(suggestions || []), ...extra];
  };
  const searchingNow = typed.length > 0;
  const list = searchingNow
    ? merged()
    : (arrivals?.passes || []).filter((p) => (tab === 'pending' ? p.status !== 'used' : p.status === 'used'));

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-brand text-white shadow-soft">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold">{me?.checkpost?.name}</div>
            <div className="truncate text-[12px] text-white/70">
              {me?.staff?.name} · on duty · {me?.serverDate}
            </div>
          </div>
          <button type="button" onClick={signOut} className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-[13px] font-semibold">
            End shift
          </button>
        </div>

        {totals && (
          <div className="mx-auto flex max-w-lg gap-2 px-4 pb-3">
            <Stat label="Expected" value={totals.expected} />
            <Stat label="Entered" value={totals.entered} tone="bg-pass-500/25" />
            <Stat label="Still to come" value={totals.pending} tone="bg-white/15" />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4">
        <div className="sticky top-[104px] z-10 -mx-4 bg-shell px-4 pb-3 pt-3">
          <input
            ref={searchRef} className="field text-[18px] uppercase tracking-wide" autoFocus
            placeholder="Vehicle number or pass number" value={q} inputMode="text"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="mt-1.5 px-1 text-[13px] text-muted">
            {!searchingNow ? 'Type the last 4 digits of the number plate.'
              : `${list.length} match${list.length === 1 ? '' : 'es'}${searching ? ' · still looking' : ''}`}
          </p>
        </div>

        {flash && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-pass-500/25 bg-pass-50 px-4 py-3">
            <div>
              <div className="text-[15px] font-bold text-pass-700">
                {spacedPlate(flash.regNo)} recorded{flash.override ? ' (allowed)' : ''}
              </div>
              <div className="text-[13px] text-muted">at {clock(flash.at)}</div>
            </div>
            <button type="button" onClick={() => setFlash(null)} className="text-[13px] font-semibold text-muted">Clear</button>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>
        )}

        {!searchingNow && (
          <div className="mb-3 flex gap-2">
            <Tab active={tab === 'pending'} onClick={() => setTab('pending')} label={`Still to come (${totals?.pending ?? 0})`} />
            <Tab active={tab === 'entered'} onClick={() => setTab('entered')} label={`Entered (${totals?.entered ?? 0})`} />
          </div>
        )}

        {!arrivals && !error && <p className="py-10 text-center text-muted">Loading today&rsquo;s passes…</p>}

        {arrivals && list.length === 0 && (
          <p className="card px-5 py-10 text-center text-[15px] text-muted">
            {searchingNow
              ? 'No pass found for that number. Check the digits, or ask the visitor for their pass number.'
              : tab === 'pending' ? 'Every booked vehicle has come through.' : 'No entries recorded yet.'}
          </p>
        )}

        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.ticketNo}>
              <button type="button" onClick={() => setOpen({ ticketNo: p.ticketNo, typed: q.trim() || null })}
                className="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:scale-[.995]">
                <div className="min-w-0 flex-1">
                  <div className="plate text-[19px]">{spacedPlate(p.regNo)}</div>
                  <div className="truncate text-[13px] text-muted">
                    {p.slot?.label} · {p.category?.label}{p.visitor ? ` · ${p.visitor}` : ''}
                    {p.travelDate !== arrivals?.date ? ` · ${p.travelDate}` : ''}
                  </div>
                </div>
                {p.status === 'used'
                  ? <span className="chip bg-pass-50 text-pass-700">In at {clock(p.usedAt)}</span>
                  : <span className="chip bg-shell text-muted">Expected</span>}
              </button>
            </li>
          ))}
        </ul>
      </main>

      {open && (
        <PassSheet ticketNo={open.ticketNo} typed={open.typed} onClose={closeSheet} onRecorded={onRecorded} />
      )}
    </div>
  );
}

const Stat = ({ label, value, tone = 'bg-white/10' }) => (
  <div className={`flex-1 rounded-xl ${tone} px-3 py-2`}>
    <div className="text-[20px] font-extrabold leading-tight">{value}</div>
    <div className="text-[11px] uppercase tracking-wide text-white/70">{label}</div>
  </div>
);

const Tab = ({ active, onClick, label }) => (
  <button type="button" onClick={onClick}
    className={`flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${active ? 'bg-brand text-white' : 'border border-line bg-white text-muted'}`}>
    {label}
  </button>
);
