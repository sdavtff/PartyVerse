/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
        },
        /** texto principal: branco no tema escuro, quase preto no claro */
        white: 'rgb(var(--fg) / <alpha-value>)',
        /** sempre escuro (texto sobre botões coloridos, contornos) */
        night: '#0c0a16',
        /** sempre branco (quadro de desenho, botão do Google) */
        paper: '#ffffff',
        /** cor de destaque (o nome ficou de versões antigas): violeta neon */
        lime: { 300: '#c4b1ff', 400: '#a585ff', 500: '#8b5cf6' },
        violet: { 400: '#a585ff', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
        pop: {
          pink: '#ff5fa2',
          sky: '#5cc8ff',
          amber: '#ffc23d',
          violet: '#a98bff',
          rose: '#ff7a6b',
          teal: '#3ee0c0',
          orange: '#ff9a3d',
          indigo: '#8f9bff',
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        chunky: '0 10px 30px -14px rgba(0,0,0,0.7)',
        'chunky-sm': '0 6px 16px -10px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(165,133,255,0.35), 0 10px 30px -10px rgba(139,92,246,0.55)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        rise: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wobble: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
      },
      animation: {
        pop: 'pop .25s cubic-bezier(.2,1.4,.4,1) both',
        rise: 'rise .3s ease-out both',
        wobble: 'wobble 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
