/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        rose: {
          light: '#e8c4c8',
          soft: '#d4a0a7',
          main: '#b76e79',
        },
        violet: {
          soft: '#a78bfa',
          deep: '#6b3fa0',
        },
        gold: {
          light: '#f0c27f',
          gold: '#e5b96b',
        },
        bgdark: {
          DEFAULT: '#0d0a1a',
          2: '#1a1130',
        },
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        ruqaa: ['"Aref Ruqaa"', 'serif'],
      },
      animation: {
        scaleIn: 'scaleIn .5s ease-out',
        shimmer: 'shimmer 4s linear infinite',
        floatName: 'floatName 4s ease-in-out infinite',
      },
      keyframes: {
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        floatName: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
