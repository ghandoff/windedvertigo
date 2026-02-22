/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pacific: {
          DEFAULT: '#024a87',
          50:  '#f0f7fc',
          100: '#dfecf8',
          200: '#b8d7f0',
          300: '#84bce5',
          400: '#4a9bd6',
          500: '#2480c4',
          600: '#1466a8',
          700: '#024a87',
          800: '#053d6e',
          900: '#08335b',
          950: '#0a2240',
        },
        nordic: {
          50: '#f0fafb',
          100: '#d9f2f4',
          200: '#b7e5ea',
          300: '#85d1da',
          400: '#4db5c2',
          500: '#2e99a8',
          600: '#287b8e',
          700: '#266474',
          800: '#265361',
          900: '#244653',
          950: '#132d37',
        },
        gold: {
          50: '#fefbe8',
          100: '#fef5c3',
          200: '#fee88a',
          300: '#fed447',
          400: '#fcc015',
          500: '#eca708',
          600: '#cc8004',
          700: '#a35a07',
          800: '#86470e',
          900: '#723b12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
