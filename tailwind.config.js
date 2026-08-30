/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#07070c',
        panel: '#0d0d14',
        card: '#111118',
        hairline: 'rgba(255,255,255,0.08)',
        accent: '#7c5cff',
        'accent-soft': 'rgba(124,92,255,0.18)',
        success: '#34d399',
      },
      fontFamily: {
        latin: ['Inter', 'system-ui', 'sans-serif'],
        farsi: ['Vazirmatn', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
