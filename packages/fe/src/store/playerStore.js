import { create } from 'zustand';

export const usePlayerStore = create((set) => ({
    videoId: null,
    state: 'idle', // 'playing' | 'paused' | 'idle'
    currentTime: 0,
    updatedAt: null,
    updatedBy: null,

    setPlayerState: (playerState) => set({
        videoId: playerState.videoId,
        state: playerState.state,
        currentTime: playerState.currentTime,
        updatedAt: Date.now(), // Use local timestamp for drift calculation
        updatedBy: playerState.updatedBy,
    }),

    setVideoId: (videoId) => set({ videoId }),
    setState: (state) => set({ state }),
    setCurrentTime: (currentTime) => set({ currentTime }),

    reset: () => set({
        videoId: null,
        state: 'idle',
        currentTime: 0,
        updatedAt: null,
        updatedBy: null,
    }),
}));
