import { useRef, useState } from 'react';
import { useSession } from '../lib/session';

/*
 * Sign-in at a gate: a mobile number and six digits, both on a numeric keypad,
 * and nothing else on the screen. The PIN boxes are one hidden input behind six
 * drawn cells — a real six-input arrangement loses a digit every time a glove
 * hits two cells at once.
 */
export default function SignIn() {
  const { signIn, endedNotice } = useSession();
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [choices, setChoices] = useState(null);
  const pinRef = useRef(null);

  const ready = mobile.replace(/\D/g, '').length === 10 && pin.length === 6;

  async function submit(checkpostId) {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await signIn(mobile, pin, checkpostId);
      if (out.ok) return;
      if (out.error === 'choose_checkpost') { setChoices(out.checkposts); return; }
      setError(out.message || 'That mobile number and PIN do not match.');
      setPin('');
      pinRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-soft" />
          <h1 className="mt-4 text-2xl font-extrabold">Pravesha Checkpost</h1>
          <p className="mt-1 text-[15px] text-muted">Sign in to start your shift.</p>
        </div>

        {endedNotice && !error && (
          <p className="mb-4 rounded-xl border border-ask-500/30 bg-ask-50 px-4 py-3 text-[15px] text-ask-700">{endedNotice}</p>
        )}
        {error && (
          <p className="mb-4 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] font-medium text-stop-700">{error}</p>
        )}

        {choices ? (
          <div className="card p-5">
            <h2 className="text-[15px] font-semibold">Which checkpost are you at?</h2>
            <div className="mt-3 space-y-2">
              {choices.map((c) => (
                <button key={c.id} type="button" onClick={() => submit(c.id)} disabled={busy}
                  className="btn-quiet w-full justify-between text-left">
                  <span>{c.name}</span>
                  <span className="text-[13px] text-muted">{c.placeName}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="card space-y-5 p-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div>
              <label className="label" htmlFor="mobile">Mobile number</label>
              <input
                id="mobile" className="field text-[17px] tracking-wide" inputMode="numeric" autoComplete="username"
                placeholder="10-digit number" value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 14))}
              />
            </div>

            <div>
              <label className="label" htmlFor="pin">6-digit PIN</label>
              <div className="relative" onClick={() => pinRef.current?.focus()}>
                <input
                  ref={pinRef} id="pin" className="absolute inset-0 h-full w-full opacity-0" inputMode="numeric"
                  autoComplete="one-time-code" value={pin} maxLength={6}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i}
                      className={`flex h-14 flex-1 items-center justify-center rounded-xl border text-2xl font-bold
                        ${pin.length === i ? 'border-brand-accent ring-4 ring-brand-accent/15' : 'border-line'} bg-white`}>
                      {pin[i] ? '•' : ''}
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[13px] text-muted">Issued by your administrator. Forgotten it? They can reset it.</p>
            </div>

            <button type="submit" className="btn-primary w-full text-[17px]" disabled={!ready || busy}>
              {busy ? 'Signing in…' : 'Start shift'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[12px] text-muted">
          Pravesha — a product of ServerPe App Solutions
        </p>
      </div>
    </div>
  );
}
