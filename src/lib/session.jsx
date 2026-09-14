import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, onSignedOut } from './api';

/*
 * The shift, held once for the whole app.
 *
 * On load the stored token is checked against the back-end rather than trusted:
 * a shift can have been taken over by the next person while this phone was in a
 * pocket, and the app must find that out before it shows a gate screen it is no
 * longer entitled to.
 */
const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [me, setMe] = useState(null);
  const [state, setState] = useState(getToken() ? 'checking' : 'signed-out');
  const [endedNotice, setEndedNotice] = useState(null);

  useEffect(() => {
    if (!getToken()) return undefined;
    let alive = true;
    api.session()
      .then((d) => { if (alive) { setMe(d); setState('ready'); } })
      .catch(() => { if (alive) setState('signed-out'); });
    return () => { alive = false; };
  }, []);

  /* A 401 anywhere ends the shift everywhere, with a reason on the sign-in screen. */
  useEffect(() => onSignedOut(() => {
    setMe(null);
    setState('signed-out');
    setEndedNotice('Your shift has ended. Please sign in again.');
  }), []);

  /* A code to the staff member's own phone. Nothing is stored until it works. */
  const requestCode = useCallback((mobile) => api.requestCode(mobile), []);

  const signInWithCode = useCallback(async (mobile, code, checkpostId) => {
    const out = await api.signInWithCode(mobile, code, checkpostId);
    if (out.ok) {
      setToken(out.token);
      setMe(out);
      setState('ready');
      setEndedNotice(null);
    }
    return out;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.signOut(); } catch { /* the shift ends locally regardless */ }
    setToken(null);
    setMe(null);
    setState('signed-out');
    setEndedNotice(null);
  }, []);

  const value = useMemo(
    () => ({ me, state, signInWithCode, requestCode, signOut, endedNotice }),
    [me, state, signInWithCode, requestCode, signOut, endedNotice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
