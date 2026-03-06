import { IncomingWebhook } from '@slack/webhook';
import { getDb } from '../config/database.js';

const webhookCache = {}; // { roomId: IncomingWebhook }

export async function sendSlackNotification(roomId, payload) {
    try {
        const db = getDb();
        const webhook = db.prepare('SELECT slack_url FROM room_webhooks WHERE room_id = ?').get(roomId);
        if (!webhook) return;

        let sender = webhookCache[roomId];
        if (!sender || sender.url !== webhook.slack_url) {
            sender = new IncomingWebhook(webhook.slack_url);
            sender.url = webhook.slack_url;
            webhookCache[roomId] = sender;
        }

        await sender.send(payload);
    } catch (err) {
        console.error('Failed to send Slack webhook:', err);
    }
}
