import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [permission, setPermission] = useState('default');
    const vapidKeyRef = useRef(null);
    const token = useAuthStore(s => s.accessToken);

    // Check support on mount
    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        setIsSupported(supported);
        if (supported) {
            setPermission(Notification.permission);
        }
    }, []);

    // Check existing subscription
    useEffect(() => {
        if (!isSupported || !token) return;

        (async () => {
            try {
                const reg = await navigator.serviceWorker.getRegistration('/sw.js');
                if (reg) {
                    const sub = await reg.pushManager.getSubscription();
                    setIsSubscribed(!!sub);
                }
            } catch { /* silent */ }
        })();
    }, [isSupported, token]);

    const fetchVapidKey = useCallback(async () => {
        if (vapidKeyRef.current) return vapidKeyRef.current;
        const res = await fetch(`${API_URL}/api/push/vapid-key`);
        if (!res.ok) throw new Error('VAPID key not available');
        const { publicKey } = await res.json();
        vapidKeyRef.current = publicKey;
        return publicKey;
    }, []);

    const subscribe = useCallback(async () => {
        if (!isSupported || !token) return false;
        setIsLoading(true);

        try {
            // Request permission
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') {
                setIsLoading(false);
                return false;
            }

            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            // Get VAPID key
            const vapidKey = await fetchVapidKey();

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });

            // Send subscription to server
            const res = await fetch(`${API_URL}/api/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });

            if (res.ok) {
                setIsSubscribed(true);
                setIsLoading(false);
                return true;
            }
        } catch (err) {
            console.error('Push subscribe error:', err);
        }

        setIsLoading(false);
        return false;
    }, [isSupported, token, fetchVapidKey]);

    const unsubscribe = useCallback(async () => {
        if (!isSupported || !token) return false;
        setIsLoading(true);

        try {
            const reg = await navigator.serviceWorker.getRegistration('/sw.js');
            if (reg) {
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    // Tell server to remove
                    await fetch(`${API_URL}/api/push/subscribe`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ endpoint: sub.endpoint }),
                    });

                    await sub.unsubscribe();
                }
            }
            setIsSubscribed(false);
        } catch (err) {
            console.error('Push unsubscribe error:', err);
        }

        setIsLoading(false);
        return true;
    }, [isSupported, token]);

    const toggle = useCallback(async () => {
        if (isSubscribed) return unsubscribe();
        return subscribe();
    }, [isSubscribed, subscribe, unsubscribe]);

    return {
        isSupported,
        isSubscribed,
        isLoading,
        permission,
        subscribe,
        unsubscribe,
        toggle,
    };
}
