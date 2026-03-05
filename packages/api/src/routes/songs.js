import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import { requireRoomOwnerOrAdmin } from '../middlewares/role.js';
import { fetchVideoMetadata, fetchPlaylistVideos, extractPlaylistId } from '../services/youtube.js';
import { logActivity } from '../services/socket.js';

const router = Router();

// Helper: get queue for a room sorted by vote_score desc, then position
function getQueueForRoom(roomId) {
    const db = getDb();
    return db.prepare(`
    SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar
    FROM songs s
    JOIN users u ON s.added_by = u.id
    WHERE s.room_id = ?
    ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC
  `).all(roomId);
}

// Helper: emit queue update via socket
function emitQueueUpdate(req, roomSlug, roomId) {
    const io = req.app.get('io');
    const roomNsp = io.of(`/room/${roomSlug}`);
    const queue = getQueueForRoom(roomId);
    roomNsp.emit('queue:updated', queue);
}

// Helper: save song to history (Feature 3)
function saveToHistory(db, song) {
    const id = uuidv4();
    db.prepare(`
    INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, song.room_id, song.youtube_id, song.title, song.thumbnail, song.duration, song.channel_name, song.added_by);
}

// GET /api/rooms/:slug/songs — get queue
router.get('/:slug/songs', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const songs = getQueueForRoom(room.id);

    // Attach user's vote to each song
    const userId = req.user.userId;
    const votes = db.prepare('SELECT song_id, type FROM votes WHERE user_id = ?').all(userId);
    const voteMap = {};
    votes.forEach(v => { voteMap[v.song_id] = v.type; });

    const songsWithVotes = songs.map(s => ({
        ...s,
        userVote: voteMap[s.id] || null,
    }));

    res.json({ songs: songsWithVotes });
});

// POST /api/rooms/:slug/songs — add song
// Feature 7: duplicate detection with ?force=true bypass
// Feature 8: song limit enforcement
router.post('/:slug/songs', verifyToken, async (req, res) => {
    try {
        const { url, videoId: directVideoId, title: directTitle, force } = req.body;
        const db = getDb();
        const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Feature 8: Check song limit per user
        if (room.song_limit > 0) {
            const userSongCount = db.prepare(
                'SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND added_by = ?'
            ).get(room.id, req.user.userId).count;

            if (userSongCount >= room.song_limit) {
                return res.status(429).json({
                    error: `You can only have ${room.song_limit} songs in the queue at once`,
                    code: 'SONG_LIMIT_REACHED',
                });
            }
        }

        let metadata;

        // Support direct videoId (from search results) or URL
        if (directVideoId) {
            metadata = {
                videoId: directVideoId,
                title: directTitle || `YouTube Video (${directVideoId})`,
                thumbnail: `https://img.youtube.com/vi/${directVideoId}/hqdefault.jpg`,
                duration: 0,
                channelName: 'Unknown',
            };
            // Try to fetch full metadata in background
            fetchVideoMetadata(directVideoId).then(full => {
                if (full && full.title !== metadata.title) {
                    db.prepare('UPDATE songs SET title = ?, thumbnail = ?, duration = ?, channel_name = ? WHERE youtube_id = ? AND room_id = ?')
                        .run(full.title, full.thumbnail, full.duration, full.channelName, directVideoId, room.id);
                    emitQueueUpdate(req, req.params.slug, room.id);
                }
            }).catch(() => { });
        } else if (url) {
            metadata = await fetchVideoMetadata(url);
            if (!metadata) {
                return res.status(400).json({ error: 'Invalid YouTube URL or video not found' });
            }
        } else {
            return res.status(400).json({ error: 'YouTube URL or videoId is required' });
        }

        // Feature 7: Check if song already in queue
        const existing = db.prepare('SELECT id FROM songs WHERE room_id = ? AND youtube_id = ?').get(room.id, metadata.videoId);
        if (existing && !force) {
            return res.status(409).json({
                error: 'This song is already in the queue',
                code: 'DUPLICATE_IN_QUEUE',
                existingSongId: existing.id,
            });
        }
        if (existing && force) {
            // Skip — already in queue, user forced but we don't add duplicates
            return res.status(200).json({ message: 'Song already in queue', existing: true });
        }

        // Feature 7: Check if song was recently played (in history)
        const inHistory = db.prepare(
            'SELECT id FROM song_history WHERE room_id = ? AND youtube_id = ? ORDER BY played_at DESC LIMIT 1'
        ).get(room.id, metadata.videoId);

        // Get max position
        const maxPos = db.prepare('SELECT MAX(position) as pos FROM songs WHERE room_id = ?').get(room.id);
        const position = (maxPos?.pos || 0) + 1;

        const id = uuidv4();
        db.prepare(`
      INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, room.id, metadata.videoId, metadata.title, metadata.thumbnail, metadata.duration, metadata.channelName, req.user.userId, position);

        // If this is the first/only song, mark it as playing
        const songCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ?').get(room.id).count;
        if (songCount === 1) {
            db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(id);

            const { playerStates } = await import('./player.js');
            const stateObj = {
                videoId: metadata.videoId,
                state: 'playing',
                currentTime: 0,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.userId,
            };
            playerStates.set(req.params.slug, stateObj);
            const io = req.app.get('io');
            io.of(`/room/${req.params.slug}`).emit('player:sync', stateObj);
        }

        emitQueueUpdate(req, req.params.slug, room.id);

        // Broadcast notification for Feature 5 (browser notifications)
        const io = req.app.get('io');
        io.of(`/room/${req.params.slug}`).emit('song:added', {
            title: metadata.title,
            addedBy: req.user.displayName,
            thumbnail: metadata.thumbnail,
        });

        // Phase 3: Log activity
        logActivity(db, room.id, req.user.userId, 'song_add', { songTitle: metadata.title });

        const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
        res.status(201).json({
            song,
            wasInHistory: !!inHistory, // Feature 7: tell FE if this was previously played
        });
    } catch (err) {
        console.error('Error adding song:', err);
        res.status(500).json({ error: 'Failed to add song' });
    }
});

// POST /api/rooms/:slug/songs/import-playlist — Feature 2: Import YouTube playlist
router.post('/:slug/songs/import-playlist', verifyToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Playlist URL is required' });
        }

        const db = getDb();
        const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const videos = await fetchPlaylistVideos(url);
        if (!videos || videos.length === 0) {
            return res.status(400).json({ error: 'Could not fetch playlist or playlist is empty' });
        }

        // Get existing songs in queue to skip duplicates
        const existingIds = new Set(
            db.prepare('SELECT youtube_id FROM songs WHERE room_id = ?').all(room.id).map(s => s.youtube_id)
        );

        let added = 0;
        let skipped = 0;
        const maxPos = db.prepare('SELECT MAX(position) as pos FROM songs WHERE room_id = ?').get(room.id);
        let position = (maxPos?.pos || 0) + 1;

        // Check song limit
        let userSongCount = 0;
        if (room.song_limit > 0) {
            userSongCount = db.prepare(
                'SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND added_by = ?'
            ).get(room.id, req.user.userId).count;
        }

        const insertSong = db.prepare(`
      INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const batchInsert = db.transaction(() => {
            for (const video of videos) {
                if (existingIds.has(video.videoId)) {
                    skipped++;
                    continue;
                }

                // Song limit check
                if (room.song_limit > 0 && (userSongCount + added) >= room.song_limit) {
                    break;
                }

                const id = uuidv4();
                insertSong.run(id, room.id, video.videoId, video.title, video.thumbnail, video.duration, video.channelName, req.user.userId, position);
                position++;
                added++;
            }
        });

        batchInsert();

        // Auto-play first song if queue was empty
        const currentPlaying = db.prepare('SELECT id FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
        if (!currentPlaying) {
            const firstSong = db.prepare(`
        SELECT * FROM songs WHERE room_id = ?
        ORDER BY position ASC LIMIT 1
      `).get(room.id);

            if (firstSong) {
                db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(firstSong.id);

                const { playerStates } = await import('./player.js');
                const stateObj = {
                    videoId: firstSong.youtube_id,
                    state: 'playing',
                    currentTime: 0,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.user.userId,
                };
                playerStates.set(req.params.slug, stateObj);
                const io = req.app.get('io');
                io.of(`/room/${req.params.slug}`).emit('player:sync', stateObj);
            }
        }

        emitQueueUpdate(req, req.params.slug, room.id);

        res.json({
            message: `Imported ${added} songs (${skipped} duplicates skipped)`,
            added,
            skipped,
            total: videos.length,
        });
    } catch (err) {
        console.error('Playlist import error:', err);
        res.status(500).json({ error: 'Failed to import playlist' });
    }
});

// GET /api/rooms/:slug/history — Feature 3: Queue history
router.get('/:slug/history', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const history = db.prepare(`
    SELECT h.*, u.display_name as added_by_name, u.avatar as added_by_avatar
    FROM song_history h
    JOIN users u ON h.added_by = u.id
    WHERE h.room_id = ?
    ORDER BY h.played_at DESC
    LIMIT ? OFFSET ?
  `).all(room.id, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM song_history WHERE room_id = ?').get(room.id).count;

    res.json({ history, total, limit, offset });
});

// DELETE /api/rooms/:slug/songs/:id — remove song
router.delete('/:slug/songs/:id', verifyToken, (req, res) => {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const song = db.prepare('SELECT * FROM songs WHERE id = ? AND room_id = ?').get(req.params.id, room.id);
    if (!song) {
        return res.status(404).json({ error: 'Song not found' });
    }

    // Member can only delete their own songs; room owner or admin can delete any
    const isOwner = room.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin && song.added_by !== req.user.userId) {
        return res.status(403).json({ error: 'You can only remove your own songs' });
    }

    // Feature 3: Save to history before deleting (only if it was playing)
    if (song.is_playing) {
        saveToHistory(db, song);
    }

    db.prepare('DELETE FROM songs WHERE id = ?').run(song.id);

    emitQueueUpdate(req, req.params.slug, room.id);
    res.json({ message: 'Song removed' });
});

// POST /api/rooms/:slug/songs/:id/vote — vote on song
router.post('/:slug/songs/:id/vote', verifyToken, (req, res) => {
    const { type } = req.body;
    if (!type || !['up', 'down'].includes(type)) {
        return res.status(400).json({ error: 'Vote type must be "up" or "down"' });
    }

    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const song = db.prepare('SELECT * FROM songs WHERE id = ? AND room_id = ?').get(req.params.id, room.id);
    if (!song) {
        return res.status(404).json({ error: 'Song not found' });
    }

    const userId = req.user.userId;
    const existingVote = db.prepare('SELECT * FROM votes WHERE song_id = ? AND user_id = ?').get(song.id, userId);

    const updateVoteScore = db.transaction(() => {
        if (existingVote) {
            if (existingVote.type === type) {
                // Remove vote (toggle)
                db.prepare('DELETE FROM votes WHERE song_id = ? AND user_id = ?').run(song.id, userId);
                const delta = type === 'up' ? -1 : 1;
                db.prepare('UPDATE songs SET vote_score = vote_score + ? WHERE id = ?').run(delta, song.id);
            } else {
                // Change vote
                db.prepare('UPDATE votes SET type = ? WHERE song_id = ? AND user_id = ?').run(type, song.id, userId);
                const delta = type === 'up' ? 2 : -2;
                db.prepare('UPDATE songs SET vote_score = vote_score + ? WHERE id = ?').run(delta, song.id);
            }
        } else {
            // New vote
            db.prepare('INSERT INTO votes (song_id, user_id, type) VALUES (?, ?, ?)').run(song.id, userId, type);
            const delta = type === 'up' ? 1 : -1;
            db.prepare('UPDATE songs SET vote_score = vote_score + ? WHERE id = ?').run(delta, song.id);
        }
    });

    updateVoteScore();
    emitQueueUpdate(req, req.params.slug, room.id);

    res.json({ message: 'Vote recorded' });
});

// PUT /api/rooms/:slug/songs/reorder — reorder queue [Any member]
router.put('/:slug/songs/reorder', verifyToken, (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'orderedIds must be an array' });
    }

    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const reorder = db.transaction(() => {
        orderedIds.forEach((id, index) => {
            db.prepare('UPDATE songs SET position = ? WHERE id = ? AND room_id = ?').run(index, id, room.id);
        });
    });

    reorder();
    emitQueueUpdate(req, req.params.slug, room.id);

    res.json({ message: 'Queue reordered' });
});

// DELETE /api/rooms/:slug/songs — clear queue [Owner or Admin]
router.delete('/:slug/songs', verifyToken, requireRoomOwnerOrAdmin, (req, res) => {
    const db = getDb();
    const room = req.room || db.prepare('SELECT * FROM rooms WHERE slug = ?').get(req.params.slug);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    // Feature 3: Save all playing songs to history before clearing
    const playingSong = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(room.id);
    if (playingSong) {
        saveToHistory(db, playingSong);
    }

    db.prepare('DELETE FROM songs WHERE room_id = ?').run(room.id);

    emitQueueUpdate(req, req.params.slug, room.id);
    res.json({ message: 'Queue cleared' });
});

export default router;
