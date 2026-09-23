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
        display: ['"Bodoni Moda"', 'Georgia', 'Times New Roman', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        hero: ['"Bodoni Moda"', 'Georgia', 'serif'],
        ui: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero-opening': [
          'clamp(2.625rem, 6.5vw + 1rem, 6.25rem)',
          { lineHeight: '1.02', letterSpacing: '-0.02em' },
        ],
        'hero-chapter': [
          'clamp(2.25rem, 5vw + 0.75rem, 5.5rem)',
          { lineHeight: '0.95', letterSpacing: '-0.025em' },
        ],
        'hero-closing': [
          'clamp(2rem, 4.5vw + 0.75rem, 4.5rem)',
          { lineHeight: '1.05', letterSpacing: '-0.02em' },
        ],
        'brand-heading': [
          'clamp(2.375rem, 3.25vw + 1.35rem, 4.75rem)',
          { lineHeight: '1.05', letterSpacing: '-0.02em' },
        ],
        'nav-label': [
          'clamp(1.75rem, 1rem + 1.5vw, 2.25rem)',
          { lineHeight: '1.05', letterSpacing: '-0.02em' },
        ],
        'empty-heading': [
          'clamp(2.125rem, 3vw + 1.25rem, 4rem)',
          { lineHeight: '1.08', letterSpacing: '-0.02em' },
        ],
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
