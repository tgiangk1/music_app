import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/blocklist - Get blocklist for a room
router.get('/:slug/blocklist', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const blocklist = db.prepare(`
            SELECT b.*, u.display_name as added_by_name
            FROM room_blocklist b
            JOIN users u ON b.added_by = u.id
            WHERE b.room_id = ?
            ORDER BY b.created_at DESC
        `).all(room.id);

        res.json({ blocklist });
    } catch (err) {
        console.error('Error fetching blocklist:', err);
        res.status(500).json({ error: 'Failed to fetch blocklist' });
    }
});

// POST /api/rooms/:slug/blocklist - Add to blocklist
router.post('/:slug/blocklist', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const { type, value } = req.body;

        if (!type || !['channel', 'video'].includes(type) || !value || !value.trim()) {
            return res.status(400).json({ error: 'Valid type (channel/video) and value are required' });
        }

        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        // Rate limit / cap
        const count = db.prepare('SELECT COUNT(*) as count FROM room_blocklist WHERE room_id = ?').get(room.id).count;
        if (count >= 1000) {
            return res.status(429).json({ error: 'Blocklist limit reached (1000 items)' });
        }

        const cleanValue = value.trim();

        // Check if already blocked
        const existing = db.prepare('SELECT id FROM room_blocklist WHERE room_id = ? AND type = ? AND value = ? COLLATE NOCASE').get(room.id, type, cleanValue);
        if (existing) {
            return res.status(409).json({ error: 'This item is already in the blocklist' });
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO room_blocklist (id, room_id, type, value, added_by)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, room.id, type, cleanValue, req.user.userId || req.user.id);

        const newBlockedItem = db.prepare(`
            SELECT b.*, u.display_name as added_by_name
            FROM room_blocklist b
            JOIN users u ON b.added_by = u.id
            WHERE b.id = ?
        `).get(id);

        res.status(201).json({ blockedItem: newBlockedItem });
    } catch (err) {
        console.error('Error adding to blocklist:', err);
        res.status(500).json({ error: 'Failed to add to blocklist' });
    }
});

// DELETE /api/rooms/:slug/blocklist/:id - Remove from blocklist
router.delete('/:slug/blocklist/:id', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        const result = db.prepare('DELETE FROM room_blocklist WHERE id = ? AND room_id = ?').run(req.params.id, room.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Blocklist item not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error removing from blocklist:', err);
        res.status(500).json({ error: 'Failed to remove from blocklist' });
    }
});

export default router;
