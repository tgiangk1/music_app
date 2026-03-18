import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// ==================== DJ LEADERBOARD ====================

// GET /api/gamification/leaderboard?period=week|month|all&limit=20
router.get('/leaderboard', (req, res) => {
    const { period = 'week', limit = 20 } = req.query;
    const db = getDb();

    let dateFilter = '';
    if (period === 'week') dateFilter = "AND sh.played_at >= datetime('now', '-7 days')";
    else if (period === 'month') dateFilter = "AND sh.played_at >= datetime('now', '-30 days')";

    try {
        const leaders = db.prepare(`
            SELECT
                u.id,
                u.display_name,
                u.avatar,
                COUNT(DISTINCT sh.id) as songs_played,
                COALESCE(SUM(sh.duration), 0) as total_duration,
                COUNT(DISTINCT sh.room_id) as rooms_contributed,
                (
                    SELECT COUNT(*) FROM votes v
                    JOIN songs s ON v.song_id = s.id
                    WHERE s.added_by = u.id AND v.type = 'up'
                ) as total_upvotes
            FROM song_history sh
            JOIN users u ON sh.added_by = u.id
            WHERE 1=1 ${dateFilter}
            GROUP BY u.id
            ORDER BY songs_played DESC, total_upvotes DESC
            LIMIT ?
        `).all(parseInt(limit));

        // Add rank and format
        const ranked = leaders.map((l, i) => ({
            rank: i + 1,
            userId: l.id,
            displayName: l.display_name,
            avatar: l.avatar,
            songsPlayed: l.songs_played,
            listeningHours: Math.round((l.total_duration || 0) / 3600 * 10) / 10,
            roomsContributed: l.rooms_contributed,
            totalUpvotes: l.total_upvotes,
        }));

        res.json({ leaderboard: ranked, period });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ==================== ACHIEVEMENTS ====================

const ACHIEVEMENTS = [
    { id: 'first_song', name: 'First Song', emoji: '🎵', description: 'Add your first song', target: 1, type: 'songs_added' },
    { id: 'party_starter', name: 'Party Starter', emoji: '🎉', description: 'Add 50 songs', target: 50, type: 'songs_added' },
    { id: 'dj_master', name: 'DJ Master', emoji: '🎧', description: 'Add 200 songs', target: 200, type: 'songs_added' },
    { id: 'crowd_favorite', name: 'Crowd Favorite', emoji: '⭐', description: 'Get 10 upvotes', target: 10, type: 'upvotes_received' },
    { id: 'superstar', name: 'Superstar', emoji: '🌟', description: 'Get 100 upvotes', target: 100, type: 'upvotes_received' },
    { id: 'explorer', name: 'Explorer', emoji: '🧭', description: 'Join 5 different rooms', target: 5, type: 'rooms_joined' },
    { id: 'social_butterfly', name: 'Social Butterfly', emoji: '🦋', description: 'Send 100 chat messages', target: 100, type: 'messages_sent' },
    { id: 'chatterbox', name: 'Chatterbox', emoji: '💬', description: 'Send 500 chat messages', target: 500, type: 'messages_sent' },
    { id: 'streak_3', name: 'On Fire', emoji: '🔥', description: '3-day listening streak', target: 3, type: 'streak' },
    { id: 'streak_7', name: 'Unstoppable', emoji: '💪', description: '7-day listening streak', target: 7, type: 'streak' },
    { id: 'streak_30', name: 'Dedicated', emoji: '🏆', description: '30-day listening streak', target: 30, type: 'streak' },
    { id: 'night_owl', name: 'Night Owl', emoji: '🦉', description: 'Listen after midnight', target: 1, type: 'night_listener' },
];

// GET /api/gamification/achievements/:userId
router.get('/achievements/:userId', (req, res) => {
    const db = getDb();
    const { userId } = req.params;

    try {
        // Get user stats
        const songsAdded = db.prepare('SELECT COUNT(*) as c FROM song_history WHERE added_by = ?').get(userId)?.c || 0;
        const upvotesReceived = db.prepare(`
            SELECT COUNT(*) as c FROM votes v
            JOIN songs s ON v.song_id = s.id
            WHERE s.added_by = ? AND v.type = 'up'
        `).get(userId)?.c || 0;
        const roomsJoined = db.prepare('SELECT COUNT(DISTINCT room_id) as c FROM room_members WHERE user_id = ?').get(userId)?.c || 0;
        const messagesSent = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE user_id = ?').get(userId)?.c || 0;

        // Calculate streak
        const streak = calculateStreak(db, userId);

        // Check night owl
        const nightListening = db.prepare(`
            SELECT COUNT(*) as c FROM song_history
            WHERE added_by = ? AND CAST(strftime('%H', played_at) AS INTEGER) >= 0
            AND CAST(strftime('%H', played_at) AS INTEGER) < 5
        `).get(userId)?.c || 0;

        const stats = {
            songs_added: songsAdded,
            upvotes_received: upvotesReceived,
            rooms_joined: roomsJoined,
            messages_sent: messagesSent,
            streak: streak.current,
            night_listener: nightListening > 0 ? 1 : 0,
        };

        const achievements = ACHIEVEMENTS.map(a => {
            const current = stats[a.type] || 0;
            return {
                ...a,
                current: Math.min(current, a.target),
                unlocked: current >= a.target,
                progress: Math.min(1, current / a.target),
            };
        });

        res.json({ achievements, stats, streak });
    } catch (err) {
        console.error('Achievements error:', err);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// ==================== LISTENING STREAKS ====================

function calculateStreak(db, userId) {
    const days = db.prepare(`
        SELECT DISTINCT date(played_at) as day
        FROM song_history WHERE added_by = ?
        ORDER BY day DESC LIMIT 60
    `).all(userId).map(r => r.day);

    if (days.length === 0) return { current: 0, longest: 0, history: [] };

    let current = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if streak includes today or yesterday
    if (days[0] === today || days[0] === yesterday) {
        current = 1;
        for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1]);
            const curr = new Date(days[i]);
            const diffDays = (prev - curr) / 86400000;
            if (diffDays === 1) current++;
            else break;
        }
    }

    // Calculate longest streak
    let longest = 1, tempStreak = 1;
    for (let i = 1; i < days.length; i++) {
        const prev = new Date(days[i - 1]);
        const curr = new Date(days[i]);
        if ((prev - curr) / 86400000 === 1) { tempStreak++; longest = Math.max(longest, tempStreak); }
        else tempStreak = 1;
    }

    return { current, longest: Math.max(longest, current), history: days.slice(0, 30) };
}

// GET /api/gamification/streak/:userId
router.get('/streak/:userId', (req, res) => {
    const db = getDb();
    try {
        const streak = calculateStreak(db, req.params.userId);
        res.json(streak);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch streak' });
    }
});

// ==================== WEEKLY WRAPPED ====================

// GET /api/gamification/wrapped/:userId
router.get('/wrapped/:userId', (req, res) => {
    const db = getDb();
    const { userId } = req.params;

    try {
        const weekAgo = "datetime('now', '-7 days')";

        const totalSongs = db.prepare(`SELECT COUNT(*) as c FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo}`).get(userId)?.c || 0;
        const totalDuration = db.prepare(`SELECT COALESCE(SUM(duration), 0) as d FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo}`).get(userId)?.d || 0;
        const roomsVisited = db.prepare(`SELECT COUNT(DISTINCT room_id) as c FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo}`).get(userId)?.c || 0;

        const topSongs = db.prepare(`
            SELECT title, thumbnail, youtube_id, channel_name, COUNT(*) as play_count
            FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo}
            GROUP BY youtube_id ORDER BY play_count DESC LIMIT 5
        `).all(userId);

        const topArtists = db.prepare(`
            SELECT channel_name, COUNT(*) as play_count
            FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo} AND channel_name IS NOT NULL AND channel_name != ''
            GROUP BY channel_name ORDER BY play_count DESC LIMIT 3
        `).all(userId);

        // Listening by hour (for chart)
        const hourlyActivity = db.prepare(`
            SELECT CAST(strftime('%H', played_at) AS INTEGER) as hour, COUNT(*) as count
            FROM song_history WHERE added_by = ? AND played_at >= ${weekAgo}
            GROUP BY hour ORDER BY hour
        `).all(userId);

        res.json({
            period: 'week',
            totalSongs,
            listeningHours: Math.round(totalDuration / 3600 * 10) / 10,
            roomsVisited,
            topSongs,
            topArtists,
            hourlyActivity,
        });
    } catch (err) {
        console.error('Wrapped error:', err);
        res.status(500).json({ error: 'Failed to fetch wrapped' });
    }
});

export default router;
