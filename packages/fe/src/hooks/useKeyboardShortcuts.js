import { useEffect, useCallback, useState } from 'react';

/**
 * Feature 6: Keyboard shortcuts for player control
 * Space = play/pause (owner only)
 * ArrowRight = skip (owner only)
 * ? = toggle shortcuts help
 */
export function useKeyboardShortcuts({
    isRoomOwner,
    emitPlayerSync,
    emitPlayerSkip,
    videoId,
    playerState,
}) {
    const [showHelp, setShowHelp] = useState(false);

    const handleKeyDown = useCallback((e) => {
        // Don't trigger shortcuts when typing in input/textarea
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (isRoomOwner && videoId) {
                    emitPlayerSync?.({
                        videoId,
                        state: playerState === 'playing' ? 'paused' : 'playing',
                        currentTime: undefined,
                    });
                }
                break;

            case 'ArrowRight':
                if (isRoomOwner) {
                    e.preventDefault();
                    emitPlayerSkip?.();
                }
                break;

            case '?':
                setShowHelp(prev => !prev);
                break;

            case 'Escape':
                setShowHelp(false);
                break;

            default:
                break;
        }
    }, [isRoomOwner, emitPlayerSync, emitPlayerSkip, videoId, playerState]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { showHelp, setShowHelp };
}
