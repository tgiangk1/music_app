import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function SlackWebhookConfig({ slug }) {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await api.get(`/api/rooms/${slug}/webhook`);
            if (res.data.webhook) {
                setWebhookUrl(res.data.webhook);
                setIsConfigured(true);
            }
        } catch (err) {
            console.error('Failed to fetch webhook config');
        } finally {
            setIsLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await api.post(`/api/rooms/${slug}/webhook`, { slackUrl: webhookUrl });
            setIsConfigured(true);
            toast.success('Slack webhook saved successfully!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save webhook');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Remove Slack integration?')) return;
        setIsSaving(true);
        try {
            await api.delete(`/api/rooms/${slug}/webhook`);
            setWebhookUrl('');
            setIsConfigured(false);
            toast.success('Slack webhook removed');
        } catch (err) {
            toast.error('Failed to remove webhook');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return null;

    return (
        <div className="glass-card p-4 space-y-3 border-l-4 border-[#36C5F0]">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold font-display flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#36C5F0]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521h-6.313A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.521-2.521h6.313zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.522v-2.522h2.522zM15.166 17.688a2.527 2.527 0 0 1-2.522-2.523 2.526 2.526 0 0 1 2.522-2.52h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.312z" />
                    </svg>
                    Slack Notifications
                </h2>
                {isConfigured && (
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-success/10 text-success px-2 py-0.5 rounded border border-success/30">
                        Active
                    </span>
                )}
            </div>

            <p className="text-xs text-text-muted">
                Receive messages in your Slack workspace when songs are added to this room.
            </p>

            <form onSubmit={handleSave} className="flex gap-2">
                <input
                    type="password"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="input-field flex-1 text-xs"
                    required
                />
                <button type="submit" disabled={isSaving} className="btn-primary py-1.5 px-3 text-xs whitespace-nowrap">
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
                {isConfigured && (
                    <button type="button" onClick={handleDelete} disabled={isSaving} className="btn-danger py-1.5 px-3 text-xs py-1">
                        Remove
                    </button>
                )}
            </form>
        </div>
    );
}
