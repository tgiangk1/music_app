import { Router } from 'express';
import { getDb } from '../config/database.js';
import { getIO } from '../services/socket.js';

const router = Router();

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'EDM', 'Jazz', 'Classical',
  'Lo-fi', 'K-Pop', 'Latin', 'Country', 'Metal', 'Indie',
  'Acoustic', 'Chill', 'Party', 'Focus', 'Workout',
];

// GET /api/explore/genres — list available genres
router.get('/genres', (req, res) => {
  res.json({ genres: GENRES });
});

// GET /api/explore/rooms — public room discovery (no auth required)
router.get('/rooms', (req, res) => {
  try {
    const db = getDb();
    const { search, genre, sort = 'active', limit: rawLimit, offset: rawOffset } = req.query;

    let limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);
    let offset = Math.max(parseInt(rawOffset) || 0, 0);

    // Build query — only public rooms
    let whereClause = 'WHERE r.is_public = 1';
    const params = [];

    if (search && search.trim()) {
      whereClause += ' AND (r.name LIKE ? OR r.description LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    if (genre && GENRES.includes(genre)) {
      whereClause += ' AND r.genre = ?';
      params.push(genre);
    }

    // Sort options
    let orderClause;
    switch (sort) {
      case 'popular':
        orderClause = 'ORDER BY member_count DESC, r.created_at DESC';
        break;
      case 'newest':
        orderClause = 'ORDER BY r.created_at DESC';
        break;
      case 'active':
      default:
        orderClause = 'ORDER BY member_count DESC, r.created_at DESC';
        break;
    }

    // Count total for pagination
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM rooms r ${whereClause}`).get(...params);
    const total = countRow?.total || 0;

    // Main query
    const rooms = db.prepare(`
      SELECT r.id, r.name, r.slug, r.description, r.cover_color, r.room_icon, r.genre, r.tags,
             r.created_at, u.display_name as creator_name, u.avatar as creator_avatar,
             (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Enrich with now_playing and online_count
    const io = getIO();
    const enrichedRooms = rooms.map(room => {
      // Get currently playing song
      const nowPlaying = db.prepare(
        'SELECT title, youtube_id, thumbnail, channel_name FROM songs WHERE room_id = ? AND is_playing = 1'
      ).get(room.id);

      // Get online count from Socket.IO namespace
      let onlineCount = 0;
      if (io) {
        try {
          const nsp = io.of(`/room/${room.slug}`);
          onlineCount = nsp.sockets?.size || 0;
        } catch { }
      }

      return {
        ...room,
        tags: room.tags ? JSON.parse(room.tags) : [],
        has_password: false, // Public rooms shown here never require password info
        now_playing: nowPlaying ? {
          title: nowPlaying.title,
          youtubeId: nowPlaying.youtube_id,
          thumbnail: nowPlaying.thumbnail,
          artist: nowPlaying.channel_name,
        } : null,
        online_count: onlineCount,
      };
    });

    res.json({
      rooms: enrichedRooms,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('Error in explore rooms:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router;
