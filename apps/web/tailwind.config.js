/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0f0b17',
          900: '#16121f',
          800: '#211a2e',
          700: '#2d2440',
          600: '#3d3257',
          400: '#8c80a8',
          200: '#d6cfe6',
        },
        lime: { 300: '#dcff6b', 400: '#c6f432', 500: '#a8d61a' },
        pop: {
          pink: '#ff5fa2',
          sky: '#5cc8ff',
          amber: '#ffc23d',
          violet: '#a98bff',
          rose: '#ff7a6b',
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
