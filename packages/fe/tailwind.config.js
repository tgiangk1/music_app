/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                base: '#0a0a0f',
                surface: '#13131a',
                card: '#1a1a24',
                'card-hover': '#1f1f2e',
                border: '#2a2a3d',
                'border-glow': 'rgba(139, 92, 246, 0.25)',
                primary: '#8b5cf6',
                'primary-hover': '#7c3aed',
                'primary-glow': 'rgba(139, 92, 246, 0.19)',
                accent: '#a78bfa',
                'text-primary': '#f5f3ff',
                'text-secondary': '#a1a1aa',
                'text-muted': '#52525b',
                success: '#10b981',
                danger: '#ef4444',
                warning: '#f59e0b',
                'badge-admin': '#f59e0b',
                'badge-member': '#6b7280',
            },
            fontFamily: {
                display: ['Syne', 'sans-serif'],
                body: ['DM Sans', 'sans-serif'],
            },
            boxShadow: {
                'glow': '0 0 0 1px rgba(139, 92, 246, 0.25), 0 0 20px rgba(139, 92, 246, 0.12)',
                'glow-lg': '0 0 0 1px rgba(139, 92, 246, 0.35), 0 0 40px rgba(139, 92, 246, 0.2)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in': 'slideIn 0.2s ease-out',
                'fade-in': 'fadeIn 0.3s ease-out',
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
