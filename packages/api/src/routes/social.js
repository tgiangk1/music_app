import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/:slug/activity', optionalAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const activities = db.prepare(`SELECT a.*, u.display_name, u.avatar FROM activity_log a LEFT JOIN users u ON a.user_id = u.id WHERE a.room_id = ? ORDER BY a.created_at DESC LIMIT ?`).all(room.id, limit);
  const formatted = activities.map(a => ({ ...a, metadata: a.metadata ? JSON.parse(a.metadata) : {} }));
  res.json({ activities: formatted });
});

router.get('/:slug/stats', optionalAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Basic counts
  const songCount = db.prepare('SELECT COUNT(*) as count FROM song_history WHERE room_id = ?').get(room.id);
  const totalDuration = db.prepare('SELECT COALESCE(SUM(duration), 0) as total FROM song_history WHERE room_id = ?').get(room.id);
  const participants = db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM (SELECT added_by as user_id FROM song_history WHERE room_id = ? UNION SELECT user_id FROM room_members WHERE room_id = ?)`).get(room.id, room.id);

  // Top 5 most played songs
  const topSongs = db.prepare(`
    SELECT youtube_id, title, thumbnail, channel_name, COUNT(*) as play_count
    FROM song_history WHERE room_id = ?
    GROUP BY youtube_id ORDER BY play_count DESC LIMIT 5
  `).all(room.id);

  // Top 5 DJs (most songs added)
  const topDJs = db.prepare(`
    SELECT h.added_by as user_id, u.display_name, u.avatar, COUNT(*) as song_count
    FROM song_history h JOIN users u ON h.added_by = u.id
    WHERE h.room_id = ? GROUP BY h.added_by ORDER BY song_count DESC LIMIT 5
  `).all(room.id);

  // Activity by hour (0-23)
  const hourlyActivity = db.prepare(`
    SELECT CAST(strftime('%H', played_at) AS INTEGER) as hour, COUNT(*) as count
    FROM song_history WHERE room_id = ?
    GROUP BY hour ORDER BY hour
  `).all(room.id);

  // Recent 7-day trend
  const dailyTrend = db.prepare(`
    SELECT date(played_at) as day, COUNT(*) as count
    FROM song_history WHERE room_id = ? AND played_at >= datetime('now', '-7 days')
    GROUP BY day ORDER BY day
  `).all(room.id);

  // Unique artists count
  const uniqueArtists = db.prepare(`
    SELECT COUNT(DISTINCT channel_name) as count FROM song_history WHERE room_id = ?
  `).get(room.id);

  res.json({
    stats: {
      totalSongs: songCount?.count || 0,
      totalDuration: totalDuration?.total || 0,
      totalParticipants: participants?.count || 0,
      uniqueArtists: uniqueArtists?.count || 0,
      topSongs,
      topDJs,
      hourlyActivity,
      dailyTrend,
    },
  });
});

export default router;
