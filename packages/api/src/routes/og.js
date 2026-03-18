import { Router } from 'express';
import { getDb } from '../config/database.js';
import { getIO } from '../services/socket.js';

const router = Router();

// GET /api/og/room/:slug — Open Graph metadata for room share links
router.get('/room/:slug', (req, res) => {
  try {
    const db = getDb();
    const room = db.prepare(`
      SELECT r.*, u.display_name as creator_name
      FROM rooms r LEFT JOIN users u ON r.created_by = u.id
      WHERE r.slug = ?
    `).get(req.params.slug);

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Get currently playing song
    const nowPlaying = db.prepare(
      'SELECT title, youtube_id, thumbnail, channel_name FROM songs WHERE room_id = ? AND is_playing = 1'
    ).get(room.id);

    // Get member count
    const memberCount = db.prepare(
      'SELECT COUNT(*) as count FROM room_members WHERE room_id = ?'
    ).get(room.id)?.count || 0;

    // Get online count
    let onlineCount = 0;
    const io = getIO();
    if (io) {
      try {
        const nsp = io.of(`/room/${room.slug}`);
        onlineCount = nsp.sockets?.size || 0;
      } catch { }
    }

    const title = `${room.name} — SoundDen`;
    let description = room.description || `Collaborative music room`;
    if (nowPlaying) {
      description = `🎵 Now Playing: ${nowPlaying.title} | ${onlineCount} listener${onlineCount !== 1 ? 's' : ''}`;
    } else if (onlineCount > 0) {
      description = `${onlineCount} listener${onlineCount !== 1 ? 's' : ''} online`;
    }

    const image = nowPlaying
      ? `https://img.youtube.com/vi/${nowPlaying.youtube_id}/maxresdefault.jpg`
      : null;

    res.json({
      title,
      description,
      image,
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${room.slug}`,
      siteName: 'SoundDen',
      roomName: room.name,
      roomIcon: room.room_icon || '🎵',
      genre: room.genre,
      memberCount,
      onlineCount,
      nowPlaying: nowPlaying ? {
        title: nowPlaying.title,
        artist: nowPlaying.channel_name,
        thumbnail: nowPlaying.thumbnail,
        youtubeId: nowPlaying.youtube_id,
      } : null,
    });
  } catch (err) {
    console.error('Error fetching OG data:', err);
    res.status(500).json({ error: 'Failed to fetch room metadata' });
  }
});

export default router;
