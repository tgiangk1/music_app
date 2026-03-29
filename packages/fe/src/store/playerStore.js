import { create } from 'zustand';

const savedVolume = parseInt(localStorage.getItem('jukebox_volume') || '70', 10);
const savedNotifSounds = localStorage.getItem('jukebox_notif_sounds') !== 'false';

export const usePlayerStore = create((set, get) => ({
    videoId: null,
    state: 'idle', // 'playing' | 'paused' | 'idle'
    currentTime: 0,
    updatedAt: null,
    updatedBy: null,

    // Volume state — shared across Player, MiniPlayer, KeyboardShortcuts
    volume: savedVolume,
    isMuted: false,
    showVolume: false,

    // Notification sounds toggle
    notificationSounds: savedNotifSounds,

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

    // Volume actions
    setVolume: (vol) => {
        const clamped = Math.max(0, Math.min(100, vol));
        localStorage.setItem('jukebox_volume', clamped.toString());
        set({ volume: clamped, isMuted: false });
    },
    toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
    setShowVolume: (show) => set({ showVolume: show }),

    // Quality sync
    quality: null, // null = auto, or 'small' | 'medium' | 'large' | 'hd720' | 'hd1080' etc
    setQuality: (quality) => set({ quality }),
    toggleNotificationSounds: () => {
        const next = !get().notificationSounds;
        localStorage.setItem('jukebox_notif_sounds', next.toString());
        set({ notificationSounds: next });
    },

    reset: () => set({
        videoId: null,
        state: 'idle',
        currentTime: 0,
        updatedAt: null,
        updatedBy: null,
    }),
}));
