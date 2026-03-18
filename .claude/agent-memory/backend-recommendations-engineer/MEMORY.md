# Backend Recommendations Engineer - Agent Memory

## Project Architecture

### Technology Stack
- **Framework:** Express.js with ES6 modules
- **Database:** better-sqlite3 (synchronous, WAL mode enabled)
- **Authentication:** JWT (access + refresh tokens) + Passport Google OAuth 2.0
- **Real-time:** Socket.IO with namespace-based rooms (`/room/:slug`)
- **Security:** Helmet, CORS, Morgan for logging

### Database Schema (SQLite)

**Core Tables:**
- `users` - User profiles with Google OAuth integration
- `rooms` - Music rooms with public/private settings
- `room_members` - Room membership tracking
- `songs` - Current queue songs with voting
- `votes` - User upvotes/downvotes on songs
- `song_history` - Previously played songs (queue history)
- `refresh_tokens` - JWT refresh token storage

**Phase 3+ Tables:**
- `chat_messages` - Room chat functionality
- `activity_log` - User activity tracking
- `playlists` - User playlists
- `playlist_songs` - Playlist contents
- `room_schedules` - Scheduled events
- `room_notifications` - Room notifications
- `room_blocklist` - Blocked channels/videos
- `room_integrations` - Third-party integrations (Slack)

### Code Organization

```
packages/api/src/
├── config/
│   ├── database.js     # Database connection and migrations
│   └── passport.js    # Passport Google OAuth config
├── middlewares/
│   ├── auth.js        # JWT verification middleware
│   └── role.js        # Role-based access control
├── routes/
│   ├── auth.js        # Authentication endpoints
│   ├── rooms.js       # Room CRUD operations
│   ├── songs.js       # Song queue management
│   ├── player.js      # Player state sync
│   ├── users.js       # User management (admin)
│   ├── youtube.js     # YouTube API integration
│   ├── social.js      # Social features
│   ├── playlists.js   # Playlist management
│   ├── schedules.js   # Room scheduling
│   ├── notifications.js # Notification management
│   ├── blocklist.js   # Room blocklist management
│   ├── integrations.js # Third-party integrations
│   └── recommendations.js # Song recommendations
├── services/
│   ├── socket.js      # Socket.IO initialization and event handlers
│   ├── youtube.js     # YouTube metadata fetching
│   ├── scheduler.js   # Cron job scheduling
│   ├── slack.js       # Slack integration
│   └── recommendations.js # Recommendation algorithm
└── index.js          # Main application entry point
```

## Code Patterns

### Route Pattern

```javascript
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET endpoint with authentication
router.get('/', verifyToken, (req, res) => {
    const db = getDb();
    const userId = req.user.userId;

    // Validate input
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit) || 10));

    // Database query (prepared statement)
    const results = db.prepare('SELECT * FROM table WHERE user_id = ?').all(userId);

    res.json({ results });
});

export default router;
```

### Service Pattern

```javascript
import { getDb } from '../config/database.js';

export function serviceFunction(param) {
    const db = getDb();

    // Business logic
    const data = db.prepare('SELECT * FROM table WHERE col = ?').get(param);

    return processedData;
}

// Helper functions are also exported
export function helperFunction() {
    // Implementation
}
```

### Database Query Pattern

**CRITICAL: Always use prepared statements to prevent SQL injection**

```javascript
// ✅ CORRECT - Prepared statement with parameter binding
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ WRONG - SQL injection vulnerability
const user = db.exec(`SELECT * FROM users WHERE id = ${userId}`).get();

// ✅ CORRECT - Multiple parameters
const results = db.prepare('SELECT * FROM songs WHERE room_id = ? AND added_by = ?').all(roomId, userId);

// ✅ CORRECT - IN clause with parameterization
const ids = [...arrayOfIds];
const placeholders = ids.map(() => '?').join(',');
const results = db.prepare(`SELECT * FROM songs WHERE id IN (${placeholders})`).all(...ids);
```

### Error Handling Pattern

```javascript
try {
    // Validate input
    if (!input) {
        return res.status(400).json({ error: 'Input is required' });
    }

    // Business logic
    const result = processInput(input);

    // Success response
    res.status(201).json({ result });
} catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to process request' });
}
```

### Socket.IO Pattern

```javascript
import { getDb } from '../config/database.js';
import jwt from 'jsonwebtoken';

export function initSocketIO(server) {
    const io = new Server(server, { cors: { origin: CLIENT_URL } });

    const roomNsp = io.of(/^\/room\/[\w-]+$/);

    // Authentication middleware
    roomNsp.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
            if (!user) return next(new Error('User not found'));

            socket.user = {
                userId: user.id,
                displayName: user.display_name,
                // ... other user data
            };
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    // Connection handler
    roomNsp.on('connection', (socket) => {
        // Handle events
        socket.on('event:name', (data) => {
            // Process and emit
            socket.nsp.emit('event:result', result);
        });
    });

    return io;
}
```

## Security Best Practices

### 1. SQL Injection Prevention
- ALWAYS use prepared statements with parameterized queries
- NEVER concatenate user input into SQL strings
- Validate and sanitize all inputs before database operations

### 2. JWT Authentication
- Verify JWT middleware on all protected routes
- Access tokens: 15-30 minutes (short-lived)
- Refresh tokens: Secure storage with rotation
- Check user exists and is not banned on each request

### 3. Role-Based Access Control
- Use `requireAdmin` for admin-only endpoints
- Use `requireRoomOwnerOrAdmin` for room owner/admin operations
- Users can only access their own resources by default

### 4. Input Validation
- Clamp numeric parameters to safe ranges
- Validate UUID format
- Check required fields
- Sanitize string inputs (trim, length limits)

### 5. CORS Configuration
- Restrict to specific origin (CLIENT_URL)
- Enable credentials for cookie-based auth

## Performance Considerations

### Database Optimization
- Use WAL mode for better concurrency
- Set appropriate indexes on frequently queried columns
- Use transactions for multi-step operations
- LIMIT large result sets

### Memory Management
- Clean up Socket.IO listeners on disconnect
- Remove from in-memory maps when rooms/users deleted
- Use debouncing for frequent operations

### Caching Opportunities
- Trending recommendations (5-10 minute TTL)
- User recommendations (15-30 minute TTL)
- Room metadata (1-5 minute TTL)
- Invalidate cache on relevant changes

## Common Issues and Solutions

### 1. SQL Injection
**Problem:** User input concatenated into SQL queries
**Solution:** Always use prepared statements with `db.prepare().bind()`

### 2. Token Validation
**Problem:** Expired or invalid tokens cause crashes
**Solution:** Wrap JWT verification in try-catch, return appropriate error

### 3. Memory Leaks
**Problem:** Socket.IO event listeners not removed
**Solution:** Clean up on disconnect, use Map/Set for tracking, remove on delete

### 4. Race Conditions
**Problem:** Multiple clients triggering same event
**Solution:** Use debouncing (e.g., 3-second lock for player:ended events)

### 5. Database Locks
**Problem:** WAL mode not enabled, causing write locks
**Solution:** Ensure `db.pragma('journal_mode = WAL')` is called

## Recommendation System Implementation

### Algorithm Overview

1. **Analyze User Activity**
   - Get user's added songs
   - Get user's vote history
   - Get user's played history
   - Get user's favorite rooms

2. **Score Songs (Weighted)**
   - Channel preference: 40% (favorite channels from added songs)
   - Vote patterns: 30% (channels user upvoted)
   - Room activity: 30% (popular in user's rooms)

3. **Filter and Rank**
   - Remove already played/added songs
   - Sort by total score (descending)
   - Return top 10 with reasons

4. **Fallback**
   - No activity → Return trending
   - No personalized results → Return trending
   - Limited data → Adjust thresholds

### Key Functions

- `generateRecommendations(userId)` - Main recommendation generator
- `getUserActivity(db, userId)` - Analyze user behavior
- `scoreByUserSongs(db, userSongs, songScores, weight)` - Channel-based scoring
- `scoreByUserVotes(db, userId, songScores, weight)` - Vote-based scoring
- `scoreByRoomActivity(db, userId, songScores, weight)` - Room-based scoring
- `getTrendingRecommendations(db)` - Fallback trending songs

### API Endpoints

- `GET /api/recommendations` - Get user's recommendations (auth required)
- `GET /api/recommendations/:userId` - Get specific user's (admin/self)
- `GET /api/recommendations/trending` - Get trending songs (no auth)

## Testing Commands

### Check Database
```bash
cd packages/api
node src/checkData.js  # If test file exists
```

### Test Recommendations
```bash
cd packages/api
node src/testRealRecommendations.js  # If test file exists
```

### Start Server
```bash
cd packages/api
npm run dev  # Development with --watch
npm start    # Production
```

## File Paths

- Database: `packages/api/data/jukebox.db`
- Main entry: `packages/api/src/index.js`
- Routes: `packages/api/src/routes/*.js`
- Services: `packages/api/src/services/*.js`
- Middleware: `packages/api/src/middlewares/*.js`
- Config: `packages/api/src/config/*.js`

## Important Notes

- Better-sqlite3 is synchronous (no async/await needed for DB)
- Socket.IO namespaces: `/room/:slug` for room-specific communication
- JWT secret in `process.env.JWT_SECRET`
- All timestamps in ISO format strings (SQLite)
- UUIDs generated with `v4 as uuidv4`
- Room slugs are URL-friendly identifiers
- Songs use YouTube video IDs as identifiers
