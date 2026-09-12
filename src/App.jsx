import { useState } from 'react';
import Gate from './pages/Gate.jsx';
import History from './pages/History.jsx';
import Passes from './pages/Passes.jsx';
import SignIn from './pages/SignIn.jsx';
import { useSession } from './lib/session';

/*
 * A gate phone is either on a shift or signing in to one. On a shift there are
 * three things to do — check the vehicle in front of you, look through the
 * passes for a day, and look up what was checked earlier — so there is a bar at
 * the bottom, where a thumb is, and no router: a staff member should never be
 * navigating a URL in the rain.
 */
export default function App() {
  const { state, me } = useSession();
  const [tab, setTab] = useState('gate');

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

  if (state !== 'ready') return <SignIn />;

  return (
    <>
      {tab === 'gate' && <Gate />}
      {tab === 'passes' && <Passes today={me?.serverDate} />}
      {tab === 'history' && <History today={me?.serverDate} />}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          <TabButton active={tab === 'gate'} onClick={() => setTab('gate')} label="Check" icon={<GateIcon />} />
          <TabButton active={tab === 'passes'} onClick={() => setTab('passes')} label="Passes" icon={<PassIcon />} />
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} label="Earlier checks" icon={<HistoryIcon />} />
        </div>
      </nav>
    </>
  );
}

const TabButton = ({ active, onClick, label, icon }) => (
  <button type="button" onClick={onClick}
    className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[12px] font-semibold ${active ? 'text-brand' : 'text-muted'}`}>
    <span className={active ? 'opacity-100' : 'opacity-60'}>{icon}</span>
    {label}
  </button>
);

const svg = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const GateIcon = () => (<svg {...svg}><path d="M3 20V9l9-4 9 4v11" /><path d="M3 20h18M9 20v-6h6v6" /></svg>);
const PassIcon = () => (<svg {...svg}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14h5" /></svg>);
const HistoryIcon = () => (<svg {...svg}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>);
