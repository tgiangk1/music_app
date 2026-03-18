import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { fetchPlaylistVideos } from '../services/youtube.js';

const router = Router();

// List user's playlists
router.get('/', verifyToken, (req, res) => {
    const db = getDb();
    const playlists = db.prepare(`
        SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC
    `).all(req.user.userId);
    res.json({ playlists });
});

// Create empty playlist
router.post('/', verifyToken, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Playlist name is required' });
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(id, req.user.userId, name.trim());
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    res.status(201).json(playlist);
});

// Get playlist details with songs
router.get('/:id', verifyToken, (req, res) => {
    const db = getDb();
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const songs = db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC').all(playlist.id);
    res.json({ playlist, songs });
});

// Delete playlist
router.delete('/:id', verifyToken, (req, res) => {
    const db = getDb();
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    db.prepare('DELETE FROM playlists WHERE id = ?').run(playlist.id);
    res.json({ success: true });
});

// Import YouTube playlist
router.post('/import', verifyToken, async (req, res) => {
    const { playlistUrl, name } = req.body;
    if (!playlistUrl?.trim()) return res.status(400).json({ error: 'Playlist URL is required' });
    try {
        const videos = await fetchPlaylistVideos(playlistUrl.trim());
        if (!videos || videos.length === 0) return res.status(400).json({ error: 'Could not fetch playlist or playlist is empty' });
        const db = getDb();
        const id = uuidv4();
        const playlistName = name?.trim() || `YouTube Playlist (${videos.length} songs)`;
        db.prepare('INSERT INTO playlists (id, user_id, name, song_count) VALUES (?, ?, ?, ?)').run(id, req.user.userId, playlistName, videos.length);
        const insert = db.prepare('INSERT INTO playlist_songs (id, playlist_id, youtube_id, title, thumbnail, duration, channel_name, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insertMany = db.transaction((vids) => {
            vids.forEach((v, i) => {
                insert.run(uuidv4(), id, v.id, v.title, v.thumbnail, v.duration?.totalSeconds || 0, v.artist || v.channel || '', i);
            });
        });
        insertMany(videos);
        const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
        res.status(201).json(playlist);
    } catch (err) {
        res.status(500).json({ error: 'Failed to import playlist' });
    }
});

// Remove song from playlist
router.delete('/:id/songs/:youtubeId', verifyToken, (req, res) => {
    const db = getDb();
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND youtube_id = ?').run(playlist.id, req.params.youtubeId);
    const count = db.prepare('SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?').get(playlist.id);
    db.prepare('UPDATE playlists SET song_count = ?, updated_at = datetime(\'now\') WHERE id = ?').run(count.c, playlist.id);
    res.json({ success: true });
});

// Save current room queue as playlist
router.post('/save-queue', verifyToken, (req, res) => {
    const { roomSlug, name } = req.body;
    if (!roomSlug) return res.status(400).json({ error: 'Room slug is required' });
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(roomSlug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const songs = db.prepare(`SELECT youtube_id, title, thumbnail, duration, channel_name FROM songs WHERE room_id = ? ORDER BY is_playing DESC, position ASC`).all(room.id);
    if (songs.length === 0) return res.status(400).json({ error: 'Queue is empty' });
    const id = uuidv4();
    const playlistName = name?.trim() || `${room.name} Queue (${new Date().toLocaleDateString()})`;
    db.prepare('INSERT INTO playlists (id, user_id, name, song_count) VALUES (?, ?, ?, ?)').run(id, req.user.userId, playlistName, songs.length);
    const insert = db.prepare('INSERT INTO playlist_songs (id, playlist_id, youtube_id, title, thumbnail, duration, channel_name, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction((items) => {
        items.forEach((s, i) => insert.run(uuidv4(), id, s.youtube_id, s.title, s.thumbnail, s.duration, s.channel_name, i));
    });
    insertMany(songs);
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    res.status(201).json(playlist);
});

export default router;
