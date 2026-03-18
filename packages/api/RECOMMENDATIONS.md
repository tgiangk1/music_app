# Recommendation System Documentation

## Overview

The Antigravity Jukebox recommendation system provides personalized song suggestions based on user listening history, preferences, and room activity. The system uses a multi-factor scoring algorithm to rank songs and returns the top 10 recommendations with contextual reasons.

## Architecture

### Components

1. **Service Layer** (`src/services/recommendations.js`)
   - Core recommendation algorithm
   - User activity analysis
   - Song scoring functions
   - Trending recommendations fallback

2. **Route Layer** (`src/routes/recommendations.js`)
   - REST API endpoints
   - Authentication and authorization
   - Request validation
   - Response formatting

3. **Database Integration**
   - Uses existing SQLite database tables:
     - `songs` - Current queue songs
     - `song_history` - Previously played songs
     - `votes` - User upvotes/downvotes
     - `rooms` - Room metadata
     - `room_members` - Room memberships
     - `users` - User profiles

## API Endpoints

### 1. GET /api/recommendations

Get personalized song recommendations for the authenticated user.

**Authentication:** Required (JWT)

**Query Parameters:**
- `limit` (optional, default: 10, max: 20) - Number of recommendations to return

**Response:**
```json
{
  "recommendations": [
    {
      "youtubeId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "artist": "Rick Astley",
      "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      "duration": 212,
      "totalScore": 45.2,
      "reason": "Matches your favorite artists"
    }
  ],
  "generatedAt": "2026-03-11T12:00:00.000Z"
}
```

### 2. GET /api/recommendations/:userId

Get recommendations for a specific user (users can access their own, admins can access any).

**Authentication:** Required (JWT)

**Access Control:**
- Users can only access their own recommendations
- Admins can access any user's recommendations

**Query Parameters:**
- `limit` (optional, default: 10, max: 20) - Number of recommendations to return

**Response:** Same as GET /api/recommendations

### 3. GET /api/recommendations/trending

Get trending songs across all rooms (no authentication required).

**Authentication:** None

**Query Parameters:**
- `limit` (optional, default: 20, max: 50) - Number of trending songs to return

**Response:**
```json
{
  "trending": [
    {
      "youtubeId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "channel_name": "Rick Astley",
      "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      "duration": 212,
      "avg_vote_score": 8.5,
      "play_count": 45,
      "popular_rooms": "Room 1, Room 2"
    }
  ],
  "generatedAt": "2026-03-11T12:00:00.000Z"
}
```

## Recommendation Algorithm

### Scoring Factors

The system calculates a composite score for each song based on three weighted factors:

1. **Channel Preference Score (40% weight)**
   - Analyzes user's added songs to identify favorite channels/artists
   - Scores songs from similar channels higher
   - Uses average vote score and play count from matching channels

2. **Vote Pattern Score (30% weight)**
   - Analyzes user's upvote history
   - Identifies channels the user has explicitly liked
   - Boosts songs from those channels

3. **Room Activity Score (30% weight)**
   - Identifies user's favorite rooms (based on membership and activity)
   - Scores songs popular in those rooms
   - Considers both vote scores and play counts within rooms

### Algorithm Flow

```
1. Get user activity data
   ↓
2. Check if user has any activity
   ↓
3a. No activity → Return trending recommendations (fallback)
   ↓
3b. Has activity → Build song scores using three factors
   ↓
4. Filter out already played/added songs
   ↓
5. Sort by total score (descending)
   ↓
6. Return top 10 with reasons
   ↓
7. If no personalized results → Fall back to trending
```

### Reasons Provided

Each recommendation includes a reason explaining why it was recommended:

- **"Matches your favorite artists"** - Song from a channel the user frequently adds songs from
- **"Popular in your favorite rooms"** - Song frequently played in rooms the user participates in
- **"Highly rated by the community"** - Song has high average vote scores
- **"Trending across all rooms"** - Popular song across the entire platform (fallback)

### Edge Cases Handled

1. **New Users**
   - No activity data
   - Returns trending recommendations
   - Threshold adjusted based on total song count

2. **Limited Data**
   - Few songs in database
   - Lower play count thresholds
   - Returns all available songs if needed

3. **No Personalized Results**
   - User has activity but no matching songs
   - Falls back to trending recommendations
   - Ensures users always receive recommendations

4. **Private Rooms**
   - Room activity scoring respects privacy
   - Only considers rooms user has access to

## Database Queries

All queries use prepared statements with parameterized inputs to prevent SQL injection.

### Key Queries

1. **User's Added Songs:**
```sql
SELECT youtube_id, channel_name, title, thumbnail, duration
FROM songs
WHERE added_by = ?
```

2. **User's Vote History:**
```sql
SELECT s.youtube_id, s.channel_name, v.type
FROM votes v
JOIN songs s ON v.song_id = s.id
WHERE v.user_id = ?
```

3. **User's Played History:**
```sql
SELECT youtube_id, channel_name, title
FROM song_history
WHERE added_by = ?
ORDER BY played_at DESC
LIMIT 50
```

4. **User's Favorite Rooms:**
```sql
SELECT r.id, r.name, r.slug, COUNT(DISTINCT s.id) as song_count
FROM rooms r
JOIN room_members rm ON r.id = rm.room_id
LEFT JOIN songs s ON s.room_id = r.id AND s.added_by = ?
WHERE rm.user_id = ?
GROUP BY r.id
ORDER BY song_count DESC
LIMIT 5
```

5. **Trending Songs:**
```sql
SELECT youtube_id, channel_name, title, thumbnail, duration,
       AVG(s.vote_score) as avg_vote_score,
       COUNT(*) as play_count
FROM songs s
GROUP BY youtube_id, channel_name, title, thumbnail, duration
HAVING play_count >= ?
ORDER BY avg_vote_score DESC, play_count DESC
LIMIT ?
```

## Performance Considerations

1. **Database Indexes:**
   - `idx_songs_room` on songs(room_id)
   - `idx_songs_vote` on songs(room_id, vote_score DESC)
   - `idx_history_room` on song_history(room_id)
   - Existing indexes support recommendation queries

2. **Query Optimization:**
   - Limits result sets (LIMIT 10-50)
   - Uses aggregated queries where possible
   - Filters early to reduce data transfer

3. **Caching Opportunities:**
   - Trending recommendations can be cached (TTL: 5-10 minutes)
   - User recommendations can be cached (TTL: 15-30 minutes)
   - Invalidate cache on song/vote changes

## Security

1. **SQL Injection Prevention:**
   - All queries use prepared statements
   - Parameters are properly bound
   - No string concatenation in SQL

2. **Authentication:**
   - JWT verification on protected endpoints
   - User exists and is not banned checks
   - Admin role verification for sensitive operations

3. **Authorization:**
   - Users can only access their own recommendations
   - Admins can access any user's recommendations
   - Room access considered for room-based scoring

4. **Input Validation:**
   - Limit parameters clamped to safe ranges
   - User ID validation
   - Type checking on all inputs

## Future Enhancements

1. **Collaborative Filtering**
   - Find users with similar taste
   - Recommend songs they liked
   - Improve cold-start problem

2. **Content-Based Analysis**
   - Analyze song metadata (title, channel, duration)
   - Extract patterns from listening history
   - Genre classification

3. **Machine Learning**
   - Train model on user interactions
   - Predict user preferences
   - Real-time personalization

4. **Real-time Updates**
   - Push recommendations via Socket.IO
   - Update on song play/vote
   - Dynamic scoring

5. **A/B Testing**
   - Test different weightings
   - Compare recommendation strategies
   - Measure user engagement

## Monitoring and Analytics

### Activity Logging

Recommendation views are logged to `activity_log` table:

```sql
INSERT INTO activity_log (id, room_id, user_id, action_type, metadata)
VALUES (?, NULL, ?, 'recommendations_view', ?)
```

Metadata includes:
- `count` - Number of recommendations returned
- `limit` - User's requested limit

### Metrics to Track

1. Recommendation click-through rate
2. Time spent on recommendations
3. Songs added from recommendations
4. User satisfaction feedback
5. Algorithm performance (response time)

## Files

- `src/services/recommendations.js` - Core recommendation algorithm
- `src/routes/recommendations.js` - API endpoints
- `src/middlewares/auth.js` - JWT authentication middleware
- `src/config/database.js` - Database connection and schema

## Testing

To test the recommendation system:

1. Ensure database has users, rooms, and songs
2. Run: `node src/testRealRecommendations.js` (if test file exists)
3. Or make API calls to the endpoints:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3001/api/recommendations
   ```
