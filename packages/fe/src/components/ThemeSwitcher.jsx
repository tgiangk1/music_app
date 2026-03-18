import { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES } from './ThemeProvider';

/**
 * Theme switcher dropdown — shows color dots + theme name
 * Positioned relative to trigger button
 */
export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const themeList = Object.values(THEMES);

    // Extract display colors from RGB triplets
    const rgbToHex = (rgb) => {
        const [r, g, b] = rgb.split(' ').map(Number);
        return `rgb(${r},${g},${b})`;
    };

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setOpen(prev => !prev)}
                className="p-2 rounded-lg hover:bg-card-hover transition-colors flex items-center gap-1.5"
                title="Switch theme"
            >
                <div className="flex gap-0.5">
                    <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: rgbToHex(THEMES[theme].tokens['--color-primary']) }}
                    />
                    <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: rgbToHex(THEMES[theme].tokens['--color-accent']) }}
                    />
                </div>
                <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-xl p-1.5 min-w-[200px] animate-fade-in shadow-xl">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted px-2 py-1 font-mono">Theme</p>
                    {themeList.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setTheme(t.id); setOpen(false); }}
                            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors text-left
                                ${theme === t.id ? 'bg-surface text-text-primary' : 'text-text-secondary hover:bg-card-hover hover:text-text-primary'}`}
                        >
                            {/* Color dots */}
                            <div className="flex gap-1 flex-shrink-0">
                                <span className="w-3 h-3 rounded-full" style={{ background: t.bg }} />
                                <span className="w-3 h-3 rounded-full" style={{ background: rgbToHex(t.tokens['--color-primary']) }} />
                                <span className="w-3 h-3 rounded-full" style={{ background: rgbToHex(t.tokens['--color-accent']) }} />
                            </div>
                            {/* Label */}
                            <span className="text-sm font-medium truncate">{t.label}</span>
                            {/* Active indicator */}
                            {theme === t.id && (
                                <svg className="w-4 h-4 text-primary ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
