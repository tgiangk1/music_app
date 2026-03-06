import { useState, useCallback, useEffect, useRef } from 'react';

const EMOJIS = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];

/**
 * Feature 1: Live Emoji Reactions
 * Floating emojis that broadcast in realtime and animate up + fade out
 */
export default function EmojiReactions({ socket }) {
    const [reactions, setReactions] = useState([]); // { id, emoji, x }
    const [showBar, setShowBar] = useState(false);
    const containerRef = useRef(null);

    // Listen for broadcast reactions
    useEffect(() => {
        if (!socket) return;

        const handler = (data) => {
            const x = 10 + Math.random() * 80; // random 10-90% horizontal position
            setReactions(prev => [...prev.slice(-30), { ...data, x }]); // keep max 30
        };

        socket.on('reaction:broadcast', handler);
        return () => socket.off('reaction:broadcast', handler);
    }, [socket]);

    // Auto-remove reactions after animation (2s)
    useEffect(() => {
        if (reactions.length === 0) return;
        const timer = setTimeout(() => {
            setReactions(prev => prev.slice(1));
        }, 2200);
        return () => clearTimeout(timer);
    }, [reactions]);

    const sendReaction = useCallback((emoji) => {
        socket?.emit('reaction:send', { emoji });
    }, [socket]);

    return (
        <>
            {/* Floating reactions overlay */}
            <div
                ref={containerRef}
                className="absolute inset-0 pointer-events-none overflow-hidden z-10"
            >
                {reactions.map((r) => (
                    <span
                        key={r.id}
                        className="emoji-float absolute text-2xl sm:text-3xl"
                        style={{ left: `${r.x}%`, bottom: '10%' }}
                    >
                        {r.emoji}
                    </span>
                ))}
            </div>

            {/* Reaction bar toggle */}
            <div className="relative">
                <button
                    onClick={() => setShowBar(prev => !prev)}
                    className="p-2 rounded-xl hover:bg-card transition-colors text-xl"
                    title="React"
                >
                    🔥
                </button>

                {showBar && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
                        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-2 flex gap-1 animate-fade-in">
                            {EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => sendReaction(emoji)}
                                    className="text-xl sm:text-2xl p-1.5 rounded-xl hover:bg-card-hover hover:scale-125 transition-all"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
