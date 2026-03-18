import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * 5 dark themes — all tokens as RGB triplets for Tailwind rgb() usage
 */
export const THEMES = {
    'vinyl-bar': {
        id: 'vinyl-bar',
        label: 'Vinyl Bar 2AM',
        icon: '🎷',
        tokens: {
            '--color-base': '24 22 20',
            '--color-surface': '33 30 26',
            '--color-card': '40 36 32',
            '--color-card-hover': '48 44 38',
            '--color-border': '200 168 124',
            '--color-primary': '200 168 124',
            '--color-primary-hover': '184 152 94',
            '--color-accent': '138 173 124',
            '--color-text-primary': '232 224 212',
            '--color-text-secondary': '160 152 136',
            '--color-text-muted': '107 101 96',
            '--color-success': '138 173 124',
            '--color-danger': '196 122 106',
            '--color-warning': '196 169 110',
        },
        bg: '#181614',
    },
    'midnight-jazz': {
        id: 'midnight-jazz',
        label: 'Midnight Jazz',
        icon: '🎹',
        tokens: {
            '--color-base': '18 22 32',
            '--color-surface': '24 29 42',
            '--color-card': '30 37 56',
            '--color-card-hover': '37 45 66',
            '--color-border': '123 156 196',
            '--color-primary': '123 156 196',
            '--color-primary-hover': '100 136 180',
            '--color-accent': '196 152 112',
            '--color-text-primary': '220 226 236',
            '--color-text-secondary': '136 146 164',
            '--color-text-muted': '92 101 120',
            '--color-success': '110 170 140',
            '--color-danger': '196 112 112',
            '--color-warning': '196 170 120',
        },
        bg: '#121620',
    },
    'lofi-garden': {
        id: 'lofi-garden',
        label: 'Lo-fi Garden',
        icon: '🌿',
        tokens: {
            '--color-base': '20 24 22',
            '--color-surface': '26 32 28',
            '--color-card': '33 40 34',
            '--color-card-hover': '42 50 42',
            '--color-border': '138 173 124',
            '--color-primary': '138 173 124',
            '--color-primary-hover': '118 153 104',
            '--color-accent': '196 160 107',
            '--color-text-primary': '220 228 216',
            '--color-text-secondary': '142 160 136',
            '--color-text-muted': '94 106 92',
            '--color-success': '138 173 124',
            '--color-danger': '196 122 106',
            '--color-warning': '196 169 110',
        },
        bg: '#141816',
    },
    'tokyo-neon': {
        id: 'tokyo-neon',
        label: 'Tokyo Neon',
        icon: '🌃',
        tokens: {
            '--color-base': '20 18 26',
            '--color-surface': '26 24 34',
            '--color-card': '33 32 44',
            '--color-card-hover': '42 40 54',
            '--color-border': '160 124 200',
            '--color-primary': '160 124 200',
            '--color-primary-hover': '140 104 180',
            '--color-accent': '124 196 184',
            '--color-text-primary': '224 220 232',
            '--color-text-secondary': '144 138 164',
            '--color-text-muted': '96 92 112',
            '--color-success': '124 196 160',
            '--color-danger': '196 112 112',
            '--color-warning': '196 170 120',
        },
        bg: '#14121a',
    },
    'rainy-cafe': {
        id: 'rainy-cafe',
        label: 'Rainy Café',
        icon: '☕',
        tokens: {
            '--color-base': '22 20 18',
            '--color-surface': '30 26 24',
            '--color-card': '38 34 32',
            '--color-card-hover': '46 42 38',
            '--color-border': '138 180 176',
            '--color-primary': '138 180 176',
            '--color-primary-hover': '118 160 156',
            '--color-accent': '196 136 107',
            '--color-text-primary': '220 216 212',
            '--color-text-secondary': '154 148 136',
            '--color-text-muted': '104 98 96',
            '--color-success': '138 173 140',
            '--color-danger': '196 122 106',
            '--color-warning': '196 169 110',
        },
        bg: '#161412',
    },
};

const DEFAULT_THEME = 'vinyl-bar';
const STORAGE_KEY = 'jukebox_theme';

const ThemeContext = createContext({
    theme: DEFAULT_THEME,
    themeConfig: THEMES[DEFAULT_THEME],
    setTheme: () => { },
    themes: THEMES,
});

export function useTheme() {
    return useContext(ThemeContext);
}

function applyTheme(themeId) {
    const config = THEMES[themeId];
    if (!config) return;

    const root = document.documentElement;
    Object.entries(config.tokens).forEach(([prop, value]) => {
        root.style.setProperty(prop, value);
    });

    // Update body + #root backgrounds
    document.body.style.background = config.bg;
    const rootEl = document.getElementById('root');
    if (rootEl) {
        const [r, g, b] = config.tokens['--color-primary'].split(' ');
        rootEl.style.background = `radial-gradient(ellipse at 50% 0%, rgba(${r},${g},${b},0.04) 0%, transparent 70%), ${config.bg}`;
    }

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', config.bg);
}

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && THEMES[saved] ? saved : DEFAULT_THEME;
    });

    // Apply on mount + on change
    useEffect(() => {
        applyTheme(theme);
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    const setTheme = useCallback((id) => {
        if (THEMES[id]) setThemeState(id);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, themeConfig: THEMES[theme], setTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}
