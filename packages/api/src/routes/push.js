import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { vapidPublicKey } from '../services/push.js';

const router = Router();

// GET /api/push/vapid-key — public VAPID key for client
router.get('/vapid-key', (req, res) => {
    if (!vapidPublicKey) {
        return res.status(503).json({ error: 'Push notifications not configured' });
    }
    res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe — save push subscription
router.post('/subscribe', verifyToken, (req, res) => {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const db = getDb();
    const userId = req.user.userId;

    // Upsert: replace if same endpoint exists
    const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint);

    if (existing) {
        db.prepare('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?')
            .run(userId, subscription.keys.p256dh, subscription.keys.auth, existing.id);
    } else {
        db.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    }

    res.json({ success: true });
});

// DELETE /api/push/subscribe — remove push subscription
router.delete('/subscribe', verifyToken, (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) {
        return res.status(400).json({ error: 'endpoint required' });
    }

    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
        .run(endpoint, req.user.userId);

    res.json({ success: true });
});

// GET /api/push/status — check if current user has active subscription
router.get('/status', verifyToken, (req, res) => {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?')
        .get(req.user.userId);
    res.json({ subscribed: count.count > 0 });
});

export default router;
