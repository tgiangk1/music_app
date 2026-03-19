import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

const REACTION_EMOJIS = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];
const MAX_MESSAGES = 150;

// --- Shared AudioContext (handles browser autoplay policy) ---
let _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}
// Unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
    const unlock = () => {
        getAudioCtx();
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

function playMessageSound() {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch { /* audio not available */ }
}

function playMentionSound() {
    try {
        const ctx = getAudioCtx();
        // First beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        // Second beep (higher pitch, slight delay)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.18);
        gain2.gain.setValueAtTime(0.01, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime + 0.18);
        osc2.stop(ctx.currentTime + 0.4);
    } catch { /* audio not available */ }
}

function showBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const notif = new Notification(title, {
            body, icon: '/favicon.png', badge: '/favicon.png',
            silent: true, tag: `soundden-${Date.now()}`, renotify: true,
        });
        notif.onclick = () => { window.focus(); notif.close(); };
        setTimeout(() => notif.close(), 6000);
    } catch { /* not available */ }
}

/**
 * Room Chat with reply, @mention, audio & browser notifications
 */
export default function ChatBox({ socket, onlineMembers = [] }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [replyTo, setReplyTo] = useState(null);
    const [mentionQuery, setMentionQuery] = useState(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const chatContainerRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const inputRef = useRef(null);
    const mentionDropdownRef = useRef(null);
    const originalTitleRef = useRef(document.title);
    const flashIntervalRef = useRef(null);
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Reset unread count when tab becomes visible
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setUnreadCount(0);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    // Tab title flash when unread messages
    useEffect(() => {
        if (unreadCount > 0 && document.visibilityState === 'hidden') {
            const saved = originalTitleRef.current;
            let showing = false;
            flashIntervalRef.current = setInterval(() => {
                document.title = showing ? saved : `🔔 (${unreadCount}) New messages`;
                showing = !showing;
            }, 1500);
            return () => {
                clearInterval(flashIntervalRef.current);
                document.title = saved;
            };
        } else if (unreadCount === 0 && flashIntervalRef.current) {
            clearInterval(flashIntervalRef.current);
            flashIntervalRef.current = null;
        }
    }, [unreadCount]);

    useEffect(() => {
        if (!socket) return;
        socket.emit('chat:history');
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const onHistory = (data) => setMessages(data.slice(-MAX_MESSAGES));
        const onNew = (msg) => {
            setMessages(prev => [...prev, msg].slice(-MAX_MESSAGES));

            // Get sender ID — handle both `msg.user_id` and `msg.user.userId` formats
            const senderId = msg.user_id || msg.user?.userId;

            // Skip own messages
            if (senderId === user?.id) return;

            const content = msg.content || '';
            const senderName = msg.display_name || msg.user?.displayName || 'Someone';

            // Check if current user is @mentioned in this message
            const isMentioned = user?.displayName &&
                content.toLowerCase().includes(`@${user.displayName.toLowerCase()}`);

            if (isMentioned) {
                // MENTION: always play loud sound + toast (even when tab visible)
                playMentionSound();
                showBrowserNotification(
                    `${senderName} mentioned you`,
                    `"${content.slice(0, 80)}"`,
                );
                if (document.visibilityState === 'hidden') {
                    setUnreadCount(prev => prev + 1);
                }
                toast.custom((t) => (
                    <div
                        className={`max-w-sm w-full flex gap-3 cursor-pointer transition-all ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}
                        style={{
                            background: 'linear-gradient(135deg, #1e1b2e 0%, #16131f 100%)',
                            border: '1px solid rgba(139,92,246,0.35)',
                            borderRadius: '16px',
                            padding: '14px 16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        }}
                        onClick={() => { toast.dismiss(t.id); }}
                    >
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, fontWeight: 'bold', color: 'white',
                        }}>@</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 2 }}>
                                {senderName} mentioned you
                            </p>
                            <p style={{ fontSize: 13, color: '#e2e0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                &quot;{content.slice(0, 80)}&quot;
                            </p>
                        </div>
                    </div>
                ), { duration: 6000, position: 'top-right', id: `mention-${Date.now()}` });
            } else if (document.visibilityState === 'hidden') {
                // Regular message when tab hidden → soft ding + browser notification
                playMessageSound();
                showBrowserNotification(
                    `${senderName} in chat`,
                    content.slice(0, 100) || 'New message',
                );
                setUnreadCount(prev => prev + 1);
            }
        };

        socket.on('chat:history', onHistory);
        socket.on('chat:new', onNew);
        return () => {
            socket.off('chat:history', onHistory);
            socket.off('chat:new', onNew);
        };
    }, [socket, user]);

    const handleScroll = useCallback(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    }, []);

    useEffect(() => {
        if (isNearBottom && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isNearBottom]);

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

    // Filter mention suggestions
    const mentionSuggestions = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        return onlineMembers
            .filter(m => m.userId !== user?.id && m.displayName?.toLowerCase().includes(q))
            .slice(0, 5);
    }, [mentionQuery, onlineMembers, user?.id]);

    // Detect @ symbol in input for mention dropdown
    const handleInputChange = useCallback((e) => {
        const val = e.target.value;
        setInput(val);

        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
        if (atMatch) {
            setMentionQuery(atMatch[1]);
            setMentionIndex(0);
        } else {
            setMentionQuery(null);
        }
    }, []);

    // Insert mention into input
    const insertMention = useCallback((member) => {
        const cursorPos = inputRef.current?.selectionStart || input.length;
        const textBeforeCursor = input.slice(0, cursorPos);
        const atPos = textBeforeCursor.lastIndexOf('@');
        if (atPos === -1) return;
        const before = input.slice(0, atPos);
        const after = input.slice(cursorPos);
        const newInput = `${before}@${member.displayName} ${after}`;
        setInput(newInput);
        setMentionQuery(null);
        inputRef.current?.focus();
    }, [input]);

    // Handle keyboard in mention dropdown
    const handleKeyDown = useCallback((e) => {
        if (mentionQuery !== null && mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => Math.min(prev + 1, mentionSuggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                if (mentionSuggestions[mentionIndex]) {
                    e.preventDefault();
                    insertMention(mentionSuggestions[mentionIndex]);
                    return;
                }
            } else if (e.key === 'Escape') {
                setMentionQuery(null);
            }
        }
    }, [mentionQuery, mentionSuggestions, mentionIndex, insertMention]);

    const handleSend = useCallback((e) => {
        e.preventDefault();
        if (mentionQuery !== null && mentionSuggestions.length > 0 && mentionSuggestions[mentionIndex]) {
            insertMention(mentionSuggestions[mentionIndex]);
            return;
        }
        const content = input.trim();
        if (!content || !socket) return;
        socket.emit('chat:send', { content, replyTo: replyTo?.id || undefined });
        setInput('');
        setReplyTo(null);
        setMentionQuery(null);
    }, [input, socket, replyTo, mentionQuery, mentionSuggestions, mentionIndex, insertMention]);

    const sendReaction = useCallback((emoji) => {
        socket?.emit('reaction:send', { emoji });
    }, [socket]);

    const formatTime = (ts) => {
        if (!ts) return '';
        const isoTs = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
        return new Date(isoTs).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    // Render content with @mention highlighting
    const renderContent = (content) => {
        const parts = content.split(/(@[^\s@]+(?:\s[^\s@]+)?)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return (
                    <span key={i} className="text-primary font-semibold cursor-pointer hover:underline">
                        {part}
                    </span>
                );
            }
            return part;
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
                            <div key={msg.id} className={`group flex gap-2 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
                                <img
                                    src={msg.user.avatar}
                                    alt=""
                                    className="w-7 h-7 rounded-full flex-shrink-0 mt-2"
                                    referrerPolicy="no-referrer"
                                />
                                <div className={`max-w-[75%] min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {/* Reply snippet — Discord-style, above bubble */}
                                    {msg.replyMessage && (
                                        <div className={`flex items-center gap-1.5 mb-0.5 text-[11px] max-w-full ${isMe ? 'flex-row-reverse' : 'pl-1'}`}>
                                            <div className="w-0.5 h-3.5 rounded-full bg-primary/50 flex-shrink-0" />
                                            <svg className="w-3 h-3 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                            </svg>
                                            <span className="font-semibold text-primary/70 flex-shrink-0">{msg.replyMessage.user?.displayName}</span>
                                            <span className="text-text-muted truncate">{msg.replyMessage.content}</span>
                                        </div>
                                    )}
                                    <div className={`px-3 py-2 rounded-2xl text-sm ${isMe
                                        ? 'bg-primary/20 text-text-primary rounded-tr-md'
                                        : 'bg-white/[0.06] border border-white/[0.08] text-text-primary rounded-tl-md'
                                        }`}>
                                        {!isMe && (
                                            <p className="text-[11px] font-semibold text-primary/80 mb-0.5">{msg.user.displayName || 'Unknown'}</p>
                                        )}
                                        <p style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                            {renderContent(msg.content)}
                                        </p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-text-muted ${isMe ? 'justify-end' : ''}`}>
                                        <span>{formatTime(msg.createdAt)}</span>
                                        {msg.songTitle && (
                                            <>
                                                <span>·</span>
                                                <span className="truncate max-w-[120px] font-body" title={msg.songTitle}>🎵 {msg.songTitle}</span>
                                            </>
                                        )}
                                        {/* Reply button */}
                                        <button
                                            onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-primary"
                                            title="Reply"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Reply preview bar */}
            {replyTo && (
                <div className="px-3 py-2 border-t border-border bg-white/[0.03] flex items-center gap-2 animate-fade-in">
                    <div className="w-0.5 h-8 bg-primary/60 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-primary/80">{replyTo.user?.displayName}</p>
                        <p className="text-xs text-text-muted truncate">{replyTo.content?.slice(0, 60)}</p>
                    </div>
                    <button
                        onClick={() => setReplyTo(null)}
                        className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Input with emoji picker + mention dropdown */}
            <form onSubmit={handleSend} className="p-3 border-t border-border relative">
                {/* Mention autocomplete dropdown */}
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                    <div ref={mentionDropdownRef} className="absolute bottom-full left-3 right-3 mb-1 z-30">
                        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in">
                            {mentionSuggestions.map((member, i) => (
                                <button
                                    key={member.userId}
                                    type="button"
                                    onClick={() => insertMention(member)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${i === mentionIndex ? 'bg-primary/20 text-primary' : 'text-text-primary hover:bg-white/[0.06]'}`}
                                >
                                    <img src={member.avatar} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                                    <span className="truncate">{member.displayName}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="input-field flex-1 !py-2 text-sm"
                        placeholder={replyTo ? `Reply to ${replyTo.user?.displayName}...` : 'Type a message... (@ to mention)'}
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
