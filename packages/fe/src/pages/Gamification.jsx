import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

const PERIOD_TABS = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
];

export default function Gamification() {
    const [activeTab, setActiveTab] = useState('leaderboard');
    const [period, setPeriod] = useState('week');
    const [leaderboard, setLeaderboard] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [streak, setStreak] = useState({ current: 0, longest: 0, history: [] });
    const [wrapped, setWrapped] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();

    // Fetch leaderboard
    useEffect(() => {
        if (activeTab !== 'leaderboard') return;
        setLoading(true);
        api.get(`/api/gamification/leaderboard?period=${period}`)
            .then(r => setLeaderboard(r.data.leaderboard || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [activeTab, period]);

    // Fetch achievements
    useEffect(() => {
        if (activeTab !== 'achievements' || !user) return;
        setLoading(true);
        api.get(`/api/gamification/achievements/${user.id}`)
            .then(r => {
                setAchievements(r.data.achievements || []);
                setStreak(r.data.streak || { current: 0, longest: 0, history: [] });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [activeTab, user]);

    // Fetch streak
    useEffect(() => {
        if (activeTab !== 'streaks' || !user) return;
        setLoading(true);
        api.get(`/api/gamification/streak/${user.id}`)
            .then(r => setStreak(r.data || { current: 0, longest: 0, history: [] }))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [activeTab, user]);

    // Fetch wrapped
    useEffect(() => {
        if (activeTab !== 'wrapped' || !user) return;
        setLoading(true);
        api.get(`/api/gamification/wrapped/${user.id}`)
            .then(r => setWrapped(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [activeTab, user]);

    const TABS = [
        { id: 'leaderboard', label: '🏆 Leaderboard', color: '#fbbf24' },
        { id: 'achievements', label: '🎖️ Achievements', color: '#8b5cf6' },
        { id: 'streaks', label: '🔥 Streaks', color: '#f97316' },
        { id: 'wrapped', label: '📊 Wrapped', color: '#06b6d4' },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="text-text-muted hover:text-text-primary transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <h1 className="text-xl font-bold">Gamification</h1>
                    </div>
                    {user && (
                        <div className="flex items-center gap-2">
                            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                            <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                {/* Tab navigation */}
                <div className="flex gap-1 p-1 bg-surface rounded-xl mb-6 overflow-x-auto">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[100px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-card shadow-md'
                                    : 'text-text-muted hover:text-text-secondary'
                            }`}
                            style={activeTab === tab.id ? { color: tab.color } : {}}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'leaderboard' && <LeaderboardTab data={leaderboard} period={period} setPeriod={setPeriod} currentUserId={user?.id} />}
                        {activeTab === 'achievements' && <AchievementsTab data={achievements} />}
                        {activeTab === 'streaks' && <StreaksTab streak={streak} />}
                        {activeTab === 'wrapped' && <WrappedTab data={wrapped} />}
                    </>
                )}
            </div>
        </div>
    );
}

// ==================== LEADERBOARD TAB ====================
function LeaderboardTab({ data, period, setPeriod, currentUserId }) {
    const getRankBadge = (rank) => {
        if (rank === 1) return <span className="text-lg">👑</span>;
        if (rank === 2) return <span className="text-lg">🥈</span>;
        if (rank === 3) return <span className="text-lg">🥉</span>;
        return <span className="text-sm font-mono text-text-muted">#{rank}</span>;
    };

    return (
        <div className="space-y-4">
            {/* Period filter */}
            <div className="flex gap-1 p-1 bg-surface rounded-lg w-fit">
                {PERIOD_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setPeriod(t.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            period === t.id ? 'bg-amber-500/20 text-amber-400' : 'text-text-muted hover:text-text-secondary'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {data.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <p className="text-4xl mb-3">🏆</p>
                    <p className="text-text-muted">No data yet. Start playing music to climb the leaderboard!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {data.map(entry => (
                        <div
                            key={entry.userId}
                            className={`glass-card p-4 flex items-center gap-4 transition-all hover:scale-[1.01] ${
                                entry.rank <= 3 ? 'border border-amber-500/20' : ''
                            } ${entry.userId === currentUserId ? 'ring-1 ring-primary/30' : ''}`}
                        >
                            <div className="w-10 text-center flex-shrink-0">{getRankBadge(entry.rank)}</div>
                            <img src={entry.avatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{entry.displayName}</p>
                                <div className="flex gap-3 text-xs text-text-muted mt-0.5">
                                    <span>🎵 {entry.songsPlayed} songs</span>
                                    <span>⬆️ {entry.totalUpvotes} votes</span>
                                    <span className="hidden sm:inline">⏱️ {entry.listeningHours}h</span>
                                </div>
                            </div>
                            {entry.rank <= 3 && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    entry.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                                    entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                                    'bg-orange-500/20 text-orange-400'
                                }`}>
                                    Top {entry.rank}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== ACHIEVEMENTS TAB ====================
function AchievementsTab({ data }) {
    const unlocked = data.filter(a => a.unlocked);
    const locked = data.filter(a => !a.unlocked);

    return (
        <div className="space-y-6">
            <div className="glass-card p-4">
                <p className="text-sm text-text-muted">
                    🎖️ <span className="font-semibold text-text-primary">{unlocked.length}</span> / {data.length} achievements unlocked
                </p>
                <div className="mt-2 h-2 bg-border/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full transition-all"
                        style={{ width: `${data.length > 0 ? (unlocked.length / data.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {unlocked.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-text-muted mb-3">✨ Unlocked</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {unlocked.map(a => (
                            <div key={a.id} className="glass-card p-4 text-center border border-purple-500/20 hover:scale-105 transition-transform">
                                <div className="text-3xl mb-2">{a.emoji}</div>
                                <p className="text-sm font-semibold">{a.name}</p>
                                <p className="text-[11px] text-text-muted mt-1">{a.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {locked.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-text-muted mb-3">🔒 Locked</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {locked.map(a => (
                            <div key={a.id} className="glass-card p-4 text-center opacity-60">
                                <div className="text-3xl mb-2 grayscale">{a.emoji}</div>
                                <p className="text-sm font-semibold">{a.name}</p>
                                <p className="text-[11px] text-text-muted mt-1">{a.description}</p>
                                <div className="mt-2 h-1.5 bg-border/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500/50 rounded-full"
                                        style={{ width: `${a.progress * 100}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-text-muted mt-1">{a.current}/{a.target}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== STREAKS TAB ====================
function StreaksTab({ streak }) {
    // Generate last 30 days for heatmap
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        days.push({
            date: dateStr,
            label: d.toLocaleDateString([], { weekday: 'short' }),
            dayNum: d.getDate(),
            active: streak.history?.includes(dateStr),
        });
    }

    return (
        <div className="space-y-6">
            {/* Current streak hero */}
            <div className="glass-card p-8 text-center border border-orange-500/20">
                <div className="text-6xl mb-3">{streak.current > 0 ? '🔥' : '❄️'}</div>
                <p className="text-5xl font-black mb-1" style={{ color: streak.current > 0 ? '#f97316' : '#94a3b8' }}>
                    {streak.current}
                </p>
                <p className="text-text-muted font-medium">Day Streak</p>
                <p className="text-xs text-text-muted mt-2">Longest: {streak.longest} days</p>
            </div>

            {/* Heatmap calendar */}
            <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3">Last 30 Days</h3>
                <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
                    {days.map(d => (
                        <div
                            key={d.date}
                            title={`${d.date} ${d.active ? '✓' : ''}`}
                            className={`aspect-square rounded-md text-[9px] flex items-center justify-center font-mono transition-colors ${
                                d.active
                                    ? 'bg-orange-500/30 text-orange-300 ring-1 ring-orange-500/40'
                                    : 'bg-border/20 text-text-muted/50'
                            }`}
                        >
                            {d.dayNum}
                        </div>
                    ))}
                </div>
            </div>

            {/* Motivation */}
            <div className="glass-card p-4 text-center">
                <p className="text-sm text-text-muted">
                    {streak.current === 0 && 'Play a song today to start your streak! 🎵'}
                    {streak.current >= 1 && streak.current < 3 && "Keep going! You're building momentum 💪"}
                    {streak.current >= 3 && streak.current < 7 && "You're on fire! Keep the streak alive 🔥"}
                    {streak.current >= 7 && streak.current < 30 && "Unstoppable! You're a true music lover 🎧"}
                    {streak.current >= 30 && "LEGENDARY! 30+ day streak! 🏆👑"}
                </p>
            </div>
        </div>
    );
}

// ==================== WRAPPED TAB ====================
function WrappedTab({ data }) {
    if (!data) return (
        <div className="glass-card p-12 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-text-muted">No listening data this week yet.</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="🎵" label="Songs Played" value={data.totalSongs} color="#06b6d4" />
                <StatCard icon="⏱️" label="Hours Listened" value={data.listeningHours} color="#8b5cf6" />
                <StatCard icon="🏠" label="Rooms Visited" value={data.roomsVisited} color="#f97316" />
                <StatCard icon="🎤" label="Top Artists" value={data.topArtists?.length || 0} color="#ec4899" />
            </div>

            {/* Top Songs */}
            {data.topSongs?.length > 0 && (
                <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold mb-3">🎵 Top Songs This Week</h3>
                    <div className="space-y-2">
                        {data.topSongs.map((song, i) => (
                            <div key={`${song.youtube_id}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors">
                                <span className="text-lg font-bold text-text-muted w-6 text-center">{i + 1}</span>
                                <img
                                    src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id}/default.jpg`}
                                    alt="" className="w-12 h-9 rounded object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{song.title}</p>
                                    <p className="text-xs text-text-muted">{song.channel_name}</p>
                                </div>
                                <span className="text-xs text-text-muted px-2 py-0.5 bg-border/20 rounded-full">{song.play_count}x</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Artists */}
            {data.topArtists?.length > 0 && (
                <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold mb-3">🎤 Top Artists</h3>
                    <div className="space-y-2">
                        {data.topArtists.map((artist, i) => (
                            <div key={artist.channel_name} className="flex items-center gap-3 p-2">
                                <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                                <p className="text-sm font-medium flex-1">{artist.channel_name}</p>
                                <span className="text-xs text-text-muted">{artist.play_count} songs</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Hourly Activity */}
            {data.hourlyActivity?.length > 0 && (
                <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold mb-3">📈 Listening Activity by Hour</h3>
                    <div className="flex items-end gap-0.5 h-24">
                        {Array.from({ length: 24 }, (_, h) => {
                            const entry = data.hourlyActivity.find(e => e.hour === h);
                            const count = entry?.count || 0;
                            const maxCount = Math.max(...data.hourlyActivity.map(e => e.count), 1);
                            const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
                            return (
                                <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                                    <div
                                        className={`w-full rounded-t transition-all ${count > 0 ? 'bg-cyan-500/60' : 'bg-border/20'}`}
                                        style={{ height: `${height}%` }}
                                        title={`${h}:00 — ${count} songs`}
                                    />
                                    {h % 6 === 0 && <span className="text-[8px] text-text-muted">{h}h</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <div className="glass-card p-4 text-center">
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
        </div>
    );
}
