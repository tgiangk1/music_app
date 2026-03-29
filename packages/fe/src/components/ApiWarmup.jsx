import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MAX_RETRIES = 20; // ~60s total
const RETRY_INTERVAL = 3000;

/**
 * ApiWarmup — pings API /health endpoint on mount.
 * Shows a loading screen while Render free tier wakes up (~30-50s cold start).
 * Once healthy, renders children.
 */
export default function ApiWarmup({ children }) {
    const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'error'
    const [retryCount, setRetryCount] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        let timer;

        const checkHealth = async (attempt = 0) => {
            if (!mountedRef.current) return;
            try {
                const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
                if (res.ok && mountedRef.current) {
                    setStatus('ready');
                    return;
                }
            } catch {
                // Server not ready yet
            }

            if (!mountedRef.current) return;
            if (attempt >= MAX_RETRIES) {
                setStatus('error');
                return;
            }

            setRetryCount(attempt + 1);
            timer = setTimeout(() => checkHealth(attempt + 1), RETRY_INTERVAL);
        };

        checkHealth();
        return () => {
            mountedRef.current = false;
            clearTimeout(timer);
        };
    }, []);

    if (status === 'ready') return children;

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base p-6">
                <div className="max-w-sm w-full text-center space-y-5">
                    <div className="text-5xl">😵</div>
                    <h1 className="text-xl font-display font-bold text-text-primary">
                        Không thể kết nối server
                    </h1>
                    <p className="text-text-muted text-sm">
                        Server có thể đang bảo trì. Vui lòng thử lại sau.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors text-sm font-medium"
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    // Loading / warm-up state
    return (
        <div className="min-h-screen flex items-center justify-center bg-base p-6">
            <div className="max-w-sm w-full text-center space-y-6">
                <div className="text-5xl animate-pulse">🎵</div>
                <h1 className="text-xl font-display font-bold text-text-primary">
                    SoundDen
                </h1>
                <div className="space-y-3">
                    <div className="w-10 h-10 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-muted text-sm">
                        {retryCount > 2
                            ? 'Server đang khởi động, vui lòng đợi...'
                            : 'Đang kết nối...'}
                    </p>
                    {retryCount > 3 && (
                        <p className="text-text-muted text-xs opacity-60">
                            Lần thử {retryCount}/{MAX_RETRIES}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
