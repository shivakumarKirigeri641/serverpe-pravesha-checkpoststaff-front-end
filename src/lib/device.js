import { useEffect, useRef, useState } from 'react';

/*
 * device.js — the phone itself: its screen, its battery, and the light it is
 * being read in.
 *
 * Every one of these is a browser feature some phones do not have. Each is
 * asked for, and where it is missing the gate works exactly as it did before —
 * nothing here may ever stop a vehicle being checked.
 */

/* ───────────────────────────────────────────────── keep the screen on ── */

/**
 * The screen stays on for as long as a shift is open.
 *
 * A gate phone that locks between vehicles costs an unlock and a fumble every
 * time the next car pulls up. The browser releases the lock whenever the app is
 * put away or the screen is turned off by hand, so it is asked for again each
 * time the app comes back to the front.
 *
 * Returns whether the screen is currently being kept on.
 */
export function useWakeLock(active = true) {
  const lock = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let alive = true;

    const acquire = async () => {
      if (!alive || document.visibilityState !== 'visible' || lock.current) return;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (!alive) { l.release().catch(() => {}); return; }
        lock.current = l;
        setOn(true);
        l.addEventListener('release', () => { lock.current = null; if (alive) setOn(false); });
      } catch {
        /* Battery saver, or the browser said no. The phone will lock as normal. */
        setOn(false);
      }
    };

    acquire();
    const onShow = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onShow);
      if (lock.current) lock.current.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);

  return on;
}

/* ─────────────────────────────────────────────────────────── battery ── */

/**
 * How much charge is left, and whether the phone is on a charger.
 *
 * `level` is 0–100, or null where the phone will not say (iPhones never do).
 */
export function useBattery() {
  const [state, setState] = useState({ level: null, charging: null });

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return undefined;
    let battery = null;
    let alive = true;
    const read = () => {
      if (!alive || !battery) return;
      setState({ level: Math.round(battery.level * 100), charging: battery.charging });
    };
    navigator.getBattery().then((b) => {
      battery = b;
      read();
      b.addEventListener('levelchange', read);
      b.addEventListener('chargingchange', read);
    }).catch(() => {});
    return () => {
      alive = false;
      if (battery) {
        battery.removeEventListener('levelchange', read);
        battery.removeEventListener('chargingchange', read);
      }
    };
  }, []);

  return state;
}

/** Low at 20%, critical at 10% — and never while charging. */
export function batteryWarning({ level, charging }) {
  if (level === null || charging) return null;
  if (level <= 10) return 'critical';
  if (level <= 20) return 'low';
  return null;
}

/* ───────────────────────────────────────────────────────── daylight ── */

/*
 * DAYLIGHT MODE — WHAT A WEB APP CAN AND CANNOT DO ABOUT THE SUN.
 *
 * It cannot turn the phone's brightness up: no browser lets a page do that.
 * The phone's own auto-brightness does that part. What the app can do is make
 * the screen easier to read once it is as bright as it will go — pure white
 * behind, black text instead of grey, heavier borders and plates.
 *
 * AUTO follows the light around the phone, on phones that expose a light
 * sensor to the browser. Everywhere else it follows the clock and switches on
 * for the daytime hours, which at an open-air barrier is when it is needed.
 * The switch has a gap between on and off, so a passing cloud does not make
 * the screen flicker between the two.
 */
const MODES = ['auto', 'on', 'off'];
const KEY = 'pravesha.gate.daylight';
const BRIGHT_LUX = 8000;   // shade on a sunny day is around 10,000
const DIM_LUX = 2000;
const DAY_FROM = 9 * 60;   // 9:00
const DAY_TO = 17 * 60 + 30; // 17:30

const readMode = () => { try { return MODES.includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'auto'; } catch { return 'auto'; } };
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const daytime = () => { const m = minutesNow(); return m >= DAY_FROM && m <= DAY_TO; };

export function useDaylight() {
  const [mode, setModeState] = useState(readMode);
  const [bright, setBright] = useState(daytime);
  const [sensed, setSensed] = useState(false);

  /* Auto: the light sensor where there is one, the clock where there is not. */
  useEffect(() => {
    if (mode !== 'auto') return undefined;
    let sensor = null;
    let clock = null;

    const byClock = () => {
      setSensed(false);
      setBright(daytime());
      clock = setInterval(() => setBright(daytime()), 60000);
    };

    try {
      if (typeof window !== 'undefined' && 'AmbientLightSensor' in window) {
        sensor = new window.AmbientLightSensor({ frequency: 1 });
        sensor.addEventListener('reading', () => {
          setSensed(true);
          const lux = sensor.illuminance;
          setBright((was) => (was ? lux > DIM_LUX : lux > BRIGHT_LUX));
        });
        /* A sensor that exists but is not permitted falls back to the clock. */
        sensor.addEventListener('error', () => { sensor = null; byClock(); });
        sensor.start();
      } else {
        byClock();
      }
    } catch {
      byClock();
    }

    return () => {
      if (sensor) { try { sensor.stop(); } catch { /* already stopped */ } }
      if (clock) clearInterval(clock);
    };
  }, [mode]);

  const active = mode === 'on' || (mode === 'auto' && bright);

  useEffect(() => {
    document.documentElement.classList.toggle('daylight', active);
  }, [active]);

  const setMode = (next) => {
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    setModeState(next);
  };
  const cycle = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);

  return { mode, active, sensed, setMode, cycle };
}
