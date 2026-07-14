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
      },
      colors: {
        // GAKIT Brand Colors
        'gakit-blue': '#2563EB',
        'gakit-blue-light': '#3B82F6',
        
        // Hazard Status Colors
        'hazard-critical': '#EF4444',  // Red - Critical/Impassable
        'hazard-verified': '#3B82F6',   // Blue - Verified floods
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
