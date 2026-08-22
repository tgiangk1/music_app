import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * Queue Suggestions — members suggest songs and upvote them.
 * A suggestion that reaches the vote threshold moves into the queue automatically.
 */
export default function Suggestions({ slug, socket, userId, isRoomOwner }) {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [url, setUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [votingId, setVotingId] = useState(null);

    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}/suggestions`)
            .then(res => setSuggestions(res.data.suggestions || []))
            .catch(() => setSuggestions([]))
            .finally(() => setIsLoading(false));
    }, [slug]);

    // Realtime updates
    useEffect(() => {
        if (!socket) return;
        const onUpdate = (list) => setSuggestions(list || []);
        socket.on('suggestions:update', onUpdate);
        return () => socket.off('suggestions:update', onUpdate);
    }, [socket]);

    const handleSuggest = useCallback(async (e) => {
        e.preventDefault();
        if (!url.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await api.post(`/api/rooms/${slug}/suggestions`, { url: url.trim() });
            setSuggestions(prev => [res.data.suggestion, ...prev.filter(s => s.id !== res.data.suggestion.id)]);
            setUrl('');
            toast.success('Suggestion posted — gather votes! 🗳️');
        } catch (err) {
            const code = err.response?.data?.code;
            if (code === 'IN_QUEUE') toast('Already in the queue — just add it directly', { icon: '🔁' });
            else if (code === 'DUPLICATE_SUGGESTION') toast('Someone already suggested this song', { icon: '🗳️' });
            else toast.error(err.response?.data?.error || 'Failed to suggest');
        } finally {
            setIsSubmitting(false);
        }
    }, [url, isSubmitting, slug]);

    const handleVote = useCallback(async (id) => {
        setVotingId(id);
        try {
            const res = await api.post(`/api/rooms/${slug}/suggestions/${id}/vote`);
            setSuggestions(res.data.suggestions || []);
            if (res.data.movedToQueue) toast.success('Added to queue by popular vote! 🎉');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to vote');
        } finally {
            setVotingId(null);
        }
    }, [slug]);

    const handleRemove = useCallback(async (id) => {
        try {
            await api.delete(`/api/rooms/${slug}/suggestions/${id}`);
            setSuggestions(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove');
        }
    }, [slug]);

    return (
        <div className="glass-card p-5 flex flex-col min-h-[450px] max-h-[450px]">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3 flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Suggest a Song
                <span className="text-sm text-text-muted font-normal">({suggestions.length})</span>
            </h3>
            <p className="text-xs text-text-muted mb-3 flex-shrink-0 -mt-2">
                Paste any YouTube or Spotify link. Songs with 2+ votes join the queue automatically.
            </p>

            {/* Suggest form */}
            <form onSubmit={handleSuggest} className="flex gap-2 mb-4 flex-shrink-0">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste YouTube or Spotify URL..."
                    className="input-field flex-1 text-xs py-2"
                    disabled={isSubmitting}
                />
                <button type="submit" disabled={!url.trim() || isSubmitting} className="btn-primary text-xs px-3 py-2 disabled:opacity-50">
                    {isSubmitting ? '…' : 'Suggest'}
                </button>
            </form>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-2 min-h-0">
                {isLoading ? (
                    <>
                        {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                    </>
                ) : suggestions.length === 0 ? (
                    <div className="text-center py-10 animate-fade-in">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-card flex items-center justify-center">
                            <span className="text-2xl">🗳️</span>
                        </div>
                        <p className="text-text-muted text-sm">No suggestions yet</p>
                        <p className="text-text-muted text-xs mt-1">Not sure about a song? Suggest it and let the room decide!</p>
                    </div>
                ) : (
                    suggestions.map(s => (
                        <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${s.my_vote ? 'bg-primary/5 border border-primary/20' : 'bg-surface/50 hover:bg-card-hover'}`}>
                            <button
                                onClick={() => handleVote(s.id)}
                                disabled={votingId === s.id}
                                className={`flex-shrink-0 w-10 h-12 rounded-lg flex flex-col items-center justify-center border transition-all active:scale-90 ${s.my_vote ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-text-muted hover:text-primary hover:border-primary/30'}`}
                                aria-label={s.my_vote ? 'Remove vote' : 'Upvote suggestion'}
                            >
                                <svg className="w-3.5 h-3.5" fill={s.my_vote ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                </svg>
                                <span className="text-xs font-bold leading-none">{s.vote_count}</span>
                            </button>

                            <div className="flex-shrink-0 w-12 h-9 rounded-lg overflow-hidden bg-card">
                                {s.thumbnail && <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" title={s.title}>{s.title}</p>
                                <p className="text-xs text-text-muted truncate">by {s.suggested_by_name}{s.vote_count >= 2 ? ' · 🎉 ready to play' : ` · needs ${2 - s.vote_count} more`}</p>
                            </div>

                            {(s.suggested_by === userId || isRoomOwner) && (
                                <button
                                    onClick={() => handleRemove(s.id)}
                                    className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-danger active:bg-danger/10 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                    aria-label="Remove suggestion"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
