import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeSwitcher from '../components/ThemeSwitcher';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Home() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [passwordRoom, setPasswordRoom] = useState(null); // Room needing password

    const isAdmin = user?.role === 'admin';


    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await api.get('/api/rooms');
            setRooms(res.data.rooms);
        } catch (err) {
            toast.error('Failed to load rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleRoomClick = (e, room) => {
        if (room.has_password && !room.is_member) {
            e.preventDefault();
            setPasswordRoom(room);
        }
    };

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border bg-surface sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                            </svg>
                        </div>
                        <h1 className="font-display text-xl font-bold">Antigravity <span className="text-primary">Jukebox</span></h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link to="/explore" className="btn-ghost text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                            </svg>
                            Explore
                        </Link>

                        {isAdmin && (
                            <Link to="/admin" className="btn-ghost text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.083 1.168-.188l.672-.56a1.148 1.148 0 0 1 1.573.082l.773.773a1.148 1.148 0 0 1 .082 1.573l-.56.672c-.271.324-.354.764-.188 1.168s.506.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78s-.083.844.188 1.168l.56.672a1.148 1.148 0 0 1-.082 1.573l-.773.773a1.148 1.148 0 0 1-1.573.082l-.672-.56c-.324-.271-.764-.354-1.168-.188a1.148 1.148 0 0 0-.78.93l-.15.893c-.09.543-.559.94-1.109.94h-1.094c-.55 0-1.02-.397-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.929s-.843-.083-1.167.188l-.672.56a1.148 1.148 0 0 1-1.573-.082l-.773-.773a1.148 1.148 0 0 1-.082-1.573l.56-.672c.271-.324.354-.764.188-1.168a1.148 1.148 0 0 0-.93-.78l-.894-.15c-.542-.09-.94-.559-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78s.082-.844-.189-1.168l-.56-.672a1.148 1.148 0 0 1 .082-1.573l.773-.773a1.148 1.148 0 0 1 1.573-.082l.672.56c.324.271.764.354 1.168.188s.71-.506.78-.93l.15-.894Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                                Admin
                            </Link>
                        )}

                        <Link to="/gamification" className="btn-ghost text-sm flex items-center gap-2">
                            <span>🏆</span>
                            <span className="hidden sm:inline">Stats</span>
                        </Link>

                        <div className="flex items-center gap-3">
                            <img
                                src={user?.avatar}
                                alt={user?.displayName}
                                className="w-8 h-8 rounded-full border border-border"
                            />
                            <span className="text-sm text-text-secondary hidden sm:inline">{user?.displayName}</span>
                        </div>

                        <ThemeSwitcher />

                        <button onClick={handleLogout} className="text-sm text-text-muted hover:text-danger transition-colors px-3 py-2 rounded-lg hover:bg-danger/10">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="font-display text-2xl font-bold mb-1">Rooms</h2>
                        <p className="text-text-secondary text-sm">Choose a room and start listening together</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary flex items-center gap-2"
                        id="create-room-btn"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        New Room
                    </button>
                </div>

                {/* Room Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton h-48 rounded-2xl" />
                        ))}
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-20 animate-fade-in">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-card flex items-center justify-center">
                            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                        </div>
                        <h3 className="font-display text-xl font-semibold text-text-secondary mb-2">No rooms yet</h3>
                        <p className="text-text-muted text-sm">Create your first room to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rooms.map((room, i) => (
                            <Link
                                key={room.id}
                                to={`/room/${room.slug}`}
                                onClick={(e) => handleRoomClick(e, room)}
                                className="glass-card-hover p-6 block animate-fade-in group"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                {/* Room color accent */}
                                <div className="flex items-start justify-between mb-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                                        style={{ background: room.cover_color?.startsWith('linear') ? room.cover_color : `${room.cover_color}20` }}
                                    >
                                        {room.room_icon || '🎵'}
                                    </div>
                                    {/* Lock icon for password-protected rooms */}
                                    {room.has_password && (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                            </svg>
                                            Password
                                        </div>
                                    )}
                                </div>

                                <h3 className="font-display text-lg font-semibold mb-1 text-text-primary group-hover:text-primary transition-colors">
                                    {room.name}
                                </h3>
                                {room.description && (
                                    <p className="text-text-secondary text-sm mb-3 line-clamp-2">{room.description}</p>
                                )}

                                <div className="flex items-center gap-3 text-xs text-text-muted">
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                                        </svg>
                                        {room.member_count || 0} members
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full ${room.is_public ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                        {room.is_public ? 'Public' : 'Private'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Room Modal */}
            {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} onCreated={fetchRooms} />}

            {/* Password Modal */}
            {passwordRoom && (
                <PasswordModal
                    room={passwordRoom}
                    onClose={() => setPasswordRoom(null)}
                    onSuccess={() => {
                        setPasswordRoom(null);
                        navigate(`/room/${passwordRoom.slug}`);
                    }}
                />
            )}
        </div>
    );
}

function CreateRoomModal({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [coverColor, setCoverColor] = useState('#8b5cf6');
    const [roomIcon, setRoomIcon] = useState('🎵');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const solidColors = ['#8b5cf6', '#c8a87c', '#8aad7c', '#c47a6a', '#6b9ec4', '#b89c6b', '#7ca5a5', '#9b8ab5'];
    const gradients = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, #38f9d7)',
        'linear-gradient(135deg, #fa709a, #fee140)',
        'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    ];
    const icons = ['🎵', '🎸', '🎹', '🎧', '🎤', '🎷', '🥁', '🎻', '🎺', '🎶', '💿', '🎙️'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await api.post('/api/rooms', {
                name,
                description,
                isPublic,
                coverColor,
                roomIcon,
                password: password.trim() || undefined,
            });
            toast.success('Room created!');
            onCreated();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create room');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Modal */}
            <div className="glass-card p-8 w-full max-w-lg relative z-10 animate-fade-in">
                <h2 className="font-display text-xl font-bold mb-6">Create New Room</h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm text-text-secondary mb-1.5">Room Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-field w-full"
                            placeholder="e.g., Design Team"
                            autoFocus
                            id="room-name-input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-text-secondary mb-1.5">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input-field w-full resize-none"
                            rows={3}
                            placeholder="What's this room for?"
                            id="room-description-input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-text-secondary mb-2">Cover Color</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {solidColors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCoverColor(c)}
                                    className={`w-8 h-8 rounded-lg transition-transform ${coverColor === c ? 'scale-110 ring-2 ring-white/50' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {gradients.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => setCoverColor(g)}
                                    className={`w-8 h-8 rounded-lg transition-transform ${coverColor === g ? 'scale-110 ring-2 ring-white/50' : 'hover:scale-105'}`}
                                    style={{ background: g }}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-text-secondary mb-2">Room Icon</label>
                        <div className="flex flex-wrap gap-1.5">
                            {icons.map(icon => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setRoomIcon(icon)}
                                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${roomIcon === icon ? 'bg-primary/20 ring-2 ring-primary scale-110' : 'bg-surface hover:bg-card-hover hover:scale-105'}`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsPublic(!isPublic)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-primary' : 'bg-border'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublic ? 'left-6' : 'left-0.5'}`} />
                        </button>
                        <span className="text-sm text-text-secondary">
                            {isPublic ? 'Public — anyone can join' : 'Private — password required'}
                        </span>
                    </div>

                    {/* Password field */}
                    <div>
                        <label className="block text-sm text-text-secondary mb-1.5">
                            <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                                Room Password <span className="text-text-muted">{isPublic ? '(optional)' : '(required)'}</span>
                            </span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field w-full pr-10"
                                placeholder={isPublic ? 'Leave empty for no password' : 'Required for private rooms'}
                                id="room-password-input"
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
                        {password && (
                            <p className="text-xs text-warning mt-1">🔒 Users will need this password to join</p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || (!isPublic && !password.trim())}
                            className="btn-primary flex-1 disabled:opacity-50"
                            id="create-room-submit"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Room'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PasswordModal({ room, onClose, onSuccess }) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) return;

        setIsSubmitting(true);
        setError('');
        try {
            await api.post(`/api/rooms/${room.slug}/join`, { password: password.trim() });
            toast.success('Joined room!');
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to join room');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="glass-card p-8 w-full max-w-sm relative z-10 animate-fade-in text-center">
                {/* Lock icon */}
                <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: `${room.cover_color}20` }}
                >
                    <svg className="w-8 h-8" style={{ color: room.cover_color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                </div>

                <h3 className="font-display text-lg font-bold mb-1">{room.name}</h3>
                <p className="text-text-secondary text-sm mb-6">This room requires a password to join</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            className={`input-field w-full pr-10 text-center ${error ? 'border-danger' : ''}`}
                            placeholder="Enter password"
                            autoFocus
                            id="join-password-input"
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

                    {error && (
                        <p className="text-sm text-danger animate-fade-in">{error}</p>
                    )}

                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !password.trim()}
                            className="btn-primary flex-1 disabled:opacity-50"
                            id="join-room-submit"
                        >
                            {isSubmitting ? 'Joining...' : 'Join Room'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
