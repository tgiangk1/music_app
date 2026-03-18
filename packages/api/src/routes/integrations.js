import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/rooms/:slug/integrations
router.get('/:slug/integrations', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const integrations = db.prepare(`
        SELECT i.*, u.display_name as creator_name
        FROM room_integrations i
        JOIN users u ON i.created_by = u.id
        WHERE i.room_id = ?
    `).all(room.id);

    res.json({ integrations });
});

// POST /api/rooms/:slug/integrations
router.post('/:slug/integrations', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const { type, webhookUrl, config } = req.body;

    if (!type || type !== 'slack') {
        return res.status(400).json({ error: 'Unsupported integration type' });
    }
    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }

    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check existing
    const existing = db.prepare('SELECT id FROM room_integrations WHERE room_id = ? AND type = ?').get(room.id, type);
    if (existing) {
        db.prepare(`UPDATE room_integrations SET webhook_url = ?, config = ? WHERE id = ?`)
            .run(webhookUrl, config ? JSON.stringify(config) : null, existing.id);

        const item = db.prepare('SELECT * FROM room_integrations WHERE id = ?').get(existing.id);
        return res.json({ item, message: 'Integration updated' });
    }

    const id = uuidv4();
    db.prepare(`
        INSERT INTO room_integrations (id, room_id, type, webhook_url, config, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, room.id, type, webhookUrl, config ? JSON.stringify(config) : null, req.user.userId);

    const item = db.prepare('SELECT * FROM room_integrations WHERE id = ?').get(id);
    res.status(201).json({ item, message: 'Integration added' });
});

// DELETE /api/rooms/:slug/integrations/:id
router.delete('/:slug/integrations/:id', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const result = db.prepare('DELETE FROM room_integrations WHERE id = ? AND room_id = ?').run(req.params.id, room.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Integration not found' });

    res.json({ message: 'Integration removed' });
});

export default router;
