import { useEffect, useRef, useState, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '../../hooks/usePlayer';
import { usePlayerStore } from '../../store/playerStore';
import api from '../../lib/api';

export default function PlayerComponent({
    videoId,
    playerState,
    currentTime,
    currentSong,
    isRoomOwner,
    repeatMode,
    source = 'youtube',
    spotifyUri,
    emitPlayerSync,
    emitPlayerSkip,
    emitPlayerEnded,
}) {
    const { onReady, onStateChange, onError, seekTo, opts } = usePlayer({
        emitPlayerSync,
        emitPlayerEnded,
        isAdmin: isRoomOwner,
        repeatMode,
    });

    const syncedRef = useRef(false);
    const playerRef = useRef(null);

    // Spotify Web Playback SDK
    const spotifyPlayerRef = useRef(null);
    const spotifyDeviceIdRef = useRef(null);
    const [spotifyReady, setSpotifyReady] = useState(false);
    const [spotifyPlaying, setSpotifyPlaying] = useState(false);
    const [spotifyError, setSpotifyError] = useState(null);
    const spotifyTokenRef = useRef(null);

    // Volume Control — local state, persisted in localStorage
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('jukebox_volume');
        return saved !== null ? parseInt(saved, 10) : 70;
    });
    const [isMuted, setIsMuted] = useState(false);
    const [showVolume, setShowVolume] = useState(false);

    // ============================================================
    // Spotify Web Playback SDK — Init + Play
    // ============================================================

    // Load Spotify SDK script (once)
    useEffect(() => {
        if (document.getElementById('spotify-sdk')) return;
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
    }, []);

    // Initialize Spotify Player when SDK is ready
    useEffect(() => {
        if (spotifyPlayerRef.current) return; // already initialized

        const initPlayer = async () => {
            try {
                const tokenRes = await api.get('/api/spotify/token');
                const token = tokenRes.data.accessToken;
                spotifyTokenRef.current = token;

                const player = new window.Spotify.Player({
                    name: 'Antigravity Jukebox',
                    getOAuthToken: async (cb) => {
                        // Refresh token if needed
                        try {
                            const res = await api.get('/api/spotify/token');
                            spotifyTokenRef.current = res.data.accessToken;
                            cb(res.data.accessToken);
                        } catch {
                            cb(spotifyTokenRef.current);
                        }
                    },
                    volume: volume / 100,
                });

                player.addListener('ready', ({ device_id }) => {
                    console.log('🎵 Spotify Player ready, device:', device_id);
                    spotifyDeviceIdRef.current = device_id;
                    setSpotifyReady(true);
                });

                player.addListener('not_ready', () => {
                    console.log('⚠️ Spotify Player not ready');
                    setSpotifyReady(false);
                });

                player.addListener('player_state_changed', (state) => {
                    if (!state) return;
                    setSpotifyPlaying(!state.paused);

                    // Track ended
                    if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
                        if (repeatMode === 'single') {
                            // Replay
                            player.seek(0).then(() => player.resume());
                        } else {
                            emitPlayerEnded?.();
                        }
                    }
                });

                player.addListener('initialization_error', ({ message }) => {
                    console.error('Spotify init error:', message);
                    setSpotifyError('Spotify player could not initialize');
                });

                player.addListener('authentication_error', ({ message }) => {
                    console.error('Spotify auth error:', message);
                    setSpotifyError('Spotify authentication failed — try reconnecting');
                });

                player.addListener('account_error', ({ message }) => {
                    console.error('Spotify account error:', message);
                    setSpotifyError('Spotify Premium is required for playback');
                });

                await player.connect();
                spotifyPlayerRef.current = player;
            } catch (err) {
                console.log('Spotify SDK not available yet or not connected');
            }
        };

        if (window.Spotify) {
            initPlayer();
        } else {
            window.onSpotifyWebPlaybackSDKReady = initPlayer;
        }

        return () => {
            // Don't disconnect on unmount — we want to keep the player alive
        };
    }, []);

    // Play Spotify track when source is spotify
    useEffect(() => {
        if (source !== 'spotify' || !spotifyUri || !spotifyReady) return;

        const playSpotify = async () => {
            try {
                const token = spotifyTokenRef.current || (await api.get('/api/spotify/token')).data.accessToken;
                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceIdRef.current}`, {
                    method: 'PUT',
                    body: JSON.stringify({ uris: [spotifyUri] }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });
                setSpotifyPlaying(true);
                setSpotifyError(null);
            } catch (err) {
                console.error('Spotify play error:', err);
                setSpotifyError('Failed to play on Spotify');
            }
        };

        playSpotify();
    }, [spotifyUri, source, spotifyReady]);

    // Pause Spotify when YouTube starts and vice versa
    useEffect(() => {
        if (source === 'youtube' && spotifyPlayerRef.current) {
            spotifyPlayerRef.current.pause().catch(() => { });
        }
    }, [source, videoId]);

    // ============================================================
    // YouTube Controls
    // ============================================================

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

    // Apply volume to Spotify player
    useEffect(() => {
        if (spotifyPlayerRef.current) {
            spotifyPlayerRef.current.setVolume(isMuted ? 0 : volume / 100).catch(() => { });
        }
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
    };

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

    // Progress bar — poll player for current time
    const [progress, setProgress] = useState({ current: 0, duration: 0 });

    useEffect(() => {
        if (!videoId && !spotifyUri) return;
        const interval = setInterval(async () => {
            if (source === 'spotify' && spotifyPlayerRef.current) {
                try {
                    const state = await spotifyPlayerRef.current.getCurrentState();
                    if (state) {
                        setProgress({
                            current: state.position / 1000,
                            duration: state.duration / 1000,
                        });
                    }
                } catch { }
            } else {
                const player = playerRef.current;
                if (!player) return;
                try {
                    const current = player.getCurrentTime?.() || 0;
                    const duration = player.getDuration?.() || 0;
                    if (duration > 0) {
                        setProgress({ current, duration });
                    }
                } catch { }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [videoId, spotifyUri, source]);

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

    // Source badge component
    const SourceBadge = ({ src }) => (
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${src === 'spotify' ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-red-500/20 text-red-400'
            }`}>
            {src === 'spotify' ? (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
            ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
            )}
            {src === 'spotify' ? 'Spotify' : 'YouTube'}
        </span>
    );

    if (!videoId && source !== 'spotify') {
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
            {/* Player Area — YouTube or Spotify */}
            <div className="aspect-video bg-black relative">
                {source === 'spotify' ? (
                    // Spotify Player View
                    <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #121212 0%, #1a1a2e 50%, #16213e 100%)' }}>
                        <div className="text-center p-6 animate-fade-in">
                            {currentSong?.thumbnail ? (
                                <img
                                    src={currentSong.thumbnail}
                                    alt=""
                                    className={`w-40 h-40 mx-auto rounded-2xl shadow-2xl mb-4 object-cover ${spotifyPlaying ? 'animate-pulse-slow' : ''}`}
                                />
                            ) : (
                                <div className="w-40 h-40 mx-auto rounded-2xl bg-[#1DB954]/20 flex items-center justify-center mb-4">
                                    <svg className="w-16 h-16 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                    </svg>
                                </div>
                            )}
                            <p className="text-white font-medium text-sm truncate max-w-[260px]">{currentSong?.title}</p>
                            <p className="text-white/50 text-xs mt-1">{currentSong?.channel_name}</p>

                            {spotifyError && (
                                <div className="mt-3 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs">
                                    {spotifyError}
                                </div>
                            )}

                            {!spotifyReady && !spotifyError && (
                                <div className="mt-3 flex items-center justify-center gap-2 text-white/50 text-xs">
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Connecting to Spotify...
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // YouTube Player
                    <YouTube
                        videoId={videoId}
                        opts={opts}
                        onReady={handleReady}
                        onStateChange={onStateChange}
                        onError={(e) => {
                            onError(e);
                            import('react-hot-toast').then(m => m.default('⚠️ Video unavailable, skipping...', { icon: '⏭️' }));
                        }}
                        className="w-full h-full"
                        iframeClassName="w-full h-full"
                    />
                )}
            </div>

            {/* Progress Bar */}
            {currentSong && progress.duration > 0 && (
                <div className="px-4 pt-2">
                    <div className="w-full h-1 bg-border/50 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{
                                width: `${(progress.current / progress.duration) * 100}%`,
                                background: source === 'spotify'
                                    ? 'linear-gradient(90deg, #1DB954, #1ed760)'
                                    : 'linear-gradient(90deg, rgb(var(--color-primary, 139 92 246)), rgb(var(--color-accent, 167 139 250)))',
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
                                    src={currentSong.thumbnail || (source === 'youtube' ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '')}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${source === 'spotify' ? 'bg-[#1DB954]' : 'bg-success'
                                }`}>
                                {source === 'spotify' ? (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm4 17c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4-0.9 7.5-.5 10.2 1.2.4.1.5.5.3.9zm1.3-2.9c-.3.4-.7.5-1.1.3-2.8-1.7-7.1-2.2-10.5-1.2-.4.1-.9-.1-1-.5s.1-.9.5-1c3.8-1.1 8.5-.6 11.7 1.4.4.2.5.7.4 1zm.1-3c-3.4-2-9-2.2-12.2-1.2-.5.1-1-.1-1.1-.6-.2-.5.1-1 .6-1.2 3.7-1.1 9.9-.9 13.8 1.4.4.3.6.8.3 1.3-.2.4-.8.6-1.4.3z" />
                                    </svg>
                                ) : (
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{currentSong.title}</p>
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs text-text-muted">
                                    Added by {currentSong.added_by_name}
                                </p>
                                <SourceBadge src={source} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Spotify Play/Pause (for room owner) */}
                        {source === 'spotify' && isRoomOwner && spotifyReady && (
                            <button
                                onClick={() => {
                                    if (spotifyPlaying) {
                                        spotifyPlayerRef.current?.pause();
                                    } else {
                                        spotifyPlayerRef.current?.resume();
                                    }
                                }}
                                className="btn-ghost p-2 text-[#1DB954] hover:text-[#1ed760]"
                                title={spotifyPlaying ? 'Pause' : 'Play'}
                            >
                                {spotifyPlaying ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                        )}

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
                                    className="absolute bottom-full right-0 mb-2 p-3 bg-card border border-border rounded-xl shadow-lg z-50"
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
                                                background: `linear-gradient(to top, ${source === 'spotify' ? '#1DB954' : 'rgb(var(--color-primary))'} ${isMuted ? 0 : volume}%, rgb(var(--color-border)) ${isMuted ? 0 : volume}%)`,
                                            }}
                                        />
                                        <span className="text-[10px] text-text-muted font-mono mt-2">{isMuted ? 0 : volume}</span>
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
