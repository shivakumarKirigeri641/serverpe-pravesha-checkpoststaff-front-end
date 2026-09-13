import { useEffect, useRef, useState } from 'react';
import { useSession } from '../lib/session';

/*
 * Sign-in at a gate: a mobile number, then a four-digit code sent to it.
 *
 * WHY A CODE AND NOT A PIN. A PIN was issued once by an administrator and then
 * lived in somebody's memory or on a piece of paper by the barrier — never
 * rotated, passed on when a shift was covered, and only revocable by asking the
 * office. A code goes to the phone in the staff member's hand, and access is
 * switched off by switching the number off.
 *
 * TWO STEPS, NOT TWO SCREENS. The number stays on screen with the code box
 * beneath it, so a mistyped number is visible and correctable without starting
 * again — at a barrier, a screen that throws away what you typed is a screen you
 * fight.
 *
 * EVERY REFUSAL IS IN BOTH LANGUAGES. The server sends the sentence in English
 * and in Kannada and both are shown, one under the other. The person reading it
 * is standing at a gate in Chikkamagaluru, and "This mobile number is not
 * permitted to login" is exactly the sentence somebody needs to understand
 * first time.
 */
export default function SignIn() {
  const { signInWithCode, requestCode, endedNotice } = useSession();

  const [step, setStep] = useState('mobile');     // 'mobile' → 'code'
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);        // { message, messageKn }
  const [notice, setNotice] = useState(null);      // { message, messageKn }
  const [choices, setChoices] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef(null);

  const tenDigits = mobile.replace(/\D/g, '').length === 10;

  /* The wait before another code may be asked for, counted down on screen so
     nobody taps a dead button wondering why nothing happens. */
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  async function getCode() {
    if (!tenDigits || busy || secondsLeft > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const out = await requestCode(mobile);
      if (out.ok) {
        setStep('code');
        setNotice({ message: out.message, messageKn: out.messageKn });
        setSecondsLeft(60);
        setTimeout(() => codeRef.current?.focus(), 50);
      } else {
        setError({ message: out.message, messageKn: out.messageKn });
        if (out.retryIn) setSecondsLeft(out.retryIn);
      }
    } catch (e) {
      setError({ message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function submit(checkpostId) {
    if (code.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await signInWithCode(mobile, code, checkpostId);
      if (out.ok) return;
      if (out.error === 'choose_checkpost') { setChoices(out.checkposts); return; }
      setError({ message: out.message, messageKn: out.messageKn });
      setCode('');
      codeRef.current?.focus();
    } catch (e) {
      setError({ message: e.message });
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

        <Says tone="stop" says={error} />
        {!error && <Says tone="pass" says={notice} />}

        {choices ? (
          <div className="card p-5">
            <h2 className="text-[15px] font-semibold">Which checkpost are you at?</h2>
            <p className="text-[13px] text-muted">ನೀವು ಯಾವ ಚೆಕ್‌ಪೋಸ್ಟ್‌ನಲ್ಲಿದ್ದೀರಿ?</p>
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
          <form className="card space-y-5 p-5"
            onSubmit={(e) => { e.preventDefault(); if (step === 'mobile') getCode(); else submit(); }}>
            <div>
              <label className="label" htmlFor="mobile">
                Mobile number <span className="font-normal text-muted">· ಮೊಬೈಲ್ ಸಂಖ್ಯೆ</span>
              </label>
              <input
                id="mobile" className="field text-[19px] tracking-wide" inputMode="numeric" autoComplete="username"
                placeholder="10-digit number" value={mobile} maxLength={10}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                  /* Changing the number abandons the code that was sent to the
                     old one — it is no use for this number anyway. */
                  if (step === 'code') { setStep('mobile'); setCode(''); setNotice(null); }
                }}
              />
              <p className="mt-2 text-[13px] text-muted">
                Only numbers your administrator has added can sign in.
                <span className="block">ನಿರ್ವಾಹಕರು ಸೇರಿಸಿದ ಸಂಖ್ಯೆಗಳಿಗೆ ಮಾತ್ರ ಪ್ರವೇಶ.</span>
              </p>
            </div>

            {step === 'code' && (
              <div>
                <label className="label" htmlFor="code">
                  4-digit code <span className="font-normal text-muted">· 4 ಅಂಕಿಯ ಕೋಡ್</span>
                </label>
                <div className="relative" onClick={() => codeRef.current?.focus()}>
                  <input
                    ref={codeRef} id="code" className="absolute inset-0 h-full w-full opacity-0" inputMode="numeric"
                    autoComplete="one-time-code" value={code} maxLength={4}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  {/* One hidden input behind four drawn cells: four real inputs
                      lose a digit every time a gloved thumb hits two at once. */}
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i}
                        className={`flex h-16 flex-1 items-center justify-center rounded-xl border text-3xl font-bold
                          ${code.length === i ? 'border-brand-accent ring-4 ring-brand-accent/15' : 'border-line'} bg-white`}>
                        {code[i] || ''}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[13px] text-muted">
                  Sent by SMS to ••••{mobile.slice(-4)}. Valid for 3 minutes.
                  <span className="block">••••{mobile.slice(-4)} ಗೆ SMS ಕಳುಹಿಸಲಾಗಿದೆ. 3 ನಿಮಿಷ ಮಾನ್ಯ.</span>
                </p>
              </div>
            )}

            {step === 'mobile' ? (
              <button type="submit" className="btn-primary w-full text-[17px]" disabled={!tenDigits || busy || secondsLeft > 0}>
                {busy ? 'Sending…' : secondsLeft > 0 ? `Wait ${secondsLeft}s` : 'Get OTP'}
              </button>
            ) : (
              <>
                <button type="submit" className="btn-primary w-full text-[17px]" disabled={code.length !== 4 || busy}>
                  {busy ? 'Checking…' : 'Start shift'}
                </button>
                <button type="button" className="w-full py-2 text-[14px] font-semibold text-muted"
                  disabled={busy || secondsLeft > 0} onClick={getCode}>
                  {secondsLeft > 0 ? `Send another code in ${secondsLeft}s` : 'Send another code'}
                </button>
              </>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-[12px] text-muted">
          Pravesha — a product of ServerPe App Solutions
        </p>
      </div>
    </div>
  );
}

/*
 * Anything the server says, in both languages, English first.
 *
 * The Kannada line is not a translation added for politeness: for most people
 * working a barrier in this district it is the line they will actually read, and
 * putting it beneath rather than instead keeps the screen useful to both.
 */
const TONES = {
  stop: 'border-stop-500/25 bg-stop-50 text-stop-700',
  pass: 'border-pass-500/25 bg-pass-50 text-pass-700',
};

function Says({ says, tone = 'stop' }) {
  if (!says || !says.message) return null;
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 ${TONES[tone]}`}>
      <p className="text-[15px] font-medium">{says.message}</p>
      {says.messageKn && <p className="mt-1 text-[14px] opacity-90">{says.messageKn}</p>}
    </div>
  );
}
