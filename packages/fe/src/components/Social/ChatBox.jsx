import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';

/**
 * Feature 2: Room Chat
 * Chatbox with smooth scroll, timestamps, avatars, and song context
 */
export default function ChatBox({ socket }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const user = useAuthStore(s => s.user);

    // Request chat history on open
    useEffect(() => {
        if (!socket || !isOpen) return;
        socket.emit('chat:history');
    }, [socket, isOpen]);

    // Listen for events
    useEffect(() => {
        if (!socket) return;

        const onHistory = (history) => {
            setMessages(history);
            setTimeout(() => scrollToBottom(), 100);
        };

        const onNew = (msg) => {
            setMessages(prev => [...prev.slice(-99), msg]); // keep max 100
            if (!isOpen) setUnread(prev => prev + 1);
            setTimeout(() => scrollToBottom(), 50);
        };

        socket.on('chat:history', onHistory);
        socket.on('chat:new', onNew);

        return () => {
            socket.off('chat:history', onHistory);
            socket.off('chat:new', onNew);
        };
    }, [socket, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = useCallback((e) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;
        socket.emit('chat:send', { content: input.trim() });
        setInput('');
    }, [input, socket]);

    const toggleChat = () => {
        setIsOpen(prev => !prev);
        if (!isOpen) setUnread(0);
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="glass-card overflow-hidden">
            {/* Chat header / toggle */}
            <button
                onClick={toggleChat}
                className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                    <span className="font-display font-semibold text-sm">Chat</span>
                    {unread > 0 && (
                        <span className="bg-primary text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {/* Chat body */}
            {isOpen && (
                <div className="animate-fade-in">
                    {/* Messages */}
                    <div
                        ref={chatContainerRef}
                        className="h-72 overflow-y-auto scrollbar-thin px-4 space-y-3"
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
                                            src={msg.user.avatar || `https://ui-avatars.com/api/?name=${msg.user.displayName}&background=random&size=32`}
                                            alt=""
                                            className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5"
                                        />
                                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className={`rounded-2xl px-3 py-2 text-sm
                        ${isMe
                                                    ? 'bg-primary/20 text-text-primary rounded-tr-sm'
                                                    : 'bg-card text-text-primary rounded-tl-sm'}`}
                                            >
                                                {!isMe && (
                                                    <p className="text-xs font-semibold text-primary mb-0.5">{msg.user.displayName}</p>
                                                )}
                                                <p className="break-words">{msg.content}</p>
                                            </div>
                                            <div className={`flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted ${isMe ? 'justify-end' : ''}`}>
                                                <span>{formatTime(msg.createdAt)}</span>
                                                {msg.songTitle && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="truncate max-w-[120px]" title={msg.songTitle}>🎵 {msg.songTitle}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} className="p-3 border-t border-border/50">
                        <div className="flex gap-2">
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
            )}
        </div>
    );
}
