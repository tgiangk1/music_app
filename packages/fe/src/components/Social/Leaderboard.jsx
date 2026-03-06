import { useState, useEffect } from 'react';
import api from '../../lib/api';

/**
 * Feature 5: Weekly Leaderboard
 * Top members by songs contributed + vote score
 */
export default function Leaderboard({ slug }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        setIsLoading(true);
        api.get(`/api/rooms/${slug}/leaderboard`)
            .then(res => setEntries(res.data.leaderboard || []))
            .catch(() => setEntries([]))
            .finally(() => setIsLoading(false));
    }, [slug]);

    if (isLoading) {
        return <div className="glass-card p-4"><div className="skeleton h-32 rounded-xl" /></div>;
    }

    if (entries.length === 0) {
        return (
            <div className="glass-card p-4 text-center">
                <p className="text-text-muted text-sm">No activity this week yet</p>
            </div>
        );
    }

    const medals = ['🥇', '🥈', '🥉'];

    return (
        <div className="glass-card p-4">
            <h3 className="font-display text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                🏆 Weekly Leaderboard
            </h3>
            <div className="space-y-1.5">
                {entries.map((entry, i) => (
                    <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition-all
              ${i < 3 ? 'bg-surface/60' : 'hover:bg-surface/30'}`}
                        style={{ animationDelay: `${i * 50}ms` }}
                    >
                        {/* Rank */}
                        <div className="w-7 text-center flex-shrink-0">
                            {i < 3 ? (
                                <span className="text-lg">{medals[i]}</span>
                            ) : (
                                <span className="text-sm font-semibold text-text-muted">{i + 1}</span>
                            )}
                        </div>

                        {/* Avatar */}
                        <img
                            src={entry.avatar || `https://ui-avatars.com/api/?name=${entry.display_name}&background=random&size=32`}
                            alt=""
                            className="w-8 h-8 rounded-full flex-shrink-0"
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.display_name}</p>
                            <p className="text-[10px] text-text-muted">
                                {entry.total_songs} songs added · {entry.songs_played} played
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
