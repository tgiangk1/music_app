import { getDb } from '../config/database.js';

export async function notifySlackSongAdded(roomId, roomSlug, roomName, songTitle, addedBy, thumbnail, url) {
    const db = getDb();
    const integration = db.prepare('SELECT * FROM room_integrations WHERE room_id = ? AND type = ?').get(roomId, 'slack');

    if (!integration || !integration.webhook_url) return;

    try {
        const payload = {
            text: `🎵 New song added in ${roomName}: ${songTitle}`,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*🎵 New song added to <${process.env.CLIENT_URL}/room/${roomSlug}|${roomName}>*\n*Title:* ${songTitle}\n*Added by:* ${addedBy}`
                    },
                    "accessory": {
                        "type": "image",
                        "image_url": thumbnail || "https://img.youtube.com/vi/default/hqdefault.jpg",
                        "alt_text": "Video thumbnail"
                    }
                }
            ]
        };

        if (url) {
            payload.blocks.push({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Listen in SoundDen",
                            "emoji": true
                        },
                        "url": `${process.env.CLIENT_URL}/room/${roomSlug}`,
                        "action_id": "button-action"
                    }
                ]
            });
        }

        await fetch(integration.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Slack webhook failed:', err.message);
    }
}

