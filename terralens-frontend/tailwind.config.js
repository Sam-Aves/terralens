/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#060913',
          800: '#0b1120',
          700: '#131e36',
          600: '#1c2d52'
        },
        satellite: {
          cyan: '#00F0FF',
          blue: '#0072FF',
          gold: '#FFD700',
          alert: '#FF4B4B'
        }
      }
    },
  },
  plugins: [],
}
