import cron from 'node-cron';
import { getDb } from '../config/database.js';

export function initCronJobs(io) {
    // Run every minute
    cron.schedule('* * * * *', () => {
        executePendingSchedules(io);
    });

    console.log('✅ Cron jobs initialized');
}

function executePendingSchedules(io) {
    try {
        const db = getDb();
        const now = new Date().toISOString();

        // Get all schedules that are due but not executed
        const pendingSchedules = db.prepare(`
            SELECT s.*, r.slug as room_slug, r.name as room_name
            FROM room_schedules s
            JOIN rooms r ON s.room_id = r.id
            WHERE s.is_executed = 0 AND s.scheduled_at <= ?
        `).all(now);

        if (pendingSchedules.length === 0) return;

        const markExecuted = db.prepare('UPDATE room_schedules SET is_executed = 1 WHERE id = ?');

        db.transaction(() => {
            for (const schedule of pendingSchedules) {
                markExecuted.run(schedule.id);

                const eventData = {
                    title: schedule.title,
                    roomName: schedule.room_name,
                    roomSlug: schedule.room_slug,
                    shouldNotify: schedule.notify_members === 1
                };

                // Broadcast to the room via Socket.io
                const roomNsp = io.of(`/room/${schedule.room_slug}`);
                if (roomNsp) {
                    roomNsp.emit('room:schedule_triggered', eventData);
                }

                // Feature Global Event: Also emit to root namespace if it's a public room
                const room = db.prepare('SELECT is_public FROM rooms WHERE id = ?').get(schedule.room_id);
                if (room && room.is_public === 1 && eventData.shouldNotify) {
                    io.emit('global:schedule_triggered', eventData);
                }
            }
        })();

        console.log(`Executed ${pendingSchedules.length} pending schedules.`);
    } catch (err) {
        console.error('Error executing schedules:', err);
    }
}
