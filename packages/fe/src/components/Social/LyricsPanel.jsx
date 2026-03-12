import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

/**
 * Feature 4: Lyrics Display Panel
 * Fetches lyrics via backend proxy (Genius.com scraping)
 */
export default function LyricsPanel({ currentSong }) {
    const [lyrics, setLyrics] = useState('');
    const [songInfo, setSongInfo] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const cacheRef = useRef({}); // Cache by song title

    useEffect(() => {
        if (!isOpen || !currentSong?.title) {
            setLyrics('');
            setSongInfo(null);
            setError(null);
            return;
        }

        const title = currentSong.title;

        // Check cache
        if (cacheRef.current[title]) {
            setLyrics(cacheRef.current[title].lyrics);
            setSongInfo(cacheRef.current[title].songInfo);
            setError(null);
            return;
        }

        // Clean up YouTube title for search
        const cleanTitle = title
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/official\s*(video|audio|music\s*video|lyric\s*video|mv)/gi, '')
            .replace(/ft\.?|feat\.?/gi, '')
            .replace(/\|.*/g, '')
            .replace(/lyrics?$/i, '')
            .trim();

        if (!cleanTitle) {
            setError('Cannot extract song info for lyrics search');
            return;
        }

        setIsLoading(true);
        setError(null);

        api.get('/api/lyrics', { params: { q: cleanTitle } })
            .then(res => {
                const { lyrics: text, songInfo: info, error: apiError } = res.data;
                if (text) {
                    cacheRef.current[title] = { lyrics: text, songInfo: info };
                    setLyrics(text);
                    setSongInfo(info);
                } else {
                    setError(apiError || 'Lyrics not available for this song');
                }
            })
            .catch(() => {
                setError('Failed to fetch lyrics');
            })
            .finally(() => setIsLoading(false));
    }, [isOpen, currentSong?.title]);

    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="font-display font-semibold text-sm">Lyrics</span>
                </div>
                <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {isOpen && (
                <div className="px-4 pb-4 animate-fade-in">
                    {!currentSong ? (
                        <p className="text-text-muted text-sm text-center py-4">No song playing</p>
                    ) : isLoading ? (
                        <div className="space-y-2 py-2">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="skeleton w-8 h-8 rounded" />
                                <div>
                                    <div className="skeleton h-3 w-32 rounded mb-1" />
                                    <div className="skeleton h-2 w-20 rounded" />
                                </div>
                            </div>
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-4 rounded" style={{ width: `${50 + Math.random() * 50}%` }} />)}
                        </div>
                    ) : error ? (
                        <p className="text-text-muted text-sm text-center py-4">{error}</p>
                    ) : (
                        <>
                            {songInfo && (
                                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/50">
                                    {songInfo.thumbnail && (
                                        <img src={songInfo.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">{songInfo.title}</p>
                                        <p className="text-[10px] text-text-muted">{songInfo.artist}</p>
                                    </div>
                                </div>
                            )}
                            <div className="max-h-80 overflow-y-auto scrollbar-thin">
                                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-body leading-relaxed">
                                    {lyrics}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
