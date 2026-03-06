import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// ── Leaderboard cache (1 hour TTL) ──
const leaderboardCache = new Map(); // slug -> { data, ts }
const LEADERBOARD_TTL = 60 * 60 * 1000; // 1 hour

// GET /api/rooms/:slug/stats/me — Feature 4: Personal stats
router.get('/:slug/stats/me', verifyToken, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const userId = req.user.userId;

  // Songs I added (currently in queue)
  const songsInQueue = db.prepare(
    'SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND added_by = ?'
  ).get(room.id, userId).count;

  // Songs I've added historically
  const songsTotal = db.prepare(
    'SELECT COUNT(*) as count FROM song_history WHERE room_id = ? AND added_by = ?'
  ).get(room.id, userId).count + songsInQueue;

  res.json({
    stats: {
      songsInQueue,
      songsTotal,
      messageCount,
    },
  });
});

// GET /api/rooms/:slug/leaderboard — Feature 5: Weekly leaderboard
router.get('/:slug/leaderboard', verifyToken, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Check cache
  const cached = leaderboardCache.get(req.params.slug);
  if (cached && Date.now() - cached.ts < LEADERBOARD_TTL) {
    return res.json({ leaderboard: cached.data, cached: true });
  }

  // Last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Aggregate: top members by total songs added
  const leaderboard = db.prepare(`
    SELECT
      u.id as user_id,
      u.display_name,
      u.avatar,
      COUNT(DISTINCT h.id) as songs_played,
      COUNT(DISTINCT h.id) + COALESCE(
        (SELECT COUNT(*) FROM songs WHERE added_by = u.id AND room_id = ?), 0
      ) as total_songs
    FROM song_history h
    JOIN users u ON h.added_by = u.id
    WHERE h.room_id = ? AND h.played_at >= ?
    GROUP BY u.id
    ORDER BY total_songs DESC
    LIMIT 10
  `).all(room.id, room.id, weekAgo);

  // Simpler fallback: if no history yet, use current queue
  let result = leaderboard;
  if (leaderboard.length === 0) {
    result = db.prepare(`
      SELECT
        u.id as user_id,
        u.display_name,
        u.avatar,
        COUNT(s.id) as total_songs,
        0 as songs_played
      FROM songs s
      JOIN users u ON s.added_by = u.id
      WHERE s.room_id = ?
      GROUP BY u.id
      ORDER BY total_songs DESC
      LIMIT 10
    `).all(room.id);
  }

  // Cache result
  leaderboardCache.set(req.params.slug, { data: result, ts: Date.now() });

  res.json({ leaderboard: result, cached: false });
});

// GET /api/rooms/:slug/activity — Feature 6: Activity feed
router.get('/:slug/activity', verifyToken, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const limit = Math.min(parseInt(req.query.limit) || 30, 100);

  const activities = db.prepare(`
    SELECT a.*, u.display_name, u.avatar
    FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.room_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(room.id, limit);

  // Parse metadata JSON
  const formatted = activities.map(a => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : {},
  }));

  res.json({ activities: formatted });
});

export default router;
