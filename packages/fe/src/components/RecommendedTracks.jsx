import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useQueue } from '../hooks/useQueue';
import api from '../lib/api';
import toast from 'react-hot-toast';

/**
 * RecommendedTracks Component
 * Displays personalized track recommendations for the user
 * Features:
 * - Fetches recommendations from /api/recommendations/:userId
 * - Shows track thumbnails, titles, artists, and recommendation reasons
 * - Play now and Add to Queue actions
 * - Loading skeletons and error handling with retry
 * - Responsive grid layout
 * - Proper request cancellation on unmount
 * - Keyboard accessibility support
 */
export default function RecommendedTracks({ roomSlug }) {
    const { user } = useAuthStore();
    const { addSong } = useQueue(roomSlug);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addingSongId, setAddingSongId] = useState(null);
    const [playingSongId, setPlayingSongId] = useState(null);
    const controllerRef = useRef(null);

    /**
     * Fetch recommendations from API
     * Properly handles abort controller for cleanup
     */
    const fetchRecommendations = useCallback(async (signal) => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        try {
            const res = await api.get(`/api/recommendations/${user.id}`, { signal });
            setRecommendations(res.data.recommendations || []);
            setError(null);
        } catch (err) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;

            const errorMessage = err.response?.data?.error || 'Failed to load recommendations';
            setError(errorMessage);
            setRecommendations([]);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    // Fetch recommendations on mount
    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        controllerRef.current = new AbortController();
        fetchRecommendations(controllerRef.current.signal);

        return () => {
            if (controllerRef.current) {
                controllerRef.current.abort();
            }
        };
    }, [fetchRecommendations, user?.id]);

    /**
     * Handle play now action
     * Adds song to queue and sets it as playing
     */
    const handlePlayNow = useCallback(async (track) => {
        setAddingSongId(track.id);
        setPlayingSongId(track.id);

        try {
            await addSong(null, track.youtubeId, track.title);
            // Note: Toast is already shown by useQueue hook
        } catch (err) {
            // Error is handled by useQueue hook
            setPlayingSongId(null);
        } finally {
            setAddingSongId(null);
        }
    }, [addSong]);

    /**
     * Handle add to queue action
     * Adds song to queue without playing
     */
    const handleAddToQueue = useCallback(async (track, e) => {
        e.stopPropagation();
        setAddingSongId(track.id);

        try {
            await addSong(null, track.youtubeId, track.title);
            // Note: Toast is already shown by useQueue hook
        } catch (err) {
            // Error is handled by useQueue hook
        } finally {
            setAddingSongId(null);
        }
    }, [addSong]);

    /**
     * Handle retry on error
     * Creates new abort controller for the retry request
     */
    const handleRetry = useCallback(() => {
        // Clean up previous controller
        if (controllerRef.current) {
            controllerRef.current.abort();
        }

        setIsLoading(true);
        setError(null);
        controllerRef.current = new AbortController();
        fetchRecommendations(controllerRef.current.signal);
    }, [fetchRecommendations]);

    // Loading state with skeletons
    if (isLoading) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="skeleton h-6 w-40" />
                    <div className="skeleton h-4 w-24 rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-3">
                            <div className="skeleton aspect-square rounded-xl" />
                            <div className="skeleton h-5 w-3/4" />
                            <div className="skeleton h-4 w-1/2" />
                            <div className="skeleton h-8 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state with retry
    if (error) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h3 className="font-display text-lg font-semibold text-text-secondary mb-2">Failed to load recommendations</h3>
                <p className="text-text-muted text-sm mb-4">{error}</p>
                <button onClick={handleRetry} className="btn-primary inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Retry
                </button>
            </div>
        );
    }

    // Empty state
    if (!recommendations || recommendations.length === 0) {
        return (
            <div className="glass-card p-8 text-center animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-card flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                    </svg>
                </div>
                <h3 className="font-display text-lg font-semibold text-text-secondary mb-2">No recommendations yet</h3>
                <p className="text-text-muted text-sm">Start adding songs to get personalized recommendations!</p>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-display text-lg font-semibold">Recommended for You</h3>
                        <p className="text-xs text-text-muted">Based on your listening history</p>
                    </div>
                </div>
                <span className="text-xs text-text-muted bg-surface px-3 py-1 rounded-full">
                    {recommendations.length} tracks
                </span>
            </div>

            {/* Tracks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommendations.map((track, index) => {
                    const isAdding = addingSongId === track.id;
                    const isPlaying = playingSongId === track.id;

                    return (
                        <div
                            key={track.id}
                            className="group relative bg-surface/50 rounded-xl overflow-hidden hover:bg-card-hover transition-all duration-300 animate-slide-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                            role="article"
                            aria-label={`Track: ${track.title} by ${track.artist}`}
                        >
                            {/* Thumbnail with hover overlay */}
                            <button
                                className="aspect-square relative overflow-hidden w-full cursor-pointer"
                                onClick={() => handlePlayNow(track)}
                                aria-label={`Play ${track.title}`}
                                disabled={isAdding === track.id}
                            >
                                <img
                                    src={track.thumbnail || `https://img.youtube.com/vi/${track.youtubeId}/maxresdefault.jpg`}
                                    alt={`${track.title} album art`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    onError={(e) => {
                                        // Fallback to lower quality thumbnail
                                        e.target.src = `https://img.youtube.com/vi/${track.youtubeId}/hqdefault.jpg`;
                                    }}
                                />

                                {/* Play overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                    {isAdding ? (
                                        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center" role="status" aria-label="Loading">
                                            <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform duration-200">
                                            <svg className="w-5 h-5 text-white ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Duration badge */}
                                {track.duration && (
                                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded" aria-hidden="true">
                                        {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                                    </div>
                                )}
                            </button>

                            {/* Track Info */}
                            <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h4
                                            className="font-medium text-sm text-text-primary truncate hover:text-primary transition-colors cursor-pointer"
                                            onClick={() => handlePlayNow(track)}
                                            title={track.title}
                                        >
                                            {track.title}
                                        </h4>
                                        <p className="text-xs text-text-muted truncate mt-0.5" title={track.artist}>{track.artist}</p>
                                    </div>
                                    <button
                                        onClick={(e) => handleAddToQueue(track, e)}
                                        className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Add to queue"
                                        disabled={isAdding === track.id}
                                        aria-label={`Add ${track.title} to queue`}
                                    >
                                        {isAdding === track.id ? (
                                            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Recommendation reason badge */}
                                {track.reason && (
                                    <div className="mt-2">
                                        <span className="inline-flex items-center gap-1 text-xs text-text-muted bg-surface px-2 py-1 rounded-full" aria-label={`Recommendation reason: ${track.reason}`}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                            </svg>
                                            {track.reason}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
