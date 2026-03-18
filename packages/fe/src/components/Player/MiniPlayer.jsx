import { usePlayerStore } from '../../store/playerStore';

/**
 * Enhanced Mini Player — Floating bar with progress, PiP, and glow effects
 * Appears when main player is scrolled out of view
 */
export default function MiniPlayer({
    currentSong,
    isRoomOwner,
    isVisible,
    emitPlayerSkip,
    progress,
}) {
    const playerState = usePlayerStore();

    if (!isVisible || !currentSong || !playerState.videoId) return null;

    const progressPercent = progress?.duration > 0
        ? (progress.current / progress.duration) * 100
        : 0;

    const handlePiP = async () => {
        try {
            const iframe = document.querySelector('#main-player iframe');
            if (!iframe) return;
            // PiP is only available on video elements, not iframes
            // Use requestPictureInPicture on a video tag if available
            const video = iframe.contentDocument?.querySelector('video');
            if (video && document.pictureInPictureEnabled) {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await video.requestPictureInPicture();
                }
            }
        } catch (err) {
            console.warn('PiP not available:', err);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
            {/* Progress bar at top */}
            <div className="h-0.5 bg-border/30">
                <div
                    className="h-full transition-all duration-1000 ease-linear"
                    style={{
                        width: `${progressPercent}%`,
                        background: 'linear-gradient(90deg, rgb(var(--color-primary, 139 92 246)), rgb(var(--color-accent, 167 139 250)))',
                    }}
                />
            </div>

            <div className={`bg-surface/95 backdrop-blur-xl border-t border-border ${playerState.state === 'playing' ? 'shadow-[0_-2px_20px_rgba(139,92,246,0.1)]' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
                    {/* Thumbnail with playing animation */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-card relative group">
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
                            {progress?.duration > 0 && (
                                <span className="ml-2 font-mono text-[10px]">
                                    {formatTime(progress.current)} / {formatTime(progress.duration)}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {/* PiP button */}
                        <button
                            onClick={handlePiP}
                            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Picture in Picture"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </button>

                        {isRoomOwner && (
                            <button
                                onClick={emitPlayerSkip}
                                className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
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
                            className="p-2 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
                            title="Scroll to player"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
