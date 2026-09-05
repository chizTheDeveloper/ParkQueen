/** @type {import('tailwindcss').Config} */
// Ported verbatim from the `tailwind.config = {...}` block that used to live
// inline in index.html for the Play CDN. Keep darkMode and the two custom
// palettes identical — the app toggles `.dark` on <html> and uses queen-*/dark-*
// utilities directly in JSX.
module.exports = {
  darkMode: 'class',
  // The Play CDN JIT-compiled against the live DOM; this build compiles against
  // source instead, so these globs must cover every file that can contribute a
  // class name. Verified: the codebase never builds class names dynamically
  // (no `bg-${x}` / string concatenation), so static extraction is complete.
  content: [
    './index.html',
    './*.{ts,tsx}',
    './{components,views,utils,hooks,services,i18n}/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        queen: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        dark: {
          900: '#071426',
          800: '#091d36',
          700: '#0f294d',
        },
      },
    },
  },
  plugins: [],
};
