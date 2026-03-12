import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { searchYouTube } from '../services/youtube.js';

const router = Router();

router.get('/search', verifyToken, async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q || !q.trim()) return res.status(400).json({ error: 'Search query is required' });
        const maxLimit = Math.min(parseInt(limit) || 10, 20);
        const results = await searchYouTube(q.trim(), maxLimit);
        res.json({ results });
    } catch (err) {
        console.error('YouTube search error:', err);
        res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

export default router;
