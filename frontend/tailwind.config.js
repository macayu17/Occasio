/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6eeff',
          100: '#ccdcff',
          200: '#99b9ff',
          300: '#6697ff',
          400: '#3374ff',
          500: '#0046FF',
          600: '#0038cc',
          700: '#002a99',
          800: '#001c66',
          900: '#000e33',
        },
        secondary: {
          50: '#fff4e6',
          100: '#ffe9cc',
          200: '#ffd399',
          300: '#ffbd66',
          400: '#ffa733',
          500: '#FF8040',
          600: '#cc6633',
          700: '#994d26',
          800: '#66331a',
          900: '#331a0d',
        },
        accent: {
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#001BB7',
          600: '#001692',
          700: '#00106e',
          800: '#000b49',
          900: '#000525',
        },
        neutral: {
          50: '#fefdf9',
          100: '#fdfbf3',
          200: '#fbf7e7',
          300: '#f9f3db',
          400: '#f7efcf',
          500: '#F5F1DC',
          600: '#c4c1b0',
          700: '#939184',
          800: '#626058',
          900: '#31302c',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
