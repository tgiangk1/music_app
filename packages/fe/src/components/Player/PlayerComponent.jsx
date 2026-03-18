import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '../../hooks/usePlayer';
import { usePlayerStore } from '../../store/playerStore';
import AudioVisualizer, { VISUALIZER_MODES } from './AudioVisualizer';

export default function PlayerComponent({
    videoId,
    playerState,
    currentTime,
    currentSong,
    isRoomOwner,
    repeatMode,
    emitPlayerSync,
    emitPlayerSkip,
    emitPlayerEnded,
}) {
    const { onReady, onStateChange, onError, opts } = usePlayer({
        emitPlayerSync,
        emitPlayerEnded,
        isRoomOwner,
        repeatMode,
    });

    const syncedRef = useRef(false);
    const playerRef = useRef(null);
    const [startAt, setStartAt] = useState(0);

    // Capture sync time for YouTube start parameter (set once per video)
    useEffect(() => {
        if (currentTime > 0 && !syncedRef.current) {
            setStartAt(Math.floor(currentTime));
            syncedRef.current = true;
        }
    }, [currentTime]);

    // Reset on video change
    useEffect(() => {
        syncedRef.current = false;
        setStartAt(0);
    }, [videoId]);

    // Build opts with start parameter — YouTube will natively load at this position
    const playerOpts = useMemo(() => ({
        ...opts,
        playerVars: {
            ...opts.playerVars,
            start: startAt > 0 ? startAt : undefined,
        },
    }), [opts, startAt]);

    // Volume Control — local state, persisted in localStorage
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('jukebox_volume');
        return saved !== null ? parseInt(saved, 10) : 70;
    });
    const [isMuted, setIsMuted] = useState(false);
    const [showVolume, setShowVolume] = useState(false);

    // Visualizer state
    const [showVisualizer, setShowVisualizer] = useState(() => localStorage.getItem('jukebox_visualizer') !== 'off');
    const [visualizerMode, setVisualizerMode] = useState(() => localStorage.getItem('jukebox_viz_mode') || 'bars');
    const [vizColorScheme, setVizColorScheme] = useState(() => localStorage.getItem('jukebox_viz_color') || 'neon');

    // Apply volume to YouTube player
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        try {
            if (isMuted) {
                player.mute();
            } else {
                player.unMute();
                player.setVolume(volume);
            }
        } catch { }
    }, [volume, isMuted]);

    // Save volume to localStorage
    useEffect(() => {
        localStorage.setItem('jukebox_volume', volume.toString());
    }, [volume]);

    const handleVolumeChange = (e) => {
        const val = parseInt(e.target.value, 10);
        setVolume(val);
        setIsMuted(false);
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    // Override onReady to capture player ref and set initial volume
    const handleReady = (event) => {
        playerRef.current = event.target;
        try {
            event.target.setVolume(volume);
            if (isMuted) event.target.mute();
        } catch { }
        onReady(event);

        // Fallback: if sync data arrives after YouTube loaded, use loadVideoById
        if (!syncedRef.current) {
            setTimeout(() => {
                const latestState = usePlayerStore.getState();
                if (latestState.currentTime > 0 && !syncedRef.current) {
                    syncedRef.current = true;
                    event.target.loadVideoById({
                        videoId: videoId,
                        startSeconds: Math.floor(latestState.currentTime),
                    });
                }
            }, 2000);
        }
    };

    // Progress bar — poll YouTube player for current time
    const [progress, setProgress] = useState({ current: 0, duration: 0 });

    useEffect(() => {
        if (!videoId) return;
        const interval = setInterval(() => {
            const player = playerRef.current;
            if (!player) return;
            try {
                const current = player.getCurrentTime?.() || 0;
                const duration = player.getDuration?.() || 0;
                if (duration > 0) {
                    setProgress({ current, duration });
                }
            } catch { }
        }, 1000);
        return () => clearInterval(interval);
    }, [videoId]);

    const formatTime = useCallback((seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }, []);

    // Volume icon based on level
    const VolumeIcon = () => {
        if (isMuted || volume === 0) {
            return (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-3.15a.75.75 0 0 1 1.28.53v13.774a.75.75 0 0 1-1.28.53L6.75 14.25H3.75a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75h3Z" />
                </svg>
            );
        }
        if (volume < 50) {
            return (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M6.75 8.25l4.72-3.15a.75.75 0 0 1 1.28.53v12.74a.75.75 0 0 1-1.28.53l-4.72-3.15H3.75a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75h3Z" />
                </svg>
            );
        }
        return (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-3.15a.75.75 0 0 1 1.28.53v12.74a.75.75 0 0 1-1.28.53l-4.72-3.15H3.75a.75.75 0 0 1-.75-.75v-3a.75.75 0 0 1 .75-.75h3Z" />
            </svg>
        );
    };

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
                    opts={playerOpts}
                    onReady={handleReady}
                    onStateChange={onStateChange}
                    onError={(e) => {
                        onError(e);
                        import('react-hot-toast').then(m => m.default('⚠️ Video unavailable, skipping...', { icon: '⏭️' }));
                    }}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                />
                {/* Audio Visualizer Overlay */}
                {showVisualizer && (
                    <AudioVisualizer
                        isPlaying={playerState === 'playing'}
                        mode={visualizerMode}
                        colorScheme={vizColorScheme}
                    />
                )}
                {/* Visualizer Controls */}
                <div className="absolute bottom-2 left-2 z-20 flex gap-1">
                    <button
                        onClick={() => {
                            const next = !showVisualizer;
                            setShowVisualizer(next);
                            localStorage.setItem('jukebox_visualizer', next ? 'on' : 'off');
                        }}
                        className={`p-1.5 rounded-lg text-xs backdrop-blur-sm transition-all ${
                            showVisualizer ? 'bg-primary/30 text-white' : 'bg-black/40 text-white/60 hover:text-white'
                        }`}
                        title="Toggle Visualizer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                        </svg>
                    </button>
                    {showVisualizer && (
                        <>
                            <button
                                onClick={() => {
                                    const idx = VISUALIZER_MODES.indexOf(visualizerMode);
                                    const next = VISUALIZER_MODES[(idx + 1) % VISUALIZER_MODES.length];
                                    setVisualizerMode(next);
                                    localStorage.setItem('jukebox_viz_mode', next);
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/40 text-white/80 hover:text-white backdrop-blur-sm transition-all uppercase"
                                title="Change mode"
                            >
                                {visualizerMode}
                            </button>
                            <button
                                onClick={() => {
                                    const schemes = ['neon', 'sunset', 'ocean', 'primary'];
                                    const idx = schemes.indexOf(vizColorScheme);
                                    const next = schemes[(idx + 1) % schemes.length];
                                    setVizColorScheme(next);
                                    localStorage.setItem('jukebox_viz_color', next);
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/40 text-white/80 hover:text-white backdrop-blur-sm transition-all"
                                title="Change colors"
                            >
                                🎨 {vizColorScheme}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {currentSong && progress.duration > 0 && (
                <div className="px-4 pt-2">
                    <div className="w-full h-1 bg-border/50 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{
                                width: `${(progress.current / progress.duration) * 100}%`,
                                background: 'linear-gradient(90deg, rgb(var(--color-primary, 139 92 246)), rgb(var(--color-accent, 167 139 250)))',
                            }}
                        />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-text-muted font-mono">{formatTime(progress.current)}</span>
                        <span className="text-[10px] text-text-muted font-mono">{formatTime(progress.duration)}</span>
                    </div>
                </div>
            )}

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

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Volume Control */}
                        <div
                            className="relative flex items-center"
                            onMouseEnter={() => setShowVolume(true)}
                            onMouseLeave={() => setShowVolume(false)}
                        >
                            <button
                                onClick={toggleMute}
                                className="btn-ghost p-2 text-text-secondary hover:text-text-primary"
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                <VolumeIcon />
                            </button>

                            {/* Volume Slider Popup */}
                            {showVolume && (
                                <div
                                    className="absolute bottom-full right-0 pb-0 z-50"
                                >
                                    {/* Invisible bridge to prevent hover gap */}
                                    <div className="absolute bottom-0 left-0 w-full h-2 bg-transparent" />
                                    <div
                                        className="p-3 bg-card border border-border rounded-xl shadow-lg"
                                        style={{ width: '40px', height: '130px' }}
                                    >
                                        <div className="w-full flex flex-col items-center h-full">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={isMuted ? 0 : volume}
                                                onChange={handleVolumeChange}
                                                className="volume-slider-vertical"
                                                style={{
                                                    writingMode: 'vertical-lr',
                                                    direction: 'rtl',
                                                    width: '4px',
                                                    height: '80px',
                                                    margin: '0',
                                                    background: `linear-gradient(to top, rgb(var(--color-primary)) ${isMuted ? 0 : volume}%, rgb(var(--color-border)) ${isMuted ? 0 : volume}%)`,
                                                }}
                                            />
                                            <span className="text-[10px] text-text-muted font-mono mt-2">{isMuted ? 0 : volume}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                </div>
            )}
        </div>
    );
}
