import { useState, useEffect } from 'react';
import api from '../../lib/api';

/**
 * Room Stats — minimal key metrics display
 * Shows inline when selected as a sidebar tab
 */
export default function RoomStats({ slug }) {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!slug) return;
        setIsLoading(true);
        api.get(`/api/rooms/${slug}/stats`)
            .then(res => setStats(res.data.stats))
            .catch(() => setStats(null))
            .finally(() => setIsLoading(false));
    }, [slug]);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    if (isLoading) {
        return (
            <div className="glass-card p-4">
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="glass-card p-6 text-center">
                <p className="text-text-muted text-sm">Stats unavailable</p>
            </div>
        );
    }

    return (
        <div className="glass-card p-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-primary">{stats.totalSongs || 0}</p>
                    <p className="text-[10px] text-text-muted mt-1">Songs</p>
                </div>
                <div className="bg-surface rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-accent">{formatDuration(stats.totalDuration)}</p>
                    <p className="text-[10px] text-text-muted mt-1">Listen Time</p>
                </div>
                <div className="bg-surface rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-text-secondary">{stats.totalParticipants || 0}</p>
                    <p className="text-[10px] text-text-muted mt-1">Joined</p>
                </div>
            </div>
        </div>
    );
}
