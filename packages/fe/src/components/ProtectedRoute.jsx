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
                    className={`glass-card p-4 border-info/30 max-w-sm w-full shadow-glow-lg flex gap-3 cursor-pointer ${t.visible ? 'animate-fade-in' : 'animate-slide-up opacity-0'
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
