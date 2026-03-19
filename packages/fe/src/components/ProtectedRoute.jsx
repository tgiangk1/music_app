import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, accessToken, isLoading, checkAuth } = useAuthStore();
    const globalSocketRef = useRef(null);
    const navigate = useNavigate();

    // Setup Global Socket Connection for App-wide Notifications
    useEffect(() => {
        if (!accessToken) return;

        // Connect to the generic/root namespace
        const socket = io(SOCKET_URL, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
        });

        globalSocketRef.current = socket;

        socket.on('global:schedule_triggered', (data) => {
            // Ignore if the user is already inside this specific room (prevent duplicate toast)
            const currentPath = window.location.pathname;
            if (currentPath === `/room/${data.roomSlug}`) return;

            toast.custom((t) => (
                <div
                    className={`glass-card p-4 border-info/30 max-w-sm w-full flex gap-3 cursor-pointer ${t.visible ? 'animate-fade-in' : 'animate-slide-up opacity-0'
                        }`}
                    onClick={() => {
                        toast.dismiss(t.id);
                        navigate(`/room/${data.roomSlug}`);
                    }}
                >
                    <div className="flex-shrink-0 text-3xl">🌍</div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-info font-bold text-sm">Event in {data.roomName}</h4>
                        <p className="text-text-secondary text-sm truncate">{data.title}</p>
                        <p className="text-info text-xs font-semibold mt-1 flex items-center gap-1">
                            Join Event
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                        </p>
                    </div>
                </div>
            ), { duration: 15000, position: 'top-right', id: `global-event-${data.roomSlug}` }); // ID prevents exact dupes if spammed
        });


        socket.on('notification:mention', (data) => {
            const currentUser = useAuthStore.getState().user;
            if (!currentUser || data.userId !== currentUser.id) return;

            // If user is already in the room, ChatBox handles sound + toast
            const currentPath = window.location.pathname;
            if (data.roomSlug && currentPath === `/room/${data.roomSlug}`) return;

            // Play mention sound (ding-dong)
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                if (ctx.state === 'suspended') ctx.resume();
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.connect(gain1); gain1.connect(ctx.destination);
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, ctx.currentTime);
                gain1.gain.setValueAtTime(0.3, ctx.currentTime);
                gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.15);
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2); gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.18);
                gain2.gain.setValueAtTime(0.01, ctx.currentTime);
                gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.18);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc2.start(ctx.currentTime + 0.18); osc2.stop(ctx.currentTime + 0.4);
            } catch { /* audio not available */ }

            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    const notif = new Notification(`${data.from} mentioned you`, {
                        body: `"${data.content}"`, icon: '/favicon.png', tag: `mention-${Date.now()}`, renotify: true, silent: true,
                    });
                    notif.onclick = () => { window.focus(); notif.close(); if (data.roomSlug) navigate(`/room/${data.roomSlug}`); };
                    setTimeout(() => notif.close(), 6000);
                } catch { /* not available */ }
            }

            toast.custom((t) => (
                <div
                    className={`max-w-sm w-full flex gap-3 cursor-pointer transition-all ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}
                    style={{
                        background: 'linear-gradient(135deg, #1e1b2e 0%, #16131f 100%)',
                        border: '1px solid rgba(139,92,246,0.35)',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.1)',
                    }}
                    onClick={() => {
                        toast.dismiss(t.id);
                        if (data.roomSlug) navigate(`/room/${data.roomSlug}`);
                    }}
                >
                    <div className="flex-shrink-0 relative">
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18,
                        }}>@</div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#a78bfa' }}>
                            {data.from} mentioned you
                        </p>
                        <p className="text-sm truncate" style={{ color: '#e2e0f0' }}>
                            &quot;{data.content}&quot;
                        </p>
                        <p className="text-xs mt-1.5" style={{ color: '#7c6fa0' }}>
                            Tap to go to room →
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                        style={{ color: '#7c6fa0', flexShrink: 0 }}
                        className="hover:text-white transition-colors self-start mt-0.5"
                    >✕</button>
                </div>
            ), { duration: 8000, position: 'top-right', id: `mention-global-${Date.now()}` });
        });

        return () => {
            socket.disconnect();
            globalSocketRef.current = null;
        };
    }, [accessToken, navigate]);

    useEffect(() => {
        if (accessToken && !user) {
            checkAuth();
        }
    }, [accessToken, user, checkAuth]);

    if (!accessToken) {
        return <Navigate to="/login" replace />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary font-body">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requireAdmin && user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
}
