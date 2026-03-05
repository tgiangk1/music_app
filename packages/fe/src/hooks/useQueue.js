import { useEffect, useCallback } from 'react';
import { useQueueStore } from '../store/queueStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

export function useQueue(slug) {
    const { songs, isLoading, setSongs, setLoading } = useQueueStore();

    // Fetch initial queue
    useEffect(() => {
        if (!slug) return;

        setLoading(true);
        api.get(`/api/rooms/${slug}/songs`)
            .then((res) => setSongs(res.data.songs))
            .catch((err) => {
                console.error('Failed to fetch queue:', err);
                setSongs([]);
            });
    }, [slug, setSongs, setLoading]);

    // Phase 2: Support both URL and direct videoId (from search)
    const addSong = useCallback(async (url, videoId, title) => {
        try {
            const body = {};
            if (videoId) {
                body.videoId = videoId;
                body.title = title;
            } else if (url) {
                body.url = url;
            } else {
                throw new Error('URL or videoId required');
            }

            const res = await api.post(`/api/rooms/${slug}/songs`, body);

            if (res.data.existing) {
                toast('Song already in queue', { icon: '🔁' });
                return res.data;
            }

            toast.success(`Added: ${res.data.song?.title || title || 'Song'}`);
            return res.data.song;
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to add song';
            const code = err.response?.data?.code;

            if (code === 'DUPLICATE_IN_QUEUE') {
                toast('This song is already in the queue', { icon: '🔁' });
            } else if (code === 'SONG_LIMIT_REACHED') {
                toast.error(msg);
            } else {
                toast.error(msg);
            }
            throw err;
        }
    }, [slug]);

    const removeSong = useCallback(async (songId) => {
        try {
            await api.delete(`/api/rooms/${slug}/songs/${songId}`);
            toast.success('Song removed');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to remove song';
            toast.error(msg);
        }
    }, [slug]);

    const voteSong = useCallback(async (songId, type) => {
        try {
            await api.post(`/api/rooms/${slug}/songs/${songId}/vote`, { type });
        } catch (err) {
            toast.error('Failed to vote');
        }
    }, [slug]);

    const clearQueue = useCallback(async () => {
        try {
            await api.delete(`/api/rooms/${slug}/songs`);
            toast.success('Queue cleared');
        } catch (err) {
            toast.error('Failed to clear queue');
        }
    }, [slug]);

    const reorderQueue = useCallback(async (orderedIds) => {
        try {
            await api.put(`/api/rooms/${slug}/songs/reorder`, { orderedIds });
        } catch (err) {
            toast.error('Failed to reorder queue');
        }
    }, [slug]);

    return {
        songs,
        isLoading,
        addSong,
        removeSong,
        voteSong,
        clearQueue,
        reorderQueue,
    };
}
