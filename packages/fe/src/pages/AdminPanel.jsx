import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminPanel() {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [feedbackFilter, setFeedbackFilter] = useState({ status: '', category: '' });
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [expandedFeedback, setExpandedFeedback] = useState(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await api.get(`/api/users${searchQuery ? `?search=${searchQuery}` : ''}`);
                setUsers(res.data.users);
            } else if (activeTab === 'rooms') {
                const res = await api.get('/api/rooms');
                setRooms(res.data.rooms);
            } else if (activeTab === 'feedback') {
                const params = new URLSearchParams();
                if (feedbackFilter.status) params.set('status', feedbackFilter.status);
                if (feedbackFilter.category) params.set('category', feedbackFilter.category);
                const res = await api.get(`/api/feedback?${params}`);
                setFeedbacks(res.data);
            }
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.patch(`/api/users/${userId}/role`, { role: newRole });
            toast.success(`Role updated to ${newRole}`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update role');
        }
    };

    const handleBan = async (userId, isBanned) => {
        try {
            if (isBanned) {
                await api.delete(`/api/users/${userId}/ban`);
                toast.success('User unbanned');
            } else {
                await api.post(`/api/users/${userId}/ban`);
                toast.success('User banned');
            }
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update ban status');
        }
    };

    const handleDeleteRoom = async (slug) => {
        if (!confirm('Are you sure you want to delete this room?')) return;
        try {
            await api.delete(`/api/rooms/${slug}`);
            toast.success('Room deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete room');
        }
    };

    const handleReply = async (feedbackId) => {
        if (!replyText.trim()) return;
        try {
            await api.patch(`/api/feedback/${feedbackId}`, { admin_reply: replyText.trim() });
            toast.success('Reply sent');
            setReplyingTo(null);
            setReplyText('');
            fetchData();
        } catch (err) {
            toast.error('Failed to send reply');
        }
    };

    const handleFeedbackStatus = async (feedbackId, status) => {
        try {
            await api.patch(`/api/feedback/${feedbackId}`, { status });
            toast.success('Status updated');
            fetchData();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!confirm('Delete this feedback?')) return;
        try {
            await api.delete(`/api/feedback/${feedbackId}`);
            toast.success('Feedback deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border bg-surface sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 hover:bg-card rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <h1 className="font-display text-xl font-bold">Admin <span className="text-primary">Panel</span></h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Tabs */}
                <div className="flex gap-2 mb-8">
                    {['users', 'rooms', 'feedback'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${activeTab === tab
                                ? 'bg-primary text-white'
                                : 'bg-card text-text-secondary hover:bg-card-hover'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                                className="input-field flex-1"
                                placeholder="Search users by name or email..."
                            />
                            <button onClick={fetchData} className="btn-primary">Search</button>
                        </div>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                            </div>
                        ) : (
                            <div className="glass-card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border/50">
                                                <th className="text-left text-xs text-text-muted font-medium px-4 py-3">User</th>
                                                <th className="text-left text-xs text-text-muted font-medium px-4 py-3">Email</th>
                                                <th className="text-left text-xs text-text-muted font-medium px-4 py-3">Role</th>
                                                <th className="text-left text-xs text-text-muted font-medium px-4 py-3">Status</th>
                                                <th className="text-right text-xs text-text-muted font-medium px-4 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id} className="border-b border-border/30 hover:bg-card-hover transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <img src={u.avatar} alt="" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
                                                            <span className="text-sm font-medium">{u.displayName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-text-secondary">{u.email}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={u.role === 'admin' ? 'badge-admin' : 'badge-member'}>{u.role}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.isBanned ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                                                            }`}>
                                                            {u.isBanned ? 'Banned' : 'Active'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {u.id !== user.id && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'member' : 'admin')}
                                                                    className="btn-ghost text-xs px-3 py-1"
                                                                >
                                                                    {u.role === 'admin' ? 'Demote' : 'Promote'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleBan(u.id, u.isBanned)}
                                                                    className={`text-xs px-3 py-1 rounded-lg transition-colors ${u.isBanned ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'
                                                                        }`}
                                                                >
                                                                    {u.isBanned ? 'Unban' : 'Ban'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Rooms Tab */}
                {activeTab === 'rooms' && (
                    <div>
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-text-muted">No rooms yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rooms.map(room => (
                                    <div key={room.id} className="glass-card p-6">
                                        <div className="flex items-start justify-between mb-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: `${room.cover_color}20` }}
                                            >
                                                <svg className="w-5 h-5" style={{ color: room.cover_color }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                                                </svg>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRoom(room.slug)}
                                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>

                                        <h3 className="font-display font-semibold mb-1">{room.name}</h3>
                                        {room.description && (
                                            <p className="text-text-secondary text-sm mb-3 line-clamp-2">{room.description}</p>
                                        )}

                                        <div className="flex items-center gap-3 text-xs text-text-muted">
                                            <span>{room.is_public ? '🌐 Public' : '🔒 Private'}</span>
                                            <Link to={`/room/${room.slug}`} className="text-primary hover:underline">
                                                Open →
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Feedback Tab */}
                {activeTab === 'feedback' && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex gap-3 mb-6 flex-wrap">
                            <select
                                value={feedbackFilter.status}
                                onChange={e => { setFeedbackFilter(f => ({ ...f, status: e.target.value })); setTimeout(fetchData, 0); }}
                                className="input-field w-auto"
                            >
                                <option value="">All Status</option>
                                <option value="new">🔵 New</option>
                                <option value="read">🟡 Read</option>
                                <option value="replied">🟢 Replied</option>
                            </select>
                            <select
                                value={feedbackFilter.category}
                                onChange={e => { setFeedbackFilter(f => ({ ...f, category: e.target.value })); setTimeout(fetchData, 0); }}
                                className="input-field w-auto"
                            >
                                <option value="">All Categories</option>
                                <option value="bug">🐛 Bug</option>
                                <option value="feature-request">💡 Feature</option>
                                <option value="ui-ux">🎨 UI/UX</option>
                                <option value="music">🎵 Music</option>
                                <option value="other">📝 Other</option>
                            </select>
                            <span className="text-text-muted text-sm self-center ml-auto">{feedbacks.length} feedback(s)</span>
                        </div>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                            </div>
                        ) : feedbacks.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-4xl mb-3">📭</p>
                                <p className="text-text-muted">No feedback yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {feedbacks.map(fb => {
                                    const isExpanded = expandedFeedback === fb.id;
                                    const categoryIcons = { 'bug': '🐛', 'feature-request': '💡', 'ui-ux': '🎨', 'music': '🎵', 'other': '📝' };
                                    const statusColors = { 'new': 'bg-blue-500/10 text-blue-400', 'read': 'bg-yellow-500/10 text-yellow-400', 'replied': 'bg-green-500/10 text-green-400' };
                                    return (
                                        <div key={fb.id} className="glass-card overflow-hidden">
                                            <div
                                                className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
                                                onClick={() => setExpandedFeedback(isExpanded ? null : fb.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src={fb.avatar} alt="" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium">{fb.display_name}</span>
                                                            <span className="text-xs text-text-muted">{fb.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs">{categoryIcons[fb.category] || '📝'} {fb.category}</span>
                                                            <span className="font-medium text-sm truncate">{fb.subject}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[fb.status] || ''}`}>
                                                            {fb.status}
                                                        </span>
                                                        <span className="text-xs text-text-muted">
                                                            {new Date(fb.created_at).toLocaleDateString('vi-VN')}
                                                        </span>
                                                        <span className="text-text-muted">{isExpanded ? '▲' : '▼'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                                                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{fb.message}</p>

                                                    {fb.screenshot && (
                                                        <a href={fb.screenshot} target="_blank" rel="noopener noreferrer">
                                                            <img src={fb.screenshot} alt="Screenshot" className="w-full max-h-48 object-cover rounded-lg border border-border/30 hover:opacity-80 transition-opacity" />
                                                        </a>
                                                    )}
                                                    {fb.admin_reply && (
                                                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                                            <p className="text-xs text-green-400 font-medium mb-1">Your reply — {new Date(fb.replied_at).toLocaleDateString('vi-VN')}</p>
                                                            <p className="text-sm text-green-200 whitespace-pre-wrap">{fb.admin_reply}</p>
                                                        </div>
                                                    )}

                                                    {replyingTo === fb.id ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                value={replyText}
                                                                onChange={e => setReplyText(e.target.value)}
                                                                placeholder="Type your reply..."
                                                                rows={3}
                                                                className="input-field w-full resize-none"
                                                                autoFocus
                                                            />
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleReply(fb.id)} className="btn-primary text-xs px-4 py-1.5">Send Reply</button>
                                                                <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="btn-ghost text-xs px-4 py-1.5">Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button onClick={() => { setReplyingTo(fb.id); setReplyText(fb.admin_reply || ''); }} className="btn-primary text-xs px-3 py-1.5">
                                                                {fb.admin_reply ? '✏️ Edit Reply' : '💬 Reply'}
                                                            </button>
                                                            {fb.status === 'new' && (
                                                                <button onClick={() => handleFeedbackStatus(fb.id, 'read')} className="btn-ghost text-xs px-3 py-1.5">👁 Mark Read</button>
                                                            )}
                                                            <button onClick={() => handleDeleteFeedback(fb.id)} className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors">
                                                                🗑 Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
