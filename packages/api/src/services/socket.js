import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { playerStates } from '../routes/player.js';
import { getRoomRole } from '../middlewares/role.js';
import { v4 as uuidv4 } from 'uuid';
import { fetchRelatedVideos, fetchVideoMetadata } from './youtube.js';

let io;
const onlineMembers = new Map();
const endedLocks = new Map();

export function getIO() { return io; }

export function initSocketIO(server) {
    io = new Server(server, {
        cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
    });

    const roomNsp = io.of(/^\/room\/[\w-]+$/);

    io.on('connection', (socket) => {
        console.log(`🔌 Global client connected: ${socket.id}`);
        socket.on('disconnect', () => console.log(`🔌 Global client disconnected: ${socket.id}`));
    });

    roomNsp.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            if (!user) return next(new Error('User not found'));
            if (user.is_banned) return next(new Error('Account is banned'));
            const nspName = socket.nsp.name;
            const slug = nspName.replace('/room/', '');
            const room = db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
            if (!room) return next(new Error('Room not found'));
            if (!room.is_public) {
                const isMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, user.id);
                if (!isMember && room.created_by !== user.id && user.role !== 'admin') return next(new Error('Access denied to this private room'));
            }
            const roomRole = getRoomRole(room.id, user.id, room.created_by, user.role);
            socket.user = { userId: user.id, displayName: user.display_name, avatar: user.avatar, role: user.role, email: user.email, isOwner: room.created_by === user.id, roomRole };
            socket.roomSlug = slug;
            socket.roomId = room.id;
            socket.roomOwnerId = room.created_by;
            next();
        } catch (err) { return next(new Error('Invalid or expired token')); }
    });

    roomNsp.on('connection', (socket) => {
        const slug = socket.roomSlug;
        console.log(`🔌 ${socket.user.displayName} connected to room: ${slug}`);
        if (!onlineMembers.has(slug)) onlineMembers.set(slug, new Map());
        onlineMembers.get(slug).set(socket.id, socket.user);
        socket.nsp.emit('member:join', socket.user);
        const members = Array.from(onlineMembers.get(slug).values());
        const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
        socket.nsp.emit('member:list', uniqueMembers);
        const state = playerStates.get(slug);
        if (state) {
            // Calculate estimated current time for joiners
            const syncState = { ...state };
            if (syncState.state === 'playing' && syncState.updatedAt) {
                const elapsed = (Date.now() - new Date(syncState.updatedAt).getTime()) / 1000;
                syncState.currentTime = (syncState.currentTime || 0) + elapsed;
            }
            socket.emit('player:sync', syncState);
        }

        socket.on('player:sync', (data) => {
            if (!data || typeof data !== 'object') return;
            const canControl = socket.user.isOwner || socket.user.role === 'admin' || socket.user.roomRole === 'dj';
            if (!canControl) return socket.emit('notification', { type: 'warning', message: 'Only the room owner or DJs can control the player' });
            const stateObj = playerStates.get(slug) || { videoId: null, state: 'idle', currentTime: 0, updatedAt: new Date().toISOString(), updatedBy: null };
            if (typeof data.videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(data.videoId)) stateObj.videoId = data.videoId;
            else if (data.videoId === null) stateObj.videoId = null;
            if (['playing', 'paused', 'idle'].includes(data.state)) stateObj.state = data.state;
            if (typeof data.currentTime === 'number' && data.currentTime >= 0 && isFinite(data.currentTime)) stateObj.currentTime = data.currentTime;
            stateObj.updatedAt = new Date().toISOString();
            stateObj.updatedBy = socket.user.userId;
            playerStates.set(slug, stateObj);
            socket.nsp.emit('player:sync', stateObj);
        });

        socket.on('player:skip', async () => {
            const canControl = socket.user.isOwner || socket.user.role === 'admin' || socket.user.roomRole === 'dj';
            if (!canControl) return socket.emit('notification', { type: 'warning', message: 'Only the room owner or DJs can skip songs' });
            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            if (current) {
                // Fix: fetch duration if 0
                let duration = current.duration;
                if (!duration && current.youtube_id) {
                    try {
                        const meta = await fetchVideoMetadata(current.youtube_id);
                        if (meta?.duration) duration = meta.duration;
                    } catch (e) { /* fallback to 0 */ }
                }
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, duration, current.channel_name, current.added_by);
                db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
            }
            const next = db.prepare(`SELECT * FROM songs WHERE room_id = ? ORDER BY vote_score DESC, position ASC, created_at ASC LIMIT 1`).get(socket.roomId);
            const stateObj = playerStates.get(slug) || {};
            if (next) { db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id); stateObj.videoId = next.youtube_id; stateObj.state = 'playing'; stateObj.currentTime = 0; }
            else { stateObj.videoId = null; stateObj.state = 'idle'; stateObj.currentTime = 0; }
            stateObj.updatedAt = new Date().toISOString();
            stateObj.updatedBy = socket.user.userId;
            playerStates.set(slug, stateObj);
            socket.nsp.emit('player:sync', stateObj);
            const queue = db.prepare(`SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar FROM songs s JOIN users u ON s.added_by = u.id WHERE s.room_id = ? ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC`).all(socket.roomId);
            socket.nsp.emit('queue:updated', queue);
        });

        socket.on('player:ended', async () => {
            const now = Date.now();
            const lastEnded = endedLocks.get(slug) || 0;
            if (now - lastEnded < 3000) return;
            endedLocks.set(slug, now);
            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            if (current) {
                // Fix: fetch duration if 0
                let duration = current.duration;
                if (!duration && current.youtube_id) {
                    try {
                        const meta = await fetchVideoMetadata(current.youtube_id);
                        if (meta?.duration) duration = meta.duration;
                    } catch (e) { /* fallback to 0 */ }
                }
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, duration, current.channel_name, current.added_by);
                db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
            }
            let next = db.prepare(`SELECT * FROM songs WHERE room_id = ? ORDER BY vote_score DESC, position ASC, created_at ASC LIMIT 1`).get(socket.roomId);
            const stateObj = playerStates.get(slug) || {};

            // Smart Autoplay: if queue empty and autoplay enabled, find related song
            if (!next) {
                const room = db.prepare('SELECT autoplay_enabled FROM rooms WHERE id = ?').get(socket.roomId);
                if (room?.autoplay_enabled) {
                    const lastVideoId = current?.youtube_id;
                    const lastTitle = current?.title;
                    const lastChannel = current?.channel_name;

                    // Get recently played IDs to avoid repeats
                    const recentHistory = db.prepare(`SELECT youtube_id FROM song_history WHERE room_id = ? ORDER BY played_at DESC LIMIT 10`).all(socket.roomId);
                    const excludeIds = recentHistory.map(h => h.youtube_id);

                    let autoSong = null;

                    // Strategy 1: YouTube related videos (search by channel/title)
                    if (lastVideoId && lastTitle) {
                        try {
                            const related = await fetchRelatedVideos(lastVideoId, lastTitle, lastChannel, excludeIds);
                            if (related.length > 0) {
                                const pick = related[Math.floor(Math.random() * Math.min(3, related.length))]; // Pick from top 3
                                // Fetch proper metadata
                                const meta = await fetchVideoMetadata(pick.videoId);
                                autoSong = meta || { videoId: pick.videoId, title: pick.title, thumbnail: pick.thumbnail, duration: 0, channelName: pick.channelName };
                            }
                        } catch (e) { console.error('Autoplay YouTube fetch error:', e.message); }
                    }

                    // Strategy 2: Fallback to random from history
                    if (!autoSong) {
                        const histSong = db.prepare(`SELECT DISTINCT youtube_id, title, thumbnail, duration, channel_name, added_by FROM song_history WHERE room_id = ? ${lastVideoId ? 'AND youtube_id != ?' : ''} ORDER BY RANDOM() LIMIT 1`).get(...(lastVideoId ? [socket.roomId, lastVideoId] : [socket.roomId]));
                        if (histSong) {
                            autoSong = { videoId: histSong.youtube_id, title: histSong.title, thumbnail: histSong.thumbnail, duration: histSong.duration, channelName: histSong.channel_name, addedBy: histSong.added_by };
                        }
                    }

                    if (autoSong) {
                        const autoId = uuidv4();
                        const addedBy = autoSong.addedBy || current?.added_by || socket.user.userId;
                        db.prepare(`INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position, is_playing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`).run(autoId, socket.roomId, autoSong.videoId, autoSong.title, autoSong.thumbnail, autoSong.duration || 0, autoSong.channelName || 'Unknown', addedBy);
                        next = db.prepare('SELECT * FROM songs WHERE id = ?').get(autoId);
                        socket.nsp.emit('notification', { type: 'info', message: `🎵 Autoplay: ${autoSong.title}` });
                        socket.nsp.emit('autoplay:next', { title: autoSong.title, thumbnail: autoSong.thumbnail });
                    }
                }
            }

            if (next) { db.prepare('UPDATE songs SET is_playing = 1 WHERE id = ?').run(next.id); stateObj.videoId = next.youtube_id; stateObj.state = 'playing'; stateObj.currentTime = 0; }
            else { stateObj.videoId = null; stateObj.state = 'idle'; stateObj.currentTime = 0; }
            stateObj.updatedAt = new Date().toISOString();
            playerStates.set(slug, stateObj);
            socket.nsp.emit('player:sync', stateObj);
            const queue = db.prepare(`SELECT s.*, u.display_name as added_by_name, u.avatar as added_by_avatar FROM songs s JOIN users u ON s.added_by = u.id WHERE s.room_id = ? ORDER BY s.is_playing DESC, s.vote_score DESC, s.position ASC, s.created_at ASC`).all(socket.roomId);
            socket.nsp.emit('queue:updated', queue);
        });

        socket.on('reaction:send', (data) => {
            if (!data?.emoji || typeof data.emoji !== 'string') return;
            const allowed = ['🔥', '❤️', '😂', '👏', '🎵', '💀', '🥲', '🤩', '👀', '💜'];
            if (!allowed.includes(data.emoji)) return;
            socket.nsp.emit('reaction:broadcast', { emoji: data.emoji, userId: socket.user.userId, displayName: socket.user.displayName, id: Date.now() + Math.random().toString(36).slice(2, 6) });
        });

        socket.on('chat:send', async (data) => {
            if (!data?.content || typeof data.content !== 'string') return;
            const content = data.content.trim().slice(0, 500);
            if (!content) return;
            const db = getDb();
            const id = uuidv4();
            const playingSong = db.prepare('SELECT id, title FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            const replyTo = typeof data.replyTo === 'string' ? data.replyTo : null;

            db.prepare(`INSERT INTO chat_messages (id, room_id, user_id, content, song_id, reply_to) VALUES (?, ?, ?, ?, ?, ?)`).run(id, socket.roomId, socket.user.userId, content, playingSong?.id || null, replyTo);

            // Fetch reply message data if replying
            let replyMessage = null;
            if (replyTo) {
                const reply = db.prepare(`SELECT cm.id, cm.content, u.id as user_id, u.display_name, u.avatar FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.id = ?`).get(replyTo);
                if (reply) {
                    replyMessage = { id: reply.id, content: reply.content.slice(0, 100), user: { userId: reply.user_id, displayName: reply.display_name, avatar: reply.avatar } };
                }
            }

            const message = { id, content, songTitle: playingSong?.title || null, replyTo, replyMessage, user: { userId: socket.user.userId, displayName: socket.user.displayName, avatar: socket.user.avatar }, createdAt: new Date().toISOString() };
            socket.nsp.emit('chat:new', message);
            logActivity(db, socket.roomId, socket.user.userId, 'chat', { messageId: id });

            // --- Push Notifications for offline members ---
            const room = db.prepare('SELECT name, slug FROM rooms WHERE id = ?').get(socket.roomId);
            const roomMembers = db.prepare('SELECT user_id FROM room_members WHERE room_id = ?').all(socket.roomId);
            const onlineSockets = await socket.nsp.fetchSockets();
            const onlineUserIds = new Set(onlineSockets.map(s => s.user?.userId).filter(Boolean));

            // Send push to members NOT online in this room (exclude sender)
            const offlineUserIds = roomMembers
                .map(m => m.user_id)
                .filter(uid => uid !== socket.user.userId && !onlineUserIds.has(uid));

            if (offlineUserIds.length > 0) {
                import('./push.js').then(({ sendPushToUsers }) => {
                    sendPushToUsers(offlineUserIds, {
                        title: `${socket.user.displayName} in ${room?.name || 'SoundDen'}`,
                        body: content.slice(0, 120),
                        icon: socket.user.avatar || '/icon-192.png',
                        url: `/room/${room?.slug || socket.roomId}`,
                        tag: `chat-${socket.roomId}`,
                    });
                }).catch(() => { });
            }

            // Detect @mentions: query all room members + owner, check if their name appears in message
            // This approach correctly handles multi-word display names
            if (content.includes('@')) {
                const memberUserIds = roomMembers.map(m => m.user_id);
                if (!memberUserIds.includes(socket.roomOwnerId)) memberUserIds.push(socket.roomOwnerId);
                const placeholders = memberUserIds.map(() => '?').join(',');
                const candidateUsers = memberUserIds.length > 0
                    ? db.prepare(`SELECT id, display_name FROM users WHERE id IN (${placeholders})`).all(...memberUserIds)
                    : [];

                const contentLower = content.toLowerCase();
                for (const candidate of candidateUsers) {
                    if (candidate.id === socket.user.userId) continue;
                    const mentionText = `@${candidate.display_name}`.toLowerCase();
                    if (!contentLower.includes(mentionText)) continue;

                    const notifId = uuidv4();
                    try {
                        db.prepare(`INSERT INTO room_notifications (id, room_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)`).run(
                            notifId, socket.roomId, candidate.id, 'mention',
                            `${socket.user.displayName} mentioned you`,
                            `in ${room?.name || 'a room'}: "${content.slice(0, 80)}"`
                        );
                    } catch (e) { /* table may not exist yet */ }

                    // Emit real-time mention to the specific user's socket(s) in this room
                    const roomNspName = socket.nsp.name;
                    const targetNsp = io.of(roomNspName);
                    for (const [, targetSocket] of targetNsp.sockets) {
                        if (targetSocket.user?.userId === candidate.id) {
                            targetSocket.emit('notification:mention', {
                                userId: candidate.id,
                                roomSlug: room?.slug,
                                from: socket.user.displayName,
                                content: content.slice(0, 80),
                            });
                        }
                    }
                    // Also emit via global namespace for users in OTHER rooms / pages
                    io.emit('notification:mention', { userId: candidate.id, roomSlug: room?.slug, from: socket.user.displayName, content: content.slice(0, 80) });

                    // Push notification for mention — always send (mention is important even if online)
                    import('./push.js').then(({ sendPushToUser }) => {
                        sendPushToUser(candidate.id, {
                            title: `${socket.user.displayName} mentioned you`,
                            body: `in ${room?.name || 'a room'}: "${content.slice(0, 100)}"`,
                            icon: socket.user.avatar || '/icon-192.png',
                            url: `/room/${room?.slug || socket.roomId}`,
                            tag: `mention-${socket.roomId}`,
                        });
                    }).catch(() => { });
                }
            }
        });

        socket.on('chat:history', () => {
            const db = getDb();
            const messages = db.prepare(`SELECT cm.id, cm.content, cm.song_id, cm.reply_to, cm.created_at, u.id as user_id, u.display_name, u.avatar, s.title as song_title FROM chat_messages cm JOIN users u ON cm.user_id = u.id LEFT JOIN songs s ON cm.song_id = s.id WHERE cm.room_id = ? ORDER BY cm.created_at DESC LIMIT 50`).all(socket.roomId);

            // Build a map of message IDs for reply lookups
            const msgMap = new Map(messages.map(m => [m.id, m]));

            const formatted = messages.reverse().map(m => {
                let replyMessage = null;
                if (m.reply_to) {
                    // Try from current batch first
                    const replyMsg = msgMap.get(m.reply_to);
                    if (replyMsg) {
                        replyMessage = { id: replyMsg.id, content: replyMsg.content.slice(0, 100), user: { userId: replyMsg.user_id, displayName: replyMsg.display_name, avatar: replyMsg.avatar } };
                    } else {
                        // Fetch from DB if not in batch
                        const reply = db.prepare(`SELECT cm.id, cm.content, u.id as user_id, u.display_name, u.avatar FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.id = ?`).get(m.reply_to);
                        if (reply) {
                            replyMessage = { id: reply.id, content: reply.content.slice(0, 100), user: { userId: reply.user_id, displayName: reply.display_name, avatar: reply.avatar } };
                        }
                    }
                }
                return { id: m.id, content: m.content, songTitle: m.song_title, replyTo: m.reply_to, replyMessage, user: { userId: m.user_id, displayName: m.display_name, avatar: m.avatar }, createdAt: m.created_at };
            });
            socket.emit('chat:history', formatted);
        });

        // Kick member (owner only)
        socket.on('member:kick', ({ userId }) => {
            if (socket.user.userId !== socket.roomOwnerId && socket.user.role !== 'admin') return;
            if (userId === socket.roomOwnerId) return; // Can't kick the owner

            // Find all sockets of the kicked user in this room
            const nsp = socket.nsp;
            for (const [id, s] of nsp.sockets) {
                if (s.user?.userId === userId) {
                    s.emit('room:kicked', { message: 'You have been kicked from this room' });
                    s.disconnect(true);
                }
            }

            // Remove from online members
            if (onlineMembers.has(slug)) {
                for (const [sid, m] of onlineMembers.get(slug)) {
                    if (m.userId === userId) onlineMembers.get(slug).delete(sid);
                }
                const members = Array.from(onlineMembers.get(slug).values());
                const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
                nsp.emit('member:list', uniqueMembers);
            }
        });

        // Set member role (owner only)
        socket.on('member:set-role', ({ userId, role }) => {
            if (socket.user.userId !== socket.roomOwnerId && socket.user.role !== 'admin') return;
            if (userId === socket.roomOwnerId) return; // Can't change owner's role
            if (!['dj', 'listener'].includes(role)) return;
            const db = getDb();
            db.prepare('UPDATE room_members SET room_role = ? WHERE room_id = ? AND user_id = ?').run(role, socket.roomId, userId);
            // Update the socket user data for the affected user
            const nsp = socket.nsp;
            for (const [id, s] of nsp.sockets) {
                if (s.user?.userId === userId) s.user.roomRole = role;
            }
            // Re-emit member list with updated roles
            if (onlineMembers.has(slug)) {
                for (const [sid, m] of onlineMembers.get(slug)) {
                    if (m.userId === userId) m.roomRole = role;
                }
                const members = Array.from(onlineMembers.get(slug).values());
                const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
                nsp.emit('member:list', uniqueMembers);
            }
            nsp.emit('notification', { type: 'info', message: `${userId === socket.user.userId ? 'Your' : 'A member\'s'} role was changed to ${role}` });
        });
        socket.on('disconnect', () => {
            console.log(`🔌 ${socket.user.displayName} disconnected from room: ${slug}`);
            if (onlineMembers.has(slug)) { onlineMembers.get(slug).delete(socket.id); if (onlineMembers.get(slug).size === 0) onlineMembers.delete(slug); }
            socket.nsp.emit('member:leave', { userId: socket.user.userId, displayName: socket.user.displayName });
            if (onlineMembers.has(slug)) {
                const members = Array.from(onlineMembers.get(slug).values());
                const uniqueMembers = [...new Map(members.map(m => [m.userId, m])).values()];
                socket.nsp.emit('member:list', uniqueMembers);
            } else { socket.nsp.emit('member:list', []); }
        });
    });

    return io;
}

const activityDebounce = new Map();

function logActivity(db, roomId, userId, actionType, metadata = {}) {
    const key = `${roomId}:${userId}:${actionType}`;
    const now = Date.now();
    const last = activityDebounce.get(key) || 0;
    if (now - last < 10000 && !['song_add', 'skip'].includes(actionType)) return;
    activityDebounce.set(key, now);
    const id = uuidv4();
    db.prepare(`INSERT INTO activity_log (id, room_id, user_id, action_type, metadata) VALUES (?, ?, ?, ?, ?)`).run(id, roomId, userId, actionType, JSON.stringify(metadata));
    if (io) {
        try {
            const room = db.prepare('SELECT slug FROM rooms WHERE id = ?').get(roomId);
            if (room) {
                const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
                io.of(`/room/${room.slug}`).emit('activity:new', { id, action_type: actionType, metadata, created_at: new Date().toISOString(), display_name: user ? user.display_name : 'System' });
            }
        } catch (e) { console.error('Failed to emit activity', e); }
    }
}

export { logActivity };
