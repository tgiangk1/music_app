import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function EmbedRoom() {
    const { slug } = useParams();
    const [socket, setSocket] = useState(null);
    const [playerState, setPlayerState] = useState(null);
    const [roomName, setRoomName] = useState('Loading Room...');
    const [hostName, setHostName] = useState('');

    const [ytPlayer, setYtPlayer] = useState(null);
    const syncInterval = useRef(null);

    useEffect(() => {
        // Embed clients act as purely listeners without Auth tokens or user records (Guest mode)
        const newSocket = io(`${SOCKET_URL}/room/${slug}`, {
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log(`🔌 Embed Connected to room: ${slug}`);
        });

        newSocket.on('room:info', (room) => {
            if (room?.name) setRoomName(room.name);
            if (room?.creator_name) setHostName(room.creator_name);
        });

        newSocket.on('player:sync', (state) => {
            setPlayerState(state);
        });

        // Some basic tracking info could be emitted, but we'll keep it strictly read-only
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [slug]);

    const onReady = (e) => {
        setYtPlayer(e.target);
    };

    // Synchronization logic for read-only embed
    useEffect(() => {
        if (!ytPlayer || !playerState) return;

        const syncPlayer = () => {
            const { videoId, state, currentTime, updatedAt } = playerState;

            // If video changed
            const currentPlayerVideoId = ytPlayer.getVideoData()?.video_id;
            if (currentPlayerVideoId !== videoId) {
                ytPlayer.loadVideoById(videoId, currentTime);
                if (state === 'playing') ytPlayer.playVideo();
                else ytPlayer.pauseVideo();
                return;
            }

            // Time sync calculation
            const now = Date.now();
            const elapsedSinceUpdate = (now - new Date(updatedAt).getTime()) / 1000;
            const expectedTime = state === 'playing' ? currentTime + elapsedSinceUpdate : currentTime;

            try {
                const actualTime = ytPlayer.getCurrentTime();
                const drift = Math.abs(actualTime - expectedTime);

                if (state === 'playing') {
                    if (ytPlayer.getPlayerState() !== YouTube.PlayerState.PLAYING) {
                        ytPlayer.playVideo();
                    }
                    if (drift > 2.0) {
                        ytPlayer.seekTo(expectedTime, true);
                    }
                } else if (state === 'paused') {
                    if (ytPlayer.getPlayerState() !== YouTube.PlayerState.PAUSED) {
                        ytPlayer.pauseVideo();
                    }
                    if (drift > 1.0) {
                        ytPlayer.seekTo(expectedTime, true);
                    }
                }
            } catch (err) {
                console.warn('Embed Player sync error:', err);
            }
        };

        syncPlayer(); // Initial sync

        syncInterval.current = setInterval(syncPlayer, 2000);

        return () => {
            if (syncInterval.current) clearInterval(syncInterval.current);
        };
    }, [ytPlayer, playerState]);

    const opts = {
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 1,
            controls: 1, // Let users control volume, but playback is forced by sync logic
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
        },
    };

    return (
        <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
            {/* Minimal Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white pointer-events-none">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                        </svg>
                        <span className="font-display font-bold textShadow-sm">{roomName}</span>
                    </div>
                    {hostName && (
                        <span className="text-[10px] text-white/70 ml-7 font-medium tracking-wide">
                            Hosted by {hostName}
                        </span>
                    )}
                </div>
                {playerState?.state === 'playing' ? (
                    <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-medium blink">
                        Live Sync
                    </span>
                ) : (
                    <span className="text-xs bg-surface text-text-muted px-2 py-0.5 rounded-full font-medium">
                        Paused
                    </span>
                )}
            </div>

            {/* Video Player */}
            <div className="flex-1 w-full bg-black relative">
                {!playerState?.videoId ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted space-y-3">
                        <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Waiting for music...</p>
                    </div>
                ) : (
                    <YouTube
                        videoId={playerState.videoId}
                        opts={opts}
                        onReady={onReady}
                        className="w-full h-full"
                        iframeClassName="w-full h-full pointer-events-auto"
                    />
                )}
            </div>

            {/* Click Interceptor (Prevents pausing video by clicking on it) */}
            <div className="absolute inset-x-0 bottom-16 top-14 z-20 pointer-events-auto cursor-default" onClick={(e) => {
                e.preventDefault();
                // Block clicks to the YouTube iframe center so they can't manually pause
                // But leave top/bottom open for volume/fullscreen controls
            }} />
        </div>
    );
}
