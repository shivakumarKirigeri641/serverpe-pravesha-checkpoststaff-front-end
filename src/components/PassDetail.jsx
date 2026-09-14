import { useEffect } from 'react';
import Photos from './Photos.jsx';
import { useT } from '../lib/i18n.jsx';
import { clock, plateText } from '../lib/verdict';

/*
 * One pass, in full.
 *
 * WHY A GATE NEEDS THIS. The questions that arrive at a barrier are rarely
 * "is this valid?" — the green tick answers that. They are "I booked this
 * yesterday, why does it say Saturday?", "my brother paid, whose name is on it?",
 * "we already came this morning". Each one is answerable from the booking, and
 * until now none of it left the admin panel.
 *
 * WHAT IS WITHHELD. The last four digits of the mobile number, never the whole
 * of it: enough to check against a visitor reading theirs out, not enough to be
 * a phone book in somebody's pocket.
 */
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function PassDetail({ pass, onClose }) {
  const { t, locale } = useT();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!pass) return null;
  const p = pass;
  const entered = p.entered;
  const day = (iso) => (iso
    ? new Date(iso).toLocaleDateString(locale, { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })
    : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-8" onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 px-6 pb-4 pt-5 ${entered ? 'bg-pass-50' : 'bg-shell'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="plate text-[26px] leading-tight">{plateText(p.regNo)}</div>
              <div className="mt-0.5 truncate text-[13px] text-muted">
                {p.category?.label}{p.vehicle ? ` · ${p.vehicle}` : ''}{p.colour ? ` · ${p.colour}` : ''}
              </div>
            </div>
            <span className={`chip shrink-0 ${entered ? 'bg-pass-500/15 text-pass-700' : 'bg-white text-muted'}`}>
              {entered ? t('inAt', { t: clock(entered.at) }) : t('expected')}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-6 pt-4">
          <Group title={t('thePass')}>
            <Row label={t('passNumber')} value={p.ticketNo} mono />
            <Row label={t('forWord')} value={`${day(`${p.travelDate}T06:00:00+05:30`)} · ${p.slot?.label}`} />
            <Row label={t('vehicleType')} value={p.category?.label} />
            {p.booked?.declared && (
              <Row label={t('typeAtGate')} value={p.booked.declaredReason || t('registerCouldNot')} />
            )}
            {p.booked?.identity && (
              <Row label={t('identifiedBy', { k: p.booked.identity.kind?.replace(/_/g, ' ') })} value={p.booked.identity.value} mono />
            )}
            {p.moved && (
              <Row label={t('moved')} value={`${t('movedFrom', { d: p.moved.fromDate })}${p.moved.fromSlot ? ` · ${p.moved.fromSlot}` : ''}`} />
            )}
          </Group>

          <Group title={t('whoBooked')}>
            <Row label={t('name')} value={p.booked?.by || p.visitor || t('notGiven')} />
            <Row label={t('mobile')} value={p.mobile} mono />
            <Row label={t('how')} value={p.booked?.how} />
            <Row label={t('when')} value={p.booked?.at ? t('dayAt', { d: day(p.booked.at), t: clock(p.booked.at) }) : null} />
          </Group>

          <Group title={t('whatPaid')}>
            <Row label={t('total')} value={money(p.paid?.total)} />
            <Row label={t('entryFee')} value={money(p.paid?.entry)} />
            <Row label={t('serviceFeeTax')} value={money(p.paid?.fee)} />
            <Row label={t('paidBy')} value={p.paid?.method} />
            <Row label={t('reference')} value={p.paid?.reference} mono />
            <Row label={t('paidAt')} value={p.paid?.at ? clock(p.paid.at) : null} />
          </Group>

          {p.photos?.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">{t('photosSale')}</h3>
              <Photos photos={p.photos} />
            </section>
          )}

          <Group title={t('atGate')}>
            {entered
              ? (
                <>
                  <Row label={t('enteredWord')} value={t('dayAt', { d: day(entered.at), t: clock(entered.at) })} />
                  <Row label={t('checkedBy')} value={entered.by} />
                  <Row label={t('gate')} value={entered.gate} />
                  <Row label={t('timesChecked')} value={String(p.checks || 1)} />
                </>
              )
              : <p className="py-2.5 text-[15px] text-muted">{t('notArrived')}</p>}
          </Group>
        </div>

        <div className="px-6 pt-6">
          <button type="button" className="btn-primary w-full" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}

const Group = ({ title, children }) => (
  <section>
    <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">{title}</h3>
    <div className="card divide-y divide-line px-4">{children}</div>
  </section>
);

/* A row with nothing in it says nothing at all, rather than "—". */
const Row = ({ label, value, mono = false }) => (value === null || value === undefined || value === '' ? null : (
  <div className="flex items-baseline justify-between gap-4 py-2.5">
    <span className="shrink-0 text-[13px] text-muted">{label}</span>
    <span className={`text-right text-[15px] font-semibold ${mono ? 'font-mono text-[14px]' : ''}`}>{value}</span>
  </div>
));
