import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import PassSheet from '../components/PassSheet.jsx';
import SellSheet from '../components/SellSheet.jsx';
import { clock, plateText } from '../lib/verdict';

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
 * WHAT HAS BEEN VERIFIED STAYS ON SCREEN. Every entry recorded on this phone
 * during this shift stacks up under the search box, newest first, with the time
 * it went through. It used to be a single ribbon with a Clear button — which
 * meant the record of a check survived only until somebody tidied it away, and
 * asked a staff member to do housekeeping with a queue waiting. Nothing here
 * needs dismissing now: the newest line is simply highlighted for a few seconds
 * and then settles into the list. Checks from earlier shifts and other days are
 * one tap away under Earlier checks.
 *
 * THE KEYBOARD COMES STRAIGHT BACK. A recorded entry closes its own sheet and
 * returns the cursor to an empty search box, so the next plate can be typed
 * without touching anything else.
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
  /* Everything verified on this phone this shift, newest first. */
  const [verified, setVerified] = useState([]);
  const [justNow, setJustNow] = useState(null); // ticket no. to highlight briefly
  const [selling, setSelling] = useState(null); // a pass being sold at the barrier
  const [ending, setEnding] = useState(false);  // End shift, asked twice on purpose
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

  /* Newest first, and never twice: re-checking a pass moves its line, it does
     not add another. */
  const remember = (entry) => {
    setVerified((list) => [entry, ...list.filter((x) => x.ticketNo !== entry.ticketNo)].slice(0, 60));
    setJustNow(entry.ticketNo);
  };

  const onRecorded = (out) => {
    remember({
      ticketNo: out.pass?.ticketNo || out.ticketNo,
      regNo: out.pass?.regNo,
      at: out.usedAt,
      note: out.verdict === 'valid_override' ? 'allowed outside slot' : null,
      type: out.pass?.category?.label || null,
    });
    load({ quiet: true });
  };

  /* The highlight fades by itself. The line stays. */
  useEffect(() => {
    if (!justNow) return undefined;
    const id = setTimeout(() => setJustNow(null), 6000);
    return () => clearTimeout(id);
  }, [justNow]);

  /*
   * Back to the search box, empty, with the cursor in it — the next vehicle is
   * already at the barrier. Called whichever way the sheet closed.
   */
  const closeSheet = () => {
    setOpen(null);
    setQ('');
    setResults(null);
    /* After the sheet unmounts, or the focus lands on a node about to go away. */
    requestAnimationFrame(() => searchRef.current?.focus());
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
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setSelling('')} className="rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-brand">
              Sell a pass
            </button>
            <button type="button" onClick={() => setEnding(true)} className="rounded-lg border border-white/25 px-3 py-2 text-[13px] font-semibold">
              End shift
            </button>
          </div>
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

        {verified.length > 0 && !searchingNow && (
          <section className="mb-4">
            <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-muted">
              Verified this shift · {verified.length}
            </h2>
            <ul className="space-y-1.5">
              {verified.map((e) => (
                <li key={e.ticketNo}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-colors duration-500 ${
                    e.ticketNo === justNow
                      ? 'border-pass-500/40 bg-pass-50'
                      : 'border-line bg-white'}`}>
                  <div className="min-w-0">
                    <div className="plate text-[17px]">{plateText(e.regNo)}</div>
                    <div className="truncate text-[13px] text-muted">
                      {e.sold ? `pass sold · ${e.sold}` : e.type || 'entry recorded'}
                      {e.note ? ` · ${e.note}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-pass-700">
                    {e.at ? clock(e.at) : 'in'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
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
          <div className="card px-5 py-8 text-center">
            <p className="text-[15px] text-muted">
              {searchingNow
                ? 'No pass found for that number. Check the digits, or ask the visitor for their pass number.'
                : tab === 'pending' ? 'Every booked vehicle has come through.' : 'No entries recorded yet.'}
            </p>
            {searchingNow && (
              <button type="button" className="btn-primary mt-4 w-full" onClick={() => setSelling(typed)}>
                Sell a pass for this vehicle
              </button>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.ticketNo}>
              <button type="button" onClick={() => setOpen({ ticketNo: p.ticketNo, typed: q.trim() || null })}
                className="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:scale-[.995]">
                <div className="min-w-0 flex-1">
                  <div className="plate text-[19px]">{plateText(p.regNo)}</div>
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

      {/*
        * End shift asks first.
        *
        * It sits a thumb's width from Sell a pass, on a phone held in one hand
        * in the wind, and the cost of a mis-tap is a signed-out gate and a code
        * to wait for with vehicles waiting. So it is confirmed, and the button
        * that confirms is not the one under the thumb.
        */}
      {ending && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 backdrop-blur-[2px]" onClick={() => setEnding(false)}>
          <div className="w-full rounded-t-3xl bg-white px-6 pb-8 pt-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">End your shift?</h2>
            <p className="mt-2 text-[15px] text-muted">
              This gate stops recording entries until somebody signs in again with a code sent to their mobile number.
              {verified.length > 0 ? ` ${verified.length} vehicle${verified.length === 1 ? '' : 's'} verified on this phone will stay in Earlier checks.` : ''}
            </p>
            <button type="button" className="btn-quiet mt-5 w-full" onClick={() => setEnding(false)}>
              No, stay on duty
            </button>
            <button type="button" className="btn mt-2 w-full bg-stop-500 py-3.5 text-[16px] font-bold text-white"
              onClick={() => { setEnding(false); signOut(); }}>
              Yes, end my shift
            </button>
          </div>
        </div>
      )}

      {selling !== null && (
        <SellSheet
          prefill={selling}
          onClose={() => { setSelling(null); setQ(''); load({ quiet: true }); requestAnimationFrame(() => searchRef.current?.focus()); }}
          /* The sale found the vehicle already has a pass: open that instead of
             selling a second one. */
          onOpenPass={(ticketNo) => setOpen({ ticketNo, typed: null })}
          onSold={(t) => remember({ ticketNo: t.ticketNo, regNo: t.regNo, at: t.enteredAt, sold: t.ticketNo, type: t.vehicleType || null })}
        />
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
