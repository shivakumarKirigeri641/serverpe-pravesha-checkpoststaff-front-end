import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';
import { signal } from '../lib/feedback';
import Camera from './Camera.jsx';
import { plateText } from '../lib/verdict';

/*
 * Selling a pass at the barrier.
 *
 * The same sale a visitor makes on WhatsApp — the vehicle decides the type, the
 * type decides the price, the place comes out of the slot's capacity — done by
 * the person standing in front of the vehicle.
 *
 * THE REGISTER DOES NOT ALWAYS KNOW. A car bought last week is on a temporary
 * registration and VAHAN has nothing; a dealer plate is nobody's; the gateway
 * has bad mornings. None of that is a reason to turn a visitor away, so the
 * screen falls through to the staff member choosing the type themselves — they
 * are looking straight at the vehicle, after all. A pass sold that way records
 * who said what it was.
 *
 * AND SOMETIMES THERE IS NO PLATE AT ALL — a new vehicle being driven up on its
 * invoice. Then we need something to write down: a chassis number, or the
 * driver's name and phone. The pass gets an identifier of our own so that one
 * vehicle still gets one pass a day.
 *
 * WHAT THE CAMERA IS FOR. Two things here can only be typed, and anything typed
 * can be mistyped. A UPI reference read off a visitor's screen is indistinguish-
 * able from a payment that never happened until the reconciliation fails a week
 * later, and a vehicle with no plate is described entirely by a chassis number
 * somebody squinted at. A photograph settles both, so there is one offered
 * beside the UPI reference and one required for a vehicle with no plate. It is
 * uploaded as it is taken, not with the sale.
 */

const TYPE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };
const METHODS = ['cash', 'upi', 'card'];

export default function SellSheet({ prefill, onClose, onSold, onOpenPass }) {
  const { t } = useT();
  const [options, setOptions] = useState(null);
  const [step, setStep] = useState('vehicle');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [regNo, setRegNo] = useState((prefill || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const [looked, setLooked] = useState(null);          // what the register said
  const [manual, setManual] = useState(false);         // staff is choosing the type
  const [noPlate, setNoPlate] = useState(false);
  const [type, setType] = useState(null);
  const [identityNote, setIdentityNote] = useState('');
  const [identityKind, setIdentityKind] = useState('chassis');

  const [slotId, setSlotId] = useState('');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [recordEntry, setRecordEntry] = useState(true);
  const [photos, setPhotos] = useState([]);            // uploaded already, ids only
  const [sold, setSold] = useState(null);

  useEffect(() => {
    api.onspotOptions()
      .then((d) => { setOptions(d); setSlotId(d.slots[0]?.slotId || ''); })
      .catch((e) => setError(e.message));
  }, []);

  const chosenType = type || looked?.type?.code || null;
  const price = useMemo(() => {
    if (!options || !chosenType) return null;
    return options.prices.find((p) => p.code === chosenType) || null;
  }, [options, chosenType]);
  const slot = options?.slots.find((s) => s.slotId === slotId) || null;
  const remaining = slot && chosenType ? (slot.types.find((x) => x.code === chosenType)?.remaining ?? null) : null;

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.onspotLookup(regNo);
      setLooked(d);
      if (d.alreadyBooked) signal('stop');
      if (d.found) { setManual(false); setType(null); } else { setManual(true); }
    } catch (e) {
      setError(e.message);
      setManual(true);
    } finally {
      setBusy(false);
    }
  }

  async function sell() {
    setBusy(true);
    setError(null);
    try {
      const out = await api.onspotSell({
        regNo: noPlate ? null : regNo,
        noPlate,
        declaredType: manual || noPlate ? chosenType : null,
        identityNote: identityNote.trim() || null,
        identityKind,
        slotId,
        mobile,
        name: name.trim() || null,
        paymentMethod: method,
        paymentReference: reference.trim() || null,
        photoIds: photos.map((p) => p.id),
        recordEntry,
      });
      setSold(out.ticket);
      signal('go');
      onSold?.(out.ticket);
    } catch (e) {
      signal('stop');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  /* An unverified vehicle — a temporary registration, or none at all — cannot
     go through without something unique written against it. */
  const unverified = manual || noPlate;
  const identityRule = (options?.identityKinds || []).find((k) => k.key === identityKind) || null;
  const vehicleReady = (noPlate || /^[A-Z0-9]{5,11}$/.test(regNo))
    && Boolean(chosenType)
    && !looked?.alreadyBooked
    /* A plate the office blocked is not sold a pass at the barrier either. */
    && looked?.watch?.level !== 'block'
    && (!unverified || identityNote.trim().length >= (identityRule?.min || 4));
  const vehicleShots = photos.filter((p) => p.kind === 'vehicle');
  const payReady = /^\d{10}$/.test(mobile) && Boolean(slotId)
    && (method === 'cash' || reference.trim().length >= 4)
    /* No plate: the photograph is the only description of the vehicle that
       cannot have been mistyped, so the sale waits for it. */
    && (!noPlate || vehicleShots.length > 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/40" onClick={busy ? undefined : onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 pb-3 pt-4">
          <div>
            <div className="text-[17px] font-bold">{sold ? t('soldTitle') : t('sellPass')}</div>
            <div className="text-[13px] text-muted">
              {sold ? t('showNumber') : options ? `${options.place?.name} · ${options.serverTime}` : t('loadingDots')}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted">
            {sold ? t('done') : t('cancel')}
          </button>
        </div>

        {error && <p className="mx-5 mt-4 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[15px] text-stop-700">{error}</p>}

        {sold ? (
          <div className="px-5 pt-5">
            <div className="rounded-2xl border border-pass-500/30 bg-pass-50 px-5 py-5 text-center">
              <div className="plate text-[26px] font-extrabold text-pass-700">{sold.ticketNo}</div>
              <div className="mt-1 text-[15px]">{plateText(sold.regNo)} · {sold.vehicleType}</div>
              <div className="text-[13px] text-muted">{sold.slot} · {sold.travelDate}</div>
              <div className="mt-3 text-[22px] font-extrabold">₹{sold.amount}</div>
              {sold.declared && <div className="mt-1 text-[13px] text-warn-700">{t('typeDeclaredShort')}{sold.noPlate ? t('noPlateSuffix') : ''}</div>}
              {sold.enteredAt && <div className="mt-1 text-[13px] text-pass-700">{t('entryRecordedTitle')}</div>}
            </div>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">{t('done')}</button>
          </div>
        ) : !options ? (
          <p className="px-5 py-10 text-center text-muted">{t('loadingPrices')}</p>
        ) : step === 'vehicle' ? (
          <div className="space-y-4 px-5 pt-4">
            <div className="flex gap-2">
              <TabBtn active={!noPlate} onClick={() => { setNoPlate(false); }} label={t('hasPlate')} />
              <TabBtn active={noPlate} onClick={() => { setNoPlate(true); setManual(true); setLooked(null); }} label={t('noPlate')} />
            </div>

            {!noPlate && (
              <>
                <div>
                  <label className="label" htmlFor="sell-plate">{t('vehicleNumber')}</label>
                  <div className="flex gap-2">
                    <input id="sell-plate" className="field flex-1 text-[19px] uppercase tracking-wide" value={regNo}
                      autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text"
                      onChange={(e) => { setRegNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setLooked(null); setManual(false); setType(null); }} />
                    <button type="button" className="btn-primary px-4" disabled={busy || regNo.length < 5} onClick={lookup}>
                      {busy ? '…' : t('check')}
                    </button>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{t('trFine')}</p>
                </div>

                {/*
                  * ALREADY HAS ONE — SAID HERE, NOT AT THE TILL.
                  *
                  * One pass per vehicle per day was always enforced, but the
                  * refusal used to arrive after the slot was chosen, the mobile
                  * typed and the money in the staff member's hand. This is the
                  * same fact, delivered while it can still save everybody the
                  * trouble — and it names the pass, because the visitor usually
                  * has one and does not know it.
                  */}
                {looked?.alreadyBooked && (
                  <div className="rounded-xl border-2 border-stop-500/40 bg-stop-50 px-4 py-3">
                    <div className="text-[15px] font-bold text-stop-700">
                      {looked.alreadyBooked.status === 'used' ? t('alreadyCame')
                        : looked.alreadyBooked.beingPaidFor ? t('beingPaid')
                          : t('alreadyHas')}
                    </div>
                    <div className="mt-0.5 text-[14px] text-stop-700/90">{looked.alreadyBooked.message}</div>
                    {!looked.alreadyBooked.beingPaidFor && (
                      <div className="mt-2 rounded-lg bg-white/70 px-3 py-2">
                        <div className="plate text-[17px]">{looked.alreadyBooked.ticketNo}</div>
                        <div className="text-[13px] text-muted">{looked.alreadyBooked.slot}</div>
                      </div>
                    )}
                    <button type="button" className="btn-primary mt-3 w-full"
                      onClick={() => { onClose(); onOpenPass?.(looked.alreadyBooked.ticketNo); }}>
                      {looked.alreadyBooked.status === 'used' ? t('openThatPass') : t('openCheckIn')}
                    </button>
                  </div>
                )}

                {looked?.watch && (
                  <div className={`rounded-xl border-2 px-4 py-3 ${looked.watch.level === 'block' ? 'border-stop-500/50 bg-stop-50 text-stop-700' : 'border-ask-500/50 bg-ask-50 text-ask-700'}`} role="alert">
                    <div className="text-[15px] font-extrabold">⚠ {looked.watch.level === 'block' ? t('watchBlockedChip') : t('watchCheckTitle')}</div>
                    <div className="text-[14px]">{t('watchReason', { r: looked.watch.reason })}</div>
                  </div>
                )}

                {looked?.found && !looked.alreadyBooked && (
                  <div className="rounded-xl border border-pass-500/25 bg-pass-50 px-4 py-3">
                    <div className="text-[15px] font-bold text-pass-700">{looked.type.label}</div>
                    <div className="text-[13px] text-muted">{[looked.vehicle, looked.colour].filter(Boolean).join(' · ') || t('fromRegister')}</div>
                  </div>
                )}

                {looked && !looked.found && (
                  <div className="rounded-xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-[14px] text-warn-700">
                    {looked.message}
                  </div>
                )}
              </>
            )}

            {(manual || noPlate) && (
              <div>
                <label className="label">{t('whatKind')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {options.types.map((ty) => (
                    <button key={ty.code} type="button" onClick={() => setType(ty.code)}
                      className={`rounded-xl border px-3 py-3 text-left ${chosenType === ty.code ? 'border-brand bg-brand/5' : 'border-line bg-white'}`}>
                      <div className="text-[15px] font-bold">
                        <span className="mr-1.5" aria-hidden>{TYPE_ICON[ty.code] || '🚘'}</span>{ty.label}
                      </div>
                      <div className="text-[13px] text-muted">₹{ty.total}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[13px] text-muted">{t('yourAnswer')}</p>
              </div>
            )}

            {(manual || noPlate) && (
              <div>
                <label className="label">
                  {t('identifies')} <span className="text-stop-700">{t('requiredWord')}</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(options.identityKinds || []).map((k) => (
                    <button key={k.key} type="button" onClick={() => setIdentityKind(k.key)}
                      className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${identityKind === k.key ? 'bg-brand text-white' : 'border border-line bg-white text-muted'}`}>
                      {k.label}
                    </button>
                  ))}
                </div>
                <input id="sell-identity" className="field mt-2 uppercase tracking-wide" value={identityNote}
                  autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                  placeholder={identityRule?.hint || t('writeWhat')}
                  onChange={(e) => setIdentityNote(e.target.value.toUpperCase())} />
                <p className="mt-1 text-[13px] text-muted">{t('identityExplain')}</p>
              </div>
            )}

            {noPlate && (
              <Camera
                kind="vehicle" required
                label={t('vehiclePhoto')}
                hint={t('vehiclePhotoHint')}
                photos={photos} onChange={setPhotos} />
            )}

            <button type="button" className="btn-primary w-full" disabled={!vehicleReady} onClick={() => setStep('pay')}>
              {t('continueBtn')}
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-5 pt-4">
            <div className="rounded-xl border border-line px-4 py-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[15px] font-bold">{noPlate ? t('noPlate') : plateText(regNo)}</div>
                <div className="text-[20px] font-extrabold">₹{price?.total ?? '—'}</div>
              </div>
              <div className="text-[13px] text-muted">
                {t('feeLine', { label: price?.label || '', e: price?.entry ?? '', f: price?.serviceFee ?? '' })}
                {manual || noPlate ? t('declaredByYou') : t('fromRegisterSuffix')}
              </div>
              {unverified && (
                <div className="mt-1 text-[13px] text-warn-700">
                  {identityRule?.label || t('identifiedByShort')}: {identityNote.trim()}
                </div>
              )}
            </div>

            <div>
              <label className="label">{t('slot')}</label>
              <div className="space-y-2">
                {options.slots.length === 0 && (
                  <p className="rounded-xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-[14px] text-warn-700">{t('noSlotNow')}</p>
                )}
                {options.slots.map((s) => {
                  const left = s.types.find((x) => x.code === chosenType)?.remaining ?? 0;
                  return (
                    <button key={s.slotId} type="button" disabled={left <= 0} onClick={() => setSlotId(s.slotId)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${slotId === s.slotId ? 'border-brand bg-brand/5' : 'border-line bg-white'} ${left <= 0 ? 'opacity-50' : ''}`}>
                      <div className="text-[15px] font-semibold">{s.label}</div>
                      <div className="text-[13px] text-muted">{left > 0 ? t('placesLeft', { n: left }) : t('full')} · {t('lastEntry', { t: s.lastEntry })}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="sell-mobile">
                  {t('visitorMobile')}{unverified ? <span className="text-stop-700"> {t('requiredWord')}</span> : ''}
                </label>
                <input id="sell-mobile" className="field tabular" inputMode="numeric" maxLength={10} value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder={t('digits10')} />
              </div>
              <div>
                <label className="label" htmlFor="sell-name">{t('name')}</label>
                <input id="sell-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('optional')} />
              </div>
            </div>

            <div>
              <label className="label">{t('paidBy')}</label>
              <div className="flex gap-2">
                {METHODS.map((key) => (
                  <button key={key} type="button" onClick={() => setMethod(key)}
                    className={`flex-1 rounded-xl border px-3 py-3 text-[15px] font-semibold ${method === key ? 'border-brand bg-brand/5' : 'border-line bg-white'}`}>
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>

            {method !== 'cash' && (
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="sell-ref">{method === 'upi' ? t('upiRef') : t('cardSlip')}</label>
                  <input id="sell-ref" className="field" value={reference} onChange={(e) => setReference(e.target.value.trim())} />
                </div>
                <Camera
                  kind="upi"
                  label={method === 'upi' ? t('upiPhoto') : t('cardPhoto')}
                  hint={method === 'upi' ? t('upiPhotoHint') : t('cardPhotoHint')}
                  photos={photos} onChange={setPhotos} />
              </div>
            )}

            <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={recordEntry} onChange={(e) => setRecordEntry(e.target.checked)} />
              {t('vehicleHere')}
            </label>

            {remaining !== null && remaining <= 0 && (
              <p className="rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[14px] text-stop-700">{t('slotFull')}</p>
            )}

            {noPlate && vehicleShots.length === 0 && (
              <p className="rounded-xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-[14px] text-warn-700">{t('goBackPhoto')}</p>
            )}

            <div className="flex gap-2">
              <button type="button" className="flex-1 rounded-xl border border-line px-4 py-3 text-[15px] font-semibold text-muted" onClick={() => setStep('vehicle')}>
                {t('back')}
              </button>
              <button type="button" className="btn-primary flex-[2]" disabled={busy || !payReady || (remaining !== null && remaining <= 0)} onClick={sell}>
                {busy ? t('selling') : t('takeAndIssue', { a: price?.total ?? '' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TabBtn = ({ active, onClick, label }) => (
  <button type="button" onClick={onClick}
    className={`flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${active ? 'bg-brand text-white' : 'border border-line bg-white text-muted'}`}>
    {label}
  </button>
);
