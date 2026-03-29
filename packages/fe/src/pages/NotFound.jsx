import { Link } from 'react-router-dom';

/**
 * 404 Not Found page
 */
export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-base p-6">
            <div className="max-w-sm w-full text-center space-y-6 animate-fade-in">
                <div className="text-7xl">🎵</div>
                <div>
                    <h1 className="text-4xl font-display font-bold text-text-primary mb-2">404</h1>
                    <p className="text-text-muted text-sm">Trang này không tồn tại hoặc đã bị xóa.</p>
                </div>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors text-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    Về trang chủ
                </Link>
            </div>
        </div>
    );
}
