/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                base: 'rgb(var(--color-base) / <alpha-value>)',
                surface: 'rgb(var(--color-surface) / <alpha-value>)',
                card: 'rgb(var(--color-card) / <alpha-value>)',
                'card-hover': 'rgb(var(--color-card-hover) / <alpha-value>)',
                border: 'rgb(var(--color-border) / 0.08)',
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
                'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
                'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
                'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
                success: 'rgb(var(--color-success) / <alpha-value>)',
                danger: 'rgb(var(--color-danger) / <alpha-value>)',
                warning: 'rgb(var(--color-warning) / <alpha-value>)',
                'badge-admin': 'rgb(var(--color-warning) / <alpha-value>)',
                'badge-member': '#6b6560',
            },
            fontFamily: {
                display: ['Syne', 'sans-serif'],
                body: ['DM Sans', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-up': 'slideUp 0.2s ease-out',
                'slide-in': 'slideIn 0.2s ease-out',
                'fade-in': 'fadeIn 0.2s ease-out',
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
