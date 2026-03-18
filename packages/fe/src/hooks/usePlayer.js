import { useRef, useCallback, useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function usePlayer({ emitPlayerSync, emitPlayerEnded, isRoomOwner, repeatMode = 'off', onCrossfadeStart, onCrossfadeEnd, onProgressUpdate }) {
    const playerRef = useRef(null);
    const { videoId, state: playerState } = usePlayerStore();
    const crossfadeRef = useRef(false);
    const savedVolumeRef = useRef(70);

    const crossfadeDuration = parseInt(localStorage.getItem('jukebox_crossfade') || '3', 10);

    // Periodic sync: owner emits currentTime every 10s while playing
    useEffect(() => {
        if (!isRoomOwner || playerState !== 'playing' || !videoId) return;
        const interval = setInterval(() => {
            try {
                const currentTime = playerRef.current?.getCurrentTime?.();
                if (currentTime != null && currentTime > 0) {
                    emitPlayerSync?.({ videoId, state: 'playing', currentTime });
                }
            } catch { }
        }, 10000);
        return () => clearInterval(interval);
    }, [isRoomOwner, playerState, videoId, emitPlayerSync]);

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

        if (isRoomOwner && ytState === 1) {
            const currentTime = event.target.getCurrentTime();
            emitPlayerSync?.({
                videoId,
                state: 'playing',
                currentTime,
            });
        }

        if (isRoomOwner && ytState === 2) {
            const currentTime = event.target.getCurrentTime();
            emitPlayerSync?.({
                videoId,
                state: 'paused',
                currentTime,
            });
        }
    }, [videoId, isRoomOwner, emitPlayerSync, emitPlayerEnded, repeatMode, onCrossfadeEnd]);

    // Handle YouTube errors (blocked/unavailable videos)
    const onError = useCallback((event) => {
        console.warn('YouTube player error:', event.data);
        if (isRoomOwner) {
            emitPlayerEnded?.();
        }
    }, [isRoomOwner, emitPlayerEnded]);

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
                controls: isRoomOwner ? 1 : 0,
                modestbranding: 1,
                rel: 0,
                fs: 0,
            },
        },
    };
}

