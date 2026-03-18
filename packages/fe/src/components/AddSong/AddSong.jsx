import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function SearchAddSong({ onAdd, slug, songs = [] }) {
    const [mode, setMode] = useState('search'); // 'search' | 'url'
    const [query, setQuery] = useState('');
    const [url, setUrl] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isAdding, setIsAdding] = useState(null); // videoId being added
    const [nextPageToken, setNextPageToken] = useState(null);
    const debounceRef = useRef(null);
    const inputRef = useRef(null);
    const scrollRef = useRef(null);

    // Existing youtube IDs in queue for duplicate detection
    const queueIds = new Set(songs.map(s => s.youtube_id));

    // Debounced search
    const doSearch = useCallback(async (q) => {
        if (!q.trim()) {
            setResults([]);
            setNextPageToken(null);
            return;
        }
        setIsSearching(true);
        try {
            const res = await api.get('/api/youtube/search', { params: { q: q.trim(), limit: 10 } });
            setResults(res.data.results || []);
            setNextPageToken(res.data.nextPage || null);
        } catch {
            setResults([]);
            setNextPageToken(null);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Load more results
    const loadMore = useCallback(async () => {
        if (!nextPageToken || isLoadingMore || !query.trim()) return;
        setIsLoadingMore(true);
        try {
            const res = await api.get('/api/youtube/search', {
                params: { q: query.trim(), nextPage: nextPageToken }
            });
            const newResults = res.data.results || [];
            setResults(prev => {
                // Deduplicate
                const existingIds = new Set(prev.map(r => r.videoId));
                const unique = newResults.filter(r => !existingIds.has(r.videoId));
                return [...prev, ...unique];
            });
            setNextPageToken(res.data.nextPage || null);
        } catch {
            // silently fail
        } finally {
            setIsLoadingMore(false);
        }
    }, [nextPageToken, isLoadingMore, query]);

    useEffect(() => {
        if (mode !== 'search') return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) {
            setResults([]);
            setNextPageToken(null);
            return;
        }
        debounceRef.current = setTimeout(() => doSearch(query), 400);
        return () => clearTimeout(debounceRef.current);
    }, [query, mode, doSearch]);

    // Infinite scroll detection
    const handleScroll = useCallback((e) => {
        const el = e.target;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
            loadMore();
        }
    }, [loadMore]);

    // Add song from search results
    const handleAddFromSearch = async (video) => {
        if (queueIds.has(video.videoId)) {
            toast('This song is already in the queue', { icon: '🔁' });
            return;
        }
        setIsAdding(video.videoId);
        try {
            await onAdd(null, video.videoId, video.title);
            setResults(prev => prev.filter(r => r.videoId !== video.videoId));
        } catch {
            // Error handled by hook
        } finally {
            setIsAdding(null);
        }
    };

    // Add song from URL
    const handleUrlSubmit = async (e) => {
        e.preventDefault();
        if (!url.trim() || isAdding) return;
        setIsAdding('url');
        try {
            await onAdd(url.trim());
            setUrl('');
        } catch {
            // Error handled by hook
        } finally {
            setIsAdding(null);
        }
    };

    const handlePaste = (e) => {
        const text = e.clipboardData?.getData('text') || '';
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            setMode('url');
            setUrl(text);
            e.preventDefault();
        }
    };

    return (
        <div className="glass-card p-4 space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1 bg-surface rounded-xl p-1">
                {[
                    { key: 'search', icon: '🔍', label: 'Search' },
                    { key: 'url', icon: '🔗', label: 'URL' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setMode(tab.key); setResults([]); setNextPageToken(null); }}
                        className={`flex-1 text-xs sm:text-sm py-2 px-3 rounded-lg transition-all font-medium
              ${mode === tab.key
                                ? 'bg-card text-text-primary shadow-sm'
                                : 'text-text-muted hover:text-text-secondary'
                            }`}
                    >
                        <span className="hidden sm:inline">{tab.icon} </span>{tab.label}
                    </button>
                ))}
            </div>

            {/* Search mode */}
            {mode === 'search' && (
                <div>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onPaste={handlePaste}
                            className="input-field w-full pl-10"
                            placeholder="Search YouTube..."
                            id="search-song-input"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Search results with infinite scroll */}
                    {results.length > 0 && (
                        <div
                            ref={scrollRef}
                            onScroll={handleScroll}
                            className="mt-3 bg-surface rounded-xl border border-border overflow-hidden max-h-96 overflow-y-auto scrollbar-thin"
                        >
                            {results.map((video, idx) => {
                                const isDup = queueIds.has(video.videoId);
                                return (
                                    <div
                                        key={video.videoId}
                                        className={`flex items-center gap-3 p-2.5 transition-colors group
                      ${idx > 0 ? 'border-t border-border' : ''}
                      ${isDup ? 'opacity-50' : 'hover:bg-card-hover cursor-pointer'}`}
                                        onClick={() => !isDup && handleAddFromSearch(video)}
                                    >
                                        <div className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-base relative">
                                            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                            {video.duration && (
                                                <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[10px] text-white px-1 rounded font-mono">
                                                    {video.duration}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{video.title}</p>
                                            <p className="text-xs text-text-muted truncate">{video.channelName}</p>
                                        </div>
                                        {isAdding === video.videoId ? (
                                            <svg className="w-5 h-5 animate-spin text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        ) : isDup ? (
                                            <span className="text-xs text-text-muted flex-shrink-0">In queue</span>
                                        ) : (
                                            <button className="p-1.5 rounded-lg text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Load more indicator */}
                            {isLoadingMore && (
                                <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
                                    <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-xs text-text-muted">Loading more...</span>
                                </div>
                            )}

                            {/* End of results */}
                            {!nextPageToken && results.length > 0 && !isLoadingMore && (
                                <div className="text-center py-2 border-t border-border">
                                    <span className="text-xs text-text-muted">{results.length} results</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* URL mode */}
            {mode === 'url' && (
                <form onSubmit={handleUrlSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onPaste={handlePaste}
                        className="input-field flex-1"
                        placeholder="Paste YouTube URL..."
                        disabled={isAdding === 'url'}
                    />
                    <button
                        type="submit"
                        disabled={isAdding === 'url' || !url.trim()}
                        className="btn-primary whitespace-nowrap disabled:opacity-50"
                    >
                        {isAdding === 'url' ? 'Adding...' : 'Add'}
                    </button>
                </form>
            )}
        </div>
    );
}
