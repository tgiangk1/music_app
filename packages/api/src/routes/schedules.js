import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/schedules
router.get('/:slug/schedules', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Return future + un-processed schedules or recent ones
    const schedules = db.prepare(`
        SELECT s.*, u.display_name as creator_name
        FROM room_schedules s
        JOIN users u ON s.created_by = u.id
        WHERE s.room_id = ?
        ORDER BY s.scheduled_at DESC
        LIMIT 20
    `).all(room.id);

    res.json({ schedules });
});

// POST /api/rooms/:slug/schedules
router.post('/:slug/schedules', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { title, scheduledAt, notifyMembers } = req.body;

    if (!title || !scheduledAt) {
        return res.status(400).json({ error: 'Title and scheduledAt are required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduledAt date format' });
    }

    if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const id = uuidv4();
    db.prepare(`
        INSERT INTO room_schedules (id, room_id, title, scheduled_at, notify_members, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, room.id, title.trim(), scheduledDate.toISOString(), notifyMembers ? 1 : 0, req.user.userId);

    const schedule = db.prepare('SELECT * FROM room_schedules WHERE id = ?').get(id);
    res.status(201).json({ schedule });
});

// DELETE /api/rooms/:slug/schedules/:id
router.delete('/:slug/schedules/:id', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const result = db.prepare('DELETE FROM room_schedules WHERE id = ? AND room_id = ?').run(req.params.id, room.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Schedule not found' });

    res.json({ message: 'Schedule deleted' });
});

export default router;
