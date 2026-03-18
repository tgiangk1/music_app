import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';

const REACTION_EMOJIS = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];
const MAX_MESSAGES = 150;

/**
 * Room Chat — always visible when tab is active
 * Includes emoji reaction picker integrated into input area
 */
export default function ChatBox({ socket }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const chatContainerRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const user = useAuthStore(s => s.user);

    // Request chat history on mount
    useEffect(() => {
        if (!socket) return;
        socket.emit('chat:history');
    }, [socket]);

    // Listen for messages — cap at MAX_MESSAGES to prevent lag
    // Backend emits 'chat:history' for history and 'chat:new' for new messages
    useEffect(() => {
        if (!socket) return;
        const onHistory = (data) => setMessages(data.slice(-MAX_MESSAGES));
        const onNew = (msg) => setMessages(prev => [...prev, msg].slice(-MAX_MESSAGES));
        socket.on('chat:history', onHistory);
        socket.on('chat:new', onNew);
        return () => {
            socket.off('chat:history', onHistory);
            socket.off('chat:new', onNew);
        };
    }, [socket]);

    // Track if user is near bottom of chat
    const handleScroll = useCallback(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    }, []);

    // Auto-scroll — use container scrollTop instead of scrollIntoView
    // scrollIntoView scrolls the ENTIRE page, not just the chat container
    useEffect(() => {
        if (isNearBottom && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isNearBottom]);

    // Close emoji picker on outside click
    useEffect(() => {
        if (!showEmojiPicker) return;
        const handler = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    const handleSend = useCallback((e) => {
        e.preventDefault();
        const content = input.trim();
        if (!content || !socket) return;
        socket.emit('chat:send', { content });
        setInput('');
    }, [input, socket]);

    const sendReaction = useCallback((emoji) => {
        socket?.emit('reaction:send', { emoji });
    }, [socket]);

    // Format timestamp — ensure UTC parsing by appending Z if missing
    const formatTime = (ts) => {
        if (!ts) return '';
        // SQLite timestamps are UTC but missing Z suffix
        const isoTs = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
        return new Date(isoTs).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    return (
        <div className="glass-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            {/* Messages */}
            <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3"
            >
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-text-muted text-sm">
                        No messages yet — say hi! 👋
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.user.userId === user?.id;
                        return (
                            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <img
                                    src={msg.user.avatar}
                                    alt=""
                                    className="w-7 h-7 rounded-full flex-shrink-0 mt-1"
                                    referrerPolicy="no-referrer"
                                />
                                <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                                    {!isMe && (
                                        <p className="text-[11px] font-medium text-text-muted mb-0.5 truncate">{msg.user.displayName || msg.user.name || 'Unknown'}</p>
                                    )}
                                    <div className={`inline-block px-3 py-2 rounded-2xl text-sm ${isMe
                                        ? 'bg-primary/20 text-text-primary rounded-tr-md'
                                        : 'bg-card text-text-primary rounded-tl-md'
                                        }`}>
                                        <p style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{msg.content}</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-text-muted ${isMe ? 'justify-end' : ''}`}>
                                        <span>{formatTime(msg.createdAt)}</span>
                                        {msg.songTitle && (
                                            <>
                                                <span>·</span>
                                                <span className="truncate max-w-[120px] font-body" title={msg.songTitle}>🎵 {msg.songTitle}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input with emoji picker */}
            <form onSubmit={handleSend} className="p-3 border-t border-border">
                <div className="flex items-center gap-2">
                    {/* Emoji picker trigger */}
                    <div ref={emojiPickerRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(prev => !prev)}
                            className={`p-2 rounded-lg transition-colors ${showEmojiPicker ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-card-hover'
                                }`}
                            title="Send reaction"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                            </svg>
                        </button>

                        {/* Emoji picker popup */}
                        {showEmojiPicker && (
                            <div className="absolute bottom-full left-0 mb-2 z-20">
                                <div className="bg-card border border-border rounded-2xl p-2 flex flex-wrap gap-1 w-[240px] animate-fade-in shadow-xl">
                                    {REACTION_EMOJIS.map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => sendReaction(emoji)}
                                            className="text-xl p-1.5 rounded-xl hover:bg-card-hover hover:scale-110 transition-all"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="input-field flex-1 !py-2 text-sm"
                        placeholder="Type a message..."
                        maxLength={500}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="btn-primary !px-3 !py-2 disabled:opacity-40"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}
