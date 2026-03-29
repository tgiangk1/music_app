import { usePlayerStore } from '../store/playerStore';

/**
 * ConnectionStatus — shows a banner when socket is disconnected/reconnecting.
 * Renders at the top of Room page.
 */
export default function ConnectionStatus({ isConnected }) {
    if (isConnected) return null;

    return (
        <div
            role="alert"
            aria-live="assertive"
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600/95 backdrop-blur-sm animate-slide-down"
        >
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Đang kết nối lại...</span>
        </div>
    );
}
