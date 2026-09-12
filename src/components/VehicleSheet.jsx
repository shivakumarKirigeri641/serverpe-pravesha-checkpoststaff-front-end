import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { clock, plateText } from '../lib/verdict';

/*
 * One vehicle, everything this gate has seen of it.
 *
 * Opened from the history list, usually because something looked odd: the same
 * plate twice in a morning, or a pass that would not work. Refusals are shown
 * beside entries for exactly that reason — a list of successful entries would
 * hide the thing being looked for.
 */

const VERDICTS = {
  valid: ['Entered', 'text-pass-700'],
  valid_override: ['Allowed after a warning', 'text-warn-700'],
  already_used: ['Refused — already used', 'text-stop-700'],
  wrong_day: ['Refused — wrong day', 'text-warn-700'],
  wrong_slot: ['Refused — outside the slot', 'text-warn-700'],
  unknown_ticket: ['Refused — no pass', 'text-stop-700'],
  not_paid: ['Refused — not paid', 'text-stop-700'],
};

const dayText = (date, today) => {
  if (date === today) return 'Today';
  try {
    return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return date; }
};

export default function VehicleSheet({ regNo, today, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.vehicle(regNo)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [regNo]);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/40" onClick={onClose}>
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white px-5 pb-3 pt-4">
          <div className="min-w-0">
            <div className="plate text-[22px]">{plateText(regNo)}</div>
            {data?.vehicle && (
              <div className="truncate text-[13px] text-muted">
                {[data.vehicle.maker, data.vehicle.model, data.vehicle.colour].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted">
            Close
          </button>
        </div>

        {error && <p className="px-5 py-6 text-[15px] text-stop-700">{error}</p>}
        {!data && !error && <p className="px-5 py-10 text-center text-muted">Looking…</p>}

        {data && (
          <div className="space-y-5 px-5 pt-4">
            <div className="flex gap-2">
              <Tally label="Entries here" value={data.entries} tone="bg-pass-50 text-pass-700" />
              <Tally label="Refusals" value={data.refusals} tone={data.refusals ? 'bg-stop-50 text-stop-700' : 'bg-shell text-muted'} />
              <Tally label="Passes bought" value={data.passes.length} tone="bg-shell text-muted" />
            </div>

            <section>
              <h3 className="pb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">At this gate</h3>
              {data.checks.length === 0 ? (
                <p className="py-4 text-[15px] text-muted">Never checked here.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.checks.map((c, i) => {
                    const [label, tone] = VERDICTS[c.verdict] || [c.verdict, 'text-muted'];
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div>
                          <div className={`text-[15px] font-semibold ${tone}`}>{label}</div>
                          <div className="text-[13px] text-muted">
                            {new Date(c.at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })} · {clock(c.at)}
                            {c.by ? ` · ${c.by}` : ''}{c.seconds !== null && c.seconds !== undefined ? ` · ${c.seconds}s` : ''}
                          </div>
                        </div>
                        {c.ticketNo && <span className="plate text-[13px] text-muted">{c.ticketNo}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="pb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Passes for this destination</h3>
              {data.passes.length === 0 ? (
                <p className="py-4 text-[15px] text-muted">No passes on record.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.passes.map((p) => (
                    <li key={p.ticketNo} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <div className="plate text-[15px]">{p.ticketNo}</div>
                        <div className="text-[13px] text-muted">{dayText(p.travelDate, today)} · {p.slot} · {p.type}</div>
                      </div>
                      <span className={`chip ${p.status === 'used' ? 'bg-pass-50 text-pass-700' : p.status === 'paid' ? 'bg-shell text-muted' : 'bg-warn-50 text-warn-700'}`}>
                        {p.status === 'used' ? `In at ${clock(p.usedAt)}` : p.status === 'paid' ? 'Not used' : p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const Tally = ({ label, value, tone }) => (
  <div className={`flex-1 rounded-xl px-3 py-2 ${tone}`}>
    <div className="text-[20px] font-extrabold leading-tight">{value}</div>
    <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
  </div>
);
