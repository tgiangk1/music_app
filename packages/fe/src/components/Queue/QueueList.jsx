import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function QueueList({
    songs,
    isLoading,
    isRoomOwner,
    userId,
    onVote,
    onRemove,
    onClear,
    onReorder,
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
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="skeleton h-6 w-32" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton h-16 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                    </svg>
                    Up Next
                    <span className="text-sm text-text-muted font-normal">({songs.length})</span>
                </h3>

                {isRoomOwner && songs.length > 0 && (
                    <button onClick={onClear} className="btn-danger text-xs px-3 py-1.5">
                        Clear All
                    </button>
                )}
            </div>

            {songs.length === 0 ? (
                <div className="text-center py-12 animate-fade-in">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-card flex items-center justify-center">
                        <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                        </svg>
                    </div>
                    <p className="text-text-muted text-sm">Queue is empty</p>
                    <p className="text-text-muted text-xs mt-1">Add a YouTube URL above</p>
                </div>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="queue">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {songs.map((song, index) => (
                                    <Draggable key={song.id} draggableId={song.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group
                          ${snapshot.isDragging ? 'bg-card shadow-glow-lg' : 'bg-surface/50 hover:bg-card-hover'}`}
                                            >
                                                {/* Drag handle */}
                                                <div {...provided.dragHandleProps} className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary p-1 -ml-1 rounded hover:bg-card-hover transition-colors">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                                    </svg>
                                                </div>

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

                                                {/* Vote buttons */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => onVote(song.id, 'up')}
                                                        className={`p-1.5 rounded-lg transition-colors ${song.userVote === 'up'
                                                            ? 'text-primary bg-primary/10'
                                                            : 'text-text-muted hover:text-primary hover:bg-primary/10'
                                                            }`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                        </svg>
                                                    </button>

                                                    <span className={`text-xs font-bold min-w-[20px] text-center ${song.vote_score > 0 ? 'text-primary' : song.vote_score < 0 ? 'text-danger' : 'text-text-muted'
                                                        }`}>
                                                        {song.vote_score}
                                                    </span>

                                                    <button
                                                        onClick={() => onVote(song.id, 'down')}
                                                        className={`p-1.5 rounded-lg transition-colors ${song.userVote === 'down'
                                                            ? 'text-danger bg-danger/10'
                                                            : 'text-text-muted hover:text-danger hover:bg-danger/10'
                                                            }`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                {/* Remove button */}
                                                {(isRoomOwner || song.added_by === userId) && (
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
