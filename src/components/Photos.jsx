import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n.jsx';

/*
 * Photographs on a pass, loaded only when somebody opens it.
 *
 * They are fetched with the shift's token and shown from a blob, because an
 * <img src> cannot carry an Authorization header and a token in a URL would
 * outlive the shift in browser history. Tapping one opens it full size — at a
 * barrier the thing being checked is usually a reference number in a screenshot,
 * which is unreadable at thumbnail size.
 */
const LABELS = { upi: 'phUpi', vehicle: 'phVehicle', plate: 'phPlate', other: 'phOther' };

export default function Photos({ photos }) {
  const { t } = useT();
  const [urls, setUrls] = useState({});
  const [big, setBig] = useState(null);

  useEffect(() => {
    let alive = true;
    const made = [];
    (async () => {
      for (const p of photos || []) {
        try {
          const url = await api.photoBlob(p.id);
          made.push(url);
          if (!alive) return;
          setUrls((m) => ({ ...m, [p.id]: url }));
        } catch { /* one that will not load is left as an empty frame */ }
      }
    })();
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [photos]);

  if (!photos?.length) return null;
  const labelOf = (kind) => t(LABELS[kind] || 'phOther');

  return (
    <>
      <div className="flex gap-2 overflow-x-auto py-1">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => urls[p.id] && setBig(urls[p.id])}
            className="relative shrink-0">
            {urls[p.id]
              ? <img src={urls[p.id]} alt={labelOf(p.kind)} className="h-24 w-24 rounded-xl border border-line object-cover" />
              : <div className="grid h-24 w-24 place-items-center rounded-xl border border-line bg-shell text-[11px] text-muted">{t('phLoading')}</div>}
            <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {labelOf(p.kind)}
            </span>
          </button>
        ))}
      </div>

      {big && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/90 p-3" onClick={() => setBig(null)}>
          <img src={big} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </>
  );
}
