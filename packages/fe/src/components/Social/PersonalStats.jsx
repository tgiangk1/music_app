import { useState, useEffect } from 'react';
import api from '../../lib/api';

/**
 * Feature 4: Personal Stats
 * Shows user's contribution stats in the room
 */
export default function PersonalStats({ slug }) {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        setIsLoading(true);
        api.get(`/api/rooms/${slug}/stats/me`)
            .then(res => setStats(res.data.stats))
            .catch(() => setStats(null))
            .finally(() => setIsLoading(false));
    }, [slug]);

    if (isLoading) {
        return <div className="glass-card p-4"><div className="skeleton h-20 rounded-xl" /></div>;
    }

    if (!stats) return null;

    const items = [
        { label: 'Songs Added', value: stats.songsTotal, icon: '🎵', color: 'text-primary' },
        { label: 'In Queue', value: stats.songsInQueue, icon: '📋', color: 'text-info' },
        { label: 'Upvotes', value: stats.upvotesReceived, icon: '👍', color: 'text-success' },
        { label: 'Vote Score', value: stats.totalVoteScore, icon: '⭐', color: 'text-warning' },
        { label: 'Messages', value: stats.messageCount, icon: '💬', color: 'text-primary' },
    ];

    return (
        <div className="glass-card p-4">
            <h3 className="font-display text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                📊 My Stats
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {items.map(item => (
                    <div key={item.label} className="text-center p-2 rounded-xl bg-surface/50">
                        <div className="text-lg">{item.icon}</div>
                        <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-[10px] text-text-muted leading-tight">{item.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
