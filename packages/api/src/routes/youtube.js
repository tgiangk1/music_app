import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { searchYouTube, searchYouTubeNextPage, fetchVideoMetadata, extractVideoId } from '../services/youtube.js';
import { extractSpotifyTrackUrl, resolveSpotifyToYouTube } from '../services/spotify.js';

const router = Router();

router.get('/search', verifyToken, async (req, res) => {
    try {
        const { q, limit, nextPage } = req.query;
        if (!q || !q.trim()) return res.status(400).json({ error: 'Search query is required' });
        const maxLimit = Math.min(parseInt(limit) || 10, 20);

        let data;
        if (nextPage) {
            // Load more results using nextPage token
            const nextPageContext = JSON.parse(decodeURIComponent(nextPage));
            data = await searchYouTubeNextPage(nextPageContext);
        } else {
            data = await searchYouTube(q.trim(), maxLimit);
        }

        res.json({
            results: data.results,
            nextPage: data.nextPage ? encodeURIComponent(JSON.stringify(data.nextPage)) : null,
        });
    } catch (err) {
        console.error('YouTube search error:', err);
        res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

// Resolve any supported music link (YouTube / Spotify) to playable metadata.
// Spotify links are matched to the closest YouTube video automatically.
router.post('/resolve-link', verifyToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

        if (extractSpotifyTrackUrl(url)) {
            const resolved = await resolveSpotifyToYouTube(url);
            if (!resolved) return res.status(422).json({ error: 'Could not resolve this Spotify link. Try searching for the song instead.' });
            return res.json(resolved);
        }

        const videoId = extractVideoId(url);
        if (!videoId) return res.status(400).json({ error: 'Unsupported link. Only YouTube and Spotify track URLs are supported.' });
        const metadata = await fetchVideoMetadata(url);
        if (!metadata) return res.status(400).json({ error: 'Could not fetch video metadata' });
        return res.json({ source: 'youtube', match: metadata });
    } catch (err) {
        console.error('resolve-link error:', err);
        res.status(500).json({ error: 'Failed to resolve link' });
    }
});

export default router;
