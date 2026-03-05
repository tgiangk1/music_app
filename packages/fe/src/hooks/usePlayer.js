import { useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function usePlayer({ emitPlayerSync, emitPlayerEnded, isRoomOwner }) {
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
            // Video ended — notify server to advance queue
            emitPlayerEnded?.();
        }

        if (isRoomOwner && ytState === 1) {
            // Owner playing — sync state to others
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
    }, [videoId, isRoomOwner, emitPlayerSync, emitPlayerEnded]);

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
