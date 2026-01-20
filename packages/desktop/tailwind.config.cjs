/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // New design palette: Warm Stone Grays
        cafe: {
          950: '#0c0a09', // Deepest Espresso
          900: '#1c1917', // Dark Roast
          850: '#23201d', // Panel Background
          800: '#292524', // Card Background
          700: '#44403c', // Borders
          600: '#57534e', // Muted Text
          500: '#78716c', // Secondary Text
          400: '#a8a29e', // Primary Text
          300: '#d6d3d1', // High Contrast Text
          200: '#e7e5e4', // Headings
          100: '#f5f5f4', // White Text
        },
        // Brand Accent: Caramel / Amber
        brand: {
          DEFAULT: '#d97706', // amber-600
          hover: '#b45309',   // amber-700
          light: '#fbbf24',   // amber-400
          subtle: '#78350f',  // amber-900 (backgrounds)
        },
        terminal: {
          bg: '#120f0e', // Very dark warm black
        },
        // Compatibility aliases (map old names to new values)
        background: '#0c0a09', // cafe-950
        card: '#292524',       // cafe-800
        espresso: '#3C2218',
        coffee: '#d97706',     // brand
        bone: '#e7e5e4',       // cafe-200
        sidebar: '#1c1917',    // cafe-900
        border: '#44403c',     // cafe-700
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
