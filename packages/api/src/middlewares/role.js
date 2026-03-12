import { getDb } from '../config/database.js';

export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

export function requireRoomOwnerOrAdmin(req, res, next) {
    const db = getDb();
    const slug = req.params.slug;
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    req.room = room;

    const isOwner = room.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the room owner or admin can perform this action' });
    }

    next();
}
