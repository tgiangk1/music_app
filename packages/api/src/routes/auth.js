import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' }
    );
}

function generateRefreshToken(user) {
    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d' }
    );

    const db = getDb();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existingTokens = db.prepare('SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY expires_at DESC').all(user.id);
    if (existingTokens.length >= 5) {
        const toDelete = existingTokens.slice(4).map(t => t.id);
        db.prepare(`DELETE FROM refresh_tokens WHERE id IN (${toDelete.map(() => '?').join(',')})`).run(...toDelete);
    }

    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
        .run(id, user.id, hashToken(token), expiresAt);

    return token;
}

const authCodes = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of authCodes) {
        if (now > entry.expiresAt) authCodes.delete(code);
    }
}, 5 * 60 * 1000);

router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
}));

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/login-failed' }),
    (req, res) => {
        const user = req.user;
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

        if (user.is_banned) {
            return res.redirect(`${clientUrl}/login?error=banned`);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        const code = uuidv4();
        authCodes.set(code, {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + 60000,
        });

        res.redirect(`${clientUrl}/auth/callback?code=${code}`);
    }
);

router.post('/exchange', (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    const entry = authCodes.get(code);
    if (!entry || Date.now() > entry.expiresAt) {
        authCodes.delete(code);
        return res.status(400).json({ error: 'Invalid or expired authorization code' });
    }

    authCodes.delete(code);

    res.json({
        accessToken: entry.accessToken,
        refreshToken: entry.refreshToken,
    });
});

router.get('/login-failed', (req, res) => {
    res.status(401).json({ error: 'Google authentication failed' });
});

router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const db = getDb();

        const hashed = hashToken(refreshToken);
        const storedToken = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?')
            .get(hashed, decoded.userId);

        if (!storedToken) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        if (new Date(storedToken.expires_at) < new Date()) {
            db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);
            return res.status(401).json({ error: 'Refresh token expired' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (!user || user.is_banned) {
            return res.status(401).json({ error: 'User not found or banned' });
        }

        db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: sanitizeUser(user),
        });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        const db = getDb();
        db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(hashToken(refreshToken));
    }
    res.json({ message: 'Logged out successfully' });
});

router.get('/me', verifyToken, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });
});

function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar,
        role: user.role,
        isBanned: !!user.is_banned,
        createdAt: user.created_at,
        lastSeenAt: user.last_seen_at,
    };
}

export default router;
