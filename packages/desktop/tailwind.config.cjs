/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        card: '#1C1C1C',
        espresso: '#3C2218',
        coffee: '#6F4E37',
        bone: '#E6D6C8',
        sidebar: '#252525',
        border: '#333333',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
