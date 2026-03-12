import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();
export const playerStates = new Map();

function getPlayerState(slug) {
    if (!playerStates.has(slug)) {
        playerStates.set(slug, { videoId: null, state: 'idle', currentTime: 0, updatedAt: new Date().toISOString(), updatedBy: null });
    }
    return playerStates.get(slug);
}

router.get('/:slug/player', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const state = getPlayerState(req.params.slug);
    if (!state.videoId) {
        const currentSong = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
        if (currentSong) { state.videoId = currentSong.youtube_id; state.state = 'playing'; }
    }
    res.json({ player: state });
});

router.post('/:slug/player/sync', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { videoId, state: playerState, currentTime } = req.body;
    const stateObj = getPlayerState(req.params.slug);
    if (videoId !== undefined) stateObj.videoId = videoId;
    if (playerState !== undefined) stateObj.state = playerState;
    if (currentTime !== undefined) stateObj.currentTime = currentTime;
    stateObj.updatedAt = new Date().toISOString();
    stateObj.updatedBy = req.user.userId;
    const io = req.app.get('io');
    io.of(`/room/${req.params.slug}`).emit('player:sync', stateObj);
    res.json({ player: stateObj });
});

router.post('/:slug/player/skip', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();
    const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
    if (current) db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
    const next = db.prepare(`SELECT * FROM songs WHERE room_id = ? ORDER BY vote_score DESC, position ASC, created_at ASC LIMIT 1`).get(room.id);
    const stateObj = getPlayerState(req.params.slug);
    if (next) { db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id); stateObj.videoId = next.youtube_id; stateObj.state = 'playing'; stateObj.currentTime = 0; }
    else { stateObj.videoId = null; stateObj.state = 'idle'; stateObj.currentTime = 0; }
    stateObj.updatedAt = new Date().toISOString();
    stateObj.updatedBy = req.user.userId;
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${req.params.slug}`);
    roomNsp.emit('player:sync', stateObj);
    const queue = db.prepare(`SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar FROM songs s JOIN users u ON s.added_by = u.id WHERE s.room_id = ? ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC`).all(room.id);
    roomNsp.emit('queue:updated', queue);
    res.json({ player: stateObj, nextSong: next || null });
});

export default router;
