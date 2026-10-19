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
        night: '#0f0b17',
        /** sempre branco (quadro de desenho, botão do Google) */
        paper: '#ffffff',
        lime: { 300: '#dcff6b', 400: '#c6f432', 500: '#a8d61a' },
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
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        chunky: '0 4px 0 0 rgba(0,0,0,0.45)',
        'chunky-sm': '0 2px 0 0 rgba(0,0,0,0.45)',
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
