import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';

const router = Router();

// GET /api/rooms/:slug/activity — Activity feed
router.get('/:slug/activity', optionalAuth, (req, res) => {
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

// GET /api/rooms/:slug/stats — Room statistics
router.get('/:slug/stats', optionalAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Total songs played
  const songCount = db.prepare('SELECT COUNT(*) as count FROM song_history WHERE room_id = ?').get(room.id);

  // Total duration (sum of all played songs)
  const totalDuration = db.prepare('SELECT COALESCE(SUM(duration), 0) as total FROM song_history WHERE room_id = ?').get(room.id);

  // Total unique participants (from history + current members)
  const participants = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM (
      SELECT added_by as user_id FROM song_history WHERE room_id = ?
      UNION
      SELECT user_id FROM room_members WHERE room_id = ?
    )
  `).get(room.id, room.id);

  res.json({
    stats: {
      totalSongs: songCount?.count || 0,
      totalDuration: totalDuration?.total || 0,
      totalParticipants: participants?.count || 0,
    }
  });
});

export default router;
