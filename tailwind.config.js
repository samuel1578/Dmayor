/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ghana: {
          green: '#B8860B',
          yellow: '#FCD116',
          red: '#CE1126',
          black: '#111111',
          light: '#FFFDF5',
          dark: '#0a0a0a',
        },
      },
      backgroundColor: {
        'ghana-light': '#FFFDF5',
        'ghana-dark': '#0a0a0a',
      },
      textColor: {
  'ghana-primary': '#B8860B',
        'ghana-accent-yellow': '#FCD116',
        'ghana-accent-red': '#CE1126',
      },
      fontFamily: {
        display: ['system-ui', 'sans-serif'],
        body: ['system-ui', 'sans-serif'],
      },
      keyframes: {
        'spin-star': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'spin-star': 'spin-star 2s linear infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.6s ease-out',
        'slide-down': 'slide-down 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
