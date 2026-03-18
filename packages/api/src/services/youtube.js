const metadataCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

export function extractVideoId(url) {
    if (!url) return null;
    const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/, /^([a-zA-Z0-9_-]{11})$/];
    for (const pattern of patterns) { const match = url.match(pattern); if (match) return match[1]; }
    return null;
}

export async function fetchVideoMetadata(url) {
    const videoId = extractVideoId(url);
    if (!videoId) return null;
    const cached = metadataCache.get(videoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    const data = await _fetchFromYoutube(videoId);
    metadataCache.set(videoId, { data, ts: Date.now() });
    if (metadataCache.size > MAX_CACHE_SIZE) { const oldest = metadataCache.keys().next().value; metadataCache.delete(oldest); }
    return data;
}

async function _fetchFromYoutube(videoId) {
    try {
        const ytSearch = await import('youtube-search-api');
        const result = await ytSearch.GetVideoDetails(videoId);
        if (!result || !result.title) return _fallbackMetadata(videoId);
        let duration = 0;
        // Try multiple sources for duration
        if (result.lengthSeconds) {
            duration = parseInt(result.lengthSeconds);
        } else if (result.length?.simpleText) {
            duration = _parseDuration(result.length.simpleText);
        }
        // Fallback: search by videoId to get duration (GetVideoDetails often misses it)
        if (!duration) {
            try {
                const search = await ytSearch.GetListByKeyword(videoId, false, 1);
                const match = search?.items?.find(i => i.id === videoId);
                if (match?.length?.simpleText) {
                    duration = _parseDuration(match.length.simpleText);
                }
            } catch (e) { /* skip */ }
        }
        return { videoId, title: result.title, thumbnail: result.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, duration, channelName: result.channel || 'Unknown' };
    } catch (err) {
        console.error('YouTube metadata fetch error:', err.message);
        return _fallbackMetadata(videoId);
    }
}

function _parseDuration(simpleText) {
    if (!simpleText) return 0;
    const parts = simpleText.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function _fallbackMetadata(videoId) {
    return { videoId, title: `YouTube Video (${videoId})`, thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, duration: 0, channelName: 'Unknown' };
}

export async function searchYouTube(query, limit = 10) {
    if (!query || !query.trim()) return { results: [], nextPage: null };
    try {
        const ytSearch = await import('youtube-search-api');
        const data = await ytSearch.GetListByKeyword(query, false, limit);
        if (!data?.items?.length) return { results: [], nextPage: null };
        const results = data.items.filter(item => item.type === 'video').map(item => ({ videoId: item.id, title: item.title, thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`, duration: item.length?.simpleText || '0:00', channelName: item.channelTitle || 'Unknown' })).slice(0, limit);
        return { results, nextPage: data.nextPage || null };
    } catch (err) { console.error('YouTube search error:', err.message); return { results: [], nextPage: null }; }
}

export async function searchYouTubeNextPage(nextPageContext) {
    if (!nextPageContext) return { results: [], nextPage: null };
    try {
        const ytSearch = await import('youtube-search-api');
        const data = await ytSearch.NextPage(nextPageContext);
        if (!data?.items?.length) return { results: [], nextPage: null };
        const results = data.items.filter(item => item.type === 'video').map(item => ({ videoId: item.id, title: item.title, thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`, duration: item.length?.simpleText || '0:00', channelName: item.channelTitle || 'Unknown' }));
        return { results, nextPage: data.nextPage || null };
    } catch (err) { console.error('YouTube next page error:', err.message); return { results: [], nextPage: null }; }
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
        return results.items.filter(item => item.id).map(item => ({ videoId: item.id, title: item.title || `YouTube Video (${item.id})`, thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`, duration: 0, channelName: item.channelTitle || 'Unknown' }));
    } catch (err) { console.error('YouTube playlist fetch error:', err.message); return null; }
}

// --- Smart Autoplay: fetch related videos ---
const relatedCache = new Map();
const RELATED_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchRelatedVideos(videoId, title, channelName, excludeIds = []) {
    // Check cache first
    const cacheKey = videoId;
    const cached = relatedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < RELATED_CACHE_TTL) {
        return cached.data.filter(v => !excludeIds.includes(v.videoId));
    }

    try {
        const ytSearch = await import('youtube-search-api');
        let results = [];

        // Strategy 1: Search by channel name + "music"
        if (channelName && channelName !== 'Unknown') {
            const channelResults = await ytSearch.GetListByKeyword(`${channelName} music`, false, 10);
            if (channelResults?.items?.length) {
                results.push(...channelResults.items.filter(i => i.type === 'video' && i.id !== videoId));
            }
        }

        // Strategy 2: Search by song title (related songs)
        if (title && results.length < 5) {
            // Extract meaningful keywords from title (remove MV, Official, etc.)
            const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|official|mv|music video|lyric|lyrics|audio|hd|4k/gi, '').trim();
            if (cleanTitle.length > 3) {
                const titleResults = await ytSearch.GetListByKeyword(cleanTitle, false, 10);
                if (titleResults?.items?.length) {
                    results.push(...titleResults.items.filter(i => i.type === 'video' && i.id !== videoId));
                }
            }
        }

        // Deduplicate by videoId
        const seen = new Set();
        const unique = [];
        for (const item of results) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                unique.push({
                    videoId: item.id,
                    title: item.title,
                    thumbnail: item.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
                    duration: item.length?.simpleText || '0:00',
                    channelName: item.channelTitle || 'Unknown'
                });
            }
        }

        // Cache results
        relatedCache.set(cacheKey, { data: unique, ts: Date.now() });
        if (relatedCache.size > 100) {
            const oldest = relatedCache.keys().next().value;
            relatedCache.delete(oldest);
        }

        return unique.filter(v => !excludeIds.includes(v.videoId));
    } catch (err) {
        console.error('Fetch related videos error:', err.message);
        return [];
    }
}

