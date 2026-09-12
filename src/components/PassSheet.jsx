import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { clock, plateText, toneOf, verdictOf } from '../lib/verdict';

/*
 * One pass, filling the bottom of the screen, with the verdict at the top and a
 * single action at the bottom under the thumb.
 *
 * NOTHING IS RECORDED UNTIL THE BUTTON IS PRESSED. Opening a pass only asks the
 * back-end for its verdict. That matters for the outside-the-slot case: the
 * staff member is being asked a question, and the answer — with their name on it
 * — is only written when they press.
 *
 * AFTER RECORDING, THE SHEET STAYS. The queue behind wants to see a green
 * screen; whoever is at the window wants to see their own plate on it. It closes
 * when the staff member closes it, not on a timer that could hide a failure.
 */
export default function PassSheet({ ticketNo, typed, onClose, onRecorded }) {
  /* When this pass was opened. The difference between that and the moment the
     button is pressed is how long the check actually took, and this phone is the
     only place that knows both ends of it — the server sees one instant. It is
     sent with the entry so the admin panel can report verification times. */
  const [openedAt] = useState(() => Date.now());
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);      // { pass, verdict, message, blocking }
  const [result, setResult] = useState(null);  // what the entry call answered
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setState('loading'); setResult(null); setError(null);
    api.pass(ticketNo)
      .then((d) => { if (alive) { setData(d); setState('ready'); } })
      .catch((e) => {
        if (!alive) return;
        if (e.status === 404) { setData({ verdict: 'unknown_ticket', blocking: true, message: e.message }); setState('ready'); }
        else { setError(e.message); setState('error'); }
      });
    return () => { alive = false; };
  }, [ticketNo]);

  /* Escape closes, because this is used on tablets with keyboards too. */
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /*
   * A recorded entry does not wait to be dismissed.
   *
   * The old flow asked for one more tap — "Next vehicle" — after the pass was
   * already stamped. At a barrier with cars behind, that tap is the queue: the
   * staff member has looked up, waved the vehicle through, and the phone is
   * still showing a screen about a car that has driven off. So the green state
   * is held just long enough to be seen, then the sheet closes on its own and
   * the gate screen takes the keyboard back for the next number plate.
   *
   * A refusal never auto-closes: that one needs reading.
   */
  useEffect(() => {
    if (!result?.ok) return undefined;
    const id = setTimeout(() => onClose(), 1100);
    return () => clearTimeout(id);
  }, [result, onClose]);

  async function record(override = false) {
    setBusy(true); setError(null);
    try {
      const out = await api.entry(ticketNo, { override, typed, elapsedMs: Date.now() - openedAt });
      setResult(out);
      if (out.ok) onRecorded?.(out);
      else if (out.verdict && out.pass) setData({ ...data, ...out, blocking: !out.needsOverride });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const shown = result && result.ok
    ? { verdict: result.verdict, pass: result.pass, message: result.message, blocking: false }
    : (result || data || {});
  const pass = shown.pass || data?.pass;
  const v = verdictOf(result?.ok ? 'valid' : shown.verdict);
  const tone = toneOf(result?.ok ? 'valid' : shown.verdict);
  const done = Boolean(result?.ok);
  /* Two shapes mean the same thing: inspecting a pass outside its slot answers
     `overridable`, and attempting the entry answers `needsOverride`. Either way
     the staff member is being asked, so the amber button must be there the first
     time they open the pass — not only after a refused attempt. */
  const needsOverride = !done && shown.verdict === 'wrong_slot' && shown.blocking !== true;
  const canRecord = !done && (shown.verdict === 'valid' || needsOverride);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-lg animate-rise overflow-hidden rounded-t-3xl bg-white pad-bottom sm:mb-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-line" />

        {state === 'loading' && <div className="p-8 text-center text-muted">Checking the pass…</div>}
        {state === 'error' && (
          <div className="p-6">
            <p className="rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>
            <button type="button" className="btn-quiet mt-4 w-full" onClick={onClose}>Close</button>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div className={`mt-3 border-y px-6 py-5 ${tone.soft}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-11 w-11 shrink-0 animate-pop place-items-center rounded-full text-xl font-black ${tone.chip}`}>
                  {tone.icon}
                </span>
                <div>
                  <h2 className={`text-xl font-extrabold ${tone.text}`}>{done ? 'Entry recorded' : v.title}</h2>
                  <p className="mt-0.5 text-[15px] leading-snug text-ink/80">{shown.message || v.action}</p>
                  {done && <p className="mt-1 text-[14px] font-semibold text-pass-700">at {clock(result.usedAt)}</p>}
                  {shown.verdict === 'already_used' && shown.usedAt && (
                    <p className="mt-1 text-[14px] font-semibold text-stop-700">Used at {clock(shown.usedAt)}</p>
                  )}
                </div>
              </div>
            </div>

            {pass && (
              <div className="px-6 py-5">
                <div className="plate text-3xl">{plateText(pass.regNo)}</div>
                <div className="mt-1 text-[15px] text-muted">
                  {[pass.vehicle?.description || pass.vehicle, pass.category?.label].filter(Boolean).join(' · ')}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
                  <Row label="Pass" value={<span className="plate">{pass.ticketNo}</span>} />
                  <Row label="Visitor" value={pass.visitor || '—'} />
                  <Row label="Date" value={pass.travelDate} />
                  <Row label="Slot" value={pass.slot?.label} />
                  <Row label="Mobile" value={pass.mobile || '—'} />
                  <Row label="Paid" value={pass.amount ? `₹${pass.amount}` : '—'} />
                </dl>
              </div>
            )}

            {error && <p className="mx-6 mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}

            <div className="space-y-2 px-6">
              {canRecord && (
                <button type="button" className={needsOverride ? 'btn w-full bg-ask-500 py-4 text-[17px] text-white' : 'btn-go w-full'}
                  disabled={busy} onClick={() => record(needsOverride)}>
                  {busy ? 'Recording…' : needsOverride ? 'Allow and record entry' : 'Record entry'}
                </button>
              )}
              <button type="button" className={done ? 'btn-primary w-full' : 'btn-quiet w-full'} onClick={onClose}>
                {done ? 'Next vehicle now' : needsOverride ? 'Do not allow' : 'Close'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div>
    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
    <dd className="mt-0.5 font-medium">{value || '—'}</dd>
  </div>
);
