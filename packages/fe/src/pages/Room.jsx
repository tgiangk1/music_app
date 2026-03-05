import { useEffect, useState, useRef } from 'react';
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
// Phase 3: Social components
import EmojiReactions from '../components/Social/EmojiReactions';
import ChatBox from '../components/Social/ChatBox';
import ListeningAvatars from '../components/Social/ListeningAvatars';
import PersonalStats from '../components/Social/PersonalStats';
import Leaderboard from '../components/Social/Leaderboard';
import ActivityFeed from '../components/Social/ActivityFeed';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Room() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const playerState = usePlayerStore();
    const [room, setRoom] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showMembers, setShowMembers] = useState(false);
    const [queueTab, setQueueTab] = useState('queue'); // 'queue' | 'history'
    const [showMiniPlayer, setShowMiniPlayer] = useState(false);
    const playerSectionRef = useRef(null);

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
        voteSong,
        clearQueue,
        reorderQueue,
    } = useQueue(slug);

    // Feature 5: Browser notifications
    const { requestPermission, notify } = useNotifications();

    useEffect(() => {
        requestPermission();
    }, [requestPermission]);

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
                navigate('/');
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

    // Feature 4: Mini Player — Intersection Observer
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

    // Feature 6: Keyboard shortcuts
    const { showHelp, setShowHelp } = useKeyboardShortcuts({
        isRoomOwner,
        emitPlayerSync,
        emitPlayerSkip,
        videoId: playerState.videoId,
        playerState: playerState.state,
    });

    const currentSong = songs.find(s => s.is_playing);
    const queue = songs.filter(s => !s.is_playing);

    // Feature 5: Show notification when new song is added
    const prevQueueLenRef = useRef(songs.length);
    useEffect(() => {
        if (songs.length > prevQueueLenRef.current) {
            const newest = songs[songs.length - 1];
            if (newest && newest.added_by !== user?.id) {
                notify(`🎵 ${newest.title}`, {
                    body: `Added by ${newest.added_by_name || 'Someone'}`,
                    tag: `song-${newest.id}`,
                });
            }
        }
        prevQueueLenRef.current = songs.length;
    }, [songs, notify, user?.id]);

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
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 hover:bg-card rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${room?.cover_color}20` }}
                        >
                            <svg className="w-4 h-4" style={{ color: room?.cover_color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-display text-lg font-semibold leading-tight">{room?.name}</h1>
                            <div className="flex items-center gap-2 text-xs text-text-muted">
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

                    <div className="flex items-center gap-2">
                        {/* Phase 3: Listening avatars */}
                        <ListeningAvatars members={onlineMembers} />

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
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
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
                                emitPlayerSync={emitPlayerSync}
                                emitPlayerSkip={emitPlayerSkip}
                                emitPlayerEnded={emitPlayerEnded}
                            />
                            {/* Phase 3: Floating emoji reactions overlay */}
                            <EmojiReactions socket={socket} />
                        </div>

                        {/* Add Song */}
                        <AddSong onAdd={addSong} slug={slug} songs={songs} />

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
                                    userId={user?.id}
                                    onVote={voteSong}
                                    onRemove={removeSong}
                                    onClear={clearQueue}
                                    onReorder={reorderQueue}
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

                        {/* Phase 3: Chat */}
                        <ChatBox socket={socket} />

                        {/* Phase 3: Personal Stats */}
                        <PersonalStats slug={slug} />

                        {/* Phase 3: Leaderboard */}
                        <Leaderboard slug={slug} />

                        {/* Phase 3: Activity Feed */}
                        <ActivityFeed slug={slug} />
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
        </div>
    );
}
