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
        primary: {
          50: '#fef7ee',
          100: '#fcecd6',
          200: '#f8d5ac',
          300: '#f3b878',
          400: '#ed9042',
          500: '#e8741e',
          600: '#d95a14',
          700: '#b44313',
          800: '#903617',
          900: '#742f16',
        },
      },
    },
  },
  plugins: [],
};

export default config;
