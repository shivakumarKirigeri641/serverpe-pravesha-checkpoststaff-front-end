import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
import { signal } from '../lib/feedback';
import { enqueueExit } from '../lib/offline';
import { clock, plateText } from '../lib/verdict';

/*
 * Checking a vehicle out (063, user 2026-09-19).
 *
 * The vehicle is leaving whatever the screen says, so this is not a verdict: it
 * shows who it is and since when they were inside, and one button records the
 * exit. With no signal the exit is kept on the phone and sent later, exactly as
 * entries are. The server's answer for a pass never checked in, or already out,
 * is shown as it is — the staff member decides what to do about it.
 */
export default function ExitSheet({ pass, onClose, onDone }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [done, setDone] = useState(null);   // { exitedAt, offline }

  /* The green screen goes by itself; the next vehicle is already waiting. */
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(onClose, 1800);
    return () => clearTimeout(id);
  }, [done, onClose]);

  const finish = (exitedAt, offline) => {
    signal('go');
    setDone({ exitedAt, offline });
    onDone({ ticketNo: pass.ticketNo, regNo: pass.regNo, exitedAt, offline, pass });
  };

  const record = async () => {
    setBusy(true); setProblem(null);
    try {
      const out = await api.exit(pass.ticketNo);
      if (out.ok) return finish(out.exitedAt, false);
      signal(out.verdict === 'already_exited' ? 'ask' : 'stop');
      setProblem(out.message || t('noPassFound'));
    } catch (e) {
      if (e.offline) {
        const item = enqueueExit({ pass });
        return finish(item.recordedAt, true);
      }
      signal('stop');
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  };

  const entered = pass.status === 'used';
  const minutes = entered && pass.usedAt ? Math.max(0, Math.round((Date.now() - new Date(pass.usedAt)) / 60000)) : null;
  const length = minutes === null ? null
    : minutes >= 60 ? t('hoursMins', { h: Math.floor(minutes / 60), m: minutes % 60 }) : t('minsOnly', { m: minutes });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-lg animate-rise overflow-hidden rounded-t-3xl bg-white pad-bottom sm:mb-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pb-2 pt-6">
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">{t('exitTitle')}</p>
          <div className="plate mt-1 text-[34px] leading-tight">
            {pass.passKind === 'person' ? t('peopleCount', { n: pass.persons || 1 }) : plateText(pass.regNo)}
          </div>
          <div className="text-[15px] font-medium text-ink/85">
            {pass.passKind === 'person'
              ? t('perPersonPass')
              : [pass.details?.make, pass.details?.model, pass.details?.variant].filter(Boolean).join(' ') || pass.vehicle || '—'}
            {pass.details?.colour ? ` · ${pass.details.colour}` : ''}
          </div>
          <div className="mt-1 text-[13px] text-muted">
            {pass.ticketNo}{pass.category?.label ? ` · ${pass.category.label}` : ''}{pass.visitor ? ` · ${pass.visitor}` : ''}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-shell px-4 py-3 text-[15px]">
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{t('enteredAtLabel')}</dt>
              <dd className="mt-0.5 font-semibold">{entered ? clock(pass.usedAt) : t('notEnteredChip')}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{pass.exitedAt ? t('exitedAtLabel') : t('inside')}</dt>
              <dd className="mt-0.5 font-semibold">{pass.exitedAt ? clock(pass.exitedAt) : length ? t('insideFor', { d: length }) : '—'}</dd>
            </div>
          </dl>

          {problem && (
            <p role="alert" className="mt-3 rounded-xl border border-stop-500/30 bg-stop-50 px-4 py-3 text-[14px] font-semibold text-stop-700">{problem}</p>
          )}
        </div>

        <div className="space-y-2 px-6 pb-4 pt-2">
          {!pass.exitedAt && (
            <button type="button" className={`btn-act w-full ${busy ? '' : 'tap-me'}`} disabled={busy} onClick={record}>
              {busy ? t('recordingExit') : `⬅ ${t('recordExit')}`}
            </button>
          )}
          <button type="button" className="btn-quiet w-full" onClick={onClose} disabled={busy}>{t('close')}</button>
        </div>
      </div>

      {done && (
        <div className="fixed inset-0 z-[60] grid animate-pop place-items-center bg-pass-500 px-6 text-center text-white"
          onClick={(e) => { e.stopPropagation(); onClose(); }} role="status" aria-live="assertive">
          <div>
            <div className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-white/20 text-[80px] font-black leading-none">⬅</div>
            <div className="mt-5 text-[30px] font-black">{t('exitRecorded')}</div>
            <div className="plate mt-2 text-[34px]">
              {pass.passKind === 'person' ? t('peopleCount', { n: pass.persons || 1 }) : plateText(pass.regNo)}
            </div>
            <div className="mt-2 text-[18px] font-semibold text-white/90">{clock(done.exitedAt)}</div>
            {done.offline && (
              <div className="mx-auto mt-4 max-w-xs rounded-xl bg-black/20 px-4 py-2 text-[15px] font-semibold">📵 {t('exitSavedOffline')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
