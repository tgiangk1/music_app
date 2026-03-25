import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
    { value: 'bug', label: '🐛 Bug', color: '#ef4444' },
    { value: 'feature-request', label: '💡 Feature', color: '#f59e0b' },
    { value: 'ui-ux', label: '🎨 UI/UX', color: '#8b5cf6' },
    { value: 'music', label: '🎵 Music', color: '#10b981' },
    { value: 'other', label: '📝 Other', color: '#6b7280' },
];

const STATUS_BADGE = {
    new: { label: 'New', bg: '#3b82f6' },
    read: { label: 'Read', bg: '#f59e0b' },
    replied: { label: 'Replied', bg: '#10b981' },
};

export default function FeedbackButton() {
    const user = useAuthStore(s => s.user);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState('form');
    const [category, setCategory] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const [feedbacks, setFeedbacks] = useState([]);
    const [unreadReplies, setUnreadReplies] = useState(0);
    const [expandedId, setExpandedId] = useState(null);
    const panelRef = useRef(null);
    const fileInputRef = useRef(null);

    // Close panel on outside click
    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    // Fetch feedback history
    useEffect(() => {
        if (!user) return;
        api.get('/api/feedback/my').then(res => {
            setFeedbacks(res.data);
            setUnreadReplies(res.data.filter(f => f.status === 'replied').length);
        }).catch(() => { });
    }, [user, open]);

    // Poll for reply notifications (every 30s)
    useEffect(() => {
        if (!user) return;
        let prevReplied = unreadReplies;
        const checkReplies = () => {
            api.get('/api/feedback/my').then(res => {
                const replied = res.data.filter(f => f.status === 'replied').length;
                if (replied > prevReplied && prevReplied >= 0) {
                    toast('Admin replied to your feedback!', { icon: '💬', duration: 5000 });
                }
                prevReplied = replied;
                setUnreadReplies(replied);
                if (open) setFeedbacks(res.data);
            }).catch(() => { });
        };
        const interval = setInterval(checkReplies, 30000);
        return () => clearInterval(interval);
    }, [user, open]);

    if (!user) return null;

    const handleScreenshot = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5MB');
            return;
        }
        setScreenshot(file);
        setScreenshotPreview(URL.createObjectURL(file));
    };

    const removeScreenshot = () => {
        setScreenshot(null);
        if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
        setScreenshotPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category || !subject.trim() || !message.trim()) {
            toast.error('Please fill all fields');
            return;
        }
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('category', category);
            formData.append('subject', subject.trim());
            formData.append('message', message.trim());
            if (screenshot) formData.append('screenshot', screenshot);

            await api.post('/api/feedback', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Feedback sent! 🎉');
            setCategory('');
            setSubject('');
            setMessage('');
            removeScreenshot();
            setView('history');
            const res = await api.get('/api/feedback/my');
            setFeedbacks(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setOpen(prev => !prev)}
                style={{
                    position: 'fixed', bottom: 24, right: 24,
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: 'white',
                    boxShadow: '0 4px 24px rgba(139,92,246,0.4)',
                    zIndex: 9998, transition: 'transform 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                title="Send Feedback"
            >
                {open ? '✕' : '💬'}
                {unreadReplies > 0 && !open && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#ef4444', color: 'white', fontSize: 11,
                        fontWeight: 700, width: 20, height: 20, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{unreadReplies}</span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div ref={panelRef} style={{
                    position: 'fixed', bottom: 92, right: 24,
                    width: 380, maxHeight: '70vh',
                    background: 'linear-gradient(135deg, #1e1b2e 0%, #16131f 100%)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: 16, boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
                    zIndex: 9999, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', animation: 'feedbackSlideUp 0.25s ease-out',
                }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
                        {['form', 'history'].map(tab => (
                            <button key={tab} onClick={() => { setView(tab); if (tab === 'history') setUnreadReplies(0); }}
                                style={{
                                    flex: 1, padding: '14px 0',
                                    background: view === tab ? 'rgba(139,92,246,0.15)' : 'transparent',
                                    border: 'none', color: view === tab ? '#a78bfa' : '#7c6fa0',
                                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                    borderBottom: view === tab ? '2px solid #8b5cf6' : '2px solid transparent',
                                }}
                            >
                                {tab === 'form' ? '✏️ New' : `📋 History (${feedbacks.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    {view === 'form' && (
                        <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                            {/* Categories */}
                            <div>
                                <label style={{ fontSize: 11, color: '#7c6fa0', marginBottom: 4, display: 'block' }}>Category</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {CATEGORIES.map(c => (
                                        <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                                            style={{
                                                padding: '5px 10px', borderRadius: 16,
                                                border: category === c.value ? `2px solid ${c.color}` : '1px solid rgba(124,111,160,0.3)',
                                                background: category === c.value ? `${c.color}20` : 'transparent',
                                                color: category === c.value ? c.color : '#7c6fa0',
                                                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                            }}
                                        >{c.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: 11, color: '#7c6fa0', marginBottom: 3, display: 'block' }}>Subject</label>
                                <input value={subject} onChange={e => setSubject(e.target.value)}
                                    placeholder="Brief summary..." maxLength={200}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(124,111,160,0.3)', background: '#16131f', color: '#e2e0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: 11, color: '#7c6fa0', marginBottom: 3, display: 'block' }}>Message</label>
                                <textarea value={message} onChange={e => setMessage(e.target.value)}
                                    placeholder="Describe in detail..." maxLength={5000} rows={4}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(124,111,160,0.3)', background: '#16131f', color: '#e2e0f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Screenshot */}
                            <div>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshot} style={{ display: 'none' }} />
                                {screenshotPreview ? (
                                    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(139,92,246,0.25)' }}>
                                        <img src={screenshotPreview} alt="Preview" style={{ width: '100%', maxHeight: 120, objectFit: 'cover' }} />
                                        <button type="button" onClick={removeScreenshot}
                                            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px dashed rgba(124,111,160,0.3)', background: 'transparent', color: '#7c6fa0', fontSize: 12, cursor: 'pointer' }}>
                                        📎 Attach Screenshot (optional)
                                    </button>
                                )}
                            </div>

                            <button type="submit" disabled={sending || !category || !subject.trim() || !message.trim()}
                                style={{
                                    padding: '10px 0', borderRadius: 8, border: 'none',
                                    background: sending ? '#4c1d95' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                    color: 'white', fontWeight: 600, fontSize: 13,
                                    cursor: sending ? 'not-allowed' : 'pointer',
                                    opacity: (!category || !subject.trim() || !message.trim()) ? 0.5 : 1,
                                }}>
                                {sending ? 'Sending...' : 'Send Feedback 🚀'}
                            </button>
                        </form>
                    )}

                    {/* History */}
                    {view === 'history' && (
                        <div style={{ overflowY: 'auto', padding: 12 }}>
                            {feedbacks.length === 0 ? (
                                <p style={{ color: '#7c6fa0', textAlign: 'center', padding: 32, fontSize: 13 }}>No feedback sent yet</p>
                            ) : feedbacks.map(f => {
                                const catInfo = CATEGORIES.find(c => c.value === f.category);
                                const statusInfo = STATUS_BADGE[f.status] || STATUS_BADGE.new;
                                const isExpanded = expandedId === f.id;
                                return (
                                    <div key={f.id} onClick={() => setExpandedId(isExpanded ? null : f.id)}
                                        style={{ padding: 10, borderRadius: 8, background: isExpanded ? 'rgba(139,92,246,0.08)' : 'rgba(22,19,31,0.5)', border: '1px solid rgba(124,111,160,0.15)', marginBottom: 6, cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <span style={{ fontSize: 11, color: catInfo?.color || '#7c6fa0' }}>{catInfo?.label || f.category}</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: 'white', background: statusInfo.bg, padding: '2px 8px', borderRadius: 10 }}>{statusInfo.label}</span>
                                        </div>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e0f0', margin: '3px 0 2px' }}>{f.subject}</p>
                                        <p style={{ fontSize: 10, color: '#7c6fa0', margin: 0 }}>{new Date(f.created_at).toLocaleDateString('vi-VN')}</p>

                                        {isExpanded && (
                                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(124,111,160,0.15)' }}>
                                                <p style={{ fontSize: 12, color: '#c4b5fd', whiteSpace: 'pre-wrap', margin: '0 0 6px' }}>{f.message}</p>
                                                {f.screenshot && (
                                                    <img src={f.screenshot} alt="Screenshot"
                                                        style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid rgba(139,92,246,0.2)' }} />
                                                )}
                                                {f.admin_reply && (
                                                    <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: 8, marginTop: 6 }}>
                                                        <p style={{ fontSize: 10, color: '#10b981', fontWeight: 600, margin: '0 0 3px' }}>Admin Reply — {new Date(f.replied_at).toLocaleDateString('vi-VN')}</p>
                                                        <p style={{ fontSize: 12, color: '#a7f3d0', whiteSpace: 'pre-wrap', margin: 0 }}>{f.admin_reply}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <style>{`
        @keyframes feedbackSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
}
