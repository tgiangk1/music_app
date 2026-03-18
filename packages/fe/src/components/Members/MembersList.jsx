import { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const ROLE_BADGES = {
    owner: { label: 'Host', color: 'text-warning bg-warning/10' },
    dj: { label: 'DJ', color: 'text-primary bg-primary/10' },
    listener: null, // No badge for listeners
};

export default function MembersList({ members, isRoomOwner, currentUserId, roomSlug, socket, onClose }) {
    const [kickingId, setKickingId] = useState(null);
    const [roleMenuId, setRoleMenuId] = useState(null);

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

    const handleSetRole = (userId, role) => {
        if (socket) socket.emit('member:set-role', { userId, role });
        setRoleMenuId(null);
    };

    const getEffectiveRole = (member) => {
        if (member.isOwner) return 'owner';
        return member.roomRole || 'listener';
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
                <div className="space-y-1">
                    {members.map((member) => {
                        const role = getEffectiveRole(member);
                        const badge = ROLE_BADGES[role];
                        const isMe = member.userId === currentUserId;

                        return (
                            <div
                                key={member.userId}
                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-card-hover/50 transition-colors group relative"
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={member.avatar}
                                        alt={member.displayName}
                                        className="w-9 h-9 rounded-full border border-border"
                                        referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-card" />
                                </div>

                                {/* Name + Role */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary truncate">
                                        {member.displayName}
                                        {isMe && <span className="text-text-muted ml-1 text-xs">(you)</span>}
                                    </p>
                                    {badge && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                    )}
                                </div>

                                {/* Actions (owner only, not on self or other owners) */}
                                {isRoomOwner && !member.isOwner && !isMe && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Role toggle */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setRoleMenuId(roleMenuId === member.userId ? null : member.userId)}
                                                className="p-1.5 rounded-lg hover:bg-card text-text-muted hover:text-text-primary transition-colors"
                                                title="Change role"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                </svg>
                                            </button>
                                            {roleMenuId === member.userId && (
                                                <div className="absolute right-0 top-full mt-1 w-28 bg-card border border-border rounded-xl p-1 z-10 shadow-lg animate-fade-in">
                                                    <button
                                                        onClick={() => handleSetRole(member.userId, 'dj')}
                                                        className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${role === 'dj' ? 'bg-primary/10 text-primary' : 'hover:bg-card-hover text-text-secondary'
                                                            }`}
                                                    >
                                                        🎧 DJ
                                                    </button>
                                                    <button
                                                        onClick={() => handleSetRole(member.userId, 'listener')}
                                                        className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${role === 'listener' ? 'bg-primary/10 text-primary' : 'hover:bg-card-hover text-text-secondary'
                                                            }`}
                                                    >
                                                        👤 Listener
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Kick */}
                                        <button
                                            onClick={() => handleKick(member)}
                                            disabled={kickingId === member.userId}
                                            className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                                            title={`Kick ${member.displayName}`}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
