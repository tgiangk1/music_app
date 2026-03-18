import { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function MembersList({ members, isRoomOwner, currentUserId, roomSlug, socket, onClose }) {
    const [kickingId, setKickingId] = useState(null);

    const handleKick = async (member) => {
        if (!confirm(`Kick ${member.displayName} from the room?`)) return;
        setKickingId(member.userId);
        try {
            await api.delete(`/api/rooms/${roomSlug}/members/${member.userId}`);
            if (socket) {
                socket.emit('member:kick', { userId: member.userId });
            }
            toast.success(`${member.displayName} has been kicked`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to kick member');
        } finally {
            setKickingId(null);
        }
    };

    return (
        <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold flex items-center gap-2 text-text-secondary">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {members.length} Online
                </h3>
            </div>

            {members.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-6">No one's here yet</p>
            ) : (
                <div className="grid grid-cols-4 gap-3">
                    {members.map((member) => (
                        <div
                            key={member.userId}
                            className="flex flex-col items-center gap-1.5 group relative"
                        >
                            <div className="relative">
                                <img
                                    src={member.avatar}
                                    alt={member.displayName}
                                    className="w-10 h-10 rounded-full border border-border"
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-card" />

                                {/* Kick button overlay */}
                                {isRoomOwner && !member.isOwner && member.userId !== currentUserId && (
                                    <button
                                        onClick={() => handleKick(member)}
                                        disabled={kickingId === member.userId}
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 disabled:opacity-50"
                                        title={`Kick ${member.displayName}`}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <span className="text-[10px] text-text-muted truncate w-full text-center leading-tight">
                                {member.displayName.split(' ')[0]}
                            </span>
                            {member.isOwner && (
                                <span className="text-[8px] font-mono text-warning px-1 rounded bg-warning/10">host</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
