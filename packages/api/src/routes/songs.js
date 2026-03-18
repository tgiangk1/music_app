import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';
import { fetchVideoMetadata } from '../services/youtube.js';
import { logActivity } from '../services/socket.js';

const router = Router();

function getQueueForRoom(roomId) {
    const db = getDb();
    return db.prepare(`
    SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar
    FROM songs s
    JOIN users u ON s.added_by = u.id
    WHERE s.room_id = ?
    ORDER BY s.is_playing DESC, s.position ASC, s.created_at ASC
  `).all(roomId);
}

function emitQueueUpdate(req, roomSlug, roomId) {
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${roomSlug}`);
    const queue = getQueueForRoom(roomId);
    roomNsp.emit('queue:updated', queue);
}

function saveToHistory(db, song) {
    const id = uuidv4();
    db.prepare(`
    INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, song.room_id, song.youtube_id, song.title, song.thumbnail, song.duration, song.channel_name, song.added_by);
}

router.get('/:slug/songs', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ songs: getQueueForRoom(room.id) });
});

router.post('/:slug/songs', verifyToken, async (req, res) => {
    try {
        const { url, videoId: directVideoId, title: directTitle, force } = req.body;
        const db = getDb();
        const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        if (room.song_limit > 0) {
            const userSongCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND added_by = ?').get(room.id, req.user.userId).count;
            if (userSongCount >= room.song_limit) {
                return res.status(429).json({ error: `You can only have ${room.song_limit} songs in the queue at once`, code: 'SONG_LIMIT_REACHED' });
            }
        }

        let metadata;
        if (directVideoId) {
            metadata = { videoId: directVideoId, title: directTitle || `YouTube Video (${directVideoId})`, thumbnail: `https://img.youtube.com/vi/${directVideoId}/hqdefault.jpg`, duration: 0, channelName: 'Unknown' };
            fetchVideoMetadata(directVideoId).then(full => {
                if (full && full.title !== metadata.title) {
                    db.prepare('UPDATE songs SET title = ?, thumbnail = ?, duration = ?, channel_name = ? WHERE youtube_id = ? AND room_id = ?').run(full.title, full.thumbnail, full.duration, full.channelName, directVideoId, room.id);
                    emitQueueUpdate(req, req.params.slug, room.id);
                }
            }).catch(() => { });
        } else if (url) {
            metadata = await fetchVideoMetadata(url);
            if (!metadata) return res.status(400).json({ error: 'Invalid YouTube URL or video not found' });
        } else {
            return res.status(400).json({ error: 'YouTube URL or videoId is required' });
        }

        const existing = db.prepare('SELECT id FROM songs WHERE room_id = ? AND youtube_id = ?').get(room.id, metadata.videoId);
        if (existing && !force) return res.status(409).json({ error: 'This song is already in the queue', code: 'DUPLICATE_IN_QUEUE', existingSongId: existing.id });
        if (existing && force) return res.status(200).json({ message: 'Song already in queue', existing: true });

        const inHistory = db.prepare('SELECT id FROM song_history WHERE room_id = ? AND youtube_id = ? ORDER BY played_at DESC LIMIT 1').get(room.id, metadata.videoId);
        const maxPos = db.prepare('SELECT MAX(position) as pos FROM songs WHERE room_id = ?').get(room.id);
        const position = (maxPos?.pos || 0) + 1;

        const id = uuidv4();
        db.prepare(`INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, room.id, metadata.videoId, metadata.title, metadata.thumbnail, metadata.duration, metadata.channelName, req.user.userId, position);

        const songCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ?').get(room.id).count;
        if (songCount === 1) {
            db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(id);
            const { playerStates } = await import('./player.js');
            const stateObj = { videoId: metadata.videoId, state: 'playing', currentTime: 0, updatedAt: new Date().toISOString(), updatedBy: req.user.userId };
            playerStates.set(req.params.slug, stateObj);
            const io = req.app.get('io');
            io.of(`/room/${req.params.slug}`).emit('player:sync', stateObj);
        }

        emitQueueUpdate(req, req.params.slug, room.id);
        const io = req.app.get('io');
        io.of(`/room/${req.params.slug}`).emit('song:added', { title: metadata.title, addedBy: req.user.displayName, thumbnail: metadata.thumbnail });
        logActivity(db, room.id, req.user.userId, 'song_add', { songTitle: metadata.title });

        const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
        res.status(201).json({ song, wasInHistory: !!inHistory });
    } catch (err) {
        console.error('Error adding song:', err);
        res.status(500).json({ error: 'Failed to add song' });
    }
});

router.get('/:slug/history', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const history = db.prepare(`SELECT h.*, u.display_name as added_by_name, u.avatar as added_by_avatar FROM song_history h JOIN users u ON h.added_by = u.id WHERE h.room_id = ? ORDER BY h.played_at DESC LIMIT ? OFFSET ?`).all(room.id, limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM song_history WHERE room_id = ?').get(room.id).count;
    res.json({ history, total, limit, offset });
});

router.delete('/:slug/songs/:id', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const song = db.prepare('SELECT * FROM songs WHERE id = ? AND room_id = ?').get(req.params.id, room.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    const isOwner = room.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin && song.added_by !== req.user.userId) return res.status(403).json({ error: 'You can only remove your own songs' });
    if (song.is_playing) saveToHistory(db, song);
    db.prepare('DELETE FROM songs WHERE id = ?').run(song.id);
    emitQueueUpdate(req, req.params.slug, room.id);
    res.json({ message: 'Song removed' });
});

router.put('/:slug/songs/reorder', verifyToken, (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const reorder = db.transaction(() => { orderedIds.forEach((id, index) => { db.prepare('UPDATE songs SET position = ? WHERE id = ? AND room_id = ?').run(index, id, room.id); }); });
    reorder();
    emitQueueUpdate(req, req.params.slug, room.id);
    res.json({ message: 'Queue reordered' });
});

router.delete('/:slug/songs', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const playingSong = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
    if (playingSong) saveToHistory(db, playingSong);
    db.prepare('DELETE FROM songs WHERE room_id = ?').run(room.id);
    emitQueueUpdate(req, req.params.slug, room.id);
    res.json({ message: 'Queue cleared' });
});

// Push saved playlist to room queue
router.post('/:slug/songs/push-playlist', verifyToken, (req, res) => {
    const { playlistId } = req.body;
    if (!playlistId) return res.status(400).json({ error: 'playlistId is required' });
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, req.user.userId);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const songs = db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC').all(playlistId);
    if (songs.length === 0) return res.status(400).json({ error: 'Playlist is empty' });

    const existingIds = new Set(
        db.prepare('SELECT youtube_id FROM songs WHERE room_id = ?').all(room.id).map(s => s.youtube_id)
    );
    const maxPos = db.prepare('SELECT MAX(position) as pos FROM songs WHERE room_id = ?').get(room.id);
    let position = (maxPos?.pos || 0) + 1;
    let added = 0;
    let skipped = 0;

    const insert = db.prepare('INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const pushAll = db.transaction(() => {
        for (const song of songs) {
            if (existingIds.has(song.youtube_id)) { skipped++; continue; }
            insert.run(uuidv4(), room.id, song.youtube_id, song.title, song.thumbnail, song.duration, song.channel_name, req.user.userId, position++);
            existingIds.add(song.youtube_id);
            added++;
        }
    });
    pushAll();

    if (added > 0) {
        // Auto-play first song if queue was empty
        const songCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ?').get(room.id).count;
        if (songCount === added) {
            const first = db.prepare('SELECT * FROM songs WHERE room_id = ? ORDER BY position ASC LIMIT 1').get(room.id);
            if (first) db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(first.id);
        }
        emitQueueUpdate(req, req.params.slug, room.id);
    }

    res.json({ added, skipped });
});

export default router;
