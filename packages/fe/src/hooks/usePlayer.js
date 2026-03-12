import { useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function usePlayer({ emitPlayerSync, emitPlayerEnded, isRoomOwner, repeatMode = 'off' }) {
    const playerRef = useRef(null);
    const { videoId, state: playerState } = usePlayerStore();

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
            // Video ended
            if (repeatMode === 'single') {
                // Repeat single: seek back to start
                event.target.seekTo(0);
                event.target.playVideo();
            } else {
                // Normal or queue repeat: advance to next
                emitPlayerEnded?.();
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
    }, [videoId, isRoomOwner, emitPlayerSync, emitPlayerEnded, repeatMode]);

    // Handle YouTube errors (blocked/unavailable videos)
    const onError = useCallback((event) => {
        console.warn('YouTube player error:', event.data);
        // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed restricted
        if (isRoomOwner) {
            emitPlayerEnded?.(); // Auto-skip to next
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
