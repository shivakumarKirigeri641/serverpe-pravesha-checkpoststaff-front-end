/*
 * The number pad under the search box.
 *
 * Staff find a vehicle by the last four digits on its plate. Opening the phone's
 * full keyboard for four numbers covers half the screen, puts the digits in a
 * cramped top row and is miserable in gloves or rain. So the digits are big
 * keys here, the phone keyboard stays shut, and "ABC" brings it back for the
 * rare plate or pass number that needs letters.
 *
 * Keys answer on touch-down rather than release — at a barrier the thumb is
 * already on its way to the next key — and still work from a keyboard.
 */
const ROWS = [['1', '2', '3', 'back'], ['4', '5', '6', '0'], ['7', '8', '9', 'letters']];

export default function NumberPad({ onDigit, onBackspace, onLetters, lettersLabel = 'ABC', deleteLabel = 'Delete' }) {
  const act = (k) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* not allowed */ } }
    if (k === 'back') onBackspace();
    else if (k === 'letters') onLetters();
    else onDigit(k);
  };
  const bind = (k) => ({
    /* preventDefault keeps the focus, and the cursor, in the search box. */
    onPointerDown: (e) => { e.preventDefault(); act(k); },
    /* A click with no pointer behind it is a keyboard's Enter or Space. */
    onClick: (e) => { if (e.detail === 0) act(k); },
  });

  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1.5" role="group" aria-label="Number pad">
      {ROWS.flat().map((k) => (
        <button key={k} type="button" {...bind(k)} data-key={k}
          aria-label={k === 'back' ? deleteLabel : k === 'letters' ? lettersLabel : k}
          className={`press h-12 select-none rounded-xl border border-line bg-white font-bold shadow-sm active:bg-shell ${
            k === 'letters' ? 'text-[15px] text-brand' : k === 'back' ? 'text-[20px] text-ink' : 'text-[24px] text-ink'}`}>
          {k === 'back' ? '⌫' : k === 'letters' ? lettersLabel : k}
        </button>
      ))}
    </div>
  );
}
