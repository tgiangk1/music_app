import { useState, useEffect } from 'react';
import api from '../../lib/api';

const HOUR_LABELS = ['12a', '', '2a', '', '4a', '', '6a', '', '8a', '', '10a', '', '12p', '', '2p', '', '4p', '', '6p', '', '8p', '', '10p', ''];

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
            <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
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

    // Build hourly data (0-23)
    const hourlyMap = new Map();
    (stats.hourlyActivity || []).forEach(h => hourlyMap.set(h.hour, h.count));
    const maxHourly = Math.max(1, ...Array.from(hourlyMap.values()));

    return (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin pr-1">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-2">
                <StatCard label="Songs Played" value={stats.totalSongs || 0} icon="🎵" />
                <StatCard label="Listen Time" value={formatDuration(stats.totalDuration)} icon="⏱️" />
                <StatCard label="DJs" value={stats.totalParticipants || 0} icon="🎧" />
                <StatCard label="Artists" value={stats.uniqueArtists || 0} icon="🎤" />
            </div>

            {/* Top Songs */}
            {stats.topSongs?.length > 0 && (
                <div className="glass-card p-3">
                    <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                        <span>🔥</span> Most Played
                    </h4>
                    <div className="space-y-1.5">
                        {stats.topSongs.map((song, i) => (
                            <div key={song.youtube_id} className="flex items-center gap-2.5 group">
                                <span className={`text-xs font-mono w-4 text-center flex-shrink-0 ${i === 0 ? 'text-warning font-bold' : 'text-text-muted'}`}>
                                    {i + 1}
                                </span>
                                <img
                                    src={song.thumbnail}
                                    alt=""
                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-text-primary truncate">{song.title}</p>
                                    <p className="text-[10px] text-text-muted truncate">{song.channel_name}</p>
                                </div>
                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    {song.play_count}×
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top DJs */}
            {stats.topDJs?.length > 0 && (
                <div className="glass-card p-3">
                    <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                        <span>🎧</span> Top DJs
                    </h4>
                    <div className="space-y-1.5">
                        {stats.topDJs.map((dj, i) => {
                            const pct = stats.topDJs[0]?.song_count ? Math.round((dj.song_count / stats.topDJs[0].song_count) * 100) : 0;
                            return (
                                <div key={dj.user_id} className="flex items-center gap-2.5">
                                    <span className={`text-xs font-mono w-4 text-center flex-shrink-0 ${i === 0 ? 'text-warning font-bold' : 'text-text-muted'}`}>
                                        {i + 1}
                                    </span>
                                    <img
                                        src={dj.avatar}
                                        alt=""
                                        className="w-7 h-7 rounded-full border border-border flex-shrink-0"
                                        referrerPolicy="no-referrer"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-text-primary truncate">{dj.display_name}</p>
                                        <div className="mt-0.5 h-1 bg-surface rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-text-muted flex-shrink-0">
                                        {dj.song_count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Hourly Activity */}
            <div className="glass-card p-3">
                <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                    <span>📊</span> Peak Hours
                </h4>
                <div className="flex items-end gap-[2px] h-12">
                    {Array.from({ length: 24 }, (_, h) => {
                        const count = hourlyMap.get(h) || 0;
                        const heightPct = count > 0 ? Math.max(8, (count / maxHourly) * 100) : 4;
                        return (
                            <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}:00 — ${count} songs`}>
                                <div
                                    className={`w-full rounded-sm transition-all ${count > 0 ? 'bg-primary/70' : 'bg-surface'}`}
                                    style={{ height: `${heightPct}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-1">
                    {HOUR_LABELS.map((label, i) => (
                        <span key={i} className="text-[7px] text-text-muted flex-1 text-center">{label}</span>
                    ))}
                </div>
            </div>

            {/* 7-Day Trend */}
            {stats.dailyTrend?.length > 0 && (
                <div className="glass-card p-3">
                    <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                        <span>📈</span> Last 7 Days
                    </h4>
                    <div className="flex items-end gap-1 h-10">
                        {stats.dailyTrend.map((day) => {
                            const maxDay = Math.max(...stats.dailyTrend.map(d => d.count));
                            const pct = maxDay > 0 ? Math.max(10, (day.count / maxDay) * 100) : 10;
                            const dayLabel = new Date(day.day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
                            return (
                                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full bg-accent/60 rounded-sm"
                                        style={{ height: `${pct}%` }}
                                        title={`${dayLabel}: ${day.count} songs`}
                                    />
                                    <span className="text-[7px] text-text-muted">{dayLabel}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {stats.totalSongs === 0 && (
                <div className="text-center py-4">
                    <p className="text-text-muted text-xs">No listening data yet. Play some songs!</p>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-surface rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold font-mono text-primary">{value}</p>
            <p className="text-[10px] text-text-muted mt-0.5 flex items-center justify-center gap-1">
                <span>{icon}</span> {label}
            </p>
        </div>
    );
}
