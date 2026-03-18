import { getDb } from '../config/database.js';

/**
 * Generate personalized song recommendations for a user
 *
 * Algorithm:
 * 1. Analyze user's listening history (songs they've played, liked, added)
 * 2. Identify favorite genres/artists based on channel names
 * 3. Score songs based on:
 *    - Weighted play count (0.4)
 *    - Weighted likes/upvotes (0.3)
 *    - Weighted room activity (0.3)
 * 4. Filter out songs user has already heard extensively
 * 5. Return top 10 with reasons
 *
 * @param {string} userId - The user ID to generate recommendations for
 * @returns {Array} Array of recommended songs with scores and reasons
 */
export function generateRecommendations(userId) {
    const db = getDb();

    // Get user's listening history and preferences
    const userActivity = getUserActivity(db, userId);

    // If user has no activity, return trending recommendations
    if (userActivity.totalActivity === 0) {
        return getTrendingRecommendations(db);
    }

    // Build song scores based on user preferences
    const songScores = new Map();

    // Score based on user's added songs (direct preference)
    scoreByUserSongs(db, userActivity.addedSongs, songScores, 0.4);

    // Score based on user's upvotes (likes)
    scoreByUserVotes(db, userId, songScores, 0.3);

    // Score based on room activity (rooms user participates in)
    scoreByRoomActivity(db, userId, songScores, 0.3);

    // Filter out songs user has already played extensively
    const playedSongIds = new Set(userActivity.playedSongs.map(s => s.youtube_id));
    const addedSongIds = new Set(userActivity.addedSongs.map(s => s.youtube_id));

    // Sort and get top 10
    const sortedSongs = Array.from(songScores.entries())
        .map(([youtubeId, score]) => ({ youtubeId, ...score }))
        .filter(song => !playedSongIds.has(song.youtubeId) && !addedSongIds.has(song.youtubeId))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);
    // If no personalized recommendations found, fall back to trending
    if (sortedSongs.length === 0) {
        return getTrendingRecommendations(db);
    }


    // Fetch full song details and attach reasons
    const recommendations = sortedSongs.map(song => {
        const reasons = [];
        if (song.channelMatch) reasons.push('Matches your favorite artists');
        if (song.roomMatch) reasons.push('Popular in your favorite rooms');
        if (song.highVoteScore) reasons.push('Highly rated by the community');

        return {
            ...song,
            reason: reasons[0] || 'Based on your listening preferences',
        };
    });

    return recommendations;
}

/**
 * Get user's activity data for recommendation analysis
 */
function getUserActivity(db, userId) {
    // Songs user has added
    const addedSongs = db.prepare(`
        SELECT youtube_id, channel_name, title, thumbnail, duration
        FROM songs
        WHERE added_by = ?
    `).all(userId);

    // User's vote history
    const userVotes = db.prepare(`
        SELECT s.youtube_id, s.channel_name, v.type
        FROM votes v
        JOIN songs s ON v.song_id = s.id
        WHERE v.user_id = ?
    `).all(userId);

    // Songs played in user's history (from song_history table)
    const playedSongs = db.prepare(`
        SELECT youtube_id, channel_name, title
        FROM song_history
        WHERE added_by = ?
        ORDER BY played_at DESC
        LIMIT 50
    `).all(userId);

    // Get user's favorite rooms (rooms where user has most activity)
    const favoriteRooms = db.prepare(`
        SELECT r.id, r.name, r.slug,
               COUNT(DISTINCT s.id) as song_count
        FROM rooms r
        JOIN room_members rm ON r.id = rm.room_id
        LEFT JOIN songs s ON s.room_id = r.id AND s.added_by = ?
        WHERE rm.user_id = ?
        GROUP BY r.id
        ORDER BY song_count DESC
        LIMIT 5
    `).all(userId, userId);

    // Count upvotes
    const upvoteCount = userVotes.filter(v => v.type === 'up').length;

    return {
        addedSongs,
        userVotes,
        playedSongs,
        favoriteRooms,
        upvoteCount,
        totalActivity: addedSongs.length + userVotes.length + playedSongs.length,
    };
}

/**
 * Score songs based on user's favorite channels
 */
function scoreByUserSongs(db, userSongs, songScores, weight) {
    // Extract favorite channels
    const channelCounts = {};
    userSongs.forEach(song => {
        const channel = song.channel_name || 'Unknown';
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });

    // Get top channels
    const topChannels = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([channel]) => channel);

    if (topChannels.length === 0) return;

    // Find songs from these channels
    const channelSongs = db.prepare(`
        SELECT youtube_id, channel_name, title, thumbnail, duration,
               AVG(vote_score) as avg_vote_score,
               COUNT(*) as play_count
        FROM songs
        WHERE channel_name IN (${topChannels.map(() => '?').join(',')})
        GROUP BY youtube_id, channel_name, title, thumbnail, duration
        ORDER BY avg_vote_score DESC, play_count DESC
        LIMIT 50
    `).all(...topChannels);

    channelSongs.forEach(song => {
        const existing = songScores.get(song.youtube_id) || {
            channelMatch: false,
            roomMatch: false,
            highVoteScore: false,
            totalScore: 0,
            channelScore: 0,
            roomScore: 0,
            voteScore: 0,
            playCount: 0,
            title: song.title,
            channel_name: song.channel_name,
            thumbnail: song.thumbnail,
            duration: song.duration,
        };

        existing.channelMatch = true;
        existing.channelScore += (song.avg_vote_score * 10 + song.play_count) * weight;
        existing.totalScore = existing.channelScore + existing.roomScore + existing.voteScore;
        existing.playCount = Math.max(existing.playCount, song.play_count);

        songScores.set(song.youtube_id, existing);
    });
}

/**
 * Score songs based on user's voting patterns
 */
function scoreByUserVotes(db, userId, songScores, weight) {
    // Get user's upvoted songs and their channels
    const upvotedChannels = db.prepare(`
        SELECT DISTINCT s.channel_name
        FROM votes v
        JOIN songs s ON v.song_id = s.id
        WHERE v.user_id = ? AND v.type = 'up'
    `).all(userId);

    if (upvotedChannels.length === 0) return;

    const channelNames = upvotedChannels.map(c => c.channel_name);

    // Find popular songs from these channels
    const popularSongs = db.prepare(`
        SELECT youtube_id, channel_name, title, thumbnail, duration,
               AVG(vote_score) as avg_vote_score,
               COUNT(*) as play_count
        FROM songs
        WHERE channel_name IN (${channelNames.map(() => '?').join(',')})
        GROUP BY youtube_id, channel_name, title, thumbnail, duration
        HAVING play_count >= 1
        ORDER BY avg_vote_score DESC
        LIMIT 30
    `).all(...channelNames);

    popularSongs.forEach(song => {
        const existing = songScores.get(song.youtube_id) || {
            channelMatch: false,
            roomMatch: false,
            highVoteScore: false,
            totalScore: 0,
            channelScore: 0,
            roomScore: 0,
            voteScore: 0,
            playCount: 0,
            title: song.title,
            channel_name: song.channel_name,
            thumbnail: song.thumbnail,
            duration: song.duration,
        };

        existing.highVoteScore = true;
        existing.voteScore += song.avg_vote_score * weight;
        existing.totalScore = existing.channelScore + existing.roomScore + existing.voteScore;
        existing.playCount = Math.max(existing.playCount, song.play_count);

        songScores.set(song.youtube_id, existing);
    });
}

/**
 * Score songs based on user's room activity
 */
function scoreByRoomActivity(db, userId, songScores, weight) {
    // Get user's favorite rooms
    const favoriteRooms = db.prepare(`
        SELECT r.id, r.name, r.slug
        FROM room_members rm
        JOIN rooms r ON rm.room_id = r.id
        WHERE rm.user_id = ?
        ORDER BY rm.joined_at ASC
        LIMIT 5
    `).all(userId);

    if (favoriteRooms.length === 0) return;

    const roomIds = favoriteRooms.map(r => r.id);

    // Get popular songs from these rooms - lower threshold for smaller datasets
    const totalSongs = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;
    const threshold = totalSongs < 5 ? 1 : 2;

    const roomSongs = db.prepare(`
        SELECT youtube_id, channel_name, title, thumbnail, duration,
               AVG(s.vote_score) as avg_vote_score,
               COUNT(*) as play_count
        FROM songs s
        WHERE s.room_id IN (${roomIds.map(() => '?').join(',')})
        GROUP BY youtube_id, channel_name, title, thumbnail, duration
        HAVING play_count >= ?
        ORDER BY avg_vote_score DESC, play_count DESC
        LIMIT 40
    `).all(...roomIds, threshold);

    roomSongs.forEach(song => {
        const existing = songScores.get(song.youtube_id) || {
            channelMatch: false,
            roomMatch: false,
            highVoteScore: false,
            totalScore: 0,
            channelScore: 0,
            roomScore: 0,
            voteScore: 0,
            playCount: 0,
            title: song.title,
            channel_name: song.channel_name,
            thumbnail: song.thumbnail,
            duration: song.duration,
        };

        existing.roomMatch = true;
        existing.roomScore += (song.avg_vote_score * 8 + song.play_count * 2) * weight;
        existing.totalScore = existing.channelScore + existing.roomScore + existing.voteScore;
        existing.playCount = Math.max(existing.playCount, song.play_count);

        songScores.set(song.youtube_id, existing);
    });
}

/**
 * Get trending recommendations for new users with no history
 */
function getTrendingRecommendations(db) {
    // Get most popular songs across all rooms
    // Lower the threshold if there aren't many songs
    const totalSongs = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;

    const threshold = totalSongs < 5 ? 1 : 2;

    const trendingSongs = db.prepare(`
        SELECT youtube_id, channel_name, title, thumbnail, duration,
               AVG(s.vote_score) as avg_vote_score,
               COUNT(*) as play_count
        FROM songs s
        GROUP BY youtube_id, channel_name, title, thumbnail, duration
        HAVING play_count >= ?
        ORDER BY avg_vote_score DESC, play_count DESC
        LIMIT 10
    `).all(threshold);

    // If still no songs, get all songs
    if (trendingSongs.length === 0) {
        const allSongs = db.prepare(`
            SELECT youtube_id, channel_name, title, thumbnail, duration,
                   AVG(s.vote_score) as avg_vote_score,
                   COUNT(*) as play_count
            FROM songs s
            GROUP BY youtube_id, channel_name, title, thumbnail, duration
            ORDER BY play_count DESC
            LIMIT 10
        `).all();

        return allSongs.map(song => ({
            youtubeId: song.youtube_id,
            title: song.title,
            channel_name: song.channel_name,
            thumbnail: song.thumbnail,
            duration: song.duration,
            totalScore: song.play_count,
            reason: 'Popular songs',
        }));
    }

    return trendingSongs.map(song => ({
        youtubeId: song.youtube_id,
        title: song.title,
        channel_name: song.channel_name,
        thumbnail: song.thumbnail,
        duration: song.duration,
        totalScore: song.avg_vote_score * 10 + song.play_count,
        reason: 'Trending across all rooms',
    }));
}
