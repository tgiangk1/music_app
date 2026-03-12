import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { useSocket } from '../hooks/useSocket';
import { useQueue } from '../hooks/useQueue';
import { useNotifications } from '../hooks/useNotifications';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import PlayerComponent from '../components/Player/PlayerComponent';
import MiniPlayer from '../components/Player/MiniPlayer';
import QueueList from '../components/Queue/QueueList';
import QueueHistory from '../components/Queue/QueueHistory';
import AddSong from '../components/AddSong/AddSong';
import MembersList from '../components/Members/MembersList';
import ShortcutsHelp from '../components/ShortcutsHelp';
// Social components
import EmojiReactions from '../components/Social/EmojiReactions';
import ChatBox from '../components/Social/ChatBox';

import ActivityFeed from '../components/Social/ActivityFeed';
import LyricsPanel from '../components/Social/LyricsPanel';
import RoomStats from '../components/Social/RoomStats';
import { useTheme } from '../components/ThemeProvider';
import { generateQRCode } from '../lib/qrcode';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Room() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user, isLoading: authLoading } = useAuthStore();
    const playerState = usePlayerStore();
    const [room, setRoom] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showMembers, setShowMembers] = useState(false);
    const [queueTab, setQueueTab] = useState('queue'); // 'queue' | 'history'
    const [showMiniPlayer, setShowMiniPlayer] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [repeatMode, setRepeatMode] = useState(() => localStorage.getItem('jukebox_repeat') || 'off'); // 'off' | 'single' | 'queue'
    const playerSectionRef = useRef(null);
    const qrCanvasRef = useRef(null);
    const profileMenuRef = useRef(null);
    const { theme, toggleTheme } = useTheme();

    const isGuest = !user && !authLoading;
    const isAdmin = user?.role === 'admin';

    const {
        socket,
        isConnected,
        onlineMembers,
        emitPlayerSync,
        emitPlayerSkip,
        emitPlayerEnded,
    } = useSocket(slug);

    const {
        songs,
        isLoading: queueLoading,
        addSong,
        removeSong,
        clearQueue,
        reorderQueue,
    } = useQueue(slug);

    // Browser notifications (only for logged-in users)
    const { requestPermission, notify } = useNotifications();

    useEffect(() => {
        if (!isGuest) requestPermission();
    }, [requestPermission, isGuest]);

    // Fetch room details
    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}`)
            .then(res => {
                setRoom(res.data.room);
                setIsLoading(false);
            })
            .catch(err => {
                if (err.response?.status === 403) toast.error('You do not have access to this room');
                else if (err.response?.status === 404) toast.error('Room not found');
                navigate(isGuest ? '/login' : '/');
            });
    }, [slug, navigate]);

    // Fetch initial player state
    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}/player`)
            .then(res => {
                if (res.data.player) usePlayerStore.getState().setPlayerState(res.data.player);
            })
            .catch(() => { });
    }, [slug]);

    // Mini Player — Intersection Observer
    useEffect(() => {
        const el = playerSectionRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setShowMiniPlayer(!entry.isIntersecting),
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [isLoading]);

    const isRoomOwner = room?.isOwner || room?.created_by === user?.id || isAdmin;

    // Keyboard shortcuts
    const { showHelp, setShowHelp } = useKeyboardShortcuts({
        isRoomOwner,
        emitPlayerSync,
        emitPlayerSkip,
        videoId: playerState.videoId,
        playerState: playerState.state,
    });

    const currentSong = songs.find(s => s.is_playing);
    const queue = songs.filter(s => !s.is_playing);

    // Repeat mode toggle
    const cycleRepeatMode = () => {
        const next = repeatMode === 'off' ? 'single' : repeatMode === 'single' ? 'queue' : 'off';
        setRepeatMode(next);
        localStorage.setItem('jukebox_repeat', next);
    };

    // Shuffle queue (Fisher-Yates)
    const shuffleQueue = () => {
        if (queue.length < 2) return;
        const ids = queue.map(s => s.id);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        reorderQueue(ids);
    };

    // Show notification when new song is added
    const prevQueueLenRef = useRef(songs.length);
    useEffect(() => {
        if (songs.length > prevQueueLenRef.current) {
            const newest = songs[songs.length - 1];
            if (newest && newest.added_by !== user?.id) {
                notify(`🎵 ${newest.title}`, {
                    body: `Added by ${newest.added_by_name || 'Someone'}`,
                    tag: `song-${newest.id}`,
                });
                playNotificationSound();
            }
        }
        prevQueueLenRef.current = songs.length;
    }, [songs, notify, user?.id]);

    // Sound notification — Web Audio "ding" when someone else adds a song
    const playNotificationSound = () => {
        if (!document.hidden) return; // only when tab is inactive
        if (localStorage.getItem('jukebox_sound_notification') === 'off') return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch { }
    };

    // Now Playing — dynamic tab title
    useEffect(() => {
        if (currentSong?.title) {
            document.title = `🎵 ${currentSong.title} — ${room?.name || 'Jukebox'}`;
        } else {
            document.title = room?.name ? `${room.name} — Antigravity Jukebox` : 'Antigravity Jukebox';
        }
        return () => { document.title = 'Antigravity Jukebox'; };
    }, [currentSong?.title, room?.name]);

    // Share Room Link
    const handleShareRoom = async () => {
        const roomUrl = `${window.location.origin}/room/${slug}`;
        try {
            await navigator.clipboard.writeText(roomUrl);
            toast.success('Room link copied to clipboard!');
        } catch {
            // Fallback for older browsers
            setShowShareModal(true);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Joining room...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Room Header */}
            <header className="border-b border-border/50 bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link to="/" className="p-2 hover:bg-card rounded-lg transition-colors flex-shrink-0">
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${room?.cover_color}20` }}
                        >
                            <svg className="w-4 h-4" style={{ color: room?.cover_color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="font-display text-lg font-semibold leading-tight truncate">{room?.name}</h1>
                                {room?.creator_name && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface/80 text-text-muted border border-border flex items-center gap-1 flex-shrink-0 hidden sm:flex">
                                        <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 24 24">
                                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                                        </svg>
                                        Host: {room.creator_name}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
                                <span>{onlineMembers.length} online</span>
                                {room?.song_limit > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-warning/10 text-warning rounded text-[10px]">
                                        Max {room.song_limit}/user
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">

                        {/* Share Room Button */}
                        <button
                            onClick={handleShareRoom}
                            className="btn-ghost text-sm p-2 hidden sm:flex"
                            title="Share Room Link"
                        >
                            <svg className="w-5 h-5 text-text-muted hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                            </svg>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="btn-ghost text-sm p-2 hidden sm:flex"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5 text-text-muted hover:text-warning transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-text-muted hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                                </svg>
                            )}
                        </button>

                        <button
                            onClick={() => setShowHelp(true)}
                            className="btn-ghost text-sm p-2 hidden sm:flex"
                            title="Keyboard shortcuts (?)"
                        >
                            <kbd className="text-xs font-mono bg-card px-1.5 py-0.5 rounded border border-border">?</kbd>
                        </button>

                        <button
                            onClick={() => setShowMembers(!showMembers)}
                            className={`btn-ghost text-sm p-2 sm:px-3 ${showMembers ? 'bg-card border-border' : ''}`}
                        >
                            <svg className="w-5 h-5 sm:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                            <span className="hidden sm:inline">Members ({onlineMembers.length})</span>
                        </button>

                        {/* User Avatar / Profile Dropdown */}
                        {!isGuest ? (
                            <div className="relative" ref={profileMenuRef}>
                                <button
                                    onClick={() => setShowProfileMenu(prev => !prev)}
                                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-card-hover transition-colors"
                                >
                                    <img
                                        src={user?.avatar}
                                        alt={user?.display_name}
                                        className="w-7 h-7 rounded-full ring-2 ring-border"
                                        referrerPolicy="no-referrer"
                                    />
                                </button>
                                {showProfileMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 shadow-glow-lg animate-slide-up z-50">
                                        <div className="flex items-center gap-3 p-3 border-b border-border mb-2">
                                            <img src={user?.avatar} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{user?.display_name}</p>
                                                <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/')}
                                            className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-card-hover transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                                            </svg>
                                            All Rooms
                                        </button>
                                        <button
                                            onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
                                            className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-danger/10 text-danger transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                            </svg>
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <a
                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/google`}
                                className="btn-primary text-xs px-3 py-1.5"
                            >
                                Login
                            </a>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 room-layout">
                    {/* Left: Player + Queue */}
                    <div className="space-y-6">
                        {/* Player with emoji overlay */}
                        <div ref={playerSectionRef} id="main-player" className="relative">
                            <PlayerComponent
                                videoId={playerState.videoId}
                                playerState={playerState.state}
                                currentTime={playerState.currentTime}
                                currentSong={currentSong}
                                isRoomOwner={isRoomOwner}
                                repeatMode={repeatMode}
                                emitPlayerSync={emitPlayerSync}
                                emitPlayerSkip={emitPlayerSkip}
                                emitPlayerEnded={emitPlayerEnded}
                            />
                            {/* Floating emoji reactions overlay */}
                            {!isGuest && <EmojiReactions socket={socket} />}
                        </div>

                        {/* Add Song — hidden for guests */}
                        {!isGuest && <AddSong onAdd={addSong} slug={slug} songs={songs} />}

                        {/* Queue / History tabs */}
                        <div>
                            <div className="flex gap-1 mb-4 bg-surface rounded-xl p-1 max-w-xs">
                                <button
                                    onClick={() => setQueueTab('queue')}
                                    className={`flex-1 text-sm py-2 px-4 rounded-lg transition-all font-medium
                    ${queueTab === 'queue' ? 'bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    Queue {queue.length > 0 && `(${queue.length})`}
                                </button>
                                <button
                                    onClick={() => setQueueTab('history')}
                                    className={`flex-1 text-sm py-2 px-4 rounded-lg transition-all font-medium
                    ${queueTab === 'history' ? 'bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    History
                                </button>
                            </div>

                            {queueTab === 'queue' ? (
                                <QueueList
                                    songs={queue}
                                    isLoading={queueLoading}
                                    isRoomOwner={isRoomOwner}
                                    isGuest={isGuest}
                                    userId={user?.id}
                                    onRemove={removeSong}
                                    onClear={clearQueue}
                                    onReorder={reorderQueue}
                                    onShuffle={shuffleQueue}
                                    repeatMode={repeatMode}
                                    onRepeatToggle={cycleRepeatMode}
                                />
                            ) : (
                                <QueueHistory slug={slug} onReplay={addSong} />
                            )}
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        {/* Members (toggling on mobile) */}
                        <div className={`${showMembers ? 'block' : 'hidden'} lg:block`}>
                            <MembersList
                                members={onlineMembers}
                                isAdmin={isAdmin}
                                roomSlug={slug}
                                onClose={() => setShowMembers(false)}
                            />
                        </div>

                        {/* Chat — hidden for guests */}
                        {!isGuest && <ChatBox socket={socket} />}

                        {/* Lyrics Panel */}
                        <LyricsPanel currentSong={currentSong} />

                        {/* Activity Feed */}
                        <ActivityFeed slug={slug} />

                        {/* Room Stats */}
                        <RoomStats slug={slug} />
                    </div>
                </div>
            </main>

            {/* Mini Player */}
            <MiniPlayer
                currentSong={currentSong}
                isRoomOwner={isRoomOwner}
                isVisible={showMiniPlayer}
                emitPlayerSkip={emitPlayerSkip}
            />

            {/* Shortcuts help */}
            <ShortcutsHelp
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                isRoomOwner={isRoomOwner}
            />

            {/* Share Modal (fallback) */}
            {showShareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
                    <div className="glass-card p-6 w-full max-w-sm relative z-10 animate-slide-up">
                        <h3 className="font-display text-lg font-bold mb-4 text-center">Share Room</h3>

                        {/* QR Code */}
                        <div className="flex justify-center mb-4">
                            <canvas
                                ref={(el) => {
                                    qrCanvasRef.current = el;
                                    if (el) generateQRCode(el, `${window.location.origin}/room/${slug}`, 180);
                                }}
                                className="rounded-xl border border-border"
                            />
                        </div>
                        <p className="text-center text-xs text-text-muted mb-4">Scan QR code or copy link below</p>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={`${window.location.origin}/room/${slug}`}
                                className="input-field flex-1 text-sm"
                                onFocus={e => e.target.select()}
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/room/${slug}`);
                                    toast.success('Copied!');
                                    setShowShareModal(false);
                                }}
                                className="btn-primary text-sm"
                            >
                                Copy
                            </button>
                        </div>
                        <button
                            onClick={() => setShowShareModal(false)}
                            className="btn-ghost w-full mt-3 text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Guest Login Banner */}
            {isGuest && (
                <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border">
                    <div className="bg-gradient-to-r from-primary/10 via-card to-primary/10 backdrop-blur-xl px-4 py-3">
                        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg">🎧</span>
                                <p className="text-text-secondary text-sm truncate">
                                    <span className="font-medium text-text-primary">Listening as Guest</span>
                                    {' — '} Login to add songs, chat, and more
                                </p>
                            </div>
                            <a
                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/google`}
                                className="btn-primary text-sm px-4 py-2 whitespace-nowrap flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                Login with Google
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
