import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';

export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        if (user.is_banned) return res.status(403).json({ error: 'Account is banned' });
        req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            displayName: user.display_name,
            avatar: user.avatar,
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (user && !user.is_banned) {
            req.user = {
                userId: user.id,
                email: user.email,
                role: user.role,
                displayName: user.display_name,
                avatar: user.avatar,
            };
        } else {
            req.user = null;
        }
    } catch {
        req.user = null;
    }
    next();
}
