import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', verifyToken, (req, res) => {
    const db = getDb();

    const notifications = db.prepare(`
        SELECT * FROM room_notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(req.user.userId);

    const unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM room_notifications
        WHERE user_id = ? AND is_read = 0
    `).get(req.user.userId).count;

    res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, (req, res) => {
    const db = getDb();

    const result = db.prepare(`
        UPDATE room_notifications 
        SET is_read = 1 
        WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });

    res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, (req, res) => {
    const db = getDb();

    db.prepare(`
        UPDATE room_notifications 
        SET is_read = 1 
        WHERE user_id = ? AND is_read = 0
    `).run(req.user.userId);

    res.json({ message: 'All marked as read' });
});

export default router;
