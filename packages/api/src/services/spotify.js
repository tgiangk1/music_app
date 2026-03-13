import { getDb } from '../config/database.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Refresh Spotify access token using stored refresh token
 */
export async function refreshSpotifyToken(userId) {
    const db = getDb();
    const conn = db.prepare('SELECT * FROM spotify_connections WHERE user_id = ?').get(userId);
    if (!conn) throw new Error('Spotify not connected');

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Spotify token refresh failed:', err);
        // If refresh token is revoked, disconnect
        if (res.status === 400 || res.status === 401) {
            db.prepare('DELETE FROM spotify_connections WHERE user_id = ?').run(userId);
        }
        throw new Error('Failed to refresh Spotify token');
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Spotify may or may not return a new refresh token
    const newRefreshToken = data.refresh_token || conn.refresh_token;

    db.prepare(`
        UPDATE spotify_connections 
        SET access_token = ?, refresh_token = ?, expires_at = ?
        WHERE user_id = ?
    `).run(data.access_token, newRefreshToken, expiresAt, userId);

    return data.access_token;
}

/**
 * Get a valid Spotify access token (auto-refresh if expired)
 */
export async function getSpotifyToken(userId) {
    const db = getDb();
    const conn = db.prepare('SELECT * FROM spotify_connections WHERE user_id = ?').get(userId);
    if (!conn) return null;

    // Check if token is expired (with 60s buffer)
    const expiresAt = new Date(conn.expires_at).getTime();
    if (Date.now() > expiresAt - 60000) {
        return await refreshSpotifyToken(userId);
    }

    return conn.access_token;
}

/**
 * Make an authenticated request to Spotify API
 */
async function spotifyFetch(userId, endpoint, options = {}) {
    const token = await getSpotifyToken(userId);
    if (!token) throw new Error('Spotify not connected');

    const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (res.status === 401) {
        // Token might have just expired, try refresh once
        const newToken = await refreshSpotifyToken(userId);
        const retryRes = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        if (!retryRes.ok) {
            const errBody = await retryRes.text().catch(() => '');
            console.error(`Spotify API retry error ${retryRes.status}:`, errBody);
            throw new Error(`Spotify API error: ${retryRes.status}`);
        }
        return retryRes.json();
    }

    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`Spotify API error ${res.status} for ${endpoint}:`, errBody);
        throw new Error(`Spotify API error: ${res.status}`);
    }
    return res.json();
}

/**
 * Search tracks on Spotify
 */
export async function searchTracks(userId, query, limit = 10) {
    const data = await spotifyFetch(userId,
        `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=from_token`
    );
    return (data.tracks?.items || []).map(formatTrack);
}

/**
 * Get user's playlists
 */
export async function getUserPlaylists(userId, offset = 0, limit = 20) {
    const data = await spotifyFetch(userId, `/me/playlists?offset=${offset}&limit=${limit}`);
    return {
        items: (data.items || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url || null,
            trackCount: p.tracks?.total || p.items?.total || 0,
            owner: p.owner?.display_name || '',
            isPublic: p.public,
        })),
        total: data.total || 0,
        offset: data.offset || 0,
    };
}

/**
 * Get tracks from a playlist
 */
export async function getPlaylistTracks(userId, playlistId, offset = 0, limit = 50) {
    const data = await spotifyFetch(userId,
        `/playlists/${playlistId}?market=from_token`
    );
    // Extract tracks from paging object
    // Spotify returns: data.items (paging object with .items array)
    // Each entry has .item (NOT .track) containing the track data
    let trackEntries = [];
    if (data.items?.items && Array.isArray(data.items.items)) {
        trackEntries = data.items.items;
    } else if (data.tracks?.items && Array.isArray(data.tracks.items)) {
        trackEntries = data.tracks.items;
    } else if (Array.isArray(data.items)) {
        trackEntries = data.items;
    }
    const sliced = trackEntries.slice(offset, offset + limit);
    return {
        items: sliced
            .map(entry => {
                // Spotify uses 'item' in Get Playlist, 'track' in old deprecated endpoint
                const track = entry?.item || entry?.track;
                return track ? formatTrack(track) : null;
            })
            .filter(Boolean),
        total: data.items?.total || data.tracks?.total || trackEntries.length,
        offset: offset,
    };
}

/**
 * Get user's liked (saved) tracks
 */
export async function getLikedTracks(userId, offset = 0, limit = 20) {
    const data = await spotifyFetch(userId, `/me/tracks?offset=${offset}&limit=${limit}`);
    return {
        items: (data.items || []).map(item => formatTrack(item.track)),
        total: data.total || 0,
        offset: data.offset || 0,
    };
}

/**
 * Get recently played tracks
 */
export async function getRecentlyPlayed(userId, limit = 20) {
    const data = await spotifyFetch(userId, `/me/player/recently-played?limit=${limit}`);
    return (data.items || []).map(item => formatTrack(item.track));
}

/**
 * Get Spotify user profile
 */
export async function getSpotifyProfile(userId) {
    return await spotifyFetch(userId, '/me');
}

/**
 * Format Spotify track into a simple object
 */
function formatTrack(track) {
    if (!track) return null;
    return {
        spotifyId: track.id,
        uri: track.uri || `spotify:track:${track.id}`,
        name: track.name,
        artist: track.artists?.map(a => a.name).join(', ') || '',
        album: track.album?.name || '',
        albumImage: track.album?.images?.[0]?.url || null,
        albumImageSmall: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || null,
        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : 0,
        spotifyUrl: track.external_urls?.spotify || '',
        searchQuery: `${track.artists?.[0]?.name || ''} ${track.name}`.trim(),
    };
}
