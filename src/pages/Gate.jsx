import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { LangToggle, useT } from '../lib/i18n.jsx';
import { setSoundOn, soundOn } from '../lib/feedback';
import { dismissProblem, markEntered, markExited, saveArrivals, savedArrivals, sendNow, subscribe, withQueue } from '../lib/offline';
import { batteryWarning, useBattery, useDaylight, useWakeLock } from '../lib/device';
import PassSheet from '../components/PassSheet.jsx';
import SellSheet from '../components/SellSheet.jsx';
import ExitSheet from '../components/ExitSheet.jsx';
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
 * it went through. Checks from earlier shifts and other days are one tap away
 * under Earlier checks.
 *
 * NO SIGNAL IS NOT A STOPPED GATE. Today's list is saved on the phone every time
 * it arrives; when the signal goes, the screen says so, keeps working from that
 * list, and keeps entries on the phone until they can be sent. Anything the
 * server could not accept once they arrive is shown here until somebody reads it.
 *
 * END SHIFT IS A HANDOVER. Before the shift ends, the sheet shows what this
 * shift did — checked, entered, refused, allowed outside the slot, passes sold
 * and the cash, UPI and card taken — so the cash can be counted against it. The
 * same figures are saved with the shift for the office.
 */
export default function Gate() {
  const { me, signOut } = useSession();
  const { t } = useT();
  const [arrivals, setArrivals] = useState(null);
  const [offline, setOffline] = useState(false);
  const [net, setNet] = useState({ queued: 0, problems: [], sending: false });
  /* Which list is drawn: still to come, inside, or out (063). Not a mode — every
     card carries both Check in and Check out, and whichever applies is lit. */
  const [tab, setTab] = useState('pending');
  const [exiting, setExiting] = useState(null);   // a pass being checked out
  const [showAllVerified, setShowAllVerified] = useState(false);
  /* How much of the queue is drawn. Reset whenever the list underneath changes. */
  const PAGE = 20;
  const [showCount, setShowCount] = useState(PAGE);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);       // { ticketNo, typed, pass }
  /* Everything verified on this phone this shift, newest first. */
  const [verified, setVerified] = useState([]);
  const [justNow, setJustNow] = useState(null); // ticket no. to highlight briefly
  const [selling, setSelling] = useState(null); // a pass being sold at the barrier
  const [ending, setEnding] = useState(false);  // End shift, asked twice on purpose
  const [summary, setSummary] = useState(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const searchRef = useRef(null);

  /* The phone: kept awake for the shift, watched for battery, read in the sun. */
  useWakeLock(true);
  const battery = useBattery();
  const lowBattery = batteryWarning(battery);
  const daylight = useDaylight();



  /*
   * ENTERED MEANS ENTERED, AT ONCE.
   *
   * A vehicle approved here moves to Entered the moment the entry is recorded,
   * and stays there. It used to wait for the list to reload — and a reload can
   * lose that race: one already on its way from before the tap, a server that is
   * restarting, a slow answer, the phone's saved copy used instead. Each left a
   * vehicle that had gone through sitting under "Still to come" (reported by the
   * user, 2026-09-15). Entries made on this screen are remembered and laid over
   * every list that arrives, until the server's own list shows them as used.
   */
  const recent = useRef(new Map());
  /* The same for exits recorded here (063): out at once, whatever reload races it. */
  const recentExits = useRef(new Map());
  const withRecent = useCallback((data) => {
    if (!data || !Array.isArray(data.passes)) return data;
    let next = data;
    for (const [ticketNo, at] of recent.current) {
      const onServer = data.passes.find((p) => p.ticketNo === ticketNo);
      if (onServer && onServer.status === 'used' && !data.fromPhone) recent.current.delete(ticketNo);
      else next = markEntered(next, ticketNo, at);
    }
    for (const [ticketNo, at] of recentExits.current) {
      const onServer = data.passes.find((p) => p.ticketNo === ticketNo);
      if (onServer && onServer.exitedAt && !data.fromPhone) recentExits.current.delete(ticketNo);
      else next = markExited(next, ticketNo, at);
    }
    return next;
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const d = await api.arrivals();
      saveArrivals(d);
      /* Anything recorded offline that has not been sent yet still shows as in. */
      setArrivals(withRecent(withQueue(d)));
      setOffline(false);
      if (!quiet) setError(null);
    } catch (e) {
      if (e.offline) {
        const saved = savedArrivals();
        setOffline(true);
        if (saved) { setArrivals(withRecent(saved)); setError(null); } else if (!quiet) setError(t('offlineNoList'));
      } else if (!quiet) {
        setError(e.message);
      }
    }
  }, [t, withRecent]);

  useEffect(() => { load(); }, [load]);

  /* The queue of entries kept on the phone, and anything the server refused. */
  useEffect(() => subscribe(setNet), []);
  useEffect(() => {
    /* An entry was kept or sent: redraw the list from what the phone knows. */
    if (offline) { const saved = savedArrivals(); if (saved) setArrivals(withRecent(saved)); }
  }, [net.queued, offline]);

  /*
   * Caught up the moment something happens. Every few seconds the phone asks
   * the server one tiny question — has anything changed? — and reloads today's
   * list only when the answer moves: a booking paid by WhatsApp, a pass sold at
   * either gate, an entry recorded on another phone. When the question gets an
   * answer after a spell without signal, the list is reloaded at once and the
   * saved entries are sent. Nothing reloads under an open pass sheet.
   */
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
        const sheetOpen = open || exiting;
        if (offline) { sendNow(); if (!sheetOpen) load({ quiet: true }); } else if (moved && !sheetOpen) load({ quiet: true });
      } catch (e) {
        if (alive && e.offline) setOffline(true);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    const onShow = () => { if (document.visibilityState === 'visible') { load({ quiet: true }); tick(); } };
    document.addEventListener('visibilitychange', onShow);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [load, open, exiting, offline]);

  /* The handover figures, added up the moment End shift is tapped. */
  useEffect(() => {
    if (!ending) return undefined;
    let alive = true;
    setSummary(null);
    setSummaryFailed(false);
    api.shiftSummary()
      .then((d) => { if (alive) setSummary(d.summary); })
      .catch(() => { if (alive) setSummaryFailed(true); });
    return () => { alive = false; };
  }, [ending]);

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

  /* Search as they type, once the query is worth sending. Without signal the
     phone's own list is all there is, and that is not an error. */
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
        if (e.offline) setOffline(true); else setError(e.message);
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
    const ticketNo = out.pass?.ticketNo || out.ticketNo;
    if (ticketNo) {
      recent.current.set(ticketNo, out.usedAt || new Date().toISOString());
      setArrivals((a) => markEntered(a, ticketNo, out.usedAt));
      /* Back to the queue (user, 2026-09-17): once a vehicle is recorded the
         next one is what matters, so the screen returns to "Still to come" with
         the search box empty, ready for the next plate. The entry is still at
         the top of "Entered" and in "Verified this shift". */
      setTab('pending');
      setQ('');
    }
    remember({
      ticketNo,
      regNo: out.pass?.regNo,
      at: out.usedAt,
      override: out.verdict === 'valid_override',
      saved: Boolean(out.offline),
      type: out.pass?.category?.label || null,
    });
    load({ quiet: true });
  };

  /* A vehicle checked out (063): shown as out at once, back to "Inside" with the
     search empty for the next one leaving. */
  const onExited = (out) => {
    recentExits.current.set(out.ticketNo, out.exitedAt || new Date().toISOString());
    setArrivals((a) => markExited(a, out.ticketNo, out.exitedAt));
    setQ('');
    remember({ ticketNo: out.ticketNo, regNo: out.regNo, at: out.exitedAt, exit: true, saved: Boolean(out.offline),
      type: out.pass?.category?.label || null });
    load({ quiet: true });
  };

  /* The highlight fades by itself. The line stays. */
  useEffect(() => {
    if (!justNow) return undefined;
    const id = setTimeout(() => setJustNow(null), 6000);
    return () => clearTimeout(id);
  }, [justNow]);

  /* "Verified this shift" CLEARS ITSELF (user, 2026-09-17). It used to stay on
     screen until the page was reloaded. It now goes a few seconds after the last
     entry, leaving the queue clean for the next vehicle; the entries themselves
     are still under "Entered". A new entry starts the wait again. */
  useEffect(() => {
    if (!verified.length) return undefined;
    const id = setTimeout(() => { setVerified([]); setShowAllVerified(false); }, 6000);
    return () => clearTimeout(id);
  }, [verified]);

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

  const toggleSound = () => { const next = !sound; setSoundOn(next); setSound(next); };

  const totals = arrivals?.totals;

  /* What is on the phone, then whatever the server adds that is not already
     there — so the list never jumps about as the answer arrives. */
  const merged = () => {
    const seen = new Set((suggestions || []).map((p) => p.ticketNo));
    const extra = (results || []).filter((p) => !seen.has(p.ticketNo));
    return [...(suggestions || []), ...extra];
  };
  const searchingNow = typed.length > 0;
  const matches = searchingNow ? merged() : [];
  /*
   * TYPING SEARCHES BOTH LISTS (user, 2026-09-16).
   *
   * Four digits or a plate finds the vehicle whether it has come through or
   * not, and each row says which: "Expected" or "Checked in 10:42". It used to
   * search only the tab that was open, and on "Still to come" a vehicle that had
   * already entered answered "No pass found — Sell a pass for this vehicle":
   * an invitation to sell a second pass to someone who already has one. Now
   * "No pass found" means exactly that. Vehicles still to come are listed
   * first, because they are the ones a barrier is waiting on.
   *
   * The tabs sort the day's list when nothing is typed.
   */
  /* Three lists (063): still to come; inside — newest entry first, so the one
     just recorded is at the top; out — newest exit first. Typing searches all
     three, still to come first, then inside, then out. */
  const isInside = (p) => p.status === 'used' && !p.exitedAt;
  const newestIn = (a, b) => String(b.usedAt || '').localeCompare(String(a.usedAt || ''));
  const newestOut = (a, b) => String(b.exitedAt || '').localeCompare(String(a.exitedAt || ''));
  const all = arrivals?.passes || [];
  const list = searchingNow
    ? [...matches.filter((p) => p.status !== 'used'), ...matches.filter(isInside), ...matches.filter((p) => p.exitedAt)]
    : tab === 'inside'
      ? all.filter(isInside).sort(newestIn)
      : tab === 'out'
        ? all.filter((p) => p.exitedAt).sort(newestOut)
        : all.filter((p) => p.status !== 'used');

  /*
   * A BUSY SUNDAY IS SIX HUNDRED PASSES, AND NOBODY SCROLLS SIX HUNDRED CARDS.
   *
   * The whole list used to be drawn: six hundred cards in the page, a scrollbar
   * the size of a thread, and a phone that stutters on every redraw — while the
   * vehicle actually at the barrier is found by typing four digits, never by
   * scrolling. So a screenful is drawn and the rest waits behind a button.
   *
   * The full list stays in memory regardless: it is what answers a search
   * instantly, and what answers it at all when the signal has gone. Only the
   * drawing is cut.
   */
  useEffect(() => { setShowCount(PAGE); }, [tab, typed]);
  const shown = searchingNow ? list : list.slice(0, showCount);
  const moreBelow = list.length - shown.length;

  return (
    <div className="min-h-screen pb-24">
      {/*
       * EVERYTHING NEEDED TO CHECK A VEHICLE STAYS ON SCREEN.
       *
       * The header, the search box and the two tabs are one sticky block, so a
       * staff member never scrolls to find where to type or which list they are
       * in. Before, the tabs sat below the shift's history — which grows all
       * day — so by mid-morning they were a screen and a half down and looked
       * as though they had disappeared while typing.
       *
       * It is kept short on purpose: one header line instead of three. The
       * counts that had their own row are in the tab labels, where they are
       * read anyway, and the two settings are icons in the header.
       */}
      <div className="sticky top-0 z-20 shadow-soft">
      <header className="bg-brand text-white">
        {/* TWO ROWS ON A PHONE (user, 2026-09-19). On one row the five controls
            took the whole width and the checkpost and staff names shrank to a
            letter each. The names now have the top row to themselves, End shift
            beside them; the controls sit underneath, Sell a pass taking the
            space that is left. */}
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold">{me?.checkpost?.name}</div>
            <div className="truncate text-[12px] text-white/70">
              {me?.staff?.name} · {t('onDuty')}
              {totals ? ` · ${t('expectedToday', { n: totals.expected })}` : ''}
            </div>
          </div>
          <button type="button" onClick={() => setEnding(true)} className="shrink-0 rounded-lg border border-white/25 px-2.5 py-1.5 text-[13px] font-semibold">
            {t('endShift')}
          </button>
        </div>
        <div className="mx-auto max-w-lg px-4 pb-3 pt-2.5">
          <div className="flex items-center gap-1.5">
            {/* Language and sound had a row of their own — chosen once a shift,
                paid for on every screen. Icons, with the word for a long press. */}
            <LangToggle className="bg-white/15 text-white" />
            <button type="button" onClick={daylight.cycle} aria-label={t(`daylight${daylight.mode[0].toUpperCase()}${daylight.mode.slice(1)}`)}
              title={t(`daylight${daylight.mode[0].toUpperCase()}${daylight.mode.slice(1)}`)}
              className={`relative rounded-lg px-2.5 py-2 text-[15px] leading-none ${daylight.active ? 'bg-white text-brand' : 'bg-white/15 text-white'}`}>
              ☀
              {daylight.mode === 'auto' && (
                <span className="absolute -right-1 -top-1 rounded-full bg-ask-500 px-1 text-[9px] font-black leading-[14px] text-white">A</span>
              )}
            </button>
            <button type="button" onClick={toggleSound} aria-pressed={sound} title={sound ? t('soundOn') : t('soundOff')}
              className="rounded-lg bg-white/15 px-2.5 py-2 text-[15px] leading-none text-white">
              {sound ? '🔔' : '🔕'}
            </button>
            <button type="button" onClick={() => setSelling('')} disabled={offline} title={offline ? t('sellNeedsSignal') : undefined}
              className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[14px] font-bold text-brand disabled:opacity-50">
              ＋ {t('sellPass')}
            </button>
          </div>
        </div>

        {(offline || net.queued > 0) && (
          <div className="mx-auto max-w-lg px-4 pb-2">
            <span className={`inline-block rounded-lg px-2.5 py-1.5 text-[12px] font-bold ${offline ? 'bg-ask-500 text-white' : 'bg-white/15 text-white'}`}>
              {offline ? '📵 ' : '⏫ '}
              {net.sending ? t('sendingNow', { n: net.queued }) : net.queued > 0 ? t('waitingToSend', { n: net.queued }) : t('offlineTitle')}
            </span>
          </div>
        )}
      </header>

      <div className="bg-shell px-4 pb-2.5 pt-2.5">
        <div className="mx-auto max-w-lg">
          {/* Clear sits beside the box, not inside it: a thumb in gloves or rain
              needs a real target, and the next vehicle is the next four digits. */}
          <div className="flex gap-2">
            <input
              ref={searchRef} className="field min-w-0 flex-1 text-[18px] uppercase tracking-wide placeholder:text-[15px] placeholder:normal-case placeholder:tracking-normal" autoFocus
              placeholder={t('searchPh')} value={q} inputMode="text"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button type="button" aria-label={t('clearSearch')}
                onClick={() => { setQ(''); searchRef.current?.focus(); }}
                className="press shrink-0 rounded-xl border border-line bg-white px-4 text-[15px] font-bold text-ink">
                ✕ {t('clearSearch')}
              </button>
            )}
          </div>
          {/* The tabs sit with the search box, not below the day's history:
              they are how a staff member says which list they are searching. */}
          <div className="mt-2.5 flex gap-2">
            {/* While searching, no tab is lit: the search covers all three.
                Tapping one goes back to that list. */}
            <Tab active={!searchingNow && tab === 'pending'} onClick={() => { setQ(''); setTab('pending'); }} label={t('toComeTab')} count={totals?.pending ?? 0} />
            <Tab active={!searchingNow && tab === 'inside'} onClick={() => { setQ(''); setTab('inside'); }} label={t('inside')} count={totals?.inside ?? 0} />
            <Tab active={!searchingNow && tab === 'out'} onClick={() => { setQ(''); setTab('out'); }} label={t('outTab')} count={totals?.exited ?? 0} />
          </div>
          <p className="mt-1.5 px-1 text-[12.5px] text-muted">
            {!searchingNow ? t('searchHint')
              : `${t(list.length === 1 ? 'matchOne' : 'matchMany', { n: list.length })}${
                list.length ? ` · ${t('matchSplit', { pending: list.filter((p) => p.status !== 'used').length, entered: list.filter((p) => p.status === 'used').length })}` : ''
              }${searching ? ` · ${t('stillLooking')}` : ''}`}
          </p>
        </div>
      </div>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-3">

        {lowBattery && (
          <div role="alert" className={`mb-3 rounded-xl border px-4 py-3 text-[14px] font-semibold ${
            lowBattery === 'critical' ? 'border-stop-500/40 bg-stop-50 text-stop-700' : 'border-ask-500/40 bg-ask-50 text-ask-700'}`}>
            🔋 {t(lowBattery === 'critical' ? 'batteryCritical' : 'batteryLow', { n: battery.level })}
          </div>
        )}



        {offline && arrivals?.fromPhone && (
          <div className="mb-3 rounded-xl border border-ask-500/30 bg-ask-50 px-4 py-3 text-ask-700">
            <div className="text-[15px] font-bold">📵 {t('offlineTitle')}</div>
            <p className="mt-0.5 text-[14px]">{t('offlineBody', { t: clock(arrivals.savedAt) })}</p>
          </div>
        )}

        {net.problems.length > 0 && (
          <section className="mb-3 space-y-2">
            {net.problems.map((p) => (
              <div key={p.clientId} className="rounded-xl border-2 border-stop-500/40 bg-stop-50 px-4 py-3 text-stop-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold">{t('problemTitle')}</div>
                    <div className="plate mt-0.5 text-[18px]">{plateText(p.regNo)}</div>
                    <div className="text-[13px]">{p.message}{p.recordedAt ? ` · ${clock(p.recordedAt)}` : ''}</div>
                    <div className="mt-1 text-[12px] opacity-90">{t('problemHint')}</div>
                  </div>
                  <button type="button" onClick={() => dismissProblem(p.clientId)}
                    className="shrink-0 rounded-lg border border-stop-500/30 bg-white px-3 py-1.5 text-[13px] font-bold">{t('dismiss')}</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {!offline && net.queued > 0 && !net.sending && (
          <button type="button" onClick={sendNow} className="btn-quiet mb-3 w-full">⏫ {t('sendNow')} · {t('waitingToSend', { n: net.queued })}</button>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>
        )}

        {!arrivals && !error && (
          <div className="space-y-2" aria-busy="true" aria-label={t('loadingToday')}>
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[104px]" />)}
          </div>
        )}

        {arrivals && list.length === 0 && (
          <div className="card px-5 py-8 text-center">
            <p className="text-[15px] text-muted">
              {searchingNow ? t('noPassFound')
                : tab === 'inside' ? t('noneInside') : tab === 'out' ? t('noExits') : t('allCame')}
            </p>
            {searchingNow && (
              <button type="button" className="btn-primary mt-4 w-full" disabled={offline} onClick={() => setSelling(typed)}>
                {offline ? t('sellNeedsSignal') : t('sellForVehicle')}
              </button>
            )}
          </div>
        )}

        {/* Keyed by which list is on screen — not by what has been typed, or
            the cards would re-animate under a thumb at every keystroke. */}
        <ul key={searchingNow ? 'search' : tab} className="list-in space-y-2">
          {shown.map((p) => (
            <li key={p.ticketNo}>
              {/*
               * ONE CARD, BOTH DIRECTIONS (user, 2026-09-19). Type four digits,
               * and the vehicle's card offers Check in and Check out side by
               * side; whichever applies to it now is the lit one. No mode to
               * switch, nothing to get wrong at a busy barrier.
               */}
              <div className={`card px-4 pb-3 pt-3.5 transition-colors duration-700 ${
                p.ticketNo === justNow ? '!border-brand bg-brand/10 ring-2 ring-brand/30' : ''}`}>
                <div className="min-w-0">
                  <div className="plate text-[19px]">
                    {/* A per-person pass (056) has no plate: it is read as people. */}
                    {p.passKind === 'person' ? t('peopleCount', { n: p.persons || 1 }) : plateText(p.regNo)}
                    {p.watch && (
                      <span className={`chip ml-2 align-middle font-sans ${p.watch.level === 'block' ? 'bg-stop-600 text-white' : 'bg-ask-500 text-white'}`}>
                        ⚠ {p.watch.level === 'block' ? t('watchBlockedChip') : t('watchChip')}
                      </span>
                    )}
                  </div>
                  {/* The vehicle as it looks from the barrier, then what the
                      pass is for. The fare category alone ("Car / Jeep / SUV")
                      cannot be compared with the vehicle in front of you. */}
                  <div className="truncate text-[13.5px] font-medium text-ink/85">
                    {p.passKind === 'person'
                      ? t('perPersonPass')
                      : `${[p.details?.make, p.details?.model, p.details?.variant].filter(Boolean).join(' ') || p.vehicle || '—'}${p.details?.colour ? ` · ${p.details.colour}` : ''}`}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">
                    {p.details?.type ? `${p.details.type} · ` : ''}{p.category?.label}
                    {p.slot?.label ? ` · ${p.slot.label}` : ''}{p.visitor ? ` · ${p.visitor}` : ''}
                    {p.travelDate !== arrivals?.date ? ` · ${p.travelDate}` : ''}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* Check in: lit until the vehicle has entered; then it shows when. */}
                  {p.status === 'used' ? (
                    <div className="grid place-items-center rounded-xl bg-brand/10 px-2 py-2.5 text-[14px] font-bold text-brand">
                      {p.savedOffline ? '📵 ' : ''}{t('inAt', { t: clock(p.usedAt) })}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setOpen({ ticketNo: p.ticketNo, typed: q.trim() || null, pass: p })}
                      className="press rounded-xl bg-act-500 px-2 py-2.5 text-[15px] font-extrabold text-white">
                      ⬆ {t('modeIn')}
                    </button>
                  )}
                  {/* Check out: lit while the vehicle is inside; then it shows when. */}
                  {p.exitedAt ? (
                    <div className="grid place-items-center rounded-xl bg-ask-50 px-2 py-2.5 text-[14px] font-bold text-ask-700">
                      {p.exitSavedOffline ? '📵 ' : ''}{t('outAt', { t: clock(p.exitedAt) })}
                    </div>
                  ) : (
                    <button type="button" disabled={p.status !== 'used'} onClick={() => setExiting(p)}
                      className="press rounded-xl bg-ask-500 px-2 py-2.5 text-[15px] font-extrabold text-white disabled:bg-shell disabled:text-muted/60">
                      ⬇ {t('modeOut')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {moreBelow > 0 && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setShowCount((c) => c + PAGE)} className="btn-quiet press w-full">
              {t('showMoreVehicles', { n: Math.min(PAGE, moreBelow) })}
            </button>
            <p className="mt-2 text-[12.5px] text-muted">
              {t('showingOfTotal', { shown: shown.length, n: list.length })}
            </p>
          </div>
        )}

        {/*
         * WHAT THIS SHIFT HAS ALREADY DONE — UNDERNEATH, AND SHORT.
         *
         * This list used to sit above the queue and above the tabs, so it grew
         * all morning and pushed the actual work off the screen. It is history:
         * it belongs below, and three lines of it is what anybody reads. The
         * one just recorded stays at the top of it, lit, for a moment.
         */}
        {verified.length > 0 && !searchingNow && (
          <section className="mt-6 border-t border-line pt-4">
            <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-muted">
              {t('verifiedShift')} · {verified.length}
            </h2>
            <ul className="space-y-1.5">
              {(showAllVerified ? verified : verified.slice(0, 3)).map((e) => (
                <li key={e.ticketNo}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-colors duration-500 ${
                    e.ticketNo === justNow
                      ? 'border-pass-500/40 bg-pass-50'
                      : 'border-line bg-white'}`}>
                  <div className="min-w-0">
                    <div className="plate text-[17px]">{plateText(e.regNo)}</div>
                    <div className="truncate text-[13px] text-muted">
                      {e.exit ? t('exitRecorded') : e.sold ? `${t('passSold')} · ${e.sold}` : e.type || t('entryRecorded')}
                      {e.override ? ` · ${t('allowedOutside')}` : ''}
                      {e.saved ? ` · 📵 ${t('savedOfflineShort')}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-pass-700">
                    {e.at ? clock(e.at) : t('inWord')}
                  </span>
                </li>
              ))}
            </ul>
            {verified.length > 3 && (
              <button type="button" onClick={() => setShowAllVerified((v) => !v)}
                className="btn-quiet mt-2 w-full text-[13px]">
                {showAllVerified ? t('showFewerChecked') : t('showAllChecked', { n: verified.length })}
              </button>
            )}
          </section>
        )}
      </main>


      {open && (
        <PassSheet ticketNo={open.ticketNo} typed={open.typed} fallbackPass={open.pass || null}
          onClose={closeSheet} onRecorded={onRecorded} />
      )}

      {exiting && (
        <ExitSheet pass={exiting} onDone={onExited}
          onClose={() => { setExiting(null); setQ(''); requestAnimationFrame(() => searchRef.current?.focus()); }} />
      )}

      {/*
        * End shift asks first, and shows the handover.
        *
        * It sits a thumb's width from Sell a pass, on a phone held in one hand
        * in the wind, and the cost of a mis-tap is a signed-out gate and a code
        * to wait for with vehicles waiting. So it is confirmed, and the button
        * that confirms is not the one under the thumb.
        */}
      {ending && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 backdrop-blur-[2px]" onClick={() => !signingOut && setEnding(false)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white px-6 pb-8 pt-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">{t('endQ')}</h2>
            <p className="mt-2 text-[15px] text-muted">{t('endBody')}</p>
            {net.queued > 0 && (
              <p className="mt-3 rounded-xl border border-ask-500/30 bg-ask-50 px-4 py-3 text-[14px] font-semibold text-ask-700">
                📵 {t('waitingToSend', { n: net.queued })}
              </p>
            )}

            <Handover summary={summary} failed={summaryFailed} />

            <button type="button" className="btn-quiet mt-5 w-full" disabled={signingOut} onClick={() => setEnding(false)}>
              {t('stay')}
            </button>
            <button type="button" className="btn mt-2 w-full bg-stop-500 py-3.5 text-[16px] font-bold text-white" disabled={signingOut}
              onClick={async () => { setSigningOut(true); try { await sendNow(); await signOut(); } finally { setSigningOut(false); setEnding(false); } }}>
              {signingOut ? t('ending') : t('yesEnd')}
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
          onOpenPass={(ticketNo) => setOpen({ ticketNo, typed: null, pass: (arrivals?.passes || []).find((p) => p.ticketNo === ticketNo) || null })}
          onSold={(s) => remember({ ticketNo: s.ticketNo, regNo: s.regNo, at: s.enteredAt, sold: s.ticketNo, type: s.vehicleType || null })}
        />
      )}
    </div>
  );
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/* What this shift did, to count the cash against before handing over. */
function Handover({ summary, failed }) {
  const { t } = useT();
  if (failed) return <p className="mt-4 rounded-xl border border-ask-500/30 bg-ask-50 px-4 py-3 text-[14px] text-ask-700">{t('summaryFail')}</p>;
  if (!summary) return <p className="mt-4 rounded-xl bg-shell px-4 py-6 text-center text-[14px] text-muted">{t('summaryLoading')}</p>;

  const h = Math.floor(summary.minutes / 60);
  const m = summary.minutes % 60;
  const length = h ? t('hoursMins', { h, m }) : t('minsOnly', { m });

  return (
    <section className="mt-4 rounded-2xl border border-line">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h3 className="text-[15px] font-bold">{t('shiftSummary')}</h3>
        <span className="text-[13px] text-muted">{t('sinceFor', { t: clock(summary.startedAt), d: length })}</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line">
        <Figure label={t('checked')} value={summary.checks} />
        <Figure label={t('entered')} value={summary.entries} tone="text-pass-700" />
        <Figure label={t('refused')} value={summary.refused} tone={summary.refused ? 'text-stop-700' : ''} />
        <Figure label={t('allowedAnyway')} value={summary.overrides} tone={summary.overrides ? 'text-ask-700' : ''} />
        <Figure label={t('sold')} value={summary.sold.count} />
        <Figure label={t('avgCheck')} value={summary.averageSeconds === null ? '—' : t('seconds', { s: summary.averageSeconds })} />
      </div>
      {summary.sold.count > 0 && (
        <div className="space-y-1.5 border-t border-line px-4 py-3 text-[15px]">
          <Line label={t('cash')} value={money(summary.sold.cash)} />
          <Line label={t('upi')} value={money(summary.sold.upi)} />
          {summary.sold.card > 0 && <Line label={t('card')} value={money(summary.sold.card)} />}
          <Line label={t('collected')} value={money(summary.sold.total)} strong />
        </div>
      )}
      <div className="flex items-baseline justify-between rounded-b-2xl bg-ask-50 px-4 py-3">
        <span className="text-[14px] font-bold text-ask-700">{t('handCash')}</span>
        <span className="text-[22px] font-black text-ask-700">{money(summary.sold.cash)}</span>
      </div>
      <p className="px-4 pb-3 pt-2 text-[12px] text-muted">{t('savedForAdmin')}</p>
    </section>
  );
}

const Figure = ({ label, value, tone = '' }) => (
  <div className="bg-white px-3 py-2.5">
    <div className={`text-[20px] font-extrabold leading-tight ${tone}`}>{value}</div>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
  </div>
);

const Line = ({ label, value, strong = false }) => (
  <div className={`flex items-baseline justify-between ${strong ? 'font-bold' : ''}`}>
    <span className={strong ? '' : 'text-muted'}>{label}</span>
    <span>{value}</span>
  </div>
);


/* One line on any phone: a short label and the count in a badge, so the three
   tabs are always the same height (user, 2026-09-19). */
const Tab = ({ active, onClick, label, count }) => (
  <button type="button" onClick={onClick}
    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[14px] font-semibold ${active ? 'bg-brand text-white' : 'border border-line bg-white text-muted'}`}>
    <span className="truncate">{label}</span>
    {count !== undefined && (
      /* Keyed by the number itself: React swaps the node when it changes, so
         the lift plays again. A pass bought while the phone is open, or a
         vehicle checked out, is noticed without anybody watching the badge. */
      <span key={count}
        className={`bump shrink-0 rounded-full px-1.5 text-[12px] font-bold leading-[18px] ${active ? 'bg-white/25 text-white' : 'bg-shell text-ink'}`}>{count}</span>
    )}
  </button>
);
