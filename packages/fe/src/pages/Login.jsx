const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Login() {
    const handleGoogleLogin = () => {
        window.location.href = `${API_URL}/auth/google`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-pulse-slow" />
                <div className="absolute top-1/2 -right-40 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
                <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-primary/5 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            <div className="glass-card p-10 w-full max-w-md relative z-10 animate-fade-in">
                {/* Logo / Brand */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 mb-6">
                        <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                        </svg>
                    </div>
                    <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
                        Antigravity <span className="text-primary">Jukebox</span>
                    </h1>
                    <p className="text-text-secondary text-sm">
                        Listen together with your team — real-time, synced, fun.
                    </p>
                </div>

                {/* Google Login Button */}
                <button
                    onClick={handleGoogleLogin}
                    id="google-login-btn"
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800
            font-medium py-3.5 px-6 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]
            border border-gray-200"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                </button>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-text-muted text-xs">
                        By signing in, you agree to our Terms of Service
                    </p>
                </div>
            </div>
        </div>
    );
}
