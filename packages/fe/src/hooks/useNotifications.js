import { useEffect, useRef, useCallback } from 'react';

/**
 * Feature 5: Browser Notifications for new songs when tab is inactive
 */
export function useNotifications() {
    const hasPermission = useRef(false);

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
            hasPermission.current = true;
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') {
            hasPermission.current = true;
            return true;
        }
        if (Notification.permission === 'denied') return false;

        const result = await Notification.requestPermission();
        hasPermission.current = result === 'granted';
        return hasPermission.current;
    }, []);

    const notify = useCallback((title, options = {}) => {
        if (!hasPermission.current) return;
        if (document.visibilityState === 'visible') return; // Only when tab is inactive

        try {
            const notification = new Notification(title, {
                icon: '/vite.svg',
                badge: '/vite.svg',
                silent: false,
                ...options,
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto-close after 5s
            setTimeout(() => notification.close(), 5000);
        } catch {
            // Notification API not available
        }
    }, []);

    return { requestPermission, notify };
}
