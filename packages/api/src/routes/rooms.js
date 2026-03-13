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

const PASSWORD_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function isPasswordValid(member) {
    if (!member || !member.password_verified_at) return false;
    return (Date.now() - new Date(member.password_verified_at).getTime()) < PASSWORD_EXPIRY_MS;
}

// List rooms
router.get('/', verifyToken, (req, res) => {
    const db = getDb();
    const userId = req.user.userId;
    const rooms = db.prepare(`SELECT r.*, u.display_name as creator_name, (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count FROM rooms r LEFT JOIN users u ON r.created_by = u.id WHERE r.is_public = 1 OR r.room_password IS NOT NULL OR r.id IN (SELECT room_id FROM room_members WHERE user_id = ?) OR r.created_by = ? ORDER BY r.created_at DESC`).all(userId, userId);

    const safeRooms = rooms.map(({ room_password, ...room }) => {
        const isOwner = room.created_by === userId;
        let isMember = isOwner;
        if (!isMember) {
            const membership = db.prepare('SELECT password_verified_at FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, userId);
            if (membership) {
                // For password rooms: check if password is still valid (10 min)
                isMember = room_password ? isPasswordValid(membership) : true;
            }
        }
        return {
            ...room,
            has_password: !!room_password,
            is_member: isMember,
        };
    });
    res.json({ rooms: safeRooms });
});

// Create room
router.post('/', verifyToken, (req, res) => {
    const { name, description, isPublic = true, coverColor = '#8b5cf6', password } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Room name is required' });
    const db = getDb();
    const id = uuidv4();
    let slug = slugify(name);
    const existing = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(slug);
    if (existing) slug = `${slug}-${id.slice(0, 6)}`;
    const roomPassword = password && password.trim() ? password.trim() : null;
    db.prepare(`INSERT INTO rooms (id, name, slug, description, cover_color, is_public, room_password, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name.trim(), slug, description || null, coverColor, isPublic ? 1 : 0, roomPassword, req.user.userId);
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, req.user.userId);
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    const { room_password, ...safeRoom } = room;
    res.status(201).json({ room: { ...safeRoom, has_password: !!room_password } });
});

// Get room details — check password access with 10-min expiry
router.get('/:slug', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare(`SELECT r.*, u.display_name as creator_name FROM rooms r LEFT JOIN users u ON r.created_by = u.id WHERE r.slug = ?`).get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check access for private rooms (no password)
    if (!room.is_public && !room.room_password) {
        if (!req.user) return res.status(403).json({ error: 'Login required to access private rooms' });
        const isMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
        if (!isMember && room.created_by !== req.user.userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied to this private room' });
    }

    // Check access for password-protected rooms (10-min expiry)
    if (room.room_password) {
        if (!req.user) return res.status(403).json({ error: 'Login required', requiresPassword: true });
        const isOwnerOrAdmin = room.created_by === req.user.userId || req.user.role === 'admin';
        if (!isOwnerOrAdmin) {
            const membership = db.prepare('SELECT password_verified_at FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
            if (!membership || !isPasswordValid(membership)) {
                return res.status(403).json({ error: 'This room requires a password', requiresPassword: true, roomName: room.name, coverColor: room.cover_color });
            }
        }
    }

    const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?').get(room.id).count;
    const isOwner = req.user ? room.created_by === req.user.userId : false;
    const { room_password, ...safeRoom } = room;
    res.json({ room: { ...safeRoom, memberCount, isOwner, has_password: !!room_password } });
});

// Join room with password — set password_verified_at
router.post('/:slug/join', verifyToken, (req, res) => {
    const { password } = req.body;
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Owner/admin bypass
    if (room.created_by === req.user.userId || req.user.role === 'admin') {
        db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, req.user.userId);
        return res.json({ message: 'Joined room' });
    }

    // Check password
    if (room.room_password) {
        if (!password) return res.status(403).json({ error: 'Password required' });
        if (password !== room.room_password) return res.status(403).json({ error: 'Incorrect password' });
    }

    // Upsert: insert or update password_verified_at
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
    if (existing) {
        db.prepare('UPDATE room_members SET password_verified_at = ? WHERE room_id = ? AND user_id = ?').run(now, room.id, req.user.userId);
    } else {
        db.prepare('INSERT INTO room_members (room_id, user_id, password_verified_at) VALUES (?, ?, ?)').run(room.id, req.user.userId, now);
    }
    res.json({ message: 'Joined room' });
});

// Update room
router.patch('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const { name, description, isPublic, coverColor, songLimit, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (isPublic !== undefined) updates.is_public = isPublic ? 1 : 0;
    if (coverColor !== undefined) updates.cover_color = coverColor;
    if (songLimit !== undefined) updates.song_limit = Math.max(0, parseInt(songLimit) || 0);
    if (password !== undefined) updates.room_password = password && password.trim() ? password.trim() : null;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const db = getDb();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE rooms SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), room.id);

    // When password changes, invalidate all non-owner members' password verification
    if (updates.room_password !== undefined) {
        db.prepare('UPDATE room_members SET password_verified_at = NULL WHERE room_id = ? AND user_id != ?').run(room.id, room.created_by);
    }

    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
    const io = req.app.get('io');
    io.of(`/room/${room.slug}`).emit('room:updated', updated);
    const { room_password, ...safeUpdated } = updated;
    res.json({ room: { ...safeUpdated, has_password: !!room_password } });
});

// Delete room
router.delete('/:slug', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();
    playerStates.delete(room.slug);
    const io = req.app.get('io');
    io.of(`/room/${room.slug}`).disconnectSockets(true);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
    res.json({ message: 'Room deleted' });
});

// List members
router.get('/:slug/members', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const members = db.prepare(`SELECT u.id, u.display_name, u.avatar, u.role, rm.joined_at FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ? ORDER BY rm.joined_at ASC`).all(room.id);
    res.json({ members });
});

// Add member (owner/admin)
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

// Remove member (owner/admin)
router.delete('/:slug/members/:userId', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const room = req.room;
    const db = getDb();
    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, req.params.userId);
    res.json({ message: 'Member removed' });
});

export default router;
