import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, accessToken, isLoading, checkAuth } = useAuthStore();

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
