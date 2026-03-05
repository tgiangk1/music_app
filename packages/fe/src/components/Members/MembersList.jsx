export default function MembersList({ members, isAdmin, roomSlug, onClose }) {
    return (
        <div className="glass-card p-6 sticky top-20">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    Online
                    <span className="text-sm text-text-muted font-normal">({members.length})</span>
                </h3>

                {/* Mobile close button */}
                <button onClick={onClose} className="p-1 hover:bg-card rounded-lg lg:hidden">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {members.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">No one's here yet</p>
            ) : (
                <div className="space-y-2">
                    {members.map((member, i) => (
                        <div
                            key={member.userId}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-card-hover transition-colors animate-slide-in"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            <div className="relative flex-shrink-0">
                                <img
                                    src={member.avatar}
                                    alt={member.displayName}
                                    className="w-9 h-9 rounded-full border border-border"
                                />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{member.displayName}</p>
                                <span className={member.role === 'admin' ? 'badge-admin' : 'badge-member'}>
                                    {member.role}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
