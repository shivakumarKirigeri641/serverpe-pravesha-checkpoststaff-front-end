import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
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
const METHODS = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']];

export default function SellSheet({ prefill, onClose, onSold, onOpenPass }) {
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
  const remaining = slot && chosenType ? (slot.types.find((t) => t.code === chosenType)?.remaining ?? null) : null;

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      const d = await api.onspotLookup(regNo);
      setLooked(d);
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
      onSold?.(out.ticket);
    } catch (e) {
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
            <div className="text-[17px] font-bold">{sold ? 'Pass sold' : 'Sell a pass'}</div>
            <div className="text-[13px] text-muted">
              {sold ? 'Show this number to the visitor' : options ? `${options.place?.name} · ${options.serverTime}` : 'Loading…'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-muted">
            {sold ? 'Done' : 'Cancel'}
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
              {sold.declared && <div className="mt-1 text-[13px] text-warn-700">Type declared at the gate{sold.noPlate ? ' · no number plate' : ''}</div>}
              {sold.enteredAt && <div className="mt-1 text-[13px] text-pass-700">Entry recorded</div>}
            </div>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : !options ? (
          <p className="px-5 py-10 text-center text-muted">Loading prices and slots…</p>
        ) : step === 'vehicle' ? (
          <div className="space-y-4 px-5 pt-4">
            <div className="flex gap-2">
              <TabBtn active={!noPlate} onClick={() => { setNoPlate(false); }} label="Has a number plate" />
              <TabBtn active={noPlate} onClick={() => { setNoPlate(true); setManual(true); setLooked(null); }} label="No number plate" />
            </div>

            {!noPlate && (
              <>
                <div>
                  <label className="label" htmlFor="sell-plate">Vehicle number</label>
                  <div className="flex gap-2">
                    <input id="sell-plate" className="field flex-1 text-[19px] uppercase tracking-wide" value={regNo}
                      autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text"
                      onChange={(e) => { setRegNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setLooked(null); setManual(false); setType(null); }} />
                    <button type="button" className="btn-primary px-4" disabled={busy || regNo.length < 5} onClick={lookup}>
                      {busy ? '…' : 'Check'}
                    </button>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">A temporary registration (TR) is fine — type it as it is on the vehicle.</p>
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
                      {looked.alreadyBooked.status === 'used' ? 'Already came through today'
                        : looked.alreadyBooked.beingPaidFor ? 'A pass is being paid for right now'
                          : 'This vehicle already has a pass for today'}
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
                      {looked.alreadyBooked.status === 'used' ? 'Open that pass' : 'Open it and check them in'}
                    </button>
                  </div>
                )}

                {looked?.found && !looked.alreadyBooked && (
                  <div className="rounded-xl border border-pass-500/25 bg-pass-50 px-4 py-3">
                    <div className="text-[15px] font-bold text-pass-700">{looked.type.label}</div>
                    <div className="text-[13px] text-muted">{[looked.vehicle, looked.colour].filter(Boolean).join(' · ') || 'From the vehicle register'}</div>
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
                <label className="label">What kind of vehicle is it?</label>
                <div className="grid grid-cols-2 gap-2">
                  {options.types.map((t) => (
                    <button key={t.code} type="button" onClick={() => setType(t.code)}
                      className={`rounded-xl border px-3 py-3 text-left ${chosenType === t.code ? 'border-brand bg-brand/5' : 'border-line bg-white'}`}>
                      <div className="text-[15px] font-bold">
                        <span className="mr-1.5" aria-hidden>{TYPE_ICON[t.code] || '🚘'}</span>{t.label}
                      </div>
                      <div className="text-[13px] text-muted">₹{t.total}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  You are looking at the vehicle — your answer sets the price, and your name goes on the pass.
                </p>
              </div>
            )}

            {(manual || noPlate) && (
              <div>
                <label className="label">
                  Something that identifies it <span className="text-stop-700">— required</span>
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
                  placeholder={identityRule?.hint || 'Write what you can see'}
                  onChange={(e) => setIdentityNote(e.target.value.toUpperCase())} />
                <p className="mt-1 text-[13px] text-muted">
                  The register cannot vouch for this vehicle, so this is the only record of what came through.
                  The chassis number is best — it is on the invoice and the TR paper, and it stays with the vehicle when the
                  permanent number comes. The visitor&rsquo;s mobile is taken on the next screen, and is required too.
                </p>
              </div>
            )}

            {noPlate && (
              <Camera
                kind="vehicle" required
                label="Photograph of the vehicle"
                hint="The whole vehicle from the front, close enough to read anything written on it. With no number plate this is the only record of what came through that nobody typed."
                photos={photos} onChange={setPhotos} />
            )}

            <button type="button" className="btn-primary w-full" disabled={!vehicleReady} onClick={() => setStep('pay')}>
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-5 pt-4">
            <div className="rounded-xl border border-line px-4 py-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[15px] font-bold">{noPlate ? 'No number plate' : plateText(regNo)}</div>
                <div className="text-[20px] font-extrabold">₹{price?.total ?? '—'}</div>
              </div>
              <div className="text-[13px] text-muted">
                {price?.label} · entry ₹{price?.entry} + fee ₹{price?.serviceFee}
                {manual || noPlate ? ' · type declared by you' : ' · from the register'}
              </div>
              {unverified && (
                <div className="mt-1 text-[13px] text-warn-700">
                  {identityRule?.label || 'Identified by'}: {identityNote.trim()}
                </div>
              )}
            </div>

            <div>
              <label className="label">Slot</label>
              <div className="space-y-2">
                {options.slots.length === 0 && (
                  <p className="rounded-xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-[14px] text-warn-700">
                    No slot can be entered now. Entry closes an hour before a slot ends.
                  </p>
                )}
                {options.slots.map((s) => {
                  const left = s.types.find((t) => t.code === chosenType)?.remaining ?? 0;
                  return (
                    <button key={s.slotId} type="button" disabled={left <= 0} onClick={() => setSlotId(s.slotId)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${slotId === s.slotId ? 'border-brand bg-brand/5' : 'border-line bg-white'} ${left <= 0 ? 'opacity-50' : ''}`}>
                      <div className="text-[15px] font-semibold">{s.label}</div>
                      <div className="text-[13px] text-muted">{left > 0 ? `${left} places left` : 'Full'} · last entry {s.lastEntry}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="sell-mobile">
                  Visitor mobile{unverified ? <span className="text-stop-700"> — required</span> : ''}
                </label>
                <input id="sell-mobile" className="field tabular" inputMode="numeric" maxLength={10} value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10 digits" />
              </div>
              <div>
                <label className="label" htmlFor="sell-name">Name</label>
                <input id="sell-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="label">Paid by</label>
              <div className="flex gap-2">
                {METHODS.map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setMethod(key)}
                    className={`flex-1 rounded-xl border px-3 py-3 text-[15px] font-semibold ${method === key ? 'border-brand bg-brand/5' : 'border-line bg-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {method !== 'cash' && (
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="sell-ref">{method === 'upi' ? 'UPI reference' : 'Card slip number'}</label>
                  <input id="sell-ref" className="field" value={reference} onChange={(e) => setReference(e.target.value.trim())} />
                </div>
                <Camera
                  kind="upi"
                  label={method === 'upi' ? 'Photograph of the payment screen' : 'Photograph of the card slip'}
                  hint={method === 'upi'
                    ? 'Worth taking. A reference typed from somebody else’s screen is easy to get wrong, and this is what settles it if the payment cannot be found later.'
                    : 'Worth taking, so the slip number can be checked against the settlement later.'}
                  photos={photos} onChange={setPhotos} />
              </div>
            )}

            <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={recordEntry} onChange={(e) => setRecordEntry(e.target.checked)} />
              The vehicle is here — record its entry now
            </label>

            {remaining !== null && remaining <= 0 && (
              <p className="rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-3 text-[14px] text-stop-700">
                That slot is full for this vehicle type.
              </p>
            )}

            {noPlate && vehicleShots.length === 0 && (
              <p className="rounded-xl border border-warn-500/25 bg-warn-50 px-4 py-3 text-[14px] text-warn-700">
                Go back and photograph the vehicle. With no number plate, a pass cannot be issued without it.
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" className="flex-1 rounded-xl border border-line px-4 py-3 text-[15px] font-semibold text-muted" onClick={() => setStep('vehicle')}>
                Back
              </button>
              <button type="button" className="btn-primary flex-[2]" disabled={busy || !payReady || (remaining !== null && remaining <= 0)} onClick={sell}>
                {busy ? 'Selling…' : `Take ₹${price?.total ?? ''} and issue`}
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
