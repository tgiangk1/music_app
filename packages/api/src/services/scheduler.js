import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { getIO } from './socket.js';

let cronJob = null;

export function initScheduler() {
    // Run every minute
    cronJob = cron.schedule('* * * * *', () => {
        checkSchedules();
    });

    console.log('✅ Scheduler initialized');
}

function checkSchedules() {
    try {
        const db = getDb();
        const now = new Date().toISOString();

        // Find schedules that are in the past but haven't been processed
        const pending = db.prepare(`
            SELECT s.*, r.slug as room_slug, r.name as room_name 
            FROM room_schedules s
            JOIN rooms r ON s.room_id = r.id
            WHERE s.is_processed = 0 AND s.scheduled_at <= ?
        `).all(now);

        if (!pending.length) return;

        const io = getIO();

        for (const schedule of pending) {
            console.log(`⏰ Triggering schedule: ${schedule.title} for room ${schedule.room_slug}`);

            // Mark as processed
            db.prepare('UPDATE room_schedules SET is_processed = 1 WHERE id = ?').run(schedule.id);

            // Emit to room namespace
            if (io) {
                const roomNsp = io.of(`/room/${schedule.room_slug}`);
                roomNsp.emit('schedule:started', {
                    id: schedule.id,
                    title: schedule.title,
                    roomId: schedule.room_id
                });
            }

            // If notify_members is true, create notifications for all members
            if (schedule.notify_members) {
                const members = db.prepare('SELECT user_id FROM room_members WHERE room_id = ?').all(schedule.room_id);

                const insertNotif = db.prepare(`
                    INSERT INTO room_notifications (id, room_id, user_id, type, title, message)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                const blockNotif = db.transaction(() => {
                    for (const member of members) {
                        insertNotif.run(
                            uuidv4(),
                            schedule.room_id,
                            member.user_id,
                            'schedule_start',
                            'Room Started!',
                            `Room "${schedule.room_name}" is open for: ${schedule.title}`
                        );
                    }
                });

                blockNotif();

                // Real-time notify global users if connected
                if (io) {
                    members.forEach(member => {
                        io.to(`user:${member.user_id}`).emit('notification', {
                            type: 'schedule_start',
                            message: `Room "${schedule.room_name}" is open for: ${schedule.title}`,
                            roomId: schedule.room_id,
                            roomSlug: schedule.room_slug
                        });
                    });
                }
            }
        }
    } catch (err) {
        console.error('Scheduler error:', err);
    }
}
