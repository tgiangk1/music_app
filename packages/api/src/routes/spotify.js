import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import {
    searchTracks,
    getUserPlaylists,
    getPlaylistTracks,
    getLikedTracks,
    getRecentlyPlayed,
} from '../services/spotify.js';
import { searchYouTube } from '../services/youtube.js';

const router = Router();

// ============================================================
// OAuth Flow
// ============================================================

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-read-recently-played',
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
].join(' ');

// In-memory state store for CSRF protection
const stateStore = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [state, entry] of stateStore) {
        if (now > entry.expiresAt) stateStore.delete(state);
    }
}, 5 * 60 * 1000);

/**
 * GET /api/spotify/connect
 * Redirects user to Spotify authorization page
 */
router.get('/connect', verifyToken, (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    stateStore.set(state, { userId: req.user.userId, expiresAt: Date.now() + 5 * 60 * 1000 });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        state,
        show_dialog: 'true',
    });

    res.json({ url: `${SPOTIFY_AUTH_URL}?${params.toString()}` });
});

/**
 * GET /api/spotify/callback
 * Handles the OAuth callback from Spotify
 */
router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;

    // Helper: send HTML that auto-closes popup and notifies parent
    const sendPopupResponse = (success, message) => {
        res.send(`
            <!DOCTYPE html>
            <html><head><title>Spotify Connect</title></head>
            <body style="background:#121212;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
                <div style="text-align:center">
                    <p style="font-size:18px">${success ? '✅ Spotify connected!' : '❌ ' + message}</p>
                    <p style="color:#999;font-size:14px">This window will close automatically...</p>
                </div>
                <script>
                    // Method 1: postMessage to opener (try multiple origins)
                    try {
                        if (window.opener) {
                            window.opener.postMessage({ type: 'spotify_connected', success: ${success} }, '*');
                        }
                    } catch(e) {}

                    // Method 2: BroadcastChannel (works cross-origin on same browser)
                    try {
                        const bc = new BroadcastChannel('spotify_connect');
                        bc.postMessage({ type: 'spotify_connected', success: ${success} });
                        bc.close();
                    } catch(e) {}

                    setTimeout(() => window.close(), 1500);
                </script>
            </body></html>
        `);
    };

    if (error) return sendPopupResponse(false, error);
    if (!state || !stateStore.has(state)) return sendPopupResponse(false, 'Invalid state');

    const { userId } = stateStore.get(state);
    stateStore.delete(state);

    try {
        // Exchange code for tokens
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET,
        });

        const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.json().catch(() => ({}));
            console.error('Spotify token exchange failed:', err);
            return sendPopupResponse(false, 'Token exchange failed');
        }

        const tokenData = await tokenRes.json();

        // Get Spotify user profile
        const profileRes = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json();

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // Upsert spotify connection
        const db = getDb();
        const existing = db.prepare('SELECT user_id FROM spotify_connections WHERE user_id = ?').get(userId);

        if (existing) {
            db.prepare(`
                UPDATE spotify_connections 
                SET spotify_id = ?, access_token = ?, refresh_token = ?, expires_at = ?, display_name = ?, avatar = ?, connected_at = datetime('now')
                WHERE user_id = ?
            `).run(
                profile.id, tokenData.access_token, tokenData.refresh_token, expiresAt,
                profile.display_name || '', profile.images?.[0]?.url || '', userId
            );
        } else {
            db.prepare(`
                INSERT INTO spotify_connections (user_id, spotify_id, access_token, refresh_token, expires_at, display_name, avatar)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                userId, profile.id, tokenData.access_token, tokenData.refresh_token,
                expiresAt, profile.display_name || '', profile.images?.[0]?.url || ''
            );
        }

        console.log(`🎵 Spotify connected for user ${userId} (${profile.display_name})`);
        sendPopupResponse(true, 'Connected');
    } catch (err) {
        console.error('Spotify callback error:', err);
        sendPopupResponse(false, 'Server error');
    }
});

/**
 * GET /api/spotify/status
 * Check if user has linked Spotify
 */
router.get('/status', verifyToken, (req, res) => {
    const db = getDb();
    const conn = db.prepare('SELECT spotify_id, display_name, avatar, connected_at FROM spotify_connections WHERE user_id = ?').get(req.user.userId);

    res.json({
        connected: !!conn,
        ...(conn && {
            spotifyId: conn.spotify_id,
            displayName: conn.display_name,
            avatar: conn.avatar,
            connectedAt: conn.connected_at,
        }),
    });
});

/**
 * DELETE /api/spotify/disconnect
 * Unlink Spotify account
 */
router.delete('/disconnect', verifyToken, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM spotify_connections WHERE user_id = ?').run(req.user.userId);
    res.json({ message: 'Spotify disconnected' });
});

/**
 * GET /api/spotify/token
 * Return access token for Spotify Web Playback SDK (auto-refreshes if expired)
 */
router.get('/token', verifyToken, async (req, res) => {
    const db = getDb();
    const conn = db.prepare('SELECT * FROM spotify_connections WHERE user_id = ?').get(req.user.userId);
    if (!conn) return res.status(400).json({ error: 'Spotify not connected' });

    // Check if token expired
    if (new Date(conn.expires_at) <= new Date()) {
        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: conn.refresh_token,
                client_id: process.env.SPOTIFY_CLIENT_ID,
                client_secret: process.env.SPOTIFY_CLIENT_SECRET,
            });
            const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
            if (!tokenRes.ok) return res.status(500).json({ error: 'Failed to refresh token' });
            const tokenData = await tokenRes.json();
            const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
            db.prepare('UPDATE spotify_connections SET access_token = ?, expires_at = ? WHERE user_id = ?')
                .run(tokenData.access_token, expiresAt, req.user.userId);
            return res.json({ accessToken: tokenData.access_token });
        } catch (err) {
            console.error('Token refresh error:', err);
            return res.status(500).json({ error: 'Failed to refresh token' });
        }
    }

    res.json({ accessToken: conn.access_token });
});

// ============================================================
// Search & Browse
// ============================================================

/**
 * GET /api/spotify/search?q=...&limit=10
 * Search Spotify tracks
 */
router.get('/search', verifyToken, async (req, res) => {
    const { q, limit } = req.query;
    if (!q?.trim()) return res.status(400).json({ error: 'Query required' });

    try {
        const results = await searchTracks(req.user.userId, q.trim(), Math.min(parseInt(limit) || 10, 20));
        res.json({ results });
    } catch (err) {
        if (err.message === 'Spotify not connected') {
            return res.status(400).json({ error: 'Spotify not connected' });
        }
        console.error('Spotify search error:', err);
        res.status(500).json({ error: 'Failed to search Spotify' });
    }
});

/**
 * GET /api/spotify/playlists?offset=0&limit=20
 * Get user's playlists
 */
router.get('/playlists', verifyToken, async (req, res) => {
    const { offset, limit } = req.query;
    try {
        const data = await getUserPlaylists(req.user.userId, parseInt(offset) || 0, Math.min(parseInt(limit) || 20, 50));
        res.json(data);
    } catch (err) {
        if (err.message === 'Spotify not connected') return res.status(400).json({ error: 'Spotify not connected' });
        console.error('Spotify playlists error:', err);
        res.status(500).json({ error: 'Failed to get playlists' });
    }
});

/**
 * GET /api/spotify/playlists/:id/tracks?offset=0&limit=50
 * Get tracks from a playlist
 */
router.get('/playlists/:id/tracks', verifyToken, async (req, res) => {
    const { offset, limit } = req.query;
    // Prevent caching of playlist tracks
    res.set('Cache-Control', 'no-store');
    try {
        const data = await getPlaylistTracks(req.user.userId, req.params.id, parseInt(offset) || 0, Math.min(parseInt(limit) || 50, 50));
        console.log(`🎵 Returning ${data.items?.length} tracks for playlist ${req.params.id}`);
        res.json(data);
    } catch (err) {
        if (err.message === 'Spotify not connected') return res.status(400).json({ error: 'Spotify not connected' });
        if (err.message?.includes('403')) {
            return res.status(403).json({
                error: 'Spotify Web API not enabled. Go to Spotify Developer Dashboard → your app → Settings → enable "Web API", then disconnect and reconnect Spotify.',
                code: 'SPOTIFY_WEB_API_DISABLED',
            });
        }
        console.error('Spotify playlist tracks error:', err);
        res.status(500).json({ error: 'Failed to get playlist tracks' });
    }
});

/**
 * GET /api/spotify/liked?offset=0&limit=20
 * Get user's liked tracks
 */
router.get('/liked', verifyToken, async (req, res) => {
    const { offset, limit } = req.query;
    try {
        const data = await getLikedTracks(req.user.userId, parseInt(offset) || 0, Math.min(parseInt(limit) || 20, 50));
        res.json(data);
    } catch (err) {
        if (err.message === 'Spotify not connected') return res.status(400).json({ error: 'Spotify not connected' });
        console.error('Spotify liked error:', err);
        res.status(500).json({ error: 'Failed to get liked tracks' });
    }
});

/**
 * GET /api/spotify/recent?limit=20
 * Get recently played tracks
 */
router.get('/recent', verifyToken, async (req, res) => {
    const { limit } = req.query;
    try {
        const tracks = await getRecentlyPlayed(req.user.userId, Math.min(parseInt(limit) || 20, 50));
        res.json({ items: tracks });
    } catch (err) {
        if (err.message === 'Spotify not connected') return res.status(400).json({ error: 'Spotify not connected' });
        console.error('Spotify recent error:', err);
        res.status(500).json({ error: 'Failed to get recently played' });
    }
});

/**
 * POST /api/spotify/match-youtube
 * Given a Spotify track, find the best YouTube match
 * Body: { searchQuery, trackName, artist }
 */
router.post('/match-youtube', verifyToken, async (req, res) => {
    const { searchQuery, trackName, artist } = req.body;
    const query = searchQuery || `${artist} ${trackName}`.trim();

    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        const results = await searchYouTube(query, 5);
        if (!results.length) {
            return res.json({ match: null, error: 'No YouTube match found' });
        }

        // Return top result as the match, plus alternatives
        res.json({
            match: results[0],
            alternatives: results.slice(1),
        });
    } catch (err) {
        console.error('YouTube match error:', err);
        res.status(500).json({ error: 'Failed to find YouTube match' });
    }
});

export default router;
