import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { fetchPlaylistVideos } from '../services/youtube.js';
// import { google } from 'googleapis'; // Optionally for robust YouTube API later

const router = Router();

// GET /api/playlists - List user's playlists
router.get('/', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const playlists = db.prepare(`
            SELECT p.*, COUNT(s.youtube_id) as song_count
            FROM playlists p
            LEFT JOIN playlist_songs s ON p.id = s.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `).all(req.user.id);

        res.json({ playlists });
    } catch (err) {
        console.error('Error fetching playlists:', err);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// GET /api/playlists/:id - Get playlist details with songs
router.get('/:id', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const playlist = db.prepare(`SELECT * FROM playlists WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        const songs = db.prepare(`
            SELECT * FROM playlist_songs 
            WHERE playlist_id = ? 
            ORDER BY order_index ASC, added_at DESC
        `).all(req.params.id);

        res.json({ playlist, songs });
    } catch (err) {
        console.error('Error fetching playlist details:', err);
        res.status(500).json({ error: 'Failed to fetch playlist details' });
    }
});

// POST /api/playlists - Create new playlist
router.post('/', verifyToken, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        const db = getDb();
        const id = uuidv4();

        db.prepare(`
            INSERT INTO playlists (id, user_id, name)
            VALUES (?, ?, ?)
        `).run(id, req.user.id, name.trim());

        res.status(201).json({ id, name: name.trim(), song_count: 0 });
    } catch (err) {
        console.error('Error creating playlist:', err);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// DELETE /api/playlists/:id - Delete playlist
router.delete('/:id', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare(`DELETE FROM playlists WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Playlist not found or unaithorized' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting playlist:', err);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

// POST /api/playlists/:id/songs - Add song to playlist
router.post('/:id/songs', verifyToken, (req, res) => {
    try {
        const { youtubeId, title, thumbnail, duration, channelName } = req.body;

        if (!youtubeId || !title) {
            return res.status(400).json({ error: 'youtubeId and title are required' });
        }

        const db = getDb();

        // Ensure playlist belongs to user
        const playlist = db.prepare(`SELECT id FROM playlists WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Get max order index
        const orderInfo = db.prepare(`SELECT COALESCE(MAX(order_index), 0) as maxOrder FROM playlist_songs WHERE playlist_id = ?`).get(req.params.id);

        db.prepare(`
            INSERT OR IGNORE INTO playlist_songs (playlist_id, youtube_id, title, thumbnail, duration, channel_name, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, youtubeId, title, thumbnail || '', duration || 0, channelName || '', orderInfo.maxOrder + 1);

        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Error adding song to playlist:', err);
        res.status(500).json({ error: 'Failed to add song' });
    }
});

// DELETE /api/playlists/:id/songs/:youtubeId - Remove song from playlist
router.delete('/:id/songs/:youtubeId', verifyToken, (req, res) => {
    try {
        const db = getDb();

        const playlist = db.prepare(`SELECT id FROM playlists WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        db.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ? AND youtube_id = ?`).run(req.params.id, req.params.youtubeId);
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing song:', err);
        res.status(500).json({ error: 'Failed to remove song' });
    }
});

// rate limiting map definition
const importLimits = new Map();

// POST /api/playlists/import - Import YouTube Playlist
router.post('/import', verifyToken, async (req, res) => {
    try {
        const { playlistUrl, name } = req.body;
        if (!playlistUrl) return res.status(400).json({ error: 'Playlist URL is required' });

        // Extremely simple rate limiting per user: 1 request per minute
        const userId = req.user.id;
        const now = Date.now();
        if (importLimits.has(userId) && (now - importLimits.get(userId)) < 60000) {
            return res.status(429).json({ error: 'Rate limit exceeded. Try again in 1 minute.' });
        }
        importLimits.set(userId, now);

        // Fetch videos
        const videos = await fetchPlaylistVideos(playlistUrl);
        if (!videos || videos.length === 0) {
            return res.status(404).json({ error: 'Could not fetch videos from URL' });
        }

        const db = getDb();
        const playlistId = uuidv4();
        const playlistName = (name && name.trim().length > 0) ? name.trim() : `Imported Playlist (${videos.length} songs)`;

        db.transaction(() => {
            // Create playlist
            db.prepare(`INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)`).run(playlistId, userId, playlistName);

            // Insert songs
            const insertSong = db.prepare(`
                INSERT INTO playlist_songs (playlist_id, youtube_id, title, thumbnail, duration, channel_name, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            videos.forEach((video, index) => {
                try {
                    insertSong.run(
                        playlistId,
                        video.videoId,
                        video.title,
                        video.thumbnail,
                        video.duration,
                        video.channelName,
                        index
                    );
                } catch (e) {
                    console.error('Failed to insert specific song, ignoring:', e.message);
                }
            });
        })();

        res.status(201).json({ id: playlistId, name: playlistName, song_count: videos.length });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: 'Failed to import playlist' });
    }
});

export default router;
