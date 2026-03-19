import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { useSocket } from '../hooks/useSocket';
import { useQueue } from '../hooks/useQueue';
import { useNotifications } from '../hooks/useNotifications';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePushNotifications } from '../hooks/usePushNotifications';
import PlayerComponent from '../components/Player/PlayerComponent';
import MiniPlayer from '../components/Player/MiniPlayer';
import RadioMode from '../components/Player/RadioMode';
import CrossfadeIndicator from '../components/Player/CrossfadeIndicator';
import QueueList from '../components/Queue/QueueList';
import QueueHistory from '../components/Queue/QueueHistory';
import AddSong from '../components/AddSong/AddSong';
import MembersList from '../components/Members/MembersList';
import ShortcutsHelp from '../components/ShortcutsHelp';
import { EmojiOverlay } from '../components/Social/EmojiReactions';
import ChatBox from '../components/Social/ChatBox';
import RoomStats from '../components/Social/RoomStats';
import ThemeSwitcher from '../components/ThemeSwitcher';
import MobileNav from '../components/MobileNav';
import { generateQRCode, generateQRDataURL } from '../lib/qrcode';
import api from '../lib/api';
import toast from 'react-hot-toast';


export default function Room() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user, isLoading: authLoading } = useAuthStore();
    const playerState = usePlayerStore();
    const [room, setRoom] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'members' | 'stats'
    const [queueTab, setQueueTab] = useState('queue'); // 'queue' | 'history'
    const [showMiniPlayer, setShowMiniPlayer] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false); // mobile/tablet sidebar toggle
    const [mobileTab, setMobileTab] = useState('player'); // mobile bottom nav: 'player' | 'queue' | 'chat' | 'members'
    const [repeatMode, setRepeatMode] = useState(() => localStorage.getItem('jukebox_repeat') || 'off'); // 'off' | 'single' | 'queue'
    const [radioModeEnabled, setRadioModeEnabled] = useState(false);
    const [crossfadeActive, setCrossfadeActive] = useState(false);
    const [crossfadeProgress, setCrossfadeProgress] = useState(0);
    const [playerProgress, setPlayerProgress] = useState({ current: 0, duration: 0 });
    const playerSectionRef = useRef(null);
    const qrCanvasRef = useRef(null);
    const profileMenuRef = useRef(null);

    const [showSettings, setShowSettings] = useState(false);

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

    // Browser notifications + auto-subscribe push (only for logged-in users)
    const { requestPermission, notify } = useNotifications();
    const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushNotifications();

    useEffect(() => {
        if (isGuest) return;
        requestPermission();
        // Auto-subscribe push if supported and not yet subscribed
        if (pushSupported && !pushSubscribed) {
            pushSubscribe().catch(() => { });
        }
    }, [requestPermission, isGuest, pushSupported, pushSubscribed, pushSubscribe]);

    // Fetch room details
    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}`)
            .then(res => {
                setRoom(res.data.room);
                setIsLoading(false);
            })
            .catch(err => {
                if (err.response?.status === 403 && err.response?.data?.requiresPassword) {
                    toast.error('This room requires a password to join');
                } else if (err.response?.status === 403) {
                    toast.error('You do not have access to this room');
                } else if (err.response?.status === 404) {
                    toast.error('Room not found');
                }
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

    // Mini Player  Intersection Observer
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
    const canControl = isRoomOwner || room?.userRoomRole === 'dj' || room?.userRoomRole === 'admin';

    // Keyboard shortcuts
    const { showHelp, setShowHelp } = useKeyboardShortcuts({
        isRoomOwner: canControl,
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

    // Sound notification  Web Audio "ding" when someone else adds a song
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

    // Now Playing  dynamic tab title
    useEffect(() => {
        if (currentSong?.title) {
            document.title = `🎵 ${currentSong.title}  ${room?.name || 'SoundDen'}`;
        } else {
            document.title = room?.name ? `${room.name}  SoundDen` : 'SoundDen';
        }
        return () => { document.title = 'SoundDen'; };
    }, [currentSong?.title, room?.name]);

    // Now Playing toast  show when a new song starts playing
    const prevSongIdRef = useRef(null);
    useEffect(() => {
        if (!currentSong) return;
        if (prevSongIdRef.current === null) {
            // First load  remember but don't toast
            prevSongIdRef.current = currentSong.id;
            return;
        }
        if (currentSong.id === prevSongIdRef.current) return;
        prevSongIdRef.current = currentSong.id;
        toast((
            <div className="flex items-center gap-3">
                <img
                    src={currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.youtube_id}/default.jpg`}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentSong.title}</p>
                    <p className="text-xs text-gray-400">Now playing</p>
                </div>
            </div>
        ), { duration: 3000, icon: '🎵', style: { background: '#1e1e2e', color: '#fff', borderRadius: '12px' } });
    }, [currentSong?.id]);

    // Share Room Link
    const handleShareRoom = async () => {
        const roomUrl = `${window.location.origin}/room/${slug}`;
        // Mobile: use native share sheet if available
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${room?.name}  SoundDen`,
                    text: `Join my music room: ${room?.name}`,
                    url: roomUrl,
                });
                return;
            } catch { /* user cancelled or share failed, show modal */ }
        }
        setShowShareModal(true);
    };

    const handleDownloadQR = async () => {
        const roomUrl = `${window.location.origin}/room/${slug}`;
        const dataUrl = await generateQRDataURL(roomUrl);
        if (!dataUrl) return toast.error('Failed to generate QR');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${room?.name || 'room'}-qr.png`;
        a.click();
        toast.success('QR code downloaded!');
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
            <header className="border-b border-border bg-surface sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link to="/" className="p-2 hover:bg-card rounded-lg transition-colors flex-shrink-0">
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: room?.cover_color?.startsWith('linear') ? room?.cover_color : `${room?.cover_color}20` }}
                        >
                            <span className="text-sm">{room?.room_icon || '🎵'}</span>
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

                        {/* Radio Mode Toggle */}
                        {!isGuest && (
                            <button
                                onClick={() => setRadioModeEnabled(prev => !prev)}
                                className={`btn-ghost text-sm p-2 hidden sm:flex transition-colors ${radioModeEnabled ? 'text-primary bg-primary/10' : ''}`}
                                title={radioModeEnabled ? 'Radio Mode ON' : 'Radio Mode OFF'}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5l16.5-4.125M12 6.75c-2.708 0-5.363.224-7.948.655C2.999 7.58 2.25 8.507 2.25 9.574v9.176A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169A48.329 48.329 0 0012 6.75z" />
                                </svg>
                            </button>
                        )}

                        {/* Room Settings (Owner only) */}
                        {isRoomOwner && (
                            <button
                                onClick={() => setShowSettings(true)}
                                className="btn-ghost text-sm p-2 hidden sm:flex"
                                title="Room Settings"
                            >
                                <svg className="w-5 h-5 text-text-muted hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                            </button>
                        )}

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

                        <button
                            onClick={() => setShowHelp(true)}
                            className="btn-ghost text-sm p-2 hidden sm:flex"
                            title="Keyboard shortcuts (?)"
                        >
                            <kbd className="text-xs font-mono bg-card px-1.5 py-0.5 rounded border border-border">?</kbd>
                        </button>

                        {/* Sidebar toggle  visible on tablet/mobile only */}
                        <button
                            onClick={() => setShowSidebar(prev => !prev)}
                            className={`xl:hidden p-2 rounded-lg transition-colors ${showSidebar ? 'bg-primary/20 text-primary' : 'hover:bg-card-hover text-text-muted'
                                }`}
                            title="Toggle sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                            </svg>
                        </button>

                        <ThemeSwitcher />


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
                                    <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 animate-fade-in z-50">
                                        <div className="flex items-center gap-3 p-3 border-b border-border mb-2">
                                            <img src={user?.avatar} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{user?.display_name}</p>
                                                <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/profile/${user?.id}`)}
                                            className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-card-hover transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                            </svg>
                                            My Profile
                                        </button>
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
            <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 pb-20 md:pb-12">
                <div className="flex flex-col xl:flex-row gap-6">
                    {/* Left: Player + Queue */}
                    <div className={`flex-1 min-w-0 xl:min-w-[600px] space-y-6 ${mobileTab !== 'player' && mobileTab !== 'queue' ? 'hidden md:block' : ''}`}>
                        {/* Player with emoji overlay  16:9 ratio */}
                        <div ref={playerSectionRef} id="main-player" className="relative aspect-video bg-base rounded-2xl overflow-hidden">
                            <PlayerComponent
                                videoId={playerState.videoId}
                                playerState={playerState.state}
                                currentTime={playerState.currentTime}
                                currentSong={currentSong}
                                isRoomOwner={isRoomOwner}
                                canControl={canControl}
                                repeatMode={repeatMode}
                                emitPlayerSync={emitPlayerSync}
                                emitPlayerSkip={emitPlayerSkip}
                                emitPlayerEnded={emitPlayerEnded}
                            />
                            {/* Floating emoji reactions overlay */}
                            {!isGuest && <EmojiOverlay socket={socket} />}
                        </div>

                        {/* Add Song  hidden for guests, hidden on mobile queue-only view */}
                        {!isGuest && <div className={mobileTab === 'queue' ? 'hidden md:block' : ''}><AddSong onAdd={addSong} slug={slug} songs={songs} /></div>}

                        {/* Crossfade indicator */}
                        {crossfadeActive && (
                            <CrossfadeIndicator
                                isActive={crossfadeActive}
                                currentSong={currentSong}
                                nextSong={queue[0]}
                                fadeProgress={crossfadeProgress}
                            />
                        )}

                        {/* Radio Mode panel  only visible when enabled */}
                        {!isGuest && radioModeEnabled && (
                            <RadioMode
                                slug={slug}
                                isEnabled={radioModeEnabled}
                                onToggle={() => setRadioModeEnabled(prev => !prev)}
                                onAddSong={addSong}
                                queueLength={queue.length}
                            />
                        )}

                        {/* Queue / History tabs */}
                        <div className={mobileTab === 'player' ? 'hidden md:block' : ''}>
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

                    {/* Right Sidebar  Tabbed */}
                    {/* Desktop: always visible, fixed 360px */}
                    {/* Mobile: controlled by mobileTab (chat/members) */}
                    <div className={`
                        xl:w-[360px] xl:flex-shrink-0 xl:block xl:relative xl:bg-transparent xl:p-0
                        ${mobileTab === 'chat' || mobileTab === 'members'
                            ? 'block md:hidden'
                            : 'hidden md:hidden xl:block'
                        }
                        ${showSidebar
                            ? 'fixed inset-0 z-40 bg-black/60 xl:static xl:z-auto hidden md:block xl:hidden'
                            : 'hidden md:hidden xl:block'
                        }
                    `}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowSidebar(false); }}
                    >
                        <div className={`
                            xl:sticky xl:top-20 flex flex-col
                            ${showSidebar
                                ? 'absolute right-0 top-0 bottom-0 w-[360px] max-w-[85vw] bg-base border-l border-border p-4 pt-6 animate-fade-in'
                                : ''
                            }
                        `}>
                            {/* Close button  mobile/tablet only */}
                            {showSidebar && (
                                <button
                                    onClick={() => setShowSidebar(false)}
                                    className="xl:hidden absolute top-3 right-3 p-1.5 rounded-lg hover:bg-card-hover text-text-muted"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}

                            {/* Tab Bar  hidden on mobile (bottom nav handles it) */}
                            <div className="hidden md:flex gap-1 bg-surface rounded-xl p-1 mb-3">
                                <button
                                    onClick={() => setSidebarTab('chat')}
                                    className={`flex-1 text-sm py-2 px-3 rounded-lg transition-colors duration-150 font-medium
                                        ${sidebarTab === 'chat' ? 'bg-card text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    Chat
                                </button>
                                <button
                                    onClick={() => setSidebarTab('members')}
                                    className={`flex-1 text-sm py-2 px-3 rounded-lg transition-colors duration-150 font-medium
                                        ${sidebarTab === 'members' ? 'bg-card text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    Members ({onlineMembers.length})
                                </button>
                                <button
                                    onClick={() => setSidebarTab('stats')}
                                    className={`flex-1 text-sm py-2 px-3 rounded-lg transition-colors duration-150 font-medium
                                        ${sidebarTab === 'stats' ? 'bg-card text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    Stats
                                </button>
                            </div>

                            {/* Tab Content  fill remaining height */}
                            <div className="flex-1 min-h-0">
                                {(sidebarTab === 'chat' || mobileTab === 'chat') && (
                                    !isGuest ? (
                                        <ChatBox socket={socket} onlineMembers={onlineMembers} />
                                    ) : (
                                        <div className="glass-card p-6 text-center">
                                            <p className="text-text-muted text-sm">Login to join the chat</p>
                                        </div>
                                    )
                                )}
                                {(sidebarTab === 'members' || mobileTab === 'members') && (
                                    <MembersList
                                        members={onlineMembers}
                                        isRoomOwner={isRoomOwner}
                                        currentUserId={user?.id}
                                        roomSlug={slug}
                                        socket={socket}
                                        onClose={() => setSidebarTab('chat')}
                                    />
                                )}
                                {sidebarTab === 'stats' && (
                                    <RoomStats slug={slug} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <MobileNav
                activeTab={mobileTab}
                onTabChange={setMobileTab}
                queueCount={queue.length}
                memberCount={onlineMembers.length}
            />

            {/* Mini Player */}
            <MiniPlayer
                currentSong={currentSong}
                isRoomOwner={isRoomOwner}
                isVisible={showMiniPlayer}
                emitPlayerSkip={emitPlayerSkip}
                progress={playerProgress}
            />

            {/* Shortcuts help */}
            <ShortcutsHelp
                isOpen={showHelp}
                onClose={() => setShowHelp(false)}
                isRoomOwner={isRoomOwner}
            />

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowShareModal(false)} />
                    <div className="glass-card p-6 w-full max-w-sm relative z-10 animate-fade-in">
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

                        {/* Link + Copy */}
                        <div className="flex gap-2 mb-3">
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
                                    toast.success('Link copied!');
                                }}
                                className="btn-primary text-sm"
                            >
                                Copy
                            </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleDownloadQR}
                                className="btn-ghost flex-1 text-sm flex items-center justify-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Download QR
                            </button>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="btn-ghost flex-1 text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Guest Login Banner */}
            {isGuest && (
                <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border">
                    <div className="bg-card border-t border-border px-4 py-3">
                        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg">🎧</span>
                                <p className="text-text-secondary text-sm truncate">
                                    <span className="font-medium text-text-primary">Listening as Guest</span>
                                    {'  '} Login to add songs, chat, and more
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
            {/* Room Settings Modal */}
            {showSettings && (
                <RoomSettingsModal
                    room={room}
                    slug={slug}
                    onClose={() => setShowSettings(false)}
                    onUpdated={(updatedRoom) => setRoom(prev => ({ ...prev, ...updatedRoom }))}
                />
            )}
        </div>
    );
}

function RoomSettingsModal({ room, slug, onClose, onUpdated }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [autoplayEnabled, setAutoplayEnabled] = useState(room?.autoplay_enabled !== 0);

    const handleSavePassword = async () => {
        setIsSubmitting(true);
        try {
            const res = await api.patch(`/api/rooms/${slug}`, { password: password.trim() || null });
            toast.success(password.trim() ? 'Room password updated!' : 'Room password removed!');
            onUpdated(res.data.room);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemovePassword = async () => {
        setIsSubmitting(true);
        try {
            const res = await api.patch(`/api/rooms/${slug}`, { password: null });
            toast.success('Room password removed!');
            onUpdated(res.data.room);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="glass-card p-6 w-full max-w-md relative z-10 animate-fade-in">
                <h3 className="font-display text-lg font-bold mb-5 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    Room Settings
                </h3>

                {/* Password Section */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-text-secondary mb-1.5 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            {room?.has_password ? 'Change Password' : 'Set Password'}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field w-full pr-10"
                                placeholder={room?.has_password ? 'Enter new password' : 'Enter password'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-text-muted mt-1">Password expires after 10 minutes  users will need to re-enter</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSavePassword}
                            disabled={isSubmitting || !password.trim()}
                            className="btn-primary flex-1 text-sm disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : password.trim() ? 'Save Password' : 'Enter password first'}
                        </button>
                        {room?.has_password && (
                            <button
                                onClick={handleRemovePassword}
                                disabled={isSubmitting}
                                className="btn-ghost text-sm text-danger hover:bg-danger/10 px-4"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>

                {/* Autoplay Section */}
                <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-sm text-text-secondary flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                                </svg>
                                Smart Autoplay
                            </label>
                            <p className="text-xs text-text-muted mt-0.5">Play random songs from history when queue is empty</p>
                        </div>
                        <button
                            onClick={async () => {
                                const newVal = !autoplayEnabled;
                                setAutoplayEnabled(newVal);
                                try {
                                    const res = await api.patch(`/api/rooms/${slug}`, { autoplayEnabled: newVal });
                                    onUpdated(res.data.room);
                                } catch {
                                    setAutoplayEnabled(!newVal);
                                    toast.error('Failed to update autoplay');
                                }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoplayEnabled ? 'bg-primary' : 'bg-card-hover'
                                }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoplayEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border">
                    <button onClick={onClose} className="btn-ghost w-full text-sm">Close</button>
                </div>
            </div>
        </div>
    );
}

