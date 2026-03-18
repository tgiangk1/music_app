import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function QueueList({
    songs,
    isLoading,
    isRoomOwner,
    isGuest,
    userId,
    onRemove,
    onClear,
    onReorder,
    onShuffle,
    repeatMode,
    onRepeatToggle,
}) {
    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(songs);
        const [reordered] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reordered);

        onReorder(items.map(s => s.id));
    };

    if (isLoading) {
        return (
            <div className="glass-card p-6 flex flex-col min-h-[450px] max-h-[450px]">
                <div className="flex items-center justify-between mb-4">
                    <div className="skeleton h-6 w-32" />
                </div>
                <div className="space-y-3 flex-1 overflow-hidden">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-16 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const [searchQuery, setSearchQuery] = useState('');

    const filteredSongs = searchQuery.trim()
        ? songs.filter(s =>
            s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.added_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : songs;

    return (
        <div className="glass-card p-6 flex flex-col min-h-[450px] max-h-[450px]">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                    </svg>
                    Up Next
                    <span className="text-sm text-text-muted font-normal">({songs.length})</span>
                </h3>

                <div className="flex items-center gap-1">
                    {/* Repeat toggle */}
                    {!isGuest && (
                        <button
                            onClick={onRepeatToggle}
                            className={`p-1.5 rounded-lg transition-all text-xs ${repeatMode !== 'off'
                                ? 'text-primary bg-primary/10'
                                : 'text-text-muted hover:text-text-secondary hover:bg-card-hover'
                                }`}
                            title={`Repeat: ${repeatMode}`}
                        >
                            {repeatMode === 'single' ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Shuffle */}
                    {!isGuest && songs.length > 1 && (
                        <button
                            onClick={onShuffle}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-card-hover transition-all"
                            title="Shuffle queue"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                        </button>
                    )}

                    {/* Clear All */}
                    {isRoomOwner && !isGuest && songs.length > 0 && (
                        <button onClick={onClear} className="btn-danger text-xs px-3 py-1.5">
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Queue Search */}
            {songs.length > 2 && (
                <div className="relative mb-3 flex-shrink-0">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter queue..."
                        className="w-full pl-9 pr-8 py-2 text-xs bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {songs.length === 0 ? (
                <div className="text-center flex-1 flex flex-col items-center justify-center animate-fade-in">
                    <div className="w-16 h-16 mb-4 rounded-full bg-card flex items-center justify-center">
                        <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                        </svg>
                    </div>
                    <p className="text-text-muted text-sm">Queue is empty</p>
                    <p className="text-text-muted text-xs mt-1">Add a YouTube URL above</p>
                </div>
            ) : filteredSongs.length === 0 && searchQuery ? (
                <div className="text-center flex-1 flex flex-col items-center justify-center animate-fade-in">
                    <p className="text-text-muted text-sm">No songs match "{searchQuery}"</p>
                </div>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="queue">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 flex-1 overflow-y-scroll scrollbar-thin pr-1 min-h-0">
                                {filteredSongs.map((song, index) => (
                                    <Draggable key={song.id} draggableId={song.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group
                          ${snapshot.isDragging ? 'bg-card border border-primary/20' : 'bg-surface/50 hover:bg-card-hover'}`}
                                            >
                                                {/* Drag handle */}
                                                {!isGuest && (
                                                    <div {...provided.dragHandleProps} className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary p-1 -ml-1 rounded hover:bg-card-hover transition-colors">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                                        </svg>
                                                    </div>
                                                )}

                                                {/* Thumbnail */}
                                                <div className="flex-shrink-0 w-12 h-9 rounded-lg overflow-hidden bg-card">
                                                    <img
                                                        src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id}/default.jpg`}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{song.title}</p>
                                                    <p className="text-xs text-text-muted">
                                                        {song.added_by_name}
                                                        {song.duration > 0 && ` · ${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`}
                                                    </p>
                                                </div>

                                                {/* Remove button */}
                                                {!isGuest && (isRoomOwner || song.added_by === userId) && (
                                                    <button
                                                        onClick={() => onRemove(song.id)}
                                                        className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            )}
        </div>
    );
}
