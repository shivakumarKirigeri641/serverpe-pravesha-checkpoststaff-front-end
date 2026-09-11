import Gate from './pages/Gate.jsx';
import SignIn from './pages/SignIn.jsx';
import { useSession } from './lib/session';

/*
 * Two screens and no router: a gate phone is either on a shift or signing in to
 * one. Anything else — a log, a handover summary — belongs inside the gate
 * screen, not behind a URL a staff member would have to navigate to.
 */
export default function App() {
  const { state } = useSession();

  if (state === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <img src="/icon-192.png" alt="" className="mx-auto h-14 w-14 rounded-2xl opacity-80" />
          <p className="mt-4 text-muted">Checking your shift…</p>
        </div>
      </div>
    );
  }
  return state === 'ready' ? <Gate /> : <SignIn />;
}
