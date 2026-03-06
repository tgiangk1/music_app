import { create } from 'zustand';

export const useQueueStore = create((set) => ({
    songs: [],
    isLoading: true,

    setSongs: (newSongs) => set((state) => {
        // Prevent generic socket updates from wiping out personalized `userVote`
        const mergedSongs = newSongs.map(newSong => {
            // If the incoming song data already explicitly has userVote (e.g. from REST API), use it.
            if ('userVote' in newSong) return newSong;

            // Otherwise, preserve our local userVote so socket updates don't reset button highlights
            const existingSong = state.songs.find(s => s.id === newSong.id);
            if (existingSong && 'userVote' in existingSong) {
                return { ...newSong, userVote: existingSong.userVote };
            }
            return newSong;
        });

        return { songs: mergedSongs, isLoading: false };
    }),
    setLoading: (isLoading) => set({ isLoading }),

    addSong: (song) => set((state) => ({
        songs: [...state.songs, song],
    })),

    removeSong: (songId) => set((state) => ({
        songs: state.songs.filter(s => s.id !== songId),
    })),

    clearQueue: () => set({ songs: [] }),
}));
