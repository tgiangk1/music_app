/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
    return ({ opacityValue }) => {
        if (opacityValue !== undefined) {
            return `rgba(var(${variableName}), ${opacityValue})`;
        }
        return `rgb(var(${variableName}))`;
    };
}

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                base: withOpacity('--color-base'),
                surface: withOpacity('--color-surface'),
                card: withOpacity('--color-card'),
                'card-hover': withOpacity('--color-card-hover'),
                border: withOpacity('--color-border'),
                'border-glow': withOpacity('--color-border-glow'),
                primary: withOpacity('--color-primary'),
                'primary-hover': withOpacity('--color-primary-hover'),
                'primary-glow': 'rgba(139, 92, 246, 0.19)',
                accent: withOpacity('--color-accent'),
                'text-primary': withOpacity('--color-text-primary'),
                'text-secondary': withOpacity('--color-text-secondary'),
                'text-muted': withOpacity('--color-text-muted'),
                success: withOpacity('--color-success'),
                danger: withOpacity('--color-danger'),
                warning: withOpacity('--color-warning'),
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
