/**
 * Feature 6: Keyboard shortcuts help modal
 */
export default function ShortcutsHelp({ isOpen, onClose, isRoomOwner }) {
    if (!isOpen) return null;

    const shortcuts = [
        ...(isRoomOwner ? [
            { key: 'Space', desc: 'Play / Pause' },
            { key: '→', desc: 'Skip song' },
        ] : []),
        { key: '?', desc: 'Toggle this help' },
        { key: 'Esc', desc: 'Close modal' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60" />
            <div
                className="glass-card p-6 w-full max-w-sm relative animate-fade-in z-10"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-semibold">⌨️ Keyboard Shortcuts</h3>
                    <button onClick={onClose} className="btn-ghost p-1.5">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-2">
                    {shortcuts.map(s => (
                        <div key={s.key} className="flex items-center justify-between py-1.5">
                            <span className="text-sm text-text-secondary">{s.desc}</span>
                            <kbd className="px-2.5 py-1 bg-card rounded-lg border border-border text-xs font-mono text-text-primary">
                                {s.key}
                            </kbd>
                        </div>
                    ))}
                </div>

                {!isRoomOwner && (
                    <p className="text-xs text-text-muted mt-4 pt-3 border-t border-border/50">
                        Player controls are available only for the room owner.
                    </p>
                )}
            </div>
        </div>
    );
}
