import { create } from 'zustand';

export const useQueueStore = create((set) => ({
    songs: [],
    isLoading: true,

    setSongs: (songs) => set({ songs, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),

    addSong: (song) => set((state) => ({
        songs: [...state.songs, song],
    })),

    removeSong: (songId) => set((state) => ({
        songs: state.songs.filter(s => s.id !== songId),
    })),

    updateSongVote: (songId, voteScore, userVote) => set((state) => ({
        songs: state.songs.map(s =>
            s.id === songId ? { ...s, vote_score: voteScore, userVote } : s
        ),
    })),

    clearQueue: () => set({ songs: [] }),
}));
