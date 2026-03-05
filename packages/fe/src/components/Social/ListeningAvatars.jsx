/**
 * Feature 3: "Ai đang nghe" — Listening Avatars
 * Stacked avatar bubbles showing who's currently in the room
 */
export default function ListeningAvatars({ members = [] }) {
    const maxShow = 5;
    const shown = members.slice(0, maxShow);
    const overflow = members.length - maxShow;

    if (members.length === 0) return null;

    return (
        <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
                {shown.map((m, i) => (
                    <div
                        key={m.userId}
                        className="relative group"
                        style={{ zIndex: maxShow - i }}
                    >
                        <img
                            src={m.avatar || `https://ui-avatars.com/api/?name=${m.displayName}&background=random&size=32`}
                            alt={m.displayName}
                            className="w-8 h-8 rounded-full border-2 border-surface ring-1 ring-border/30 transition-transform group-hover:scale-110 group-hover:z-50"
                        />
                        {/* Listening pulse indicator */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border border-surface">
                            <span className="absolute inset-0 bg-success rounded-full animate-ping opacity-50" />
                        </span>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded-lg text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {m.displayName}
                        </div>
                    </div>
                ))}

                {overflow > 0 && (
                    <div className="w-8 h-8 rounded-full bg-card border-2 border-surface flex items-center justify-center text-xs font-semibold text-text-muted">
                        +{overflow}
                    </div>
                )}
            </div>

            <span className="text-xs text-text-muted hidden sm:inline">
                {members.length} listening
            </span>
        </div>
    );
}
