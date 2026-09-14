import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
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
  valid: ['vEntered', 'text-pass-700'],
  valid_override: ['vAllowedWarn', 'text-warn-700'],
  already_used: ['vRefUsed', 'text-stop-700'],
  wrong_day: ['vRefDay', 'text-warn-700'],
  wrong_slot: ['vRefSlot', 'text-warn-700'],
  unknown_ticket: ['vRefNoPass', 'text-stop-700'],
  not_paid: ['vRefNotPaid', 'text-stop-700'],
  watch_blocked: ['watchBlockedChip', 'text-stop-700'],
};

export default function VehicleSheet({ regNo, today, onClose }) {
  const { t, locale } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const dayText = (date) => {
    if (date === today) return t('today');
    try {
      return new Date(`${date}T00:00:00+05:30`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    } catch { return date; }
  };

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
            {t('close')}
          </button>
        </div>

        {error && <p className="px-5 py-6 text-[15px] text-stop-700">{error}</p>}
        {!data && !error && <p className="px-5 py-10 text-center text-muted">{t('looking')}</p>}

        {data && (
          <div className="space-y-5 px-5 pt-4">
            <div className="flex gap-2">
              <Tally label={t('entriesHere')} value={data.entries} tone="bg-pass-50 text-pass-700" />
              <Tally label={t('refusals')} value={data.refusals} tone={data.refusals ? 'bg-stop-50 text-stop-700' : 'bg-shell text-muted'} />
              <Tally label={t('passesBought')} value={data.passes.length} tone="bg-shell text-muted" />
            </div>

            <section>
              <h3 className="pb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{t('atThisGate')}</h3>
              {data.checks.length === 0 ? (
                <p className="py-4 text-[15px] text-muted">{t('neverChecked')}</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.checks.map((c, i) => {
                    const [labelKey, tone] = VERDICTS[c.verdict] || [null, 'text-muted'];
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div>
                          <div className={`text-[15px] font-semibold ${tone}`}>{labelKey ? t(labelKey) : c.verdict}</div>
                          <div className="text-[13px] text-muted">
                            {new Date(c.at).toLocaleDateString(locale, { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })} · {clock(c.at)}
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
              <h3 className="pb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{t('passesForDest')}</h3>
              {data.passes.length === 0 ? (
                <p className="py-4 text-[15px] text-muted">{t('noPassesRecord')}</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {data.passes.map((p) => (
                    <li key={p.ticketNo} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <div className="plate text-[15px]">{p.ticketNo}</div>
                        <div className="text-[13px] text-muted">{dayText(p.travelDate)} · {p.slot} · {p.type}</div>
                      </div>
                      <span className={`chip ${p.status === 'used' ? 'bg-pass-50 text-pass-700' : p.status === 'paid' ? 'bg-shell text-muted' : 'bg-warn-50 text-warn-700'}`}>
                        {p.status === 'used' ? t('inAt', { t: clock(p.usedAt) }) : p.status === 'paid' ? t('notUsed') : p.status}
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
