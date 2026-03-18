import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function PlaylistManager({ isOpen, onClose }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [importUrl, setImportUrl] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPlaylists();
        }
    }, [isOpen]);

    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/playlists');
            setPlaylists(res.data.playlists || []);
        } catch (err) {
            toast.error('Failed to load playlists');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;

        try {
            const res = await api.post('/api/playlists', { name: newPlaylistName });
            setPlaylists([res.data.playlist, ...playlists]);
            setNewPlaylistName('');
            toast.success('Playlist created');
        } catch (err) {
            toast.error('Failed to create playlist');
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importUrl.trim()) return;

        try {
            setLoading(true);
            await api.post('/api/playlists/import', { url: importUrl });
            setImportUrl('');
            toast.success('Playlist imported successfully');
            fetchPlaylists();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to import playlist');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this playlist?')) return;

        try {
            await api.delete(`/api/playlists/${id}`);
            setPlaylists(playlists.filter(p => p.id !== id));
            toast.success('Playlist deleted');
        } catch (err) {
            toast.error('Failed to delete playlist');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface-800 border border-surface-700/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
                    <h2 className="font-syne text-2xl font-bold font-glow">Saved Playlists</h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-8">
                    {/* Create New / Import Forms */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <form onSubmit={handleCreate} className="space-y-4">
                            <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider">Create New</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    placeholder="Playlist Name"
                                    className="flex-1 bg-surface-900 border border-surface-700 rounded-xl px-4 py-2 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!newPlaylistName.trim()}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                                >
                                    Create
                                </button>
                            </div>
                        </form>

                        <form onSubmit={handleImport} className="space-y-4">
                            <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider">Import YouTube Playlist</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    placeholder="YouTube URL"
                                    className="flex-1 bg-surface-900 border border-surface-700 rounded-xl px-4 py-2 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!importUrl.trim() || loading}
                                    className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                                >
                                    Import
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Playlist List */}
                    <div>
                        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4 border-b border-surface-700/50 pb-2">Your Playlists</h3>

                        {loading && playlists.length === 0 ? (
                            <div className="text-center py-8 text-surface-400">Loading playlists...</div>
                        ) : playlists.length === 0 ? (
                            <div className="text-center py-8 text-surface-400 bg-surface-900/50 rounded-xl border border-dashed border-surface-700">
                                You don't have any playlists yet.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {playlists.map(playlist => (
                                    <div key={playlist.id} className="bg-surface-900 border border-surface-700 rounded-xl p-4 flex gap-4 hover:border-primary-500/50 transition-colors group">
                                        <div className="w-16 h-16 bg-surface-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                                            {playlist.thumbnail ? (
                                                <img src={playlist.thumbnail} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-surface-600">
                                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white truncate">{playlist.name}</h4>
                                            <p className="text-sm text-surface-400">{playlist.songCount || 0} songs</p>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                            <button
                                                onClick={() => handleDelete(playlist.id)}
                                                className="p-2 text-surface-400 hover:text-red-400 transition-colors"
                                                title="Delete Playlist"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
