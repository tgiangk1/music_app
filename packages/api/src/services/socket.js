import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { playerStates } from '../routes/player.js';
import { v4 as uuidv4 } from 'uuid';

let io;

// Track online members per room namespace
const onlineMembers = new Map(); // slug -> Map<socketId, userInfo>

// ERR-1: Debounce lock for player:ended events (prevents N clients firing simultaneously)
const endedLocks = new Map(); // slug -> timestamp

export function initSocketIO(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            credentials: true,
        },
    });

    // Dynamic namespace for rooms: /room/:slug
    const roomNsp = io.of(/^\/room\/[\w-]+$/);

    roomNsp.use((socket, next) => {
        // JWT authentication middleware
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

            if (!user) {
                return next(new Error('User not found'));
            }

            if (user.is_banned) {
                return next(new Error('Account is banned'));
            }

            // Extract room slug from namespace
            const nspName = socket.nsp.name; // e.g., /room/design-team
            const slug = nspName.replace('/room/', '');

            // Check room access
            const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
            if (!room) {
                return next(new Error('Room not found'));
            }

            // Check private room access
            if (!room.is_public) {
                const isMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, user.id);
                const isCreator = room.created_by === user.id;
                const isAdmin = user.role === 'admin';

                if (!isMember && !isCreator && !isAdmin) {
                    return next(new Error('Access denied to this private room'));
                }
            }

            socket.user = {
                userId: user.id,
                displayName: user.display_name,
                avatar: user.avatar,
                role: user.role,
                email: user.email,
                isOwner: room.created_by === user.id,
            };
            socket.roomSlug = slug;
            socket.roomId = room.id;
            socket.roomOwnerId = room.created_by;

            next();
        } catch (err) {
            return next(new Error('Invalid or expired token'));
        }
    });

    roomNsp.on('connection', (socket) => {
        const slug = socket.roomSlug;
        console.log(`🔌 ${socket.user.displayName} connected to room: ${slug}`);

        // Track online member
        if (!onlineMembers.has(slug)) {
            onlineMembers.set(slug, new Map());
        }
        onlineMembers.get(slug).set(socket.id, socket.user);

        // Broadcast member join to all
        socket.nsp.emit('member:join', socket.user);

        // Broadcast updated member list to ALL clients in this room
        const members = Array.from(onlineMembers.get(slug).values());
        // Deduplicate by userId
        const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
        socket.nsp.emit('member:list', uniqueMembers);

        // Send current player state
        const state = playerStates.get(slug);
        if (state) {
            socket.emit('player:sync', state);
        }

        // Handle player:sync from owner/admin
        socket.on('player:sync', (data) => {
            // CQ-2: Validate input
            if (!data || typeof data !== 'object') return;

            const canControl = socket.user.isOwner || socket.user.role === 'admin';
            if (!canControl) {
                return socket.emit('notification', { type: 'warning', message: 'Only the room owner can control the player' });
            }

            const stateObj = playerStates.get(slug) || {
                videoId: null,
                state: 'idle',
                currentTime: 0,
                updatedAt: new Date().toISOString(),
                updatedBy: null,
            };

            // CQ-2: Validate each field strictly
            if (typeof data.videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(data.videoId)) {
                stateObj.videoId = data.videoId;
            } else if (data.videoId === null) {
                stateObj.videoId = null;
            }
            if (['playing', 'paused', 'idle'].includes(data.state)) {
                stateObj.state = data.state;
            }
            if (typeof data.currentTime === 'number' && data.currentTime >= 0 && isFinite(data.currentTime)) {
                stateObj.currentTime = data.currentTime;
            }

            stateObj.updatedAt = new Date().toISOString();
            stateObj.updatedBy = socket.user.userId;

            playerStates.set(slug, stateObj);
            socket.nsp.emit('player:sync', stateObj);
        });

        // Handle player:skip from admin
        socket.on('player:skip', () => {
            const canControl = socket.user.isOwner || socket.user.role === 'admin';
            if (!canControl) {
                return socket.emit('notification', { type: 'warning', message: 'Only the room owner can skip songs' });
            }

            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);

            if (current) {
                // Feature 3: Save to history before deleting
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, current.duration, current.channel_name, current.added_by);
                db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
            }

            const next = db.prepare(`
        SELECT * FROM songs WHERE room_id = ?
        ORDER BY vote_score DESC, position ASC, created_at ASC
        LIMIT 1
      `).get(socket.roomId);

            const stateObj = playerStates.get(slug) || {};

            if (next) {
                db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id);
                stateObj.videoId = next.youtube_id;
                stateObj.state = 'playing';
                stateObj.currentTime = 0;
            } else {
                stateObj.videoId = null;
                stateObj.state = 'idle';
                stateObj.currentTime = 0;
            }

            stateObj.updatedAt = new Date().toISOString();
            stateObj.updatedBy = socket.user.userId;
            playerStates.set(slug, stateObj);

            socket.nsp.emit('player:sync', stateObj);

            // Emit updated queue
            const queue = db.prepare(`
        SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar
        FROM songs s
        JOIN users u ON s.added_by = u.id
        WHERE s.room_id = ?
        ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC
      `).all(socket.roomId);
            socket.nsp.emit('queue:updated', queue);
        });

        // Handle song ended (auto-skip to next)
        socket.on('player:ended', () => {
            // ERR-1: Debounce — only process once per 3 seconds per room
            const now = Date.now();
            const lastEnded = endedLocks.get(slug) || 0;
            if (now - lastEnded < 3000) return;
            endedLocks.set(slug, now);

            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);

            if (current) {
                // Feature 3: Save to history before deleting
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, current.duration, current.channel_name, current.added_by);
                db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
            }

            const next = db.prepare(`
        SELECT * FROM songs WHERE room_id = ?
        ORDER BY vote_score DESC, position ASC, created_at ASC
        LIMIT 1
      `).get(socket.roomId);

            const stateObj = playerStates.get(slug) || {};

            if (next) {
                db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id);
                stateObj.videoId = next.youtube_id;
                stateObj.state = 'playing';
                stateObj.currentTime = 0;
            } else {
                stateObj.videoId = null;
                stateObj.state = 'idle';
                stateObj.currentTime = 0;
            }

            stateObj.updatedAt = new Date().toISOString();
            playerStates.set(slug, stateObj);
            socket.nsp.emit('player:sync', stateObj);

            const queue = db.prepare(`
        SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar
        FROM songs s
        JOIN users u ON s.added_by = u.id
        WHERE s.room_id = ?
        ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC
      `).all(socket.roomId);
            socket.nsp.emit('queue:updated', queue);
        });

        // ═══════════════════════════════════════════
        // Phase 3 — Social Features
        // ═══════════════════════════════════════════

        // Feature 1: Emoji reactions (broadcast only, no DB)
        socket.on('reaction:send', (data) => {
            if (!data?.emoji || typeof data.emoji !== 'string') return;
            // Only allow known emojis, max 2 chars
            const allowed = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];
            if (!allowed.includes(data.emoji)) return;

            socket.nsp.emit('reaction:broadcast', {
                emoji: data.emoji,
                userId: socket.user.userId,
                displayName: socket.user.displayName,
                id: Date.now() + Math.random().toString(36).slice(2, 6),
            });
        });

        // Feature 2: Chat — send message
        socket.on('chat:send', (data) => {
            if (!data?.content || typeof data.content !== 'string') return;
            const content = data.content.trim().slice(0, 500); // Max 500 chars
            if (!content) return;

            const db = getDb();
            const id = uuidv4();

            // Get currently playing song for context
            const playingSong = db.prepare('SELECT id, title FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);

            db.prepare(`INSERT INTO chat_messages (id, room_id, user_id, content, song_id) VALUES (?, ?, ?, ?, ?)`)
                .run(id, socket.roomId, socket.user.userId, content, playingSong?.id || null);

            const message = {
                id,
                content,
                songTitle: playingSong?.title || null,
                user: {
                    userId: socket.user.userId,
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar,
                },
                createdAt: new Date().toISOString(),
            };

            socket.nsp.emit('chat:new', message);

            // Activity log (debounced — don't log every single message)
            logActivity(db, socket.roomId, socket.user.userId, 'chat', { messageId: id });
        });

        // Feature 2: Chat — request history
        socket.on('chat:history', () => {
            const db = getDb();
            const messages = db.prepare(`
                SELECT cm.id, cm.content, cm.song_id, cm.created_at,
                       u.id as user_id, u.display_name, u.avatar,
                       s.title as song_title
                FROM chat_messages cm
                JOIN users u ON cm.user_id = u.id
                LEFT JOIN songs s ON cm.song_id = s.id
                WHERE cm.room_id = ?
                ORDER BY cm.created_at DESC
                LIMIT 50
            `).all(socket.roomId);

            // Reverse to chronological order
            const formatted = messages.reverse().map(m => ({
                id: m.id,
                content: m.content,
                songTitle: m.song_title,
                user: {
                    userId: m.user_id,
                    displayName: m.display_name,
                    avatar: m.avatar,
                },
                createdAt: m.created_at,
            }));

            socket.emit('chat:history', formatted);
        });

        // Feature 6: Log join activity
        {
            const db = getDb();
            logActivity(db, socket.roomId, socket.user.userId, 'join', {
                displayName: socket.user.displayName,
            });
        }

        // Disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 ${socket.user.displayName} disconnected from room: ${slug}`);

            // Feature 6: Log leave activity
            const db = getDb();
            logActivity(db, socket.roomId, socket.user.userId, 'leave', {
                displayName: socket.user.displayName,
            });

            if (onlineMembers.has(slug)) {
                onlineMembers.get(slug).delete(socket.id);
                if (onlineMembers.get(slug).size === 0) {
                    onlineMembers.delete(slug);
                }
            }

            socket.nsp.emit('member:leave', { userId: socket.user.userId });

            // Updated member list
            if (onlineMembers.has(slug)) {
                const members = Array.from(onlineMembers.get(slug).values());
                const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
                socket.nsp.emit('member:list', uniqueMembers);
            } else {
                socket.nsp.emit('member:list', []);
            }
        });
    });

    return io;
}

// ── Activity logging with debounce ──
const activityDebounce = new Map(); // `${roomId}:${userId}:${type}` -> timestamp

function logActivity(db, roomId, userId, actionType, metadata = {}) {
    const key = `${roomId}:${userId}:${actionType}`;
    const now = Date.now();
    const last = activityDebounce.get(key) || 0;

    // Debounce: skip if same action by same user within 10 seconds
    // Exception: 'song_add' and 'skip' always log
    if (now - last < 10000 && !['song_add', 'skip'].includes(actionType)) {
        return;
    }
    activityDebounce.set(key, now);

    const id = uuidv4();
    db.prepare(`INSERT INTO activity_log (id, room_id, user_id, action_type, metadata) VALUES (?, ?, ?, ?, ?)`)
        .run(id, roomId, userId, actionType, JSON.stringify(metadata));
}

export { logActivity };

export function getIO() {
    return io;
}
