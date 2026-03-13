import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * SpotifyBrowser — component for searching/browsing Spotify library
 * and adding tracks to room queue via YouTube match
 */
export default function SpotifyBrowser({ onAdd, songs = [], slug }) {
    const [connected, setConnected] = useState(null); // null = loading, bool = checked
    const [spotifyProfile, setSpotifyProfile] = useState(null);
    const [view, setView] = useState('search'); // search | playlists | liked | recent
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(null);
    const [playlists, setPlaylists] = useState([]);
    const [playlistTracks, setPlaylistTracks] = useState(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [likedTracks, setLikedTracks] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const debounceRef = useRef(null);

    const queueIds = new Set(songs.map(s => s.youtube_id));
    const loadedRef = useRef({ playlists: false, liked: false, recent: false });

    // Check Spotify connection status
    useEffect(() => {
        api.get('/api/spotify/status')
            .then(res => {
                setConnected(res.data.connected);
                if (res.data.connected) {
                    setSpotifyProfile({
                        displayName: res.data.displayName,
                        avatar: res.data.avatar,
                    });
                }
            })
            .catch(() => setConnected(false));
    }, []);

    // Listen for Spotify connect from popup (multiple fallback methods)
    useEffect(() => {
        const onConnected = () => {
            api.get('/api/spotify/status').then(res => {
                if (res.data.connected) {
                    setConnected(true);
                    setSpotifyProfile({
                        displayName: res.data.displayName,
                        avatar: res.data.avatar,
                    });
                    toast.success('Spotify connected!');
                }
            });
        };

        // Method 1: postMessage from popup
        const handleMessage = (event) => {
            if (event.data?.type === 'spotify_connected' && event.data.success) {
                onConnected();
            }
        };

        // Method 2: BroadcastChannel (works cross-origin in same browser)
        let bc;
        try {
            bc = new BroadcastChannel('spotify_connect');
            bc.onmessage = (event) => {
                if (event.data?.type === 'spotify_connected' && event.data.success) {
                    onConnected();
                }
            };
        } catch (e) { }

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
            try { bc?.close(); } catch (e) { }
        };
    }, []);

    // Handle Spotify connect — with polling fallback
    const handleConnect = async () => {
        try {
            const res = await api.get('/api/spotify/connect');
            window.open(res.data.url, '_blank', 'width=500,height=700');

            // Fallback: poll for connection status every 3 seconds for 2 minutes
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await api.get('/api/spotify/status');
                    if (statusRes.data.connected && !connected) {
                        setConnected(true);
                        setSpotifyProfile({
                            displayName: statusRes.data.displayName,
                            avatar: statusRes.data.avatar,
                        });
                        clearInterval(pollInterval);
                        toast.success('Spotify connected!');
                    }
                } catch { }
            }, 3000);
            setTimeout(() => clearInterval(pollInterval), 120000);
        } catch (err) {
            toast.error('Failed to connect Spotify');
        }
    };

    // Handle Spotify disconnect
    const handleDisconnect = async () => {
        try {
            await api.delete('/api/spotify/disconnect');
            setConnected(false);
            setSpotifyProfile(null);
            loadedRef.current = { playlists: false, liked: false, recent: false };
            toast.success('Spotify disconnected');
        } catch {
            toast.error('Failed to disconnect');
        }
    };

    // Debounced search
    const doSearch = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setIsSearching(true);
        try {
            const res = await api.get('/api/spotify/search', { params: { q: q.trim(), limit: 10 } });
            setResults(res.data.results || []);
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        if (view !== 'search') return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(() => doSearch(query), 400);
        return () => clearTimeout(debounceRef.current);
    }, [query, view, doSearch]);

    // Load playlists
    const loadPlaylists = useCallback(async () => {
        setIsLoadingList(true);
        try {
            const res = await api.get('/api/spotify/playlists');
            setPlaylists(res.data.items || []);
            loadedRef.current.playlists = true;
        } catch { toast.error('Failed to load playlists'); }
        finally { setIsLoadingList(false); }
    }, []);

    // Load playlist tracks
    const loadPlaylistTracks = useCallback(async (playlist) => {
        setSelectedPlaylist(playlist);
        setIsLoadingList(true);
        try {
            const res = await api.get(`/api/spotify/playlists/${playlist.id}/tracks`);
            setPlaylistTracks(res.data.items || []);
        } catch { toast.error('Failed to load tracks'); }
        finally { setIsLoadingList(false); }
    }, []);

    // Load liked tracks
    const loadLiked = useCallback(async () => {
        setIsLoadingList(true);
        try {
            const res = await api.get('/api/spotify/liked', { params: { limit: 30 } });
            setLikedTracks(res.data.items || []);
            loadedRef.current.liked = true;
        } catch { toast.error('Failed to load liked songs'); }
        finally { setIsLoadingList(false); }
    }, []);

    // Load recent tracks
    const loadRecent = useCallback(async () => {
        setIsLoadingList(true);
        try {
            const res = await api.get('/api/spotify/recent');
            setRecentTracks(res.data.items || []);
            loadedRef.current.recent = true;
        } catch { toast.error('Failed to load recent tracks'); }
        finally { setIsLoadingList(false); }
    }, []);

    // View change handler — only load once per view
    useEffect(() => {
        if (!connected) return;
        if (view === 'playlists' && !loadedRef.current.playlists) loadPlaylists();
        if (view === 'liked' && !loadedRef.current.liked) loadLiked();
        if (view === 'recent' && !loadedRef.current.recent) loadRecent();
    }, [view, connected]);

    // Add track: directly as Spotify source (no YouTube matching)
    const handleAddTrack = async (track) => {
        setIsAdding(track.spotifyId);
        try {
            // Check if already in queue
            if (queueIds.has(track.spotifyId)) {
                toast('Already in queue', { icon: '🔁' });
                return;
            }

            // Add directly as Spotify source
            const res = await api.post(`/api/rooms/${slug}/songs`, {
                source: 'spotify',
                spotifyUri: track.uri,
                spotifyId: track.spotifyId,
                title: track.name,
                thumbnail: track.albumImageSmall || track.albumImage || '',
                artist: track.artist,
            });

            if (res.status === 201) {
                toast.success(`Added: ${track.name}`);
            } else if (res.status === 409) {
                toast('Already in queue', { icon: '🔁' });
            }
        } catch (err) {
            if (err.response?.status === 409) {
                toast('Already in queue', { icon: '🔁' });
            } else {
                toast.error('Failed to add song');
            }
        } finally {
            setIsAdding(null);
        }
    };

    // ============= RENDER =============

    // Loading state
    if (connected === null) {
        return (
            <div className="flex items-center justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-[#1DB954]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    // Not connected — show Connect button
    if (!connected) {
        return (
            <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#1DB954]/10 flex items-center justify-center">
                    <SpotifyIcon className="w-8 h-8 text-[#1DB954]" />
                </div>
                <div>
                    <h4 className="font-display font-semibold text-sm text-text-primary">Connect Spotify</h4>
                    <p className="text-xs text-text-muted mt-1">Link your Spotify to search, browse playlists, and add songs</p>
                </div>
                <button
                    onClick={handleConnect}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-medium text-sm transition-all hover:scale-105"
                    style={{ background: '#1DB954' }}
                >
                    <SpotifyIcon className="w-4 h-4" />
                    Connect Spotify
                </button>
            </div>
        );
    }

    // Connected — show browser
    return (
        <div className="space-y-3">
            {/* Profile + Disconnect */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                    <span className="text-xs text-text-muted">{spotifyProfile?.displayName}</span>
                </div>
                <button onClick={handleDisconnect} className="text-[10px] text-text-muted hover:text-danger transition-colors">
                    Disconnect
                </button>
            </div>

            {/* View tabs */}
            <div className="flex gap-1 bg-surface rounded-lg p-0.5 overflow-x-auto scrollbar-none">
                {[
                    { key: 'search', label: '🔍 Search' },
                    { key: 'playlists', label: '📁 Playlists' },
                    { key: 'liked', label: '💚 Liked' },
                    { key: 'recent', label: '🕐 Recent' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setView(tab.key); setPlaylistTracks(null); setSelectedPlaylist(null); }}
                        className={`flex-shrink-0 text-[11px] py-1.5 px-2.5 rounded-md transition-all font-medium whitespace-nowrap
                            ${view === tab.key ? 'bg-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search view */}
            {view === 'search' && (
                <div>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                            <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="input-field w-full pl-9 text-sm"
                            placeholder="Search Spotify..."
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="w-4 h-4 animate-spin text-[#1DB954]" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        )}
                    </div>
                    {results.length > 0 && (
                        <div className="mt-2 space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">
                            {results.map(track => (
                                <TrackRow key={track.spotifyId} track={track} isAdding={isAdding} queueIds={queueIds} onAdd={handleAddTrack} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Playlists view */}
            {view === 'playlists' && (
                <div>
                    {playlistTracks && selectedPlaylist ? (
                        <div>
                            <button onClick={() => { setPlaylistTracks(null); setSelectedPlaylist(null); }}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-2 transition-colors">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                                Back to playlists
                            </button>
                            <div className="flex items-center gap-2 mb-2">
                                {selectedPlaylist.image && (
                                    <img src={selectedPlaylist.image} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{selectedPlaylist.name}</p>
                                    <p className="text-[10px] text-text-muted">{selectedPlaylist.trackCount} tracks</p>
                                </div>
                            </div>
                            <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">
                                {isLoadingList ? <LoadingSkeleton /> : playlistTracks.map(track => track && (
                                    <TrackRow key={track.spotifyId} track={track} isAdding={isAdding} queueIds={queueIds} onAdd={handleAddTrack} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                            {isLoadingList ? <LoadingSkeleton /> : playlists.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => loadPlaylistTracks(p)}
                                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-card-hover cursor-pointer transition-colors"
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded bg-surface overflow-hidden">
                                        {p.image ? (
                                            <img src={p.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-text-muted">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{p.name}</p>
                                        <p className="text-[10px] text-text-muted">{p.trackCount} tracks • {p.owner}</p>
                                    </div>
                                    <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Liked tracks */}
            {view === 'liked' && (
                <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">
                    {isLoadingList ? <LoadingSkeleton /> : likedTracks.map(track => track && (
                        <TrackRow key={track.spotifyId} track={track} isAdding={isAdding} queueIds={queueIds} onAdd={handleAddTrack} />
                    ))}
                    {!isLoadingList && likedTracks.length === 0 && (
                        <p className="text-xs text-text-muted text-center py-4">No liked songs found</p>
                    )}
                </div>
            )}

            {/* Recent tracks */}
            {view === 'recent' && (
                <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">
                    {isLoadingList ? <LoadingSkeleton /> : recentTracks.map((track, idx) => track && (
                        <TrackRow key={`${track.spotifyId}-${idx}`} track={track} isAdding={isAdding} queueIds={queueIds} onAdd={handleAddTrack} />
                    ))}
                    {!isLoadingList && recentTracks.length === 0 && (
                        <p className="text-xs text-text-muted text-center py-4">No recent tracks</p>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Sub-components ---

function TrackRow({ track, isAdding, queueIds, onAdd }) {
    const adding = isAdding === track.spotifyId;
    return (
        <div
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-card-hover transition-colors group cursor-pointer"
            onClick={() => !adding && onAdd(track)}
        >
            <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-surface">
                {track.albumImageSmall ? (
                    <img src={track.albumImageSmall} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1DB954]/10">
                        <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{track.name}</p>
                <p className="text-[10px] text-text-muted truncate">{track.artist}</p>
            </div>
            {adding ? (
                <svg className="w-4 h-4 animate-spin text-[#1DB954] flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : (
                <button className="p-1 rounded-md text-[#1DB954] hover:bg-[#1DB954]/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
            )}
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-2 py-1">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-2.5 p-2">
                    <div className="skeleton w-10 h-10 rounded" />
                    <div className="flex-1">
                        <div className="skeleton h-3 w-3/4 rounded mb-1" />
                        <div className="skeleton h-2 w-1/2 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function SpotifyIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
    );
}
