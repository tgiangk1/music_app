import { getDb } from '../config/database.js';

export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
}

export function requireRoomOwnerOrAdmin(req, res, next) {
    const db = getDb();
    const slug = req.params.slug;
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    req.room = room;
    const isOwner = room.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Only the room owner or admin can perform this action' });
    next();
}

/**
 * Check if user has DJ-level access in a room (owner, admin, or DJ role)
 */
export function requireDJOrAbove(req, res, next) {
    const db = getDb();
    const slug = req.params.slug;
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    req.room = room;
    const isOwner = room.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (isOwner || isAdmin) return next();
    const membership = db.prepare('SELECT room_role FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
    if (membership?.room_role === 'dj') return next();
    return res.status(403).json({ error: 'DJ or higher role required' });
}

/**
 * Get user's effective role in a room
 */
export function getRoomRole(roomId, userId, roomOwnerId, globalRole) {
    if (globalRole === 'admin') return 'owner';
    if (userId === roomOwnerId) return 'owner';
    const db = getDb();
    const membership = db.prepare('SELECT room_role FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, userId);
    return membership?.room_role || 'listener';
}
