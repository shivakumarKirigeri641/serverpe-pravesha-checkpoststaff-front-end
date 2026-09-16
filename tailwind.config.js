/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* A gate screen is read at arm's length, in sun and in rain, so the
           palette is high-contrast and the verdict colours are unmistakable
           across a metre: green means let them through, red means stop,
           amber means ask. */
        brand: { DEFAULT: '#075e54', light: '#128c7e', accent: '#00a884', deep: '#053f38' },
        pass: { 50: '#e9f9ef', 500: '#12a150', 600: '#0d8a43', 700: '#0a6c34' },
        stop: { 50: '#fdecec', 500: '#d92d20', 600: '#b42318', 700: '#912018' },
        ask: { 50: '#fff6e5', 500: '#e08700', 600: '#b86e00', 700: '#8f5600' },
        /* Blue means "your move": a valid pass that has not been recorded yet.
           Green is kept for after the tap, so a staff member never reads a
           pass that still needs recording as one that is done (2026-09-16). */
        act: { 50: '#e8f1fd', 500: '#1d6fe0', 600: '#155bc2', 700: '#0f478f' },
        ink: '#0d1b1e', muted: '#5d7169', line: '#dde7e3', shell: '#f2f6f4',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: { soft: '0 1px 2px rgba(13,27,30,.05), 0 8px 24px rgba(13,27,30,.08)' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.94)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(14px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { pop: 'pop .22s ease-out', rise: 'rise .25s ease-out' },
    },
  },
  plugins: [],
};
