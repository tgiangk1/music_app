import { useState, useEffect } from 'react';
import api from '../../lib/api';

const ACTION_CONFIG = {
    join: { icon: '🟢', label: 'joined', color: 'text-success' },
    leave: { icon: '🔴', label: 'left', color: 'text-danger' },
    song_add: { icon: '🎵', label: 'added a song', color: 'text-primary' },
    skip: { icon: '⏭️', label: 'skipped', color: 'text-warning' },
    chat: { icon: '💬', label: 'sent a message', color: 'text-info' },
    vote: { icon: '👍', label: 'voted', color: 'text-success' },
};

/**
 * Feature 6: Room Activity Feed
 * Timeline of room activities
 */
export default function ActivityFeed({ slug }) {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!slug || !isOpen) return;
        setIsLoading(true);
        api.get(`/api/rooms/${slug}/activity`, { params: { limit: 30 } })
            .then(res => setActivities(res.data.activities || []))
            .catch(() => setActivities([]))
            .finally(() => setIsLoading(false));
    }, [slug, isOpen]);

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="font-display font-semibold text-sm">Activity</span>
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
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}
                        </div>
                    ) : activities.length === 0 ? (
                        <p className="text-text-muted text-sm text-center py-4">No activity yet</p>
                    ) : (
                        <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                            {activities.map((a) => {
                                const config = ACTION_CONFIG[a.action_type] || { icon: '📌', label: a.action_type, color: 'text-text-muted' };
                                return (
                                    <div key={a.id} className="flex items-center gap-2 py-1.5 text-xs">
                                        <span className="flex-shrink-0">{config.icon}</span>
                                        <span className="font-medium text-text-primary truncate">
                                            {a.display_name || 'System'}
                                        </span>
                                        <span className={`${config.color}`}>{config.label}</span>
                                        {a.metadata?.songTitle && (
                                            <span className="text-text-muted truncate max-w-[100px]" title={a.metadata.songTitle}>
                                                — {a.metadata.songTitle}
                                            </span>
                                        )}
                                        <span className="text-text-muted ml-auto flex-shrink-0">{formatTime(a.created_at)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
