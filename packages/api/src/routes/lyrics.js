import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query parameter q' });

    try {
        // Search Genius for the song
        const searchUrl = `https://genius.com/api/search/song?q=${encodeURIComponent(query)}&per_page=5`;
        const searchRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        });

        if (!searchRes.ok) {
            console.error('Genius search failed:', searchRes.status, searchRes.statusText);
            return res.json({ lyrics: null, error: 'Search failed' });
        }

        const searchData = await searchRes.json();
        const hits = searchData?.response?.sections?.[0]?.hits || searchData?.response?.hits || [];

        if (hits.length === 0) {
            return res.json({ lyrics: null, error: 'No results found' });
        }

        const hit = hits[0]?.result || hits[0];
        const songPath = hit?.path;
        if (!songPath) return res.json({ lyrics: null, error: 'No song path found' });

        // Fetch the Genius lyrics page
        const pageUrl = `https://genius.com${songPath}`;
        const pageRes = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        if (!pageRes.ok) {
            console.error('Genius page fetch failed:', pageRes.status, pageUrl);
            return res.json({ lyrics: null, error: 'Failed to fetch lyrics page' });
        }

        const html = await pageRes.text();

        // Try multiple regex patterns to extract lyrics (Genius changes their HTML frequently)
        let lyricsContainers = [];

        // Pattern 1: data-lyrics-container attribute (most common)
        const regex1 = /data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = regex1.exec(html)) !== null) {
            lyricsContainers.push(match[1]);
        }

        // Pattern 2: Lyrics__Container class
        if (lyricsContainers.length === 0) {
            const regex2 = /class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
            while ((match = regex2.exec(html)) !== null) {
                lyricsContainers.push(match[1]);
            }
        }

        // Pattern 3: Look for lyrics in JSON data embedded in the page
        if (lyricsContainers.length === 0) {
            const jsonMatch = html.match(/"lyrics":\s*\{[^}]*"plain":\s*"([^"]+)"/);
            if (jsonMatch) {
                lyricsContainers.push(jsonMatch[1].replace(/\\n/g, '\n'));
            }
        }

        if (lyricsContainers.length === 0) {
            return res.json({ lyrics: null, error: 'Could not parse lyrics from page' });
        }

        // Clean up HTML from lyrics
        let lyrics = lyricsContainers.join('\n');
        lyrics = lyrics
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const songInfo = {
            title: hit?.title || hit?.full_title || query,
            artist: hit?.primary_artist?.name || hit?.artist_names || '',
            thumbnail: hit?.song_art_image_thumbnail_url || hit?.header_image_thumbnail_url || '',
        };

        res.json({ lyrics, songInfo });
    } catch (err) {
        console.error('Lyrics fetch error:', err.message, err.stack);
        res.json({ lyrics: null, error: 'Internal error fetching lyrics' });
    }
});

export default router;
