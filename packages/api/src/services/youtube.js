const metadataCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

export function extractVideoId(url) {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

export async function fetchVideoMetadata(url) {
    const videoId = extractVideoId(url);
    if (!videoId) return null;

    const cached = metadataCache.get(videoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }

    const data = await _fetchFromYoutube(videoId);

    metadataCache.set(videoId, { data, ts: Date.now() });

    if (metadataCache.size > MAX_CACHE_SIZE) {
        const oldest = metadataCache.keys().next().value;
        metadataCache.delete(oldest);
    }

    return data;
}

async function _fetchFromYoutube(videoId) {
    try {
        const ytSearch = await import('youtube-search-api');
        const result = await ytSearch.GetVideoDetails(videoId);

        if (!result || !result.title) {
            return _fallbackMetadata(videoId);
        }

        let duration = 0;
        if (result.lengthSeconds) {
            duration = parseInt(result.lengthSeconds);
        }

        return {
            videoId,
            title: result.title,
            thumbnail: result.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            duration,
            channelName: result.channel || 'Unknown',
        };
    } catch (err) {
        console.error('YouTube metadata fetch error:', err.message);
        return _fallbackMetadata(videoId);
    }
}

function _fallbackMetadata(videoId) {
    return {
        videoId,
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        channelName: 'Unknown',
    };
}

export async function searchYouTube(query, limit = 10) {
    if (!query || !query.trim()) return [];

    try {
        const ytSearch = await import('youtube-search-api');
        const results = await ytSearch.GetListByKeyword(query, false, limit);

        if (!results?.items?.length) return [];

        return results.items
            .filter(item => item.type === 'video')
            .map(item => ({
                videoId: item.id,
                title: item.title,
                thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
                duration: item.length?.simpleText || '0:00',
                channelName: item.channelTitle || 'Unknown',
            }))
            .slice(0, limit);
    } catch (err) {
        console.error('YouTube search error:', err.message);
        return [];
    }
}

export function extractPlaylistId(url) {
    if (!url) return null;
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

export async function fetchPlaylistVideos(playlistUrl) {
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) return null;

    try {
        const ytSearch = await import('youtube-search-api');
        const results = await ytSearch.GetPlaylistData(playlistId, 100);

        if (!results?.items?.length) return [];

        return results.items
            .filter(item => item.id)
            .map(item => ({
                videoId: item.id,
                title: item.title || `YouTube Video (${item.id})`,
                thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
                duration: 0,
                channelName: item.channelTitle || 'Unknown',
            }));
    } catch (err) {
        console.error('YouTube playlist fetch error:', err.message);
        return null;
    }
}
