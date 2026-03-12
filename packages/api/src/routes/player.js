import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// In-memory player state per room slug
export const playerStates = new Map();

function getPlayerState(slug) {
    if (!playerStates.has(slug)) {
        playerStates.set(slug, {
            videoId: null,
            state: 'idle', // 'playing' | 'paused' | 'idle'
            currentTime: 0,
            updatedAt: new Date().toISOString(),
            updatedBy: null,
        });
    }
    return playerStates.get(slug);
}

// GET /api/rooms/:slug/player — current player state
router.get('/:slug/player', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const state = getPlayerState(req.params.slug);

    // If no videoId, check if there's a song marked as playing
    if (!state.videoId) {
        const currentSong = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
        if (currentSong) {
            state.videoId = currentSong.youtube_id;
            state.state = 'playing';
        }
    }

    res.json({ player: state });
});

// POST /api/rooms/:slug/player/sync — sync state [Owner or Admin]
router.post('/:slug/player/sync', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { videoId, state: playerState, currentTime } = req.body;
    const room = req.room;

    const stateObj = getPlayerState(req.params.slug);
    if (videoId !== undefined) stateObj.videoId = videoId;
    if (playerState !== undefined) stateObj.state = playerState;
    if (currentTime !== undefined) stateObj.currentTime = currentTime;
    stateObj.updatedAt = new Date().toISOString();
    stateObj.updatedBy = req.user.userId;

    // Broadcast to room
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${req.params.slug}`);
    roomNsp.emit('player:sync', stateObj);

    res.json({ player: stateObj });
});

// POST /api/rooms/:slug/player/skip — skip song [Owner or Admin]
router.post('/:slug/player/skip', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();

    // Get current playing song
    const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);

    if (current) {
        db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
    }

    // Get next song
    const next = db.prepare(`
    SELECT * FROM songs WHERE room_id = ?
    ORDER BY vote_score DESC, position ASC, created_at ASC
    LIMIT 1
  `).get(room.id);

    const stateObj = getPlayerState(req.params.slug);

    if (next) {
        db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id);
        stateObj.videoId = next.youtube_id;
        stateObj.state = 'playing';
        stateObj.currentTime = 0;
    } else {
        stateObj.videoId = null;
        stateObj.state = 'idle';
        stateObj.currentTime = 0;
    }

    stateObj.updatedAt = new Date().toISOString();
    stateObj.updatedBy = req.user.userId;

    // Broadcast
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${req.params.slug}`);
    roomNsp.emit('player:sync', stateObj);

    // Also emit updated queue
    const queue = db.prepare(`
    SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar
    FROM songs s
    JOIN users u ON s.added_by = u.id
    WHERE s.room_id = ?
    ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC
  `).all(room.id);
    roomNsp.emit('queue:updated', queue);

    res.json({ player: stateObj, nextSong: next || null });
});

export default router;
