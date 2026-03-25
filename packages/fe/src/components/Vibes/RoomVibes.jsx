import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const VIBE_PRESETS = {
    none: { label: 'None', emoji: '🔇', bars: false, bg: false },
    chill: { label: 'Chill', emoji: '🌊', colors: ['#4F46E5', '#7C3AED', '#2563EB'], speed: 2.5, bars: true, bg: true },
    party: { label: 'Party', emoji: '🎉', colors: ['#F43F5E', '#EC4899', '#F59E0B'], speed: 0.8, bars: true, bg: true },
    lofi: { label: 'Lo-Fi', emoji: '☕', colors: ['#92400E', '#78716C', '#A16207'], speed: 4, bars: true, bg: true },
    neon: { label: 'Neon', emoji: '💜', colors: ['#A855F7', '#06B6D4', '#10B981'], speed: 1.5, bars: true, bg: true },
    sunset: { label: 'Sunset', emoji: '🌅', colors: ['#FB923C', '#F43F5E', '#A855F7'], speed: 3, bars: true, bg: true },
};

const BAR_COUNT = 24;

export function AudioVisualizer({ vibe = 'chill', isPlaying = false }) {
    const preset = VIBE_PRESETS[vibe] || VIBE_PRESETS.chill;

    if (!preset.bars || !isPlaying) {
        return null;
    }

    return (
        <div className="flex items-end gap-[2px] h-8 px-1">
            {Array.from({ length: BAR_COUNT }, (_, i) => {
                const delay = (i * 0.08) % 1.2;
                const baseHeight = 20 + Math.sin(i * 0.7) * 30;
                const colorIndex = i % preset.colors.length;
                return (
                    <motion.div
                        key={i}
                        className="flex-1 rounded-t-sm min-w-[2px]"
                        style={{
                            backgroundColor: preset.colors[colorIndex],
                            opacity: 0.7,
                        }}
                        animate={{
                            height: isPlaying
                                ? [`${baseHeight}%`, `${Math.min(100, baseHeight + 50)}%`, `${baseHeight}%`]
                                : `${baseHeight * 0.3}%`,
                        }}
                        transition={{
                            duration: preset.speed * (0.4 + Math.random() * 0.4),
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay,
                        }}
                    />
                );
            })}
        </div>
    );
}

export function VibeBackground({ vibe = 'none' }) {
    const preset = VIBE_PRESETS[vibe] || VIBE_PRESETS.none;

    if (!preset.bg) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.07]">
            {preset.colors.map((color, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full blur-3xl"
                    style={{
                        width: `${300 + i * 100}px`,
                        height: `${300 + i * 100}px`,
                        background: `radial-gradient(circle, ${color}80, transparent 70%)`,
                    }}
                    animate={{
                        x: [0, 100 * (i % 2 === 0 ? 1 : -1), 0],
                        y: [0, 80 * (i % 2 === 0 ? -1 : 1), 0],
                    }}
                    transition={{
                        duration: preset.speed * 4 + i * 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                    initial={{
                        left: `${20 + i * 25}%`,
                        top: `${15 + i * 20}%`,
                    }}
                />
            ))}
        </div>
    );
}

export function VibeSelector({ currentVibe, onSelect }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-card transition-colors text-sm"
                title="Room Vibe"
            >
                <span>{VIBE_PRESETS[currentVibe]?.emoji || '🎶'}</span>
                <span className="hidden sm:inline text-text-secondary text-xs">
                    {VIBE_PRESETS[currentVibe]?.label || 'Vibe'}
                </span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[140px] animate-fade-in">
                        {Object.entries(VIBE_PRESETS).map(([key, preset]) => (
                            <button
                                key={key}
                                onClick={() => {
                                    onSelect(key);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${currentVibe === key
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-surface text-text-secondary'
                                    }`}
                            >
                                <span>{preset.emoji}</span>
                                <span>{preset.label}</span>
                                {currentVibe === key && (
                                    <svg className="w-3.5 h-3.5 ml-auto text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export { VIBE_PRESETS };
