import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { requireAdmin, requireRoomOwnerOrAdmin } from '../middlewares/role.js';
import { playerStates } from './player.js';

const router = Router();

function slugify(text) {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

router.get('/', verifyToken, (req, res) => {
    const db = getDb();
    const userId = req.user.userId;
    const rooms = db.prepare(`SELECT r.*, u.display_name as creator_name, (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count FROM rooms r LEFT JOIN users u ON r.created_by = u.id WHERE r.is_public = 1 OR r.id IN (SELECT room_id FROM room_members WHERE user_id = ?) OR r.created_by = ? ORDER BY r.created_at DESC`).all(userId, userId);
    res.json({ rooms });
});

router.post('/', verifyToken, (req, res) => {
    const { name, description, isPublic = true, coverColor = '#8b5cf6' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Room name is required' });
    const db = getDb();
    const id = uuidv4();
    let slug = slugify(name);
    const existing = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(slug);
    if (existing) slug = `${slug}-${id.slice(0, 6)}`;
    db.prepare(`INSERT INTO rooms (id, name, slug, description, cover_color, is_public, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, name.trim(), slug, description || null, coverColor, isPublic ? 1 : 0, req.user.userId);
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, req.user.userId);
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    res.status(201).json({ room });
});

router.get('/:slug', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare(`SELECT r.*, u.display_name as creator_name FROM rooms r LEFT JOIN users u ON r.created_by = u.id WHERE r.slug = ?`).get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.is_public) {
        if (!req.user) return res.status(403).json({ error: 'Login required to access private rooms' });
        const isMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
        if (!isMember && room.created_by !== req.user.userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied to this private room' });
    }
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?').get(room.id).count;
    const isOwner = req.user ? room.created_by === req.user.userId : false;
    res.json({ room: { ...room, memberCount, isOwner } });
});

router.patch('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const { name, description, isPublic, coverColor, songLimit } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (isPublic !== undefined) updates.is_public = isPublic ? 1 : 0;
    if (coverColor !== undefined) updates.cover_color = coverColor;
    if (songLimit !== undefined) updates.song_limit = Math.max(0, parseInt(songLimit) || 0);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const db = getDb();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE rooms SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), room.id);
    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
    const io = req.app.get('io');
    io.of(`/room/${room.slug}`).emit('room:updated', updated);
    res.json({ room: updated });
});

router.delete('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();
    playerStates.delete(room.slug);
    const io = req.app.get('io');
    io.of(`/room/${room.slug}`).disconnectSockets(true);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
    res.json({ message: 'Room deleted' });
});

router.get('/:slug/members', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const members = db.prepare(`SELECT u.id, u.display_name, u.avatar, u.role, rm.joined_at FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ? ORDER BY rm.joined_at ASC`).all(room.id);
    res.json({ members });
});

router.post('/:slug/members', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const room = req.room;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, userId);
    if (existing) return res.status(409).json({ error: 'User is already a member' });
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, userId);
    res.status(201).json({ message: 'Member added' });
});

router.delete('/:slug/members/:userId', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();
    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, req.params.userId);
    res.json({ message: 'Member removed' });
});

export default router;
