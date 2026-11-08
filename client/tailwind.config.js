/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'Source Serif 4', 'Lora', 'serif'],
        sans: ['Inter', 'Geist Variable', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        paper: {
          50: '#fdfbf7',
          100: '#faf7f0',
          200: '#f7f4ee',
          300: '#efe9df',
          400: '#dcd5c4',
        },
        exam: {
          border: '#dcd5c4',
          card: '#fdfbf7',
          ink: '#1f1b16',
          secondary: '#5e554a',
          muted: '#7b7266',
          accent: '#8c4a17',
          warn: '#b8622e',
          positive: '#3f6b4a',
          negative: '#dc2626',
        }
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      transitionTimingFunction: {
        'unslop': 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    },
  },
  plugins: [],
}
