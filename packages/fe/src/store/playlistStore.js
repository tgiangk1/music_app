import { create } from 'zustand';
import api from '../lib/api';

export const usePlaylistStore = create((set, get) => ({
    playlists: [],
    isLoading: false,
    error: null,

    fetchPlaylists: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await api.get('/api/playlists');
            set({ playlists: res.data.playlists, isLoading: false });
        } catch (err) {
            set({ error: err.response?.data?.error || 'Failed to fetch playlists', isLoading: false });
        }
    },

    createPlaylist: async (name) => {
        try {
            const res = await api.post('/api/playlists', { name });
            set((state) => ({ playlists: [res.data, ...state.playlists] }));
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to create playlist');
        }
    },

    deletePlaylist: async (id) => {
        try {
            await api.delete(`/api/playlists/${id}`);
            set((state) => ({ playlists: state.playlists.filter(p => p.id !== id) }));
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to delete playlist');
        }
    },

    importPlaylist: async (playlistUrl, name) => {
        try {
            const res = await api.post('/api/playlists/import', { playlistUrl, name });
            set((state) => ({ playlists: [res.data, ...state.playlists] }));
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to import playlist');
        }
    },

    getPlaylistDetails: async (id) => {
        try {
            const res = await api.get(`/api/playlists/${id}`);
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to fetch playlist details');
        }
    },

    removeSongFromPlaylist: async (playlistId, youtubeId) => {
        try {
            await api.delete(`/api/playlists/${playlistId}/songs/${youtubeId}`);
            // We optionally could update local state if we kept detailed songs in store,
            // but for simplicity we just return success and let the component refetch or update its local state.
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to remove song');
        }
    },

    pushPlaylistToRoom: async (slug, playlistId) => {
        try {
            const res = await api.post(`/api/rooms/${slug}/songs/push-playlist`, { playlistId });
            return res.data;
        } catch (err) {
            throw new Error(err.response?.data?.error || 'Failed to push playlist');
        }
    }
}));
