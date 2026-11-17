/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        xuan: {
          bg: '#0f1115',
          card: '#181b22',
          elevated: '#1f242d',
          gold: '#c5a059',
          goldLight: '#e2c488',
          crimson: '#b91c1c',
          jade: '#2dd4bf',
          ink: '#090a0d',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
      },
      animation: {
        'float-slow': 'floatSlow 5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.35s ease-out',
        'pulse-gold': 'pulseGold 2.4s ease-in-out infinite',
      },
      keyframes: {
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(197, 160, 89, 0.25)' },
          '50%': { boxShadow: '0 0 18px 2px rgba(197, 160, 89, 0.35)' },
        },
      },
    },
  },
  plugins: [],
};
