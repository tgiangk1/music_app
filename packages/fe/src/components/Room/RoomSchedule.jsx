import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function RoomSchedule({ slug }) {
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [title, setTitle] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [notifyMembers, setNotifyMembers] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await api.get(`/api/rooms/${slug}/schedules`);
            setSchedules(res.data.schedules);
        } catch (err) {
            console.error('Failed to fetch schedules', err);
        } finally {
            setIsLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const formData = {
                title: title.trim(),
                scheduledAt: new Date(scheduledAt).toISOString(),
                notifyMembers
            };
            const res = await api.post(`/api/rooms/${slug}/schedules`, formData);
            setSchedules((prev) => [...prev, res.data.schedule].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
            toast.success('Schedule created successfully');

            // Reset form
            setTitle('');
            setScheduledAt('');
            setNotifyMembers(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create schedule');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this scheduled event?')) return;
        try {
            await api.delete(`/api/rooms/${slug}/schedules/${id}`);
            setSchedules((prev) => prev.filter(s => s.id !== id));
            toast.success('Schedule deleted');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete schedule');
        }
    };

    return (
        <div className="glass-card p-4 space-y-4">
            <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Room Schedule
            </h2>

            {/* Create Schedule Form */}
            <form onSubmit={handleSubmit} className="bg-surface border border-border/50 rounded-xl p-3 space-y-3">
                <div>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-field w-full text-sm"
                        placeholder="Event Title (e.g., Chill Friday Starts)"
                        required
                    />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="input-field w-full text-sm"
                        required
                    />
                    <button type="submit" disabled={isSubmitting} className="btn-primary py-2 px-4 shadow-sm">
                        {isSubmitting ? 'Adding...' : 'Add'}
                    </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={notifyMembers}
                        onChange={(e) => setNotifyMembers(e.target.checked)}
                        className="rounded border-border/50 text-primary bg-card"
                    />
                    Notify members when it starts
                </label>
            </form>

            {/* List of pending schedules */}
            <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Pending Events ({schedules.length})</h3>
                {isLoading ? (
                    <div className="text-center text-xs text-text-muted">Loading...</div>
                ) : schedules.length === 0 ? (
                    <div className="text-center py-4 text-xs text-text-muted bg-surface/30 rounded-lg">No pending schedules</div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                        {schedules.map((s) => (
                            <div key={s.id} className="bg-card border border-border/30 rounded-lg p-3 flex justify-between items-center group">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate text-text-primary">{s.title}</p>
                                    <p className="text-xs text-text-muted">
                                        {new Date(s.scheduled_at).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(s.id)}
                                    className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Schedule"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
