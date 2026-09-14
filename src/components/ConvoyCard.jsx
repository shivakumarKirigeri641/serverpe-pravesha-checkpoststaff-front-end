import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
import { signal } from '../lib/feedback';
import { plateText, verdictOf } from '../lib/verdict';

/*
 * The rest of a convoy, let in together.
 *
 * A tour operator or a family arrives with several vehicles booked on one
 * mobile number. Until now each one was a separate search, a separate pass and
 * a separate green button while the rest of the convoy sat in the queue.
 *
 * AFTER THE FIRST, NOT INSTEAD OF IT. The first vehicle is checked the normal
 * way. Once it is through, the visitor's other passes for today appear here,
 * all ticked; the staff member looks along the line, unticks any vehicle that
 * is not actually there, and lets the rest in with one tap.
 *
 * EVERY PASS IS STILL CHECKED BY THE SERVER, one by one, with the same rules as
 * the green button. Nothing is let in because it travels with something else:
 * a pass outside its slot is not waved through, it is marked and left for the
 * staff member to open and decide, and a blocked plate is refused as it always
 * is. It needs signal, because a batch decided on a phone without any is a
 * batch nobody can check.
 */
export default function ConvoyCard({ passes, usedNow, offline, onOpen, onAdmitted, onDismiss }) {
  const { t, lang } = useT();
  /* The convoy as it stood when the first vehicle went through. Rows leave only
     if the pass was used some other way; a row this card let in stays, ticked. */
  const [snapshot] = useState(passes);
  const [picked, setPicked] = useState(() => new Set(passes.map((p) => p.ticketNo)));
  const [results, setResults] = useState({});   // ticketNo -> answer
  const [busy, setBusy] = useState(false);

  const rows = snapshot.filter((p) => results[p.ticketNo] || !usedNow.has(p.ticketNo));
  useEffect(() => { if (rows.length === 0) onDismiss(); }, [rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (ticketNo) => setPicked((was) => {
    const next = new Set(was);
    if (next.has(ticketNo)) next.delete(ticketNo); else next.add(ticketNo);
    return next;
  });

  const resultOf = (p) => {
    const r = results[p.ticketNo];
    return r && !r.ok && usedNow.has(p.ticketNo) ? { ok: true } : r;
  };
  const chosen = rows.filter((p) => picked.has(p.ticketNo) && !results[p.ticketNo]);

  async function admit() {
    setBusy(true);
    let anyIn = false;
    let anyStopped = false;
    for (const p of chosen) {
      let out;
      try {
        out = await api.entry(p.ticketNo, { override: false, typed: 'convoy' });
      } catch (e) {
        out = e.body && e.body.verdict ? e.body : { ok: false, message: e.message };
      }
      setResults((r) => ({ ...r, [p.ticketNo]: out }));
      if (out.ok) { anyIn = true; onAdmitted(out); } else anyStopped = true;
    }
    signal(anyStopped ? 'ask' : anyIn ? 'go' : 'stop');
    setBusy(false);
  }

  const left = rows.filter((p) => !resultOf(p)?.ok);

  return (
    <section className="card mb-3 animate-rise border-2 border-brand/25 px-4 py-3" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-ink">
            {t(rows.length === 1 ? 'convoyOne' : 'convoyMany', { n: rows.length })}
          </h2>
          <p className="text-[12.5px] text-muted">{offline ? t('convoyNeedsSignal') : t('convoyHint')}</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-muted">
          {t('close')}
        </button>
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((p) => {
          const r = resultOf(p);
          const outside = r && r.verdict === 'wrong_slot';
          const tone = !r ? '' : r.ok ? 'border-pass-500/40 bg-pass-50' : outside ? 'border-ask-500/50 bg-ask-50' : 'border-stop-500/40 bg-stop-50';
          return (
            <li key={p.ticketNo} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tone || 'border-line bg-white'}`}>
              {!r ? (
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand" aria-label={plateText(p.regNo)}
                  checked={picked.has(p.ticketNo)} disabled={busy || offline} onChange={() => toggle(p.ticketNo)} />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center text-[18px] font-black">
                  {r.ok ? '✓' : outside ? '!' : '✕'}
                </span>
              )}
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(p)} disabled={busy}>
                <div className="plate text-[17px]">{plateText(p.regNo)}</div>
                <div className="truncate text-[12.5px] text-muted">
                  {r ? (r.ok ? t('convoyIn') : outside ? t('convoyOutside') : (lang === 'kn' ? verdictOf(r.verdict, lang).title : r.message) || verdictOf(r.verdict, lang).title)
                    : [p.details?.make, p.details?.model].filter(Boolean).join(' ') || p.category?.label}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {left.length > 0 && !offline && (
        <button type="button" className="btn-go mt-3 w-full" disabled={busy || chosen.length === 0} onClick={admit}>
          {busy ? t('convoyAdmitting') : t('convoyAdmit', { n: chosen.length })}
        </button>
      )}
    </section>
  );
}
