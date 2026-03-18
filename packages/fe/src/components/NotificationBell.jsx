import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function NotificationBell() {
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        fetchNotifications();

        // Optional: poll every minute or listen to global socket for 'notification'
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [user]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) { }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`, {});
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) { }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/api/notifications/read-all', {});
            setNotifications(notifications.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (err) { }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-surface-400 hover:text-white transition-colors rounded-full hover:bg-surface-800"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface flex items-center justify-center">
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between p-4 border-b border-surface-700/50 bg-surface-800/80 backdrop-blur-md">
                        <h3 className="font-semibold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-xs text-primary-400 hover:text-primary-300">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-surface-500 text-sm">
                                You have no notifications.
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-700/30">
                                {notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-4 transition-colors ${!notif.is_read ? 'bg-primary-500/5 hover:bg-primary-500/10' : 'hover:bg-surface-700/30'}`}
                                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5">
                                                {!notif.is_read ? (
                                                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-transparent" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white mb-0.5">{notif.title}</p>
                                                <p className="text-xs text-surface-400 line-clamp-2">{notif.message}</p>
                                                <p className="text-[10px] text-surface-500 mt-2">
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
