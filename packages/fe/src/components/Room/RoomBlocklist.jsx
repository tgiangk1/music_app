import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function RoomBlocklist({ slug }) {
    const [blocklist, setBlocklist] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [type, setType] = useState('video'); // 'video' | 'channel'
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchBlocklist = useCallback(async () => {
        try {
            const res = await api.get(`/api/rooms/${slug}/blocklist`);
            setBlocklist(res.data.blocklist);
        } catch (err) {
            console.error('Failed to fetch blocklist', err);
        } finally {
            setIsLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchBlocklist();
    }, [fetchBlocklist]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let finalValue = value.trim();
            if (type === 'video') {
                const match = finalValue.match(/(?:v=|youtu\.be\/|embed\/)([^&?]+)/);
                if (match) finalValue = match[1];
            }

            const res = await api.post(`/api/rooms/${slug}/blocklist`, { type, value: finalValue });
            setBlocklist(prev => [res.data.blockedItem, ...prev]);
            toast.success(`${type === 'video' ? 'Video' : 'Channel'} added to blocklist`);
            setValue('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add to blocklist');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this item from blocklist?')) return;
        try {
            await api.delete(`/api/rooms/${slug}/blocklist/${id}`);
            setBlocklist(prev => prev.filter(b => b.id !== id));
            toast.success('Removed from blocklist');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove from blocklist');
        }
    };

    return (
        <div className="glass-card p-4 space-y-4">
            <h2 className="text-lg font-semibold font-display flex items-center gap-2 text-danger">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Content Blocklist
            </h2>
            <p className="text-xs text-text-muted">
                Prevent members from adding specific videos or channels to the room's queue.
            </p>

            <form onSubmit={handleSubmit} className="bg-surface border border-border/50 rounded-xl p-3 space-y-3">
                <div className="flex gap-2 mb-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name="blockType"
                            value="video"
                            checked={type === 'video'}
                            onChange={() => setType('video')}
                            className="text-danger bg-card"
                        />
                        Target Video (URL or ID)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                            type="radio"
                            name="blockType"
                            value="channel"
                            checked={type === 'channel'}
                            onChange={() => setType('channel')}
                            className="text-danger bg-card"
                        />
                        Target Channel Name
                    </label>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="input-field flex-1 text-sm"
                        placeholder={type === 'video' ? "youtube.com/watch?v=... or ID" : "Type exactly the channel name"}
                        required
                    />
                    <button type="submit" disabled={isSubmitting} className="btn-danger py-2 px-4 shadow-sm">
                        Block
                    </button>
                </div>
            </form>

            <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Blocked Items ({blocklist.length})</h3>
                {isLoading ? (
                    <div className="text-center text-xs text-text-muted">Loading...</div>
                ) : blocklist.length === 0 ? (
                    <div className="text-center py-4 text-xs text-text-muted bg-surface/30 rounded-lg">No blocked items</div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                        {blocklist.map((item) => (
                            <div key={item.id} className="bg-card border border-border/30 rounded-lg p-2.5 flex justify-between items-center group">
                                <div className="min-w-0 flex items-center gap-2">
                                    <span className="text-xs font-mono bg-surface text-text-muted px-1.5 py-0.5 rounded capitalize">
                                        {item.type}
                                    </span>
                                    <span className="text-sm font-medium truncate text-text-primary" title={item.value}>
                                        {item.value}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-1 text-text-muted hover:text-success hover:bg-success/10 rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                    title="Unblock"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
