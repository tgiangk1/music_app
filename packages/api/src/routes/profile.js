import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/profile/:userId — public profile
router.get('/:userId', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, display_name, avatar, bio, favorite_genre, role, created_at FROM users WHERE id = ?'
    ).get(req.params.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Stats
    const songsAdded = db.prepare(
      'SELECT COUNT(*) as count FROM song_history WHERE added_by = ?'
    ).get(user.id);

    const totalListeningTime = db.prepare(
      'SELECT COALESCE(SUM(duration), 0) as total FROM song_history WHERE added_by = ?'
    ).get(user.id);

    const roomsJoined = db.prepare(
      'SELECT COUNT(*) as count FROM room_members WHERE user_id = ?'
    ).get(user.id);

    const uniqueArtists = db.prepare(
      'SELECT COUNT(DISTINCT channel_name) as count FROM song_history WHERE added_by = ?'
    ).get(user.id);

    // Top 5 most-played songs
    const topSongs = db.prepare(`
      SELECT youtube_id, title, thumbnail, channel_name, COUNT(*) as play_count
      FROM song_history WHERE added_by = ?
      GROUP BY youtube_id ORDER BY play_count DESC LIMIT 5
    `).all(user.id);

    // Top 5 artists
    const topArtists = db.prepare(`
      SELECT channel_name, COUNT(*) as song_count
      FROM song_history WHERE added_by = ? AND channel_name IS NOT NULL
      GROUP BY channel_name ORDER BY song_count DESC LIMIT 5
    `).all(user.id);

    // Recent activity (last 10 songs)
    const recentSongs = db.prepare(`
      SELECT youtube_id, title, thumbnail, channel_name, played_at
      FROM song_history WHERE added_by = ?
      ORDER BY played_at DESC LIMIT 10
    `).all(user.id);

    res.json({
      profile: {
        id: user.id,
        displayName: user.display_name,
        avatar: user.avatar,
        bio: user.bio,
        favoriteGenre: user.favorite_genre,
        role: user.role,
        joinedAt: user.created_at,
      },
      stats: {
        songsAdded: songsAdded?.count || 0,
        totalListeningTime: totalListeningTime?.total || 0,
        roomsJoined: roomsJoined?.count || 0,
        uniqueArtists: uniqueArtists?.count || 0,
      },
      topSongs,
      topArtists,
      recentSongs,
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/profile — update own profile
router.patch('/', verifyToken, (req, res) => {
  try {
    const db = getDb();
    const { bio, favoriteGenre } = req.body;
    const updates = {};

    if (bio !== undefined) updates.bio = bio ? bio.trim().slice(0, 500) : null;
    if (favoriteGenre !== undefined) updates.favorite_genre = favoriteGenre || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(
      ...Object.values(updates), req.user.userId
    );

    const user = db.prepare(
      'SELECT id, display_name, avatar, bio, favorite_genre, role, created_at FROM users WHERE id = ?'
    ).get(req.user.userId);

    res.json({
      profile: {
        id: user.id,
        displayName: user.display_name,
        avatar: user.avatar,
        bio: user.bio,
        favoriteGenre: user.favorite_genre,
        role: user.role,
        joinedAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
