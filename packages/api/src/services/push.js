import webPush from 'web-push';
import { getDb } from '../config/database.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@soundden.app';

if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    console.log('🔔 Web Push configured');
} else {
    console.warn('⚠️ VAPID keys not set — push notifications disabled');
}

/**
 * Send push notification to a specific user
 * @param {string} userId - Target user ID
 * @param {object} payload - { title, body, icon, url, tag }
 */
export async function sendPushToUser(userId, payload) {
    if (!vapidPublicKey || !vapidPrivateKey) return;

    const db = getDb();
    const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);

    if (subscriptions.length === 0) return;

    const payloadStr = JSON.stringify(payload);

    const results = await Promise.allSettled(
        subscriptions.map(sub => {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            return webPush.sendNotification(pushSub, payloadStr).catch(err => {
                // Remove expired/invalid subscriptions (410 Gone or 404)
                if (err.statusCode === 410 || err.statusCode === 404) {
                    db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
                    console.log(`🗑 Removed expired push sub ${sub.id}`);
                }
                throw err;
            });
        })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    if (sent > 0) console.log(`🔔 Push sent to ${sent} device(s) for user ${userId}`);
}

/**
 * Send push to multiple users (e.g., room members who are offline)
 * @param {string[]} userIds
 * @param {object} payload
 */
export async function sendPushToUsers(userIds, payload) {
    await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)));
}

export { vapidPublicKey };
