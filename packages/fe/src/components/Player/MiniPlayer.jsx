import { usePlayerStore } from '../../store/playerStore';

/**
 * Feature 4: Mini Player
 * Sticky bottom bar that appears when the main player is scrolled out of view
 */
export default function MiniPlayer({
    currentSong,
    isRoomOwner,
    isVisible,
    emitPlayerSkip,
}) {
    const playerState = usePlayerStore();

    if (!isVisible || !currentSong || !playerState.videoId) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border animate-slide-up">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-card relative">
                    <img
                        src={currentSong.thumbnail || `https://img.youtube.com/vi/${playerState.videoId}/default.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {playerState.state === 'playing' ? (
                            <div className="flex gap-0.5">
                                <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                <span className="w-0.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 h-2.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                        ) : (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{currentSong.title}</p>
                    <p className="text-xs text-text-muted truncate">
                        {currentSong.added_by_name || 'Unknown'}
                    </p>
                </div>

                {/* Controls */}
                {isRoomOwner && (
                    <button
                        onClick={emitPlayerSkip}
                        className="flex-shrink-0 p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Skip song"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                        </svg>
                    </button>
                )}

                {/* Scroll to player */}
                <button
                    onClick={() => document.getElementById('main-player')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-shrink-0 p-2 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
                    title="Scroll to player"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
