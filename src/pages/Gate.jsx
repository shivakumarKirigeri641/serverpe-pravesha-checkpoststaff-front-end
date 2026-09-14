import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { LangToggle, useT } from '../lib/i18n.jsx';
import { setSoundOn, soundOn } from '../lib/feedback';
import { dismissProblem, saveArrivals, savedArrivals, sendNow, subscribe } from '../lib/offline';
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
  const [tab, setTab] = useState('pending');
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

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const d = await api.arrivals();
      saveArrivals(d);
      /* Anything recorded offline that has not been sent yet still shows as in. */
      setArrivals(savedArrivals() || d);
      setOffline(false);
      if (!quiet) setError(null);
    } catch (e) {
      if (e.offline) {
        const saved = savedArrivals();
        setOffline(true);
        if (saved) { setArrivals(saved); setError(null); } else if (!quiet) setError(t('offlineNoList'));
      } else if (!quiet) {
        setError(e.message);
      }
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  /* The queue of entries kept on the phone, and anything the server refused. */
  useEffect(() => subscribe(setNet), []);
  useEffect(() => {
    /* An entry was kept or sent: redraw the list from what the phone knows. */
    if (offline) { const saved = savedArrivals(); if (saved) setArrivals(saved); }
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
        if (offline) { sendNow(); if (!open) load({ quiet: true }); } else if (moved && !open) load({ quiet: true });
      } catch (e) {
        if (alive && e.offline) setOffline(true);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    const onShow = () => { if (document.visibilityState === 'visible') { load({ quiet: true }); tick(); } };
    document.addEventListener('visibilitychange', onShow);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [load, open, offline]);

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
    remember({
      ticketNo: out.pass?.ticketNo || out.ticketNo,
      regNo: out.pass?.regNo,
      at: out.usedAt,
      override: out.verdict === 'valid_override',
      saved: Boolean(out.offline),
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
   * TYPING SEARCHES THE TAB THE STAFF MEMBER IS IN.
   *
   * On "Still to come" they are looking for the vehicle at the barrier, and a
   * line for one that already went through is one more thing to read past with
   * a queue waiting. On "Entered" they are answering "did that car go through?",
   * and the same search must find exactly those. So the tab decides, the tabs
   * stay on screen while typing, and whatever matched in the other one is
   * counted underneath so nothing is ever simply missing.
   */
  const inTab = (p) => (tab === 'pending' ? p.status !== 'used' : p.status === 'used');
  const list = searchingNow ? matches.filter(inTab) : (arrivals?.passes || []).filter(inTab);
  const otherTabMatches = searchingNow ? matches.filter((p) => !inTab(p)).length : 0;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 bg-brand text-white shadow-soft">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold">{me?.checkpost?.name}</div>
            <div className="truncate text-[12px] text-white/70">
              {me?.staff?.name} · {t('onDuty')} · {me?.serverDate}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setSelling('')} disabled={offline} title={offline ? t('sellNeedsSignal') : undefined}
              className="rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-brand disabled:opacity-50">
              {t('sellPass')}
            </button>
            <button type="button" onClick={() => setEnding(true)} className="rounded-lg border border-white/25 px-3 py-2 text-[13px] font-semibold">
              {t('endShift')}
            </button>
          </div>
        </div>

        {totals && (
          <div className="mx-auto flex max-w-lg gap-2 px-4 pb-2">
            <Stat label={t('expected')} value={totals.expected} />
            <Stat label={t('entered')} value={totals.entered} tone="bg-pass-500/25" />
            <Stat label={t('stillToCome')} value={totals.pending} tone="bg-white/15" />
          </div>
        )}
        <div className="mx-auto flex max-w-lg items-center justify-end gap-2 px-4 pb-2">
          {(offline || net.queued > 0) && (
            <span className={`mr-auto rounded-lg px-2.5 py-1.5 text-[12px] font-bold ${offline ? 'bg-ask-500 text-white' : 'bg-white/15 text-white'}`}>
              {offline ? '📵 ' : '⏫ '}
              {net.sending ? t('sendingNow', { n: net.queued }) : net.queued > 0 ? t('waitingToSend', { n: net.queued }) : t('offlineTitle')}
            </span>
          )}
          <LangToggle className="bg-white/15 text-white" />
          <button type="button" onClick={toggleSound} aria-pressed={sound}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-bold text-white">
            {sound ? `🔔 ${t('soundOn')}` : `🔕 ${t('soundOff')}`}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        <div className="sticky top-[140px] z-10 -mx-4 bg-shell px-4 pb-3 pt-3">
          <input
            ref={searchRef} className="field text-[18px] uppercase tracking-wide" autoFocus
            placeholder={t('searchPh')} value={q} inputMode="text"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="mt-1.5 px-1 text-[13px] text-muted">
            {!searchingNow ? t('searchHint')
              : `${t(list.length === 1 ? 'matchOne' : 'matchMany', { n: list.length })}${searching ? ` · ${t('stillLooking')}` : ''}`}
          </p>
        </div>

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

        {verified.length > 0 && !searchingNow && (
          <section className="mb-4">
            <h2 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-muted">
              {t('verifiedShift')} · {verified.length}
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
                      {e.sold ? `${t('passSold')} · ${e.sold}` : e.type || t('entryRecorded')}
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
          </section>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>
        )}

        {/* The tabs stay while typing: the search runs inside the one chosen,
            so they are how a staff member says what they are looking for. */}
        <div className="mb-3 flex gap-2">
          <Tab active={tab === 'pending'} onClick={() => setTab('pending')} label={`${t('stillToCome')} (${totals?.pending ?? 0})`} />
          <Tab active={tab === 'entered'} onClick={() => setTab('entered')} label={`${t('entered')} (${totals?.entered ?? 0})`} />
        </div>

        {!arrivals && !error && <p className="py-10 text-center text-muted">{t('loadingToday')}</p>}

        {/* What matched in the other tab: counted, and one tap away. */}
        {otherTabMatches > 0 && (
          <button type="button" onClick={() => setTab(tab === 'pending' ? 'entered' : 'pending')}
            className="press mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-left text-[13px] text-muted">
            <span>
              {t(otherTabMatches === 1 ? 'otherTabOne' : 'otherTabMany',
                { n: otherTabMatches, tab: tab === 'pending' ? t('entered') : t('stillToCome') })}
            </span>
            <span className="shrink-0 font-semibold text-brand">{t('showThem')} →</span>
          </button>
        )}

        {arrivals && list.length === 0 && (
          <div className="card px-5 py-8 text-center">
            <p className="text-[15px] text-muted">
              {searchingNow ? t('noPassFound') : tab === 'pending' ? t('allCame') : t('noEntries')}
            </p>
            {searchingNow && (
              <button type="button" className="btn-primary mt-4 w-full" disabled={offline} onClick={() => setSelling(typed)}>
                {offline ? t('sellNeedsSignal') : t('sellForVehicle')}
              </button>
            )}
          </div>
        )}

        <ul className="list-in space-y-2">
          {list.map((p) => (
            <li key={p.ticketNo}>
              <button type="button" onClick={() => setOpen({ ticketNo: p.ticketNo, typed: q.trim() || null, pass: p })}
                className="card press flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <div className="min-w-0 flex-1">
                  <div className="plate text-[19px]">
                    {plateText(p.regNo)}
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
                    {[p.details?.make, p.details?.model, p.details?.variant].filter(Boolean).join(' ') || p.vehicle || '—'}
                    {p.details?.colour ? ` · ${p.details.colour}` : ''}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">
                    {p.details?.type ? `${p.details.type} · ` : ''}{p.category?.label}
                    {p.slot?.label ? ` · ${p.slot.label}` : ''}{p.visitor ? ` · ${p.visitor}` : ''}
                    {p.travelDate !== arrivals?.date ? ` · ${p.travelDate}` : ''}
                  </div>
                </div>
                {p.status === 'used'
                  ? <span className="chip bg-pass-50 text-pass-700">{p.savedOffline ? '📵 ' : ''}{t('inAt', { t: clock(p.usedAt) })}</span>
                  : <span className="chip bg-shell text-muted">{t('expected')}</span>}
              </button>
            </li>
          ))}
        </ul>
      </main>

      {open && (
        <PassSheet ticketNo={open.ticketNo} typed={open.typed} fallbackPass={open.pass || null}
          onClose={closeSheet} onRecorded={onRecorded} />
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
