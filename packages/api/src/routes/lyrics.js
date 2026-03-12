import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

router.get('/', verifyToken, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query parameter q' });
    try {
        const searchUrl = `https://genius.com/api/search/song?q=${encodeURIComponent(query)}&per_page=5`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JukeboxBot/1.0)', 'Accept': 'application/json' },
        });
        if (!searchRes.ok) return res.json({ lyrics: null, error: 'Search failed' });
        const searchData = await searchRes.json();
        const hits = searchData?.response?.sections?.[0]?.hits || [];
        if (hits.length === 0) return res.json({ lyrics: null, error: 'No results found' });
        const songPath = hits[0]?.result?.path;
        if (!songPath) return res.json({ lyrics: null, error: 'No song path found' });
        const pageUrl = `https://genius.com${songPath}`;
        const pageRes = await fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', 'Accept': 'text/html' },
        });
        if (!pageRes.ok) return res.json({ lyrics: null, error: 'Failed to fetch lyrics page' });
        const html = await pageRes.text();
        const lyricsContainers = [];
        const regex = /data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = regex.exec(html)) !== null) lyricsContainers.push(match[1]);
        if (lyricsContainers.length === 0) return res.json({ lyrics: null, error: 'Could not parse lyrics' });
        let lyrics = lyricsContainers.join('\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n').trim();
        const songInfo = {
            title: hits[0]?.result?.title || query,
            artist: hits[0]?.result?.primary_artist?.name || '',
            thumbnail: hits[0]?.result?.song_art_image_thumbnail_url || '',
        };
        res.json({ lyrics, songInfo });
    } catch (err) {
        console.error('Lyrics fetch error:', err.message);
        res.json({ lyrics: null, error: 'Internal error fetching lyrics' });
    }
});

export default router;
