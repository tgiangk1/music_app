import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/webhook - Get webhook config
router.get('/:slug/webhook', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        const webhook = db.prepare('SELECT slack_url FROM room_webhooks WHERE room_id = ?').get(room.id);
        res.json({ webhook: webhook ? webhook.slack_url : null });
    } catch (err) {
        console.error('Error fetching webhook:', err);
        res.status(500).json({ error: 'Failed to fetch webhook config' });
    }
});

// POST /api/rooms/:slug/webhook - Add or update webhook
router.post('/:slug/webhook', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const { slackUrl } = req.body;
        // Strict Validation to block SSRF attempts targeting internal services
        if (!slackUrl || !slackUrl.startsWith('https://hooks.slack.com/services/')) {
            return res.status(400).json({ error: 'Invalid Slack Webhook URL. Must start with https://hooks.slack.com/services/' });
        }

        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        db.prepare(`
            INSERT INTO room_webhooks (room_id, slack_url, updated_by)
            VALUES (?, ?, ?)
            ON CONFLICT(room_id) DO UPDATE SET 
                slack_url = excluded.slack_url, 
                updated_by = excluded.updated_by, 
                updated_at = datetime('now')
        `).run(room.id, slackUrl.trim(), req.user.userId || req.user.id);

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating webhook:', err);
        res.status(500).json({ error: 'Failed to update webhook config' });
    }
});

// DELETE /api/rooms/:slug/webhook - Delete webhook
router.delete('/:slug/webhook', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    try {
        const db = getDb();
        const room = req.room || db.prepare('SELECT id FROM rooms WHERE slug = ?').get(req.params.slug);

        db.prepare('DELETE FROM room_webhooks WHERE room_id = ?').run(room.id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting webhook:', err);
        res.status(500).json({ error: 'Failed to delete webhook config' });
    }
});

export default router;
