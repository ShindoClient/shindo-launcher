/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,svelte}'],
  theme: {
    extend: {
      colors: {
        shindo: {
          primary: '#7c3aed',
          secondary: '#3b82f6',
          accent: '#10b981',
          dark: '#0f172a',
          darker: '#0c1324',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      boxShadow: {
        shindo: '0 8px 32px rgba(0, 0, 0, 0.3)',
        'shindo-lg': '0 20px 60px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
