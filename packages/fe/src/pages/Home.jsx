import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Home() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const isAdmin = user?.role === 'admin';
    const { theme, toggleTheme } = useTheme();

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

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/50 bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
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
                        {isAdmin && (
                            <Link to="/admin" className="btn-ghost text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.083 1.168-.188l.672-.56a1.148 1.148 0 0 1 1.573.082l.773.773a1.148 1.148 0 0 1 .082 1.573l-.56.672c-.271.324-.354.764-.188 1.168s.506.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78s-.083.844.188 1.168l.56.672a1.148 1.148 0 0 1-.082 1.573l-.773.773a1.148 1.148 0 0 1-1.573.082l-.672-.56c-.324-.271-.764-.354-1.168-.188a1.148 1.148 0 0 0-.78.93l-.15.893c-.09.543-.559.94-1.109.94h-1.094c-.55 0-1.02-.397-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.929s-.843-.083-1.167.188l-.672.56a1.148 1.148 0 0 1-1.573-.082l-.773-.773a1.148 1.148 0 0 1-.082-1.573l.56-.672c.271-.324.354-.764.188-1.168a1.148 1.148 0 0 0-.93-.78l-.894-.15c-.542-.09-.94-.559-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78s.082-.844-.189-1.168l-.56-.672a1.148 1.148 0 0 1 .082-1.573l.773-.773a1.148 1.148 0 0 1 1.573-.082l.672.56c.324.271.764.354 1.168.188s.71-.506.78-.93l.15-.894Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                                Admin
                            </Link>
                        )}

                        <div className="flex items-center gap-3">
                            <img
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&background=random&size=32`}
                                alt={user?.displayName}
                                className="w-8 h-8 rounded-full border border-border"
                                referrerPolicy="no-referrer"
                            />
                            <span className="text-sm text-text-secondary hidden sm:inline">{user?.displayName}</span>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg hover:bg-card-hover transition-colors"
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
                                className="glass-card-hover p-6 block animate-slide-up group"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                {/* Room color accent */}
                                <div
                                    className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                    style={{ backgroundColor: `${room.cover_color}20` }}
                                >
                                    <svg className="w-6 h-6" style={{ color: room.cover_color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                                    </svg>
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
        </div>
    );
}

function CreateRoomModal({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [coverColor, setCoverColor] = useState('#8b5cf6');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const colors = ['#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f97316', '#06b6d4'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await api.post('/api/rooms', { name, description, isPublic, coverColor });
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="glass-card p-8 w-full max-w-lg relative z-10 animate-slide-up">
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
                        <div className="flex gap-2">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCoverColor(c)}
                                    className={`w-8 h-8 rounded-lg transition-transform ${coverColor === c ? 'scale-110 ring-2 ring-white/50' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                />
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
                            {isPublic ? 'Public — anyone can join' : 'Private — invite only'}
                        </span>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
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
