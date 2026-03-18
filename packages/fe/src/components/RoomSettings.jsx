import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function RoomSettings({ isOpen, onClose, slug }) {
    const [activeTab, setActiveTab] = useState('blocklist'); // blocklist | schedule | integrations

    // Blocklist state
    const [blocklist, setBlocklist] = useState([]);
    const [blockType, setBlockType] = useState('channel');
    const [blockValue, setBlockValue] = useState('');
    const [blockTitle, setBlockTitle] = useState('');
    const [loadingBlock, setLoadingBlock] = useState(false);

    // Schedule state
    const [schedules, setSchedules] = useState([]);
    const [schedTitle, setSchedTitle] = useState('');
    const [schedDate, setSchedDate] = useState('');
    const [schedNotify, setSchedNotify] = useState(true);
    const [loadingSched, setLoadingSched] = useState(false);

    // Integrations state
    const [integrations, setIntegrations] = useState([]);
    const [slackUrl, setSlackUrl] = useState('');
    const [loadingInt, setLoadingInt] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab]);

    const fetchData = async () => {
        try {
            if (activeTab === 'blocklist') {
                const res = await api.get(`/api/rooms/${slug}/blocklist`);
                setBlocklist(res.data.blocklist || []);
            } else if (activeTab === 'schedule') {
                const res = await api.get(`/api/rooms/${slug}/schedules`);
                setSchedules(res.data.schedules || []);
            } else if (activeTab === 'integrations') {
                const res = await api.get(`/api/rooms/${slug}/integrations`);
                setIntegrations(res.data.integrations || []);
                const slack = res.data.integrations?.find(i => i.type === 'slack');
                if (slack) setSlackUrl(slack.webhook_url);
            }
        } catch (err) { }
    };

    const handleAddBlocklist = async (e) => {
        e.preventDefault();
        if (!blockValue) return;

        setLoadingBlock(true);
        try {
            const res = await api.post(`/api/rooms/${slug}/blocklist`, {
                type: blockType,
                value: blockValue,
                title: blockTitle || blockValue
            });

            setBlocklist([res.data.item, ...blocklist]);
            setBlockValue('');
            setBlockTitle('');
            toast.success('Added to blocklist');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add');
        } finally {
            setLoadingBlock(false);
        }
    };

    const handleRemoveBlocklist = async (id) => {
        try {
            await api.delete(`/api/rooms/${slug}/blocklist/${id}`);
            setBlocklist(blocklist.filter(b => b.id !== id));
        } catch (err) { }
    };

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        if (!schedTitle || !schedDate) return;

        setLoadingSched(true);
        try {
            const res = await api.post(`/api/rooms/${slug}/schedules`, {
                title: schedTitle,
                scheduledAt: new Date(schedDate).toISOString(),
                notifyMembers: schedNotify
            });

            setSchedules([res.data.schedule, ...schedules]);
            setSchedTitle('');
            setSchedDate('');
            toast.success('Schedule created');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to schedule');
        } finally {
            setLoadingSched(false);
        }
    };

    const handleRemoveSchedule = async (id) => {
        try {
            await api.delete(`/api/rooms/${slug}/schedules/${id}`);
            setSchedules(schedules.filter(s => s.id !== id));
        } catch (err) { }
    };

    const handleSaveIntegrations = async (e) => {
        e.preventDefault();
        setLoadingInt(true);
        try {
            // If empty, delete existing slack integration
            const slack = integrations.find(i => i.type === 'slack');

            if (!slackUrl.trim()) {
                if (slack) {
                    await api.delete(`/api/rooms/${slug}/integrations/${slack.id}`);
                    setIntegrations(integrations.filter(i => i.id !== slack.id));
                    toast.success('Slack integration removed');
                }
            } else {
                const res = await api.post(`/api/rooms/${slug}/integrations`, {
                    type: 'slack',
                    webhookUrl: slackUrl.trim()
                });

                if (slack) {
                    setIntegrations(integrations.map(i => i.id === slack.id ? res.data.item : i));
                } else {
                    setIntegrations([...integrations, res.data.item]);
                }
                toast.success('Slack integration saved');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save integration');
        } finally {
            setLoadingInt(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface-800 border border-surface-700/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
                    <h2 className="font-syne text-2xl font-bold font-glow">Room Settings</h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-surface-700 bg-surface-800/50 px-6">
                    <button
                        onClick={() => setActiveTab('blocklist')}
                        className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'blocklist' ? 'border-primary-500 text-white' : 'border-transparent text-surface-400 hover:text-surface-200'}`}
                    >
                        Blocklist
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-primary-500 text-white' : 'border-transparent text-surface-400 hover:text-surface-200'}`}
                    >
                        Schedule
                    </button>
                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'integrations' ? 'border-primary-500 text-white' : 'border-transparent text-surface-400 hover:text-surface-200'}`}
                    >
                        Integrations
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto w-full max-h-[60vh]">

                    {/* Blocklist Tab */}
                    {activeTab === 'blocklist' && (
                        <div className="space-y-6">
                            <div className="bg-surface-900 border border-surface-700 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-4">Add to Blocklist</h3>
                                <form onSubmit={handleAddBlocklist} className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <select
                                            value={blockType}
                                            onChange={(e) => setBlockType(e.target.value)}
                                            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500 w-full sm:w-1/3"
                                        >
                                            <option value="channel">YouTube Channel</option>
                                            <option value="video">Specific Video URL</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={blockValue}
                                            onChange={(e) => setBlockValue(e.target.value)}
                                            placeholder={blockType === 'channel' ? "Channel Name or ID" : "Video ID or URL"}
                                            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={blockTitle}
                                            onChange={(e) => setBlockTitle(e.target.value)}
                                            placeholder="(Optional) Display Title / Reason"
                                            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                                        />
                                        <button disabled={loadingBlock || !blockValue} type="submit" className="bg-danger hover:bg-red-600 text-white px-4 rounded-lg transition-colors font-medium">
                                            Block
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div>
                                <h3 className="font-semibold text-surface-300 mb-2 font-syne text-sm uppercase">Currently Blocked</h3>
                                <div className="space-y-2">
                                    {blocklist.length === 0 ? (
                                        <p className="text-surface-500 text-sm">Nothing is blocked yet.</p>
                                    ) : (
                                        blocklist.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
                                                <div>
                                                    <span className={`text-xs px-2 py-0.5 rounded mr-2 ${item.type === 'channel' ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                                                        {item.type.toUpperCase()}
                                                    </span>
                                                    <span className="font-medium text-surface-100">{item.title}</span>
                                                    <span className="text-surface-500 text-xs ml-2 hidden sm:inline-block">({item.value})</span>
                                                </div>
                                                <button onClick={() => handleRemoveBlocklist(item.id)} className="text-surface-400 hover:text-white">
                                                    Remove
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule Tab */}
                    {activeTab === 'schedule' && (
                        <div className="space-y-6">
                            <div className="bg-surface-900 border border-surface-700 p-4 rounded-xl">
                                <h3 className="font-semibold text-white mb-4">Schedule Room Opening</h3>
                                <form onSubmit={handleAddSchedule} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-surface-400 mb-1">Event Title</label>
                                            <input
                                                type="text"
                                                value={schedTitle}
                                                onChange={(e) => setSchedTitle(e.target.value)}
                                                placeholder="e.g. Weekly All-Hands Friday Music"
                                                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-surface-400 mb-1">Date & Time (Local)</label>
                                            <input
                                                type="datetime-local"
                                                value={schedDate}
                                                onChange={(e) => setSchedDate(e.target.value)}
                                                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer text-surface-200">
                                            <input
                                                type="checkbox"
                                                checked={schedNotify}
                                                onChange={(e) => setSchedNotify(e.target.checked)}
                                                className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 bg-surface-800 border-surface-600"
                                            />
                                            <span className="text-sm">Notify all room members when event starts</span>
                                        </label>
                                        <button
                                            disabled={loadingSched || !schedTitle || !schedDate}
                                            type="submit"
                                            className="btn-primary"
                                        >
                                            Schedule
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div>
                                <h3 className="font-semibold text-surface-300 mb-2 font-syne text-sm uppercase">Upcoming Events</h3>
                                <div className="space-y-2">
                                    {schedules.length === 0 ? (
                                        <p className="text-surface-500 text-sm">No scheduled events.</p>
                                    ) : (
                                        schedules.map(item => (
                                            <div key={item.id} className={`flex items-center justify-between p-4 rounded-lg border ${item.is_processed ? 'bg-surface-800/50 border-surface-700/50 opacity-70' : 'bg-surface-800 border-surface-600'}`}>
                                                <div>
                                                    <h4 className={`font-semibold ${item.is_processed ? 'text-surface-300' : 'text-primary-300'}`}>{item.title}</h4>
                                                    <p className="text-sm text-surface-400 mt-1">
                                                        {new Date(item.scheduled_at).toLocaleString()}
                                                        {item.is_processed && <span className="ml-2 text-success text-xs bg-success/10 px-1 py-0.5 rounded">Completed</span>}
                                                    </p>
                                                </div>
                                                <button onClick={() => handleRemoveSchedule(item.id)} className="text-surface-400 hover:text-white p-2">
                                                    Cancel
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Integrations Tab */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            <div className="bg-surface-900 border border-surface-700 p-6 rounded-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-2">
                                        <svg viewBox="0 0 122.8 122.8" xmlns="http://www.w3.org/2000/svg" className="w-full h-full"><path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" /><path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" /><path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" /><path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Slack Webhook</h3>
                                        <p className="text-sm text-surface-400">Post messages to a Slack channel when songs are added to this room.</p>
                                    </div>
                                </div>
                                <form onSubmit={handleSaveIntegrations} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-surface-300 mb-2">Webhook URL</label>
                                        <input
                                            type="text"
                                            value={slackUrl}
                                            onChange={(e) => setSlackUrl(e.target.value)}
                                            placeholder="https://hooks.slack.com/services/..."
                                            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none font-mono text-sm"
                                        />
                                        <p className="text-xs text-surface-500 mt-2">
                                            Create an incoming webhook in your Slack workspace and paste the URL here. Leave empty to delete.
                                        </p>
                                    </div>
                                    <div className="flex justify-end">
                                        <button disabled={loadingInt} type="submit" className="btn-primary">
                                            Save Integration
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
