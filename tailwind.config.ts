import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // GAKIT Brand Colors
        'gakit-maroon': '#7A0019',
        'gakit-maroon-light': '#9B1C31',
        maroon: {
          50: '#FDF2F4',
          100: '#FCE7EB',
          200: '#F8C9D2',
          300: '#F0A9B6',
          400: '#E07A8C',
          500: '#C94E67',
          600: '#A9314D',
          700: '#7A0019',
          800: '#5E0013',
          900: '#43000E',
        },
        
        // Hazard Status Colors
        'hazard-critical': '#EF4444',  // Red - Critical/Impassable
        'hazard-verified': '#7A0019',   // Maroon - Verified floods
        'hazard-pending': '#F59E0B',    // Amber - Pending reports
        'hazard-safe': '#10B981',       // Green - Safe routes
        
        // Canvas Neutrals
        'canvas-white': '#FFFFFF',
        'canvas-light': '#F8FAFC',
        'canvas-lighter': '#F1F5F9',
        'canvas-grey': '#E2E8F0',
      },
    },
  },
  plugins: [],
};

export default config;
