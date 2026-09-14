import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
import { signal } from '../lib/feedback';
import { enqueue, localVerdict } from '../lib/offline';
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
 * THE VERDICT IS READ FROM A METRE AWAY. The whole top of the sheet is one solid
 * colour — green, red or amber — with the answer in large type, and the phone
 * sounds and buzzes differently for each, because the person holding it is
 * usually looking at the vehicle. A recorded entry flashes the whole screen
 * green with the plate on it, so the driver can see it too.
 *
 * WITH NO SIGNAL, THE PHONE DECIDES AND REMEMBERS. The pass is judged from the
 * list saved on the phone, by the same rules, and says so; a recorded entry is
 * kept on the phone and sent when the signal returns (lib/offline.js). A signal
 * that drops between opening the pass and pressing the button is handled the
 * same way — the vehicle is not kept waiting for a network.
 */
export default function PassSheet({ ticketNo, typed, fallbackPass = null, onClose, onRecorded }) {
  const { t, lang } = useT();
  /* When this pass was opened. The difference between that and the moment the
     button is pressed is how long the check actually took, and this phone is the
     only place that knows both ends of it — the server sees one instant. It is
     sent with the entry so the admin panel can report verification times. */
  const [openedAt] = useState(() => Date.now());
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);      // { pass, verdict, message, blocking, offline }
  const [result, setResult] = useState(null);  // what the entry call answered
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const announced = useRef(null);

  useEffect(() => {
    let alive = true;
    setState('loading'); setResult(null); setError(null);
    api.pass(ticketNo)
      .then((d) => { if (alive) { setData(d); setState('ready'); } })
      .catch((e) => {
        if (!alive) return;
        if (e.status === 404) { setData({ verdict: 'unknown_ticket', blocking: true, message: e.message }); setState('ready'); }
        else if (e.offline && fallbackPass) { setData({ pass: fallbackPass, ...localVerdict(fallbackPass), offline: true }); setState('ready'); }
        else if (e.offline) { setError(t('offlineNoPass')); setState('error'); }
        else { setError(e.message); setState('error'); }
      });
    return () => { alive = false; };
  }, [ticketNo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* A refusal, or a question, is heard the moment the pass opens. A valid pass
     makes its sound when the entry is actually recorded, not before. */
  useEffect(() => {
    if (state !== 'ready' || !data || announced.current === data.verdict) return;
    announced.current = data.verdict;
    const tone = verdictOf(data.verdict).tone;
    if (tone === 'stop') signal('stop');
    else if (tone === 'ask') signal('ask');
  }, [state, data]);

  /* Escape closes, because this is used on tablets with keyboards too. */
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /*
   * A recorded entry does not wait to be dismissed.
   *
   * The green flash is held just long enough to be seen by the staff member and
   * the driver, then the sheet closes on its own and the gate screen takes the
   * keyboard back for the next number plate. A refusal never auto-closes: that
   * one needs reading.
   */
  useEffect(() => {
    if (!result?.ok) return undefined;
    const id = setTimeout(() => onClose(), result.offline ? 2200 : 1500);
    return () => clearTimeout(id);
  }, [result, onClose]);

  /* Keep the entry on the phone, to be sent when the signal is back. */
  function keepOnPhone(override) {
    const thePass = data?.pass || fallbackPass;
    const item = enqueue({ pass: thePass, override, typed, elapsedMs: Date.now() - openedAt });
    const out = {
      ok: true, offline: true, ticketNo,
      verdict: override ? 'valid_override' : 'valid',
      usedAt: item.recordedAt,
      pass: { ...thePass, status: 'used', usedAt: item.recordedAt },
    };
    setResult(out);
    signal('go');
    onRecorded?.(out);
  }

  async function record(override = false) {
    setBusy(true); setError(null);
    if (data?.offline) {
      keepOnPhone(override);
      setBusy(false);
      return;
    }
    try {
      const out = await api.entry(ticketNo, { override, typed, elapsedMs: Date.now() - openedAt });
      setResult(out);
      if (out.ok) {
        signal('go');
        onRecorded?.(out);
      } else {
        signal(verdictOf(out.verdict).tone === 'ask' ? 'ask' : 'stop');
        if (out.verdict && out.pass) setData({ ...data, ...out, blocking: !out.needsOverride });
      }
    } catch (e) {
      /* The signal dropped after the pass opened: the check was already made by
         the server, so keep the entry and send it later. */
      if (e.offline && (data?.pass || fallbackPass)) keepOnPhone(override);
      else { signal('stop'); setError(e.message); }
    } finally {
      setBusy(false);
    }
  }

  const shown = result && result.ok
    ? { verdict: result.verdict, pass: result.pass, message: result.message, blocking: false }
    : (result || data || {});
  const pass = shown.pass || data?.pass;
  const verdictKey = result?.ok ? 'valid' : shown.verdict;
  const v = verdictOf(verdictKey, lang);
  const tone = toneOf(verdictKey);
  const done = Boolean(result?.ok);
  /* Two shapes mean the same thing: inspecting a pass outside its slot answers
     `overridable`, and attempting the entry answers `needsOverride`. Either way
     the staff member is being asked, so the amber button must be there the first
     time they open the pass — not only after a refused attempt. */
  const needsOverride = !done && shown.verdict === 'wrong_slot' && shown.blocking !== true;
  /* A pass the visitor checked in themselves is already marked used, but it has
     never been seen by anybody here. Confirming it is not a second entry: it
     replaces their word with yours. */
  const selfDeclared = !done && shown.verdict === 'self_declared';
  const canRecord = !done && (shown.verdict === 'valid' || needsOverride || selfDeclared);

  /* In English the server's own sentence says it best. In Kannada the screen's
     sentence leads, and the server's detail (a date, a time) follows in small
     type when it adds something. */
  const mainLine = lang === 'kn' ? v.action : (shown.message || v.action);
  const detailLine = lang === 'kn' && !done && shown.message && !['valid'].includes(shown.verdict) ? shown.message : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-lg animate-rise overflow-hidden rounded-t-3xl bg-white pad-bottom sm:mb-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-line" />

        {state === 'loading' && <div className="p-8 text-center text-muted">{t('checkingPass')}</div>}
        {state === 'error' && (
          <div className="p-6">
            <p className="rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>
            <button type="button" className="btn-quiet mt-4 w-full" onClick={onClose}>{t('close')}</button>
          </div>
        )}

        {state === 'ready' && (
          <>
            {/* The verdict, as one solid block of colour. */}
            <div className={`mt-3 px-6 py-6 ${tone.solid}`} role="status" aria-live="assertive">
              {data?.offline && !done && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-[12px] font-bold">
                  📵 {t('offlineCheck')}
                </div>
              )}
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 shrink-0 animate-pop place-items-center rounded-full bg-white/20 text-4xl font-black">
                  {tone.icon}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[28px] font-black leading-tight">{done ? t('entryRecordedTitle') : v.title}</h2>
                  <p className="mt-1 text-[16px] font-medium leading-snug text-white/95">{mainLine}</p>
                  {detailLine && <p className="mt-1 text-[13px] leading-snug text-white/80">{detailLine}</p>}
                  {done && <p className="mt-1 text-[15px] font-bold">{t('atTime', { t: clock(result.usedAt) })}</p>}
                  {shown.verdict === 'already_used' && shown.usedAt && (
                    <p className="mt-1 text-[15px] font-bold">{t('usedAt', { t: clock(shown.usedAt) })}</p>
                  )}
                </div>
              </div>
            </div>

            {/* The office asked for a closer look at this plate: said before the
                button, in large type, with their reason. */}
            {pass?.watch && pass.watch.level === 'check' && !done && (
              <div className="mx-6 mt-4 rounded-xl border-2 border-ask-500/60 bg-ask-50 px-4 py-3 text-ask-700" role="alert">
                <div className="text-[17px] font-extrabold">⚠ {t('watchCheckTitle')}</div>
                <div className="mt-0.5 text-[15px] font-medium">{t('watchReason', { r: pass.watch.reason })}</div>
              </div>
            )}

            {pass && (
              <div className="px-6 py-5">
                <div className="plate text-3xl">{plateText(pass.regNo)}</div>
                {/* What is in front of the staff member, in the words they can
                    check against the vehicle: make, model, variant, then what
                    the register calls it — and only then the fare category. */}
                <div className="mt-1 text-[16px] font-semibold text-ink/85">
                  {[pass.details?.make, pass.details?.model, pass.details?.variant].filter(Boolean).join(' ')
                    || pass.vehicle?.description || (typeof pass.vehicle === 'string' ? pass.vehicle : '') || '—'}
                </div>
                <div className="mt-0.5 text-[14px] text-muted">
                  {[pass.details?.type, pass.details?.colour, pass.details?.fuel, pass.category?.label]
                    .filter((x) => typeof x === 'string' && x).join(' · ')}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
                  <Row label={t('pass')} value={<span className="plate">{pass.ticketNo}</span>} />
                  <Row label={t('visitor')} value={pass.visitor || '—'} />
                  <Row label={t('date')} value={pass.travelDate} />
                  <Row label={t('slot')} value={pass.slot?.label} />
                  <Row label={t('mobile')} value={pass.mobile || '—'} />
                  <Row label={t('paid')} value={pass.amount ? `₹${pass.amount}` : '—'} />
                </dl>
              </div>
            )}

            {error && <p className="mx-6 mb-3 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}

            <div className="space-y-2 px-6">
              {canRecord && (
                <button type="button" className={needsOverride ? 'btn w-full bg-ask-500 py-4 text-[17px] text-white' : 'btn-go w-full'}
                  disabled={busy} onClick={() => record(needsOverride)}>
                  {busy ? t('recording')
                    : needsOverride ? t('allowRecord')
                      : selfDeclared ? t('confirmSelf')
                        : t('recordEntry')}
                </button>
              )}
              <button type="button" className={done ? 'btn-primary w-full' : 'btn-quiet w-full'} onClick={onClose}>
                {done ? t('nextVehicle') : needsOverride ? t('doNotAllow') : t('close')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* The whole screen, green, for the moment the entry is recorded. Tap to
          move on straight away. */}
      {done && (
        <div className="fixed inset-0 z-[60] grid animate-pop place-items-center bg-pass-500 px-6 text-center text-white"
          onClick={(e) => { e.stopPropagation(); onClose(); }} role="status" aria-live="assertive">
          <div>
            <div className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-white/20 text-[80px] font-black leading-none">✓</div>
            <div className="mt-5 text-[30px] font-black">{t('entryRecordedTitle')}</div>
            {pass && <div className="plate mt-2 text-[34px]">{plateText(pass.regNo)}</div>}
            <div className="mt-2 text-[18px] font-semibold text-white/90">{t('letThrough')} · {clock(result.usedAt)}</div>
            {result.offline && (
              <div className="mx-auto mt-4 max-w-xs rounded-xl bg-black/20 px-4 py-2 text-[15px] font-semibold">📵 {t('savedOffline')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div>
    <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
    <dd className="mt-0.5 font-medium">{value || '—'}</dd>
  </div>
);
