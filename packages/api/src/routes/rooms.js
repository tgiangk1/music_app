import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { requireAdmin, requireRoomOwnerOrAdmin } from '../middlewares/role.js';
import { playerStates } from './player.js';

const router = Router();

// Helper: slugify
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// GET /api/rooms — list accessible rooms
router.get('/', verifyToken, (req, res) => {
    const db = getDb();
    const userId = req.user.userId;

    // Public rooms + private rooms user is member of
    const rooms = db.prepare(`
    SELECT r.*, u.display_name as creator_name,
      (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
    FROM rooms r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.is_public = 1
       OR r.id IN (SELECT room_id FROM room_members WHERE user_id = ?)
       OR r.created_by = ?
    ORDER BY r.created_at DESC
  `).all(userId, userId);

    res.json({ rooms });
});

// POST /api/rooms — create room [ANY authenticated user]
router.post('/', verifyToken, (req, res) => {
    const { name, description, isPublic = true, coverColor = '#8b5cf6' } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Room name is required' });
    }

    const db = getDb();
    const id = uuidv4();
    let slug = slugify(name);

    // Ensure unique slug
    const existing = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(slug);
    if (existing) {
        slug = `${slug}-${id.slice(0, 6)}`;
    }

    db.prepare(`
    INSERT INTO rooms (id, name, slug, description, cover_color, is_public, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), slug, description || null, coverColor, isPublic ? 1 : 0, req.user.userId);

    // Auto-add creator as member
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, req.user.userId);

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    res.status(201).json({ room });
});

// GET /api/rooms/:slug — room detail
router.get('/:slug', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare(`
    SELECT r.*, u.display_name as creator_name
    FROM rooms r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.slug = ?
  `).get(req.params.slug);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    // Check access for private rooms
    if (!room.is_public) {
        if (!req.user) {
            return res.status(403).json({ error: 'Login required to access private rooms' });
        }
        const isMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
        const isCreator = room.created_by === req.user.userId;
        const isAdmin = req.user.role === 'admin';

        if (!isMember && !isCreator && !isAdmin) {
            return res.status(403).json({ error: 'Access denied to this private room' });
        }
    }

    // Get member count
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?').get(room.id).count;

    // Tell the client if this user is the room owner
    const isOwner = req.user ? room.created_by === req.user.userId : false;

    res.json({ room: { ...room, memberCount, isOwner } });
});

// PATCH /api/rooms/:slug — update room [Owner or Admin]
router.patch('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room; // set by middleware

    const { name, description, isPublic, coverColor, songLimit } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (isPublic !== undefined) updates.is_public = isPublic ? 1 : 0;
    if (coverColor !== undefined) updates.cover_color = coverColor;
    if (songLimit !== undefined) updates.song_limit = Math.max(0, parseInt(songLimit) || 0);

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    const db = getDb();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    db.prepare(`UPDATE rooms SET ${setClauses} WHERE id = ?`).run(...values, room.id);

    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);

    // Broadcast room update via Socket.IO
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${room.slug}`);
    roomNsp.emit('room:updated', updated);

    res.json({ room: updated });
});

// DELETE /api/rooms/:slug — delete room [Owner or Admin]
router.delete('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();

    // CQ-1: Clean up in-memory state to prevent memory leak
    playerStates.delete(room.slug);

    // Disconnect all sockets in this room namespace
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${room.slug}`);
    roomNsp.disconnectSockets(true);

    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);

    res.json({ message: 'Room deleted' });
});

// GET /api/rooms/:slug/members — list room members
router.get('/:slug/members', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const members = db.prepare(`
    SELECT u.id, u.display_name, u.avatar, u.role, rm.joined_at
    FROM room_members rm
    JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ?
    ORDER BY rm.joined_at ASC
  `).all(room.id);

    res.json({ members });
});

// POST /api/rooms/:slug/members — add member [Owner or Admin]
router.post('/:slug/members', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    const room = req.room;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const existing = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, userId);
    if (existing) {
        return res.status(409).json({ error: 'User is already a member' });
    }

    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, userId);

    res.status(201).json({ message: 'Member added' });
});

// DELETE /api/rooms/:slug/members/:userId — remove member [Owner or Admin]
router.delete('/:slug/members/:userId', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();

    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, req.params.userId);
    res.json({ message: 'Member removed' });
});

export default router;
