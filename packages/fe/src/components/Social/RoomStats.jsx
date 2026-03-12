import { useState, useEffect } from 'react';
import api from '../../lib/api';

/**
 * Feature 6: Room Statistics
 * Shows simple room stats: total songs played, total listen time, total participants
 */
export default function RoomStats({ slug }) {
    const [stats, setStats] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !slug) return;
        setIsLoading(true);
        api.get(`/api/rooms/${slug}/stats`)
            .then(res => setStats(res.data.stats))
            .catch(() => setStats(null))
            .finally(() => setIsLoading(false));
    }, [isOpen, slug]);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                    <span className="font-display font-semibold text-sm">Room Stats</span>
                </div>
                <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {isOpen && (
                <div className="px-4 pb-4 animate-fade-in">
                    {isLoading ? (
                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                        </div>
                    ) : !stats ? (
                        <p className="text-text-muted text-sm text-center py-4">Stats unavailable</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-surface rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold font-display text-primary">{stats.totalSongs || 0}</p>
                                <p className="text-[10px] text-text-muted mt-1">Songs Played</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold font-display text-success">{formatDuration(stats.totalDuration)}</p>
                                <p className="text-[10px] text-text-muted mt-1">Listen Time</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold font-display text-accent">{stats.totalParticipants || 0}</p>
                                <p className="text-[10px] text-text-muted mt-1">Participants</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
