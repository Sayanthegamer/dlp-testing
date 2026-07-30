/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        paper: {
          50: '#fcfbfa',
          100: '#fbf9f5',
          200: '#f7f3ec',
          300: '#eee6da',
          400: '#d5c7b3',
        },
        exam: {
          border: '#dcd6cd',
          card: '#fffdfa',
          ink: '#1c1b18',
          subtle: '#666158',
          accent: '#c97a2b', // Soft warm amber accent for review alerts
          accentBg: '#fef8ef',
        }
      }
    },
  },
  plugins: [],
}
