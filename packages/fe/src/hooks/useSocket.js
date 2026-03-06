import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { useQueueStore } from '../store/queueStore';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket(slug) {
    const socketRef = useRef(null);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const accessToken = useAuthStore((s) => s.accessToken);
    const setPlayerState = usePlayerStore((s) => s.setPlayerState);
    const setSongs = useQueueStore((s) => s.setSongs);

    useEffect(() => {
        if (!slug || !accessToken) return;

        const socket = io(`${SOCKET_URL}/room/${slug}`, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log(`🔌 Connected to room: ${slug}`);
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Disconnected from room: ${slug}`);
            setIsConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            if (err.message.includes('banned')) {
                toast.error('Your account has been banned');
                useAuthStore.getState().logout();
            }
        });

        // Player sync
        socket.on('player:sync', (state) => {
            setPlayerState(state);
        });

        // Queue updates
        socket.on('queue:updated', (queue) => {
            setSongs(queue);
        });

        // Feature 5: Song added notification (handled in Room.jsx via queue changes)
        socket.on('song:added', (data) => {
            // This event provides notification data;
            // Browser notification is triggered from Room.jsx by detecting queue length change
        });

        // Member events
        socket.on('member:list', (members) => {
            setOnlineMembers(members);
        });

        socket.on('member:join', (member) => {
            setOnlineMembers((prev) => {
                // Deduplicate: If they are already in the array, don't show the toast again (prevents Strict Mode / multi-listener spam)
                const isExisting = prev.some(m => m.userId === member.userId);

                if (!isExisting && member.userId !== useAuthStore.getState().user?.id) {
                    // Only toast for *other* people, not ourselves, and only if they weren't already here
                    toast(`${member.displayName} joined the room`, {
                        id: `join-${member.userId}`, // Deduplicates toasts firing at the exact same ms
                        icon: '👋',
                        style: {
                            borderRadius: '100px',
                            background: '#2a2a3d',
                            color: '#fff',
                            padding: '8px 16px',
                            fontSize: '13px'
                        },
                        position: 'bottom-left'
                    });
                }

                if (isExisting) return prev;
                return [...prev, member];
            });
        });

        socket.on('member:leave', ({ userId, displayName }) => {
            // Find the member name before they are removed
            setOnlineMembers((prev) => {
                const isExisting = prev.some(m => m.userId === userId);
                const member = prev.find(m => m.userId === userId);

                // Only toast if they were actually in the list (prevents disconnect spam on fresh reloads)
                if (isExisting && userId !== useAuthStore.getState().user?.id) {
                    toast(`${member?.displayName || displayName || 'Someone'} left the room`, {
                        id: `leave-${userId}`, // Deduplicates toasts
                        icon: '🚶',
                        style: {
                            borderRadius: '100px',
                            background: '#2a2a3d',
                            color: '#9ca3af',
                            padding: '8px 16px',
                            fontSize: '13px'
                        },
                        position: 'bottom-left'
                    });
                }
                return prev.filter(m => m.userId !== userId);
            });
        });

        // Notifications
        socket.on('notification', ({ type, message }) => {
            if (type === 'warning') {
                toast.error(message);
            } else {
                toast(message);
            }
        });

        // Banned
        socket.on('banned', () => {
            toast.error('You have been banned from this room');
            socket.disconnect();
        });

        // Room updated
        socket.on('room:updated', (room) => {
            toast(`Room updated: ${room.name}`);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
    }, [slug, accessToken, setPlayerState, setSongs]);

    const emitPlayerSync = useCallback((data) => {
        socketRef.current?.emit('player:sync', data);
    }, []);

    const emitPlayerSkip = useCallback(() => {
        socketRef.current?.emit('player:skip');
    }, []);

    const emitPlayerEnded = useCallback(() => {
        socketRef.current?.emit('player:ended');
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        onlineMembers,
        emitPlayerSync,
        emitPlayerSkip,
        emitPlayerEnded,
    };
}
