/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#141414',
        border: '#222',
        muted: '#555',
        accent: '#a78bfa',
        'accent-dark': '#6c47ff',
      },
    },
  },
  plugins: [],
}
