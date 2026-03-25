import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { sendFeedbackNotification } from '../services/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads', 'feedback');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config: 1 image, max 5MB (Memory storage for Cloudinary upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    },
});

const router = Router();
const VALID_CATEGORIES = ['bug', 'feature-request', 'ui-ux', 'music', 'other'];
const DAILY_LIMIT = 5;

// POST /api/feedback — User submits feedback (with optional screenshot)
router.post('/', verifyToken, upload.single('screenshot'), async (req, res) => {
    const { category, subject, message } = req.body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ error: 'Subject and message are required' });
    }
    if (subject.length > 200) return res.status(400).json({ error: 'Subject must be under 200 characters' });
    if (message.length > 5000) return res.status(400).json({ error: 'Message must be under 5000 characters' });

    const db = getDb();

    // Rate limit: max 5/day/user
    const todayCount = db.prepare(
        `SELECT COUNT(*) as count FROM feedbacks WHERE user_id = ? AND created_at >= date('now')`
    ).get(req.user.userId);
    if (todayCount.count >= DAILY_LIMIT) {
        return res.status(429).json({ error: `Rate limit: max ${DAILY_LIMIT} feedback per day` });
    }

    const id = uuidv4();
    let screenshotUrl = null;

    if (req.file) {
        try {
            const { uploadImageBuffer } = await import('../services/cloudinary.js');
            screenshotUrl = await uploadImageBuffer(req.file.buffer);
        } catch (err) {
            console.error('Cloudinary upload err:', err);
            return res.status(500).json({ error: 'Failed to upload screenshot to cloud (check Cloudinary config)' });
        }
    }

    db.prepare(`INSERT INTO feedbacks (id, user_id, category, subject, message, screenshot) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, req.user.userId, category, subject.trim(), message.trim(), screenshotUrl);

    // Send email notification (non-blocking)
    sendFeedbackNotification({
        userName: req.user.displayName,
        userEmail: req.user.email,
        category,
        subject: subject.trim(),
        message: message.trim(),
        screenshotUrl,
    }).catch(() => { });

    res.status(201).json({ id, message: 'Feedback submitted successfully' });
});

// GET /api/feedback/my — User views their own feedback
router.get('/my', verifyToken, (req, res) => {
    const db = getDb();
    const feedbacks = db.prepare(`
    SELECT id, category, subject, message, screenshot, status, admin_reply, replied_at, created_at
    FROM feedbacks WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.userId);
    res.json(feedbacks);
});

// GET /api/feedback — Admin lists all feedback
router.get('/', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const db = getDb();
    const { status, category } = req.query;
    let sql = `
    SELECT f.*, u.display_name, u.email, u.avatar
    FROM feedbacks f JOIN users u ON f.user_id = u.id
  `;
    const conditions = [];
    const params = [];

    if (status && ['new', 'read', 'replied'].includes(status)) {
        conditions.push('f.status = ?');
        params.push(status);
    }
    if (category && VALID_CATEGORIES.includes(category)) {
        conditions.push('f.category = ?');
        params.push(category);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY f.created_at DESC';

    res.json(db.prepare(sql).all(...params));
});

// PATCH /api/feedback/:id — Admin updates status / reply + socket notify
router.patch('/:id', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const db = getDb();
    const feedback = db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    const { status, admin_reply } = req.body;
    const updates = [];
    const params = [];

    if (status && ['new', 'read', 'replied'].includes(status)) {
        updates.push('status = ?');
        params.push(status);
    }
    if (admin_reply !== undefined) {
        updates.push("admin_reply = ?", "replied_at = datetime('now')", "status = 'replied'");
        params.push(admin_reply);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.id);
    db.prepare(`UPDATE feedbacks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Socket notify user when admin replies
    if (admin_reply !== undefined) {
        const io = req.app.get('io');
        if (io) {
            io.emit('feedback:reply', {
                feedbackId: feedback.id,
                userId: feedback.user_id,
                subject: feedback.subject,
                reply: admin_reply,
            });
        }
    }

    res.json({ message: 'Feedback updated' });
});

// DELETE /api/feedback/:id — Admin deletes feedback
router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const db = getDb();
    const feedback = db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    // Delete screenshot file if exists
    if (feedback.screenshot) {
        const filePath = path.join(UPLOAD_DIR, feedback.screenshot);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM feedbacks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Feedback deleted' });
});

export default router;
