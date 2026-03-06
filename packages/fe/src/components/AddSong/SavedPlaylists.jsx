import { useEffect, useState } from 'react';
import { usePlaylistStore } from '../../store/playlistStore';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function SavedPlaylists({ slug }) {
    const {
        playlists,
        isLoading,
        fetchPlaylists,
        deletePlaylist,
        importPlaylist,
        pushPlaylistToRoom
    } = usePlaylistStore();

    const [isImporting, setIsImporting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [pushingId, setPushingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [playlistDetails, setPlaylistDetails] = useState({}); // id -> { playlist, songs }
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    useEffect(() => {
        fetchPlaylists();
    }, [fetchPlaylists]);

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importUrl.trim() || isImporting) return;
        setIsImporting(true);
        try {
            await importPlaylist(importUrl.trim(), '');
            toast.success('Playlist saved successfully');
            setImportUrl('');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this playlist?')) return;
        try {
            await deletePlaylist(id);
            toast.success('Playlist deleted');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handlePush = async (id, e) => {
        e.stopPropagation();
        if (pushingId) return;
        setPushingId(id);
        try {
            const res = await pushPlaylistToRoom(slug, id);
            toast.success(`Pushed ${res.added} songs to queue (${res.skipped} skipped)`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setPushingId(null);
        }
    };

    const fetchDetails = async (id) => {
        if (playlistDetails[id]) return; // already fetched
        setIsLoadingDetails(true);
        try {
            const res = await api.get(`/api/playlists/${id}`);
            setPlaylistDetails((prev) => ({ ...prev, [id]: res.data }));
        } catch (err) {
            toast.error('Failed to load playlist details');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const toggleExpand = (id) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            fetchDetails(id);
        }
    };

    const handleRemoveSong = async (playlistId, youtubeId, e) => {
        e.stopPropagation();
        try {
            await api.delete(`/api/playlists/${playlistId}/songs/${youtubeId}`);
            // Update local state
            setPlaylistDetails((prev) => {
                const current = prev[playlistId];
                if (!current) return prev;
                return {
                    ...prev,
                    [playlistId]: {
                        ...current,
                        songs: current.songs.filter(s => s.youtube_id !== youtubeId),
                        playlist: { ...current.playlist, song_count: current.playlist.song_count - 1 }
                    }
                };
            });
            // Also need to refetch playlists to update the count in the parent list, but for UX just let it be or refetch
            fetchPlaylists();
        } catch (err) {
            toast.error('Failed to remove song');
        }
    };

    return (
        <div className="space-y-4">
            {/* Import Form */}
            <form onSubmit={handleImport} className="flex gap-2">
                <input
                    type="text"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="input-field flex-1"
                    placeholder="Import YouTube Playlist to Saved..."
                    disabled={isImporting}
                />
                <button
                    type="submit"
                    disabled={isImporting || !importUrl.trim()}
                    className="btn-primary whitespace-nowrap disabled:opacity-50"
                >
                    {isImporting ? 'Saving...' : 'Save Playlist'}
                </button>
            </form>

            <div className="border-t border-border/50 pt-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">Your Saved Playlists</h3>

                {isLoading && playlists.length === 0 ? (
                    <div className="flex justify-center p-4">
                        <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                ) : playlists.length === 0 ? (
                    <div className="text-center py-6 text-sm text-text-muted bg-surface/50 rounded-xl border border-border/50">
                        You don't have any saved playlists yet.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
                        {playlists.map((playlist) => (
                            <div key={playlist.id} className="bg-surface border border-border/50 rounded-xl overflow-hidden transition-all">
                                {/* Header / Toggle */}
                                <div
                                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-card transition-colors"
                                    onClick={() => toggleExpand(playlist.id)}
                                >
                                    <div>
                                        <p className="font-medium text-sm">{playlist.name}</p>
                                        <p className="text-xs text-text-muted">{playlist.song_count} songs</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handlePush(playlist.id, e)}
                                            disabled={pushingId === playlist.id || playlist.song_count === 0}
                                            className="px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                                            title="Push all songs to Queue"
                                        >
                                            {pushingId === playlist.id ? (
                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                </svg>
                                            )}
                                            Push to Queue
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(playlist.id, e)}
                                            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                            title="Delete Playlist"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Area (Songs) */}
                                {expandedId === playlist.id && (
                                    <div className="bg-card border-t border-border/50 p-2">
                                        {isLoadingDetails && !playlistDetails[playlist.id] ? (
                                            <div className="text-center py-4 text-xs text-text-muted">Loading songs...</div>
                                        ) : playlistDetails[playlist.id]?.songs?.length === 0 ? (
                                            <div className="text-center py-4 text-xs text-text-muted">No songs in playlist.</div>
                                        ) : (
                                            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                                                {playlistDetails[playlist.id]?.songs?.map((song) => (
                                                    <div key={song.youtube_id} className="flex items-center gap-2 p-1.5 hover:bg-surface rounded-lg group text-xs text-text-secondary">
                                                        <div className="flex-shrink-0 w-8 h-6 rounded overflow-hidden relative bg-black/50">
                                                            <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 truncate">
                                                            <span className="truncate">{song.title}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleRemoveSong(playlist.id, song.youtube_id, e)}
                                                            className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 p-1"
                                                            title="Remove from playlist"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
