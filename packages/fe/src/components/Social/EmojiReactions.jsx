import { useState, useCallback, useEffect, useRef } from 'react';

const EMOJIS = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];

/**
 * Floating emoji overlay — renders on the player area
 * Only listens for broadcast events and displays floating emojis
 */
export function EmojiOverlay({ socket }) {
    const [reactions, setReactions] = useState([]); // { id, emoji, x }
    const containerRef = useRef(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            const x = 10 + Math.random() * 80;
            setReactions(prev => [...prev.slice(-30), { ...data, x }]);
        };
        socket.on('reaction:broadcast', handler);
        return () => socket.off('reaction:broadcast', handler);
    }, [socket]);

    useEffect(() => {
        if (reactions.length === 0) return;
        const timer = setTimeout(() => {
            setReactions(prev => prev.slice(1));
        }, 2200);
        return () => clearTimeout(timer);
    }, [reactions]);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-10">
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
    );
}

/**
 * Emoji trigger button — inline, meant to sit next to chat input
 */
export function EmojiTrigger({ socket }) {
    const [showBar, setShowBar] = useState(false);

    const sendReaction = useCallback((emoji) => {
        socket?.emit('reaction:send', { emoji });
    }, [socket]);

    return (
        <div className="relative">
            <button
                onClick={() => setShowBar(prev => !prev)}
                className="p-2 rounded-lg hover:bg-card-hover transition-colors text-lg"
                title="React"
            >
                🔥
            </button>

            {showBar && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
                    <div className="bg-card border border-border rounded-2xl p-2 flex gap-1 animate-fade-in">
                        {EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                className="text-xl p-1.5 rounded-xl hover:bg-card-hover hover:scale-110 transition-all"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Default export for backward compatibility
export default function EmojiReactions({ socket }) {
    return (
        <>
            <EmojiOverlay socket={socket} />
            <EmojiTrigger socket={socket} />
        </>
    );
}
