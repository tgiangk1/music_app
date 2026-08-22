import { searchYouTube } from './youtube.js';

const SPOTIFY_TRACK_PATTERN = /^https?:\/\/(open\.)?spotify\.com\/(intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/;

export function extractSpotifyTrackUrl(url) {
    if (!url) return null;
    const match = String(url).trim().match(SPOTIFY_TRACK_PATTERN);
    if (!match) return null;
    const trackId = match[3];
    return `https://open.spotify.com/track/${trackId}`;
}

/**
 * Resolve a Spotify track link to the best matching YouTube video.
 * Uses Spotify's public oEmbed endpoint (no auth) to get the track title,
 * then searches YouTube for the closest match.
 */
export async function resolveSpotifyToYouTube(spotifyUrl) {
    const normalized = extractSpotifyTrackUrl(spotifyUrl);
    if (!normalized) return null;

    let oembed;
    try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(normalized)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        oembed = await res.json();
    } catch (err) {
        console.error('Spotify oEmbed error:', err.message);
        return null;
    }

    if (!oembed?.title) return null;

    // Search YouTube using the track title
    const { results } = await searchYouTube(`${oembed.title} audio`, 5);
    const match = results[0] || null;

    return {
        source: 'spotify',
        spotifyTitle: oembed.title,
        spotifyThumbnail: oembed.thumbnail_url || null,
        match,
    };
}
