import { Router } from 'express';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/role.js';

const router = Router();

// GET /api/users — list all users [Admin]
router.get('/', verifyToken, requireAdmin, (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = 'SELECT * FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const params = [];
    const countParams = [];

    if (search) {
        const where = ' WHERE display_name LIKE ? OR email LIKE ?';
        query += where;
        countQuery += where;
        params.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = db.prepare(query).all(...params);
    const total = db.prepare(countQuery).get(...countParams).total;

    res.json({
        users: users.map(u => ({
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            avatar: u.avatar,
            role: u.role,
            isBanned: !!u.is_banned,
            createdAt: u.created_at,
            lastSeenAt: u.last_seen_at,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
});

// PATCH /api/users/:id/role — change role [Admin]
router.patch('/:id/role', verifyToken, requireAdmin, (req, res) => {
    const { role } = req.body;
    if (!role || !['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be "member" or "admin"' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion
    if (user.id === req.user.userId && role === 'member') {
        return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);

    // Notify connected sockets about role change
    const io = req.app.get('io');
    io.of('/').emit('user:roleChanged', { userId: user.id, role });

    res.json({ message: `Role updated to ${role}` });
});

// POST /api/users/:id/ban — ban user [Admin]
router.post('/:id/ban', verifyToken, requireAdmin, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.userId) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(user.id);

    // Delete all refresh tokens
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);

    // Disconnect user from all socket namespaces
    const io = req.app.get('io');
    // We'll let the socket middleware handle disconnect on next auth check

    res.json({ message: 'User banned' });
});

// DELETE /api/users/:id/ban — unban user [Admin]
router.delete('/:id/ban', verifyToken, requireAdmin, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(user.id);

    res.json({ message: 'User unbanned' });
});

export default router;
