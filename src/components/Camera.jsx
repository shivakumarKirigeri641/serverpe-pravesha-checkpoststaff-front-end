import { useRef, useState } from 'react';
import { api } from '../lib/api';

/*
 * A photograph taken at the barrier, sent as soon as it is taken.
 *
 * THE PHONE'S OWN CAMERA APP DOES THE WORK. `capture="environment"` on a file
 * input opens the rear camera directly, with the phone's focus, flash and
 * shutter — all of it better than anything this app could build, and all of it
 * already familiar to the person holding it. No permissions dialogue of our own,
 * no live video stream to keep alive on a phone with one bar of signal.
 *
 * IT IS SHRUNK BEFORE IT IS SENT. A modern camera produces four megabytes; a
 * legible photograph of a UPI screen or a vehicle is a couple of hundred
 * kilobytes. The difference is minutes of waiting on a hill. So the image is
 * drawn into a canvas at no more than 1600px on its long side and re-encoded as
 * JPEG before a single byte goes out.
 *
 * IT UPLOADS IMMEDIATELY, NOT WITH THE SALE. Two reasons. A staff member needs
 * to see "sent" while the visitor is still holding up their phone, and a
 * photograph that fails must never take a completed sale down with it — so the
 * sale simply quotes the ids of whatever arrived.
 *
 * IF IT FAILS, IT SAYS SO AND OFFERS TO TRY AGAIN. Signal at a checkpost is what
 * it is, and a silent failure here would mean a pass sold with no evidence
 * behind it and nobody aware.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.72;

/** Draw the picture smaller, and re-encode it as JPEG. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try {
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', QUALITY), width: w, height: h });
      } catch (e) {
        reject(new Error('This phone would not let the app read the photograph.'));
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a photograph.')); };
    img.src = url;
  });
}

export default function Camera({ kind, label, hint, required = false, photos, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const mine = photos.filter((p) => p.kind === kind);

  async function take(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const small = await shrink(file);
      const out = await api.uploadPhoto({ kind, image: small.dataUrl, width: small.width, height: small.height });
      onChange([...photos, { ...out.photo, preview: small.dataUrl }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      /* Same file twice — a retake of the same shot — must still fire onChange. */
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-stop-700"> — required</span>}
      </label>

      {mine.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {mine.map((p) => (
            <div key={p.id} className="relative shrink-0">
              <img src={p.preview} alt="" className="h-24 w-24 rounded-xl border border-line object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                sent
              </span>
              <button type="button" aria-label="Remove this photograph"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-ink text-[13px] font-bold text-white">×</button>
            </div>
          ))}
        </div>
      )}

      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => take(e.target.files?.[0])} />

      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        className={`w-full rounded-xl border px-4 py-3 text-[15px] font-semibold ${
          mine.length ? 'border-line bg-white text-muted' : 'border-brand bg-brand/5 text-brand'}`}>
        {busy ? 'Sending…' : mine.length ? 'Take another' : '📷  Take a photo'}
      </button>

      {error && (
        <p className="mt-2 rounded-xl border border-stop-500/25 bg-stop-50 px-4 py-2.5 text-[14px] text-stop-700">
          {error} <button type="button" className="underline" onClick={() => input.current?.click()}>Try again</button>
        </p>
      )}

      {hint && !error && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
