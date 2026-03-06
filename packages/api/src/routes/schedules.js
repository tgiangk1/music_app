import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/schedules - Get pending schedules for a room
router.get('/:slug/schedules', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const room = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const schedules = db.prepare(`
            SELECT s.*, u.display_name as creator_name
            FROM room_schedules s
            JOIN users u ON s.created_by = u.id
            WHERE s.room_id = ? AND s.is_executed = 0
            ORDER BY s.scheduled_at ASC
        `).all(room.id);

        res.json({ schedules });
    } catch (err) {
        console.error('Error fetching schedules:', err);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// POST /api/rooms/:slug/schedules - Create a schedule (Owner/Admin)
router.post('/:slug/schedules', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const { title, scheduledAt, notifyMembers } = req.body;

        if (!title || !scheduledAt) {
            return res.status(400).json({ error: 'Title and scheduled time are required' });
        }

        const scheduledTime = new Date(scheduledAt);
        if (isNaN(scheduledTime.getTime()) || scheduledTime.getTime() <= Date.now() + 60000) {
            return res.status(400).json({ error: 'Invalid or past scheduled time. Must be at least 1 minute in the future.' });
        }

        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        // Check rate limits / quota (max 10 pending events)
        const pendingCount = db.prepare(`
            SELECT COUNT(*) as count FROM room_schedules
            WHERE room_id = ? AND is_executed = 0
        `).get(room.id).count;

        if (pendingCount >= 10) {
            return res.status(429).json({ error: 'Maximum of 10 pending schedules reached for this room' });
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO room_schedules (id, room_id, title, scheduled_at, notify_members, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, room.id, title.trim(), scheduledTime.toISOString(), notifyMembers ? 1 : 0, req.user.userId || req.user.id);

        const newSchedule = db.prepare(`
            SELECT s.*, u.display_name as creator_name
            FROM room_schedules s
            JOIN users u ON s.created_by = u.id
            WHERE s.id = ?
        `).get(id);

        // Notify room members that a schedule was created
        const io = req.app.get('io');
        if (io) {
            io.of(`/room/${req.params.slug}`).emit('notification', {
                type: 'info',
                message: `📅 New Event Scheduled: ${title} at ${scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            });
        }

        res.status(201).json({ schedule: newSchedule });
    } catch (err) {
        console.error('Error creating schedule:', err);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

// DELETE /api/rooms/:slug/schedules/:id - Delete a schedule
router.delete('/:slug/schedules/:id', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        const result = db.prepare('DELETE FROM room_schedules WHERE id = ? AND room_id = ?').run(req.params.id, room.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting schedule:', err);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

export default router;
