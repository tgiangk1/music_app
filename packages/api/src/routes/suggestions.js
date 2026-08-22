import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken, optionalAuth } from '../middlewares/auth.js';
import { fetchVideoMetadata, extractVideoId } from '../services/youtube.js';
import { extractSpotifyTrackUrl, resolveSpotifyToYouTube } from '../services/spotify.js';

const router = Router();

// A suggestion moves into the queue once it reaches this many upvotes
const AUTO_ADD_THRESHOLD = 2;

function getSuggestions(roomId, userId = null) {
    const db = getDb();
    return db.prepare(`
        SELECT s.*, u.display_name as suggested_by_name,
               (SELECT COUNT(*) FROM room_suggestion_votes v WHERE v.suggestion_id = s.id) as vote_count,
               ${userId ? `EXISTS(SELECT 1 FROM room_suggestion_votes v WHERE v.suggestion_id = s.id AND v.user_id = ?)` : '0'} as my_vote
        FROM room_suggestions s
        JOIN users u ON s.suggested_by = u.id
        WHERE s.room_id = ?
        ORDER BY vote_count DESC, s.created_at ASC
    `).all(...(userId ? [userId, roomId] : [roomId]));
}

function emitSuggestionsUpdate(req, roomSlug, roomId, userId = null) {
    const io = req.app.get('io');
    if (!io) return;
    io.of(`/room/${roomSlug}`).emit('suggestions:update', getSuggestions(roomId));
}

router.get('/:slug/suggestions', optionalAuth, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ suggestions: getSuggestions(room.id, req.user?.userId) });
});

router.post('/:slug/suggestions', verifyToken, async (req, res) => {
    try {
        const { url, videoId: directVideoId, title: directTitle } = req.body;
        const db = getDb();
        const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        let metadata;
        if (directVideoId) {
            metadata = { videoId: directVideoId, title: directTitle || `YouTube Video (${directVideoId})`, thumbnail: null, channelName: 'Unknown' };
        } else if (url && extractSpotifyTrackUrl(url)) {
            const resolved = await resolveSpotifyToYouTube(url);
            if (!resolved?.match?.videoId) return res.status(422).json({ error: 'Could not resolve this Spotify link' });
            metadata = { videoId: resolved.match.videoId, title: resolved.match.title, thumbnail: resolved.match.thumbnail, channelName: resolved.match.channelName || 'Unknown' };
        } else if (url) {
            metadata = await fetchVideoMetadata(url);
            if (!metadata) return res.status(400).json({ error: 'Invalid URL or video not found' });
        } else {
            return res.status(400).json({ error: 'URL or videoId is required' });
        }

        // Already queued? Just add it directly instead.
        const inQueue = db.prepare('SELECT id FROM songs WHERE room_id = ? AND youtube_id = ?').get(room.id, metadata.videoId);
        if (inQueue) return res.status(409).json({ error: 'This song is already in the queue', code: 'IN_QUEUE' });

        const existingSuggestion = db.prepare('SELECT id FROM room_suggestions WHERE room_id = ? AND youtube_id = ?').get(room.id, metadata.videoId);
        if (existingSuggestion) return res.status(409).json({ error: 'This song has already been suggested', code: 'DUPLICATE_SUGGESTION', suggestionId: existingSuggestion.id });

        const id = uuidv4();
        db.prepare(`INSERT INTO room_suggestions (id, room_id, suggested_by, youtube_id, title, thumbnail, channel_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, room.id, req.user.userId, metadata.videoId, metadata.title, metadata.thumbnail, metadata.channelName);

        // Creator implicitly upvotes their own suggestion
        db.prepare('INSERT INTO room_suggestion_votes (suggestion_id, user_id) VALUES (?, ?)').run(id, req.user.userId);

        const suggestion = getSuggestions(room.id, req.user.userId).find(s => s.id === id);
        emitSuggestionsUpdate(req, req.params.slug, room.id);
        res.status(201).json({ suggestion });
    } catch (err) {
        console.error('Error creating suggestion:', err);
        res.status(500).json({ error: 'Failed to create suggestion' });
    }
});

router.post('/:slug/suggestions/:id/vote', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const suggestion = db.prepare('SELECT * FROM room_suggestions WHERE id = ? AND room_id = ?').get(req.params.id, room.id);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    const existing = db.prepare('SELECT 1 FROM room_suggestion_votes WHERE suggestion_id = ? AND user_id = ?').get(suggestion.id, req.user.userId);
    if (existing) {
        db.prepare('DELETE FROM room_suggestion_votes WHERE suggestion_id = ? AND user_id = ?').run(suggestion.id, req.user.userId);
    } else {
        db.prepare('INSERT INTO room_suggestion_votes (suggestion_id, user_id) VALUES (?, ?)').run(suggestion.id, req.user.userId);
    }

    const voteCount = db.prepare('SELECT COUNT(*) as c FROM room_suggestion_votes WHERE suggestion_id = ?').get(suggestion.id).c;

    // Threshold reached → move to the queue automatically
    if (!existing && voteCount >= AUTO_ADD_THRESHOLD) {
        const inQueue = db.prepare('SELECT id FROM songs WHERE room_id = ? AND youtube_id = ?').get(room.id, suggestion.youtube_id);
        if (!inQueue) {
            const maxPos = db.prepare('SELECT MAX(position) as pos FROM songs WHERE room_id = ?').get(room.id);
            const id = uuidv4();
            db.prepare(`INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, room.id, suggestion.youtube_id, suggestion.title, suggestion.thumbnail, 0, suggestion.channel_name, suggestion.suggested_by, (maxPos?.pos || 0) + 1);

            const songCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ?').get(room.id).count;
            if (songCount === 1) {
                db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(id);
                const stateObj = { videoId: suggestion.youtube_id, state: 'playing', currentTime: 0, updatedAt: new Date().toISOString(), updatedBy: req.user.userId };
                const io = req.app.get('io');
                io?.of(`/room/${req.params.slug}`).emit('player:sync', stateObj);
            }

            const io = req.app.get('io');
            io?.of(`/room/${req.params.slug}`).emit('queue:updated',
                db.prepare(`SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar FROM songs s JOIN users u ON s.added_by = u.id WHERE s.room_id = ? ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC`).all(room.id));
            io?.of(`/room/${req.params.slug}`).emit('notification', { type: 'success', message: `"${suggestion.title}" added to queue by popular vote! 🎉` });

            db.prepare('DELETE FROM room_suggestions WHERE id = ?').run(suggestion.id);
        } else {
            db.prepare('DELETE FROM room_suggestions WHERE id = ?').run(suggestion.id);
        }
    }

    emitSuggestionsUpdate(req, req.params.slug, room.id);
    res.json({ suggestions: getSuggestions(room.id, req.user.userId), movedToQueue: !existing && voteCount >= AUTO_ADD_THRESHOLD });
});

router.delete('/:slug/suggestions/:id', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const suggestion = db.prepare('SELECT * FROM room_suggestions WHERE id = ? AND room_id = ?').get(req.params.id, room.id);
    if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
    const isCreator = suggestion.suggested_by === req.user.userId;
    const isOwner = room.created_by === req.user.userId;
    const isAdmin = user?.role === 'admin';
    if (!isCreator && !isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the suggester or room owner can remove a suggestion' });
    }

    db.prepare('DELETE FROM room_suggestions WHERE id = ?').run(suggestion.id);
    emitSuggestionsUpdate(req, req.params.slug, room.id);
    res.json({ success: true });
});

export default router;
