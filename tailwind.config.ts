import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark': {
          'primary': '#0a0a0a',
          'secondary': '#1a1a1a',
          'tertiary': '#2d2d2d',
        },
        'accent': {
          'gold': '#d4af37',
          'gold-light': '#e8c76f',
          'neon-blue': '#00d4ff',
          'neon-blue-dark': '#0099cc',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--font-geist-sans)', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backdropFilter: {
        'sm': 'blur(4px)',
        'md': 'blur(12px)',
        'lg': 'blur(20px)',
      },
      animation: {
        'aura': 'aura-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        'aura-glow': {
          '0%, 100%': {
            'box-shadow': '0 0 20px rgba(0, 212, 255, 0.3), 0 0 60px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)',
          },
          '50%': {
            'box-shadow': '0 0 30px rgba(0, 212, 255, 0.6), 0 0 80px rgba(0, 212, 255, 0.3), inset 0 0 30px rgba(0, 212, 255, 0.1)',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-gold': {
          '0%, 100%': { 'text-shadow': '0 0 10px rgba(212, 175, 55, 0)' },
          '50%': { 'text-shadow': '0 0 20px rgba(212, 175, 55, 0.5)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 20px 60px rgba(0, 0, 0, 0.5)',
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.3)',
        'gold-glow-lg': '0 0 40px rgba(212, 175, 55, 0.4)',
        'neon-glow': '0 0 20px rgba(0, 212, 255, 0.2)',
        'neon-glow-lg': '0 0 40px rgba(0, 212, 255, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
