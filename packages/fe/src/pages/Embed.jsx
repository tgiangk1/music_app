import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useQueue } from '../hooks/useQueue';
import { usePlayerStore } from '../store/playerStore';
import PlayerComponent from '../components/Player/PlayerComponent';
import api from '../lib/api';

export default function Embed() {
    const { slug } = useParams();
    const playerState = usePlayerStore();
    const [room, setRoom] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const {
        socket,
        isConnected,
        onlineMembers, // not really used here but we need socket conn
    } = useSocket(slug);

    const { songs } = useQueue(slug);

    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}`)
            .then(res => {
                setRoom(res.data.room);
                setIsLoading(false);
            })
            .catch(err => {
                setIsLoading(false);
            });
    }, [slug]);

    useEffect(() => {
        if (!slug) return;
        api.get(`/api/rooms/${slug}/player`)
            .then(res => {
                if (res.data.player) usePlayerStore.getState().setPlayerState(res.data.player);
            })
            .catch(() => { });
    }, [slug]);

    const currentSong = songs.find(s => s.is_playing);

    if (isLoading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
    }

    if (!room) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Room not found</div>;
    }

    return (
        <div className="min-h-screen bg-transparent text-white font-sans overflow-hidden">
            <div className="bg-surface-900 border border-surface-700/50 rounded-xl overflow-hidden shadow-2xl h-screen flex flex-col">
                <div className="p-3 border-b border-surface-700/50 flex items-center justify-between flex-shrink-0 bg-surface-800">
                    <h1 className="font-syne font-bold text-sm truncate">{room.name}</h1>
                    <div className="flex items-center gap-1.5 text-xs text-surface-400">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {onlineMembers.length} listeners
                    </div>
                </div>

                {/* Player constraints - mostly visual sync */}
                <div className="relative aspect-video flex-shrink-0 bg-black">
                    <PlayerComponent
                        videoId={playerState.videoId}
                        playerState={playerState.state}
                        currentTime={playerState.currentTime}
                        currentSong={currentSong}
                        isRoomOwner={false} // completely read only
                        emitPlayerSync={() => { }}
                        emitPlayerSkip={() => { }}
                        emitPlayerEnded={() => { }}
                    />
                </div>

                <div className="flex-1 p-3 overflow-y-auto bg-surface-900">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Up Next</h3>
                    <div className="space-y-1.5">
                        {songs.filter(s => !s.is_playing).length === 0 ? (
                            <p className="text-surface-500 text-xs text-center py-4">Queue is empty</p>
                        ) : (
                            songs.filter(s => !s.is_playing).map((song) => (
                                <div key={song.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-800 transition-colors">
                                    <img
                                        src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id}/default.jpg`}
                                        alt=""
                                        className="w-10 h-7 object-cover rounded"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{song.title}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-2 border-t border-surface-700/50 flex-shrink-0 bg-surface-800 text-center">
                    <a href={`${window.location.origin}/room/${room.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300">
                        Open in Jukebox &rarr;
                    </a>
                </div>
            </div>
        </div>
    );
}
