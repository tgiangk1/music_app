import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { generateRecommendations } from '../services/recommendations.js';

const router = Router();

/**
 * GET /api/recommendations/trending
 *
 * Get trending songs across all rooms (no authentication required)
 *
 * Query params:
 * - limit: number of trending songs to return (default: 20, max: 50)
 *
 * Response:
 * {
 *   trending: [
 *     {
 *       id: string,
 *       youtubeId: string,
 *       title: string,
 *       artist: string,
 *       thumbnail: string,
 *       duration: number,
 *       avg_vote_score: number,
 *       play_count: number
 *     }
 *   ],
 *   generatedAt: string (ISO timestamp)
 * }
 */
router.get('/trending', (req, res) => {
    try {
        const db = getDb();

        // Validate and sanitize limit parameter
        let limit = parseInt(req.query.limit) || 20;
        limit = Math.max(1, Math.min(50, limit)); // Clamp between 1 and 50

        // Get trending songs - lower threshold for smaller datasets
        const trendingSongs = db.prepare(`
            SELECT youtube_id, channel_name, title, thumbnail, duration,
                   AVG(s.vote_score) as avg_vote_score,
                   COUNT(*) as play_count
            FROM songs s
            GROUP BY youtube_id, channel_name, title, thumbnail, duration
            ORDER BY avg_vote_score DESC, play_count DESC
            LIMIT ?
        `).all(limit);

        res.json({
            trending: trendingSongs.map((song, index) => ({
                id: `trending_${Date.now()}_${index}`,
                youtubeId: song.youtube_id,
                title: song.title,
                artist: song.channel_name || 'Unknown Artist',
                thumbnail: song.thumbnail,
                duration: song.duration,
                avg_vote_score: song.avg_vote_score,
                play_count: song.play_count,
            })),
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Error fetching trending songs:', err);
        res.status(500).json({ error: 'Failed to fetch trending songs' });
    }
});

/**
 * GET /api/recommendations
 *
 * Get personalized song recommendations for the authenticated user
 *
 * Authentication: Required (JWT)
 *
 * Query params:
 * - limit: number of recommendations to return (default: 10, max: 20)
 *
 * Response:
 * {
 *   recommendations: [
 *     {
 *       id: string (unique recommendation ID),
 *       youtubeId: string,
 *       title: string,
 *       artist: string,
 *       thumbnail: string,
 *       duration: number,
 *       totalScore: number,
 *       reason: string
 *     }
 *   ],
 *   generatedAt: string (ISO timestamp)
 * }
 */
router.get('/', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const userId = req.user.userId;

        // Validate and sanitize limit parameter
        let limit = parseInt(req.query.limit) || 10;
        limit = Math.max(1, Math.min(20, limit)); // Clamp between 1 and 20

        // Generate recommendations
        const recommendations = generateRecommendations(userId);

        // Format recommendations for frontend
        const formattedRecommendations = recommendations.slice(0, limit).map((rec, index) => ({
            id: `rec_${Date.now()}_${index}`, // Generate unique recommendation ID
            youtubeId: rec.youtubeId,
            title: rec.title,
            artist: rec.channel_name || 'Unknown Artist',
            thumbnail: rec.thumbnail || `https://img.youtube.com/vi/${rec.youtubeId}/maxresdefault.jpg`,
            duration: rec.duration,
            totalScore: rec.totalScore,
            reason: rec.reason,
        }));

        res.json({
            recommendations: formattedRecommendations,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Error generating recommendations:', err);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

/**
 * GET /api/recommendations/:userId
 *
 * Get recommendations for a specific user
 * - Users can access their own recommendations
 * - Admins can access any user's recommendations
 *
 * Authentication: Required (JWT)
 *
 * Query params:
 * - limit: number of recommendations to return (default: 10, max: 20)
 *
 * Response:
 * {
 *   recommendations: [
 *     {
 *       id: string (unique recommendation ID),
 *       youtubeId: string,
 *       title: string,
 *       artist: string,
 *       thumbnail: string,
 *       duration: number,
 *       totalScore: number,
 *       reason: string
 *     }
 *   ],
 *   generatedAt: string (ISO timestamp)
 * }
 */
router.get('/:userId', verifyToken, (req, res) => {
    try {
        const db = getDb();
        const targetUserId = req.params.userId;
        const currentUserId = req.user.userId;

        // Check if user has access (own recommendations or admin)
        if (req.user.role !== 'admin' && targetUserId !== currentUserId) {
            return res.status(403).json({ error: 'You can only access your own recommendations' });
        }

        // Validate target user exists
        const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate and sanitize limit parameter
        let limit = parseInt(req.query.limit) || 10;
        limit = Math.max(1, Math.min(20, limit)); // Clamp between 1 and 20

        // Generate recommendations
        const recommendations = generateRecommendations(targetUserId);

        // Apply limit and format for frontend
        const formattedRecommendations = recommendations.slice(0, limit).map((rec, index) => ({
            id: `rec_${Date.now()}_${index}`, // Generate unique recommendation ID
            youtubeId: rec.youtubeId,
            title: rec.title,
            artist: rec.channel_name || 'Unknown Artist',
            thumbnail: rec.thumbnail || `https://img.youtube.com/vi/${rec.youtubeId}/maxresdefault.jpg`,
            duration: rec.duration,
            totalScore: rec.totalScore,
            reason: rec.reason,
        }));

        res.json({
            recommendations: formattedRecommendations,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Error generating recommendations:', err);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

export default router;
