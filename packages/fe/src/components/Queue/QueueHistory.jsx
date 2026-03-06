import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * Feature 3: Queue History component
 * Shows previously played songs with replay capability
 */
export default function QueueHistory({ slug, onReplay }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [replayingId, setReplayingId] = useState(null);

    const fetchHistory = useCallback(async () => {
        if (!slug) return;
        setIsLoading(true);
        try {
            const res = await api.get(`/api/rooms/${slug}/history`, { params: { limit: 50 } });
            setHistory(res.data.history || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setIsLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleReplay = async (item) => {
        setReplayingId(item.id);
        try {
            await onReplay(null, item.youtube_id, item.title);
            toast.success(`Re-added: ${item.title}`);
        } catch {
            // Error handled by hook
        } finally {
            setReplayingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="glass-card p-6 flex flex-col min-h-[450px] max-h-[450px]">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="skeleton h-6 w-32" />
                </div>
                <div className="space-y-3 flex-1 overflow-hidden">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-14 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 flex flex-col min-h-[450px] max-h-[450px]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    History
                    <span className="text-sm text-text-muted font-normal">({total})</span>
                </h3>
                <button onClick={fetchHistory} className="btn-ghost text-xs p-1.5" title="Refresh">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                </button>
            </div>

            {history.length === 0 ? (
                <div className="text-center flex-1 flex flex-col items-center justify-center animate-fade-in">
                    <p className="text-text-muted text-sm">No songs played yet</p>
                </div>
            ) : (
                <div className="space-y-1.5 flex-1 overflow-y-scroll scrollbar-thin pr-1 min-h-0">
                    {history.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-card-hover transition-all group">
                            <div className="flex-shrink-0 w-10 h-8 rounded-lg overflow-hidden bg-card">
                                <img
                                    src={item.thumbnail || `https://img.youtube.com/vi/${item.youtube_id}/default.jpg`}
                                    alt="" className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-text-muted">
                                    {item.added_by_name}
                                    {item.played_at && ` · ${new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </p>
                            </div>
                            <button
                                onClick={() => handleReplay(item)}
                                disabled={replayingId === item.id}
                                className="flex-shrink-0 p-1.5 rounded-lg text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                title="Add to queue again"
                            >
                                {replayingId === item.id ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
