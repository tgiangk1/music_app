import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/blocklist
router.get('/:slug/blocklist', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const blocklist = db.prepare(`
        SELECT b.*, u.display_name as added_by_name
        FROM room_blocklist b
        JOIN users u ON b.added_by = u.id
        WHERE b.room_id = ?
        ORDER BY b.created_at DESC
    `).all(room.id);

    res.json({ blocklist });
});

// POST /api/rooms/:slug/blocklist
router.post('/:slug/blocklist', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { type, value, title } = req.body;

    if (!type || !['channel', 'video'].includes(type)) {
        return res.status(400).json({ error: 'Invalid blocklist type' });
    }
    if (!value?.trim()) {
        return res.status(400).json({ error: 'Blocklist value is required' });
    }

    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check duplicate
    const existing = db.prepare('SELECT id FROM room_blocklist WHERE room_id = ? AND type = ? AND value = ?').get(room.id, type, value.trim());
    if (existing) {
        return res.status(409).json({ error: 'Item already in blocklist' });
    }

    const id = uuidv4();
    db.prepare(`
        INSERT INTO room_blocklist (id, room_id, type, value, title, added_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, room.id, type, value.trim(), title?.trim() || value.trim(), req.user.userId);

    const item = db.prepare('SELECT * FROM room_blocklist WHERE id = ?').get(id);
    res.status(201).json({ item });
});

// DELETE /api/rooms/:slug/blocklist/:id
router.delete('/:slug/blocklist/:id', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const result = db.prepare('DELETE FROM room_blocklist WHERE id = ? AND room_id = ?').run(req.params.id, room.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

    res.json({ message: 'Item removed from blocklist' });
});

export default router;
