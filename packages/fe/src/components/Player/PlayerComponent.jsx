import { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '../../hooks/usePlayer';
import { usePlayerStore } from '../../store/playerStore';

export default function PlayerComponent({
    videoId,
    playerState,
    currentTime,
    currentSong,
    isRoomOwner,
    emitPlayerSync,
    emitPlayerSkip,
    emitPlayerEnded,
}) {
    const { onReady, onStateChange, seekTo, opts } = usePlayer({
        emitPlayerSync,
        emitPlayerEnded,
        isAdmin: isRoomOwner,
    });

    const syncedRef = useRef(false);

    // Sync player position when receiving state from server (non-owner members)
    useEffect(() => {
        if (!isRoomOwner && playerState === 'playing' && currentTime > 0 && !syncedRef.current) {
            syncedRef.current = true;
            setTimeout(() => seekTo(currentTime), 500);
        }
    }, [isRoomOwner, playerState, currentTime, seekTo]);

    // Reset sync flag on video change
    useEffect(() => {
        syncedRef.current = false;
    }, [videoId]);

    if (!videoId) {
        return (
            <div className="glass-card overflow-hidden">
                <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-card to-surface">
                    <div className="text-center p-8 animate-fade-in">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg className="w-10 h-10 text-primary animate-pulse-slow" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                            </svg>
                        </div>
                        <h3 className="font-display text-xl font-semibold text-text-secondary mb-2">No song playing</h3>
                        <p className="text-text-muted text-sm">Add a song to the queue to get started!</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card overflow-hidden">
            {/* YouTube Player */}
            <div className="aspect-video bg-black relative">
                <YouTube
                    videoId={videoId}
                    opts={opts}
                    onReady={onReady}
                    onStateChange={onStateChange}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                />
            </div>

            {/* Now Playing Bar */}
            {currentSong && (
                <div className="p-4 flex items-center justify-between border-t border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 relative">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img
                                    src={currentSong.thumbnail || `https://img.youtube.com/vi/${videoId}/default.jpg`}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{currentSong.title}</p>
                            <p className="text-xs text-text-muted">
                                Added by {currentSong.added_by_name}
                            </p>
                        </div>
                    </div>

                    {isRoomOwner && (
                        <button
                            onClick={emitPlayerSkip}
                            className="btn-ghost p-2 text-text-secondary hover:text-danger"
                            title="Skip song"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
