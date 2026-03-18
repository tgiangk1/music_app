import { useRef, useCallback, useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function usePlayer({ emitPlayerSync, emitPlayerEnded, isRoomOwner, canControl = false, repeatMode = 'off', onCrossfadeStart, onCrossfadeEnd, onProgressUpdate }) {
    const playerRef = useRef(null);
    const { videoId, state: playerState, currentTime: syncTime } = usePlayerStore();
    const crossfadeRef = useRef(false);
    const savedVolumeRef = useRef(70);
    const lastSyncRef = useRef(null); // Track when we last received a sync

    const crossfadeDuration = parseInt(localStorage.getItem('jukebox_crossfade') || '3', 10);

    // Periodic sync: controller (owner/DJ/admin) emits currentTime every 5s while playing
    useEffect(() => {
        if (!canControl || playerState !== 'playing' || !videoId) return;
        const interval = setInterval(() => {
            try {
                const currentTime = playerRef.current?.getCurrentTime?.();
                if (currentTime != null && currentTime > 0) {
                    emitPlayerSync?.({ videoId, state: 'playing', currentTime });
                }
            } catch { }
        }, 5000);
        return () => clearInterval(interval);
    }, [canControl, playerState, videoId, emitPlayerSync]);

    // Listener drift correction: check every 5s if we're out of sync
    useEffect(() => {
        if (canControl || playerState !== 'playing' || !videoId) return;
        const interval = setInterval(() => {
            try {
                const player = playerRef.current;
                if (!player) return;
                const localTime = player.getCurrentTime?.() || 0;
                const storeState = usePlayerStore.getState();
                const serverTime = storeState.currentTime || 0;

                // Calculate expected time: serverTime + elapsed since last update
                let expectedTime = serverTime;
                if (storeState.updatedAt && storeState.state === 'playing') {
                    const elapsed = (Date.now() - storeState.updatedAt) / 1000;
                    expectedTime = serverTime + elapsed;
                }

                const drift = Math.abs(localTime - expectedTime);
                if (drift > 3) {
                    console.log(`🔄 Drift correction: local=${localTime.toFixed(1)}s, expected=${expectedTime.toFixed(1)}s, drift=${drift.toFixed(1)}s`);
                    player.seekTo(expectedTime, true);
                }
            } catch { }
        }, 5000);
        return () => clearInterval(interval);
    }, [canControl, playerState, videoId]);

    // Listener: react to sync state changes (pause/play/seek from controller)
    useEffect(() => {
        if (canControl) return; // Controllers manage their own player
        const player = playerRef.current;
        if (!player) return;

        const storeState = usePlayerStore.getState();

        if (storeState.state === 'paused') {
            try { player.pauseVideo(); } catch { }
        } else if (storeState.state === 'playing') {
            // Calculate expected time
            let expectedTime = storeState.currentTime || 0;
            if (storeState.updatedAt) {
                const elapsed = (Date.now() - storeState.updatedAt) / 1000;
                expectedTime += elapsed;
            }

            try {
                const localTime = player.getCurrentTime?.() || 0;
                if (Math.abs(localTime - expectedTime) > 2) {
                    player.seekTo(expectedTime, true);
                }
                player.playVideo();
            } catch { }
        }
    }, [canControl, playerState, syncTime, videoId]);

    // Progress monitoring + Crossfade detection
    useEffect(() => {
        if (playerState !== 'playing' || !videoId) return;

        const interval = setInterval(() => {
            const player = playerRef.current;
            if (!player) return;
            try {
                const current = player.getCurrentTime?.() || 0;
                const duration = player.getDuration?.() || 0;

                // Emit progress for mini player
                if (duration > 0) {
                    onProgressUpdate?.({ current, duration });
                }

                // Crossfade logic
                if (crossfadeDuration > 0 && duration > 0 && !crossfadeRef.current) {
                    const timeRemaining = duration - current;
                    if (timeRemaining <= crossfadeDuration && timeRemaining > 0) {
                        // Start crossfade
                        crossfadeRef.current = true;
                        savedVolumeRef.current = player.getVolume?.() || 70;
                        onCrossfadeStart?.();
                    }
                }

                // During crossfade — gradually reduce volume
                if (crossfadeRef.current && duration > 0) {
                    const timeRemaining = duration - current;
                    if (timeRemaining > 0) {
                        const fadeProgress = 1 - (timeRemaining / crossfadeDuration);
                        const newVolume = Math.max(0, savedVolumeRef.current * (1 - fadeProgress));
                        try { player.setVolume(newVolume); } catch { }
                    }
                }
            } catch { }
        }, 200);

        return () => clearInterval(interval);
    }, [playerState, videoId, crossfadeDuration, onCrossfadeStart, onProgressUpdate]);

    const onReady = useCallback((event) => {
        playerRef.current = event.target;

        if (playerState === 'playing') {
            // Sync to expected time on ready
            const storeState = usePlayerStore.getState();
            let expectedTime = storeState.currentTime || 0;
            if (storeState.updatedAt && storeState.state === 'playing') {
                const elapsed = (Date.now() - storeState.updatedAt) / 1000;
                expectedTime += elapsed;
            }
            if (expectedTime > 2) {
                event.target.seekTo(expectedTime, true);
            }
            event.target.playVideo();
        }
    }, [playerState]);

    const onStateChange = useCallback((event) => {
        // YouTube player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
        const ytState = event.data;

        if (ytState === 0) {
            // Reset crossfade
            if (crossfadeRef.current) {
                crossfadeRef.current = false;
                onCrossfadeEnd?.();
                // Restore volume for next song
                try { event.target.setVolume(savedVolumeRef.current); } catch { }
            }

            // Video ended
            if (repeatMode === 'single') {
                event.target.seekTo(0);
                event.target.playVideo();
            } else {
                emitPlayerEnded?.();
            }
        }

        // Reset crossfade when new song starts
        if (ytState === 1 && crossfadeRef.current) {
            // Might be a new song loading — check if crossfade should reset
            const current = event.target.getCurrentTime?.() || 0;
            if (current < 2) {
                crossfadeRef.current = false;
                onCrossfadeEnd?.();
                try { event.target.setVolume(savedVolumeRef.current); } catch { }
            }
        }

        // Controller: emit state changes
        if (canControl && ytState === 1) {
            const currentTime = event.target.getCurrentTime();
            emitPlayerSync?.({
                videoId,
                state: 'playing',
                currentTime,
            });
        }

        if (canControl && ytState === 2) {
            const currentTime = event.target.getCurrentTime();
            emitPlayerSync?.({
                videoId,
                state: 'paused',
                currentTime,
            });
        }

        // Listener: prevent manual pause (re-sync)
        if (!canControl && ytState === 2 && playerState === 'playing') {
            // Listener somehow paused (e.g., keyboard shortcut) — force resume
            setTimeout(() => {
                try { event.target.playVideo(); } catch { }
            }, 200);
        }
    }, [videoId, canControl, emitPlayerSync, emitPlayerEnded, repeatMode, onCrossfadeEnd, playerState]);

    // Handle YouTube errors (blocked/unavailable videos)
    const onError = useCallback((event) => {
        console.warn('YouTube player error:', event.data);
        if (canControl) {
            emitPlayerEnded?.();
        }
    }, [canControl, emitPlayerEnded]);

    const seekTo = useCallback((time) => {
        playerRef.current?.seekTo(time, true);
    }, []);

    const play = useCallback(() => {
        playerRef.current?.playVideo();
    }, []);

    const pause = useCallback(() => {
        playerRef.current?.pauseVideo();
    }, []);

    return {
        playerRef,
        onReady,
        onStateChange,
        onError,
        seekTo,
        play,
        pause,
        opts: {
            height: '100%',
            width: '100%',
            playerVars: {
                autoplay: 1,
                controls: canControl ? 1 : 0,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                disablekb: canControl ? 0 : 1, // Disable keyboard controls for listeners
            },
        },
    };
}
