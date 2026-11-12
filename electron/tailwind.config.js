/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        omega: {
          bg: '#0b0e11',
          surface1: '#12161b',
          surface2: '#171d24',
          surface3: '#1f262e',
          border: '#232c35',
          accent: '#f5a524',
          pass: '#22c55e',
          fail: '#ef4444'
        }
      },
      borderRadius: {
        DEFAULT: '8px'
      }
    }
  },
  plugins: []
};
