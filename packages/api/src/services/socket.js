import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { playerStates } from '../routes/player.js';
import { getRoomRole } from '../middlewares/role.js';
import { v4 as uuidv4 } from 'uuid';

let io;
const onlineMembers = new Map();
const endedLocks = new Map();

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

        socket.on('player:skip', () => {
            const canControl = socket.user.isOwner || socket.user.role === 'admin' || socket.user.roomRole === 'dj';
            if (!canControl) return socket.emit('notification', { type: 'warning', message: 'Only the room owner or DJs can skip songs' });
            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            if (current) {
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, current.duration, current.channel_name, current.added_by);
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

        socket.on('player:ended', () => {
            const now = Date.now();
            const lastEnded = endedLocks.get(slug) || 0;
            if (now - lastEnded < 3000) return;
            endedLocks.set(slug, now);
            const db = getDb();
            const current = db.prepare('SELECT * FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            if (current) {
                const histId = uuidv4();
                db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(histId, current.room_id, current.youtube_id, current.title, current.thumbnail, current.duration, current.channel_name, current.added_by);
                db.prepare('DELETE FROM songs WHERE id = ?').run(current.id);
            }
            let next = db.prepare(`SELECT * FROM songs WHERE room_id = ? ORDER BY vote_score DESC, position ASC, created_at ASC LIMIT 1`).get(socket.roomId);
            const stateObj = playerStates.get(slug) || {};

            // Smart Autoplay: if queue empty and autoplay enabled, pick from history
            if (!next) {
                const room = db.prepare('SELECT autoplay_enabled FROM rooms WHERE id = ?').get(socket.roomId);
                if (room?.autoplay_enabled) {
                    const lastVideoId = current?.youtube_id;
                    const histSong = db.prepare(`SELECT DISTINCT youtube_id, title, thumbnail, duration, channel_name, added_by FROM song_history WHERE room_id = ? ${lastVideoId ? 'AND youtube_id != ?' : ''} ORDER BY RANDOM() LIMIT 1`).get(...(lastVideoId ? [socket.roomId, lastVideoId] : [socket.roomId]));
                    if (histSong) {
                        const autoId = uuidv4();
                        db.prepare(`INSERT INTO songs (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by, position, is_playing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`).run(autoId, socket.roomId, histSong.youtube_id, histSong.title, histSong.thumbnail, histSong.duration, histSong.channel_name, histSong.added_by);
                        next = db.prepare('SELECT * FROM songs WHERE id = ?').get(autoId);
                        socket.nsp.emit('notification', { type: 'info', message: `🎵 Autoplay: ${histSong.title}` });
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

        socket.on('chat:send', (data) => {
            if (!data?.content || typeof data.content !== 'string') return;
            const content = data.content.trim().slice(0, 500);
            if (!content) return;
            const db = getDb();
            const id = uuidv4();
            const playingSong = db.prepare('SELECT id, title FROM songs WHERE room_id = ? AND is_playing = 1').get(socket.roomId);
            db.prepare(`INSERT INTO chat_messages (id, room_id, user_id, content, song_id) VALUES (?, ?, ?, ?, ?)`).run(id, socket.roomId, socket.user.userId, content, playingSong?.id || null);
            const message = { id, content, songTitle: playingSong?.title || null, user: { userId: socket.user.userId, displayName: socket.user.displayName, avatar: socket.user.avatar }, createdAt: new Date().toISOString() };
            socket.nsp.emit('chat:new', message);
            logActivity(db, socket.roomId, socket.user.userId, 'chat', { messageId: id });
        });

        socket.on('chat:history', () => {
            const db = getDb();
            const messages = db.prepare(`SELECT cm.id, cm.content, cm.song_id, cm.created_at, u.id as user_id, u.display_name, u.avatar, s.title as song_title FROM chat_messages cm JOIN users u ON cm.user_id = u.id LEFT JOIN songs s ON cm.song_id = s.id WHERE cm.room_id = ? ORDER BY cm.created_at DESC LIMIT 50`).all(socket.roomId);
            const formatted = messages.reverse().map(m => ({ id: m.id, content: m.content, songTitle: m.song_title, user: { userId: m.user_id, displayName: m.display_name, avatar: m.avatar }, createdAt: m.created_at }));
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
export function getIO() { return io; }
