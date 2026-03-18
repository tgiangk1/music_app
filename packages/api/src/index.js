import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';

import { initDatabase } from './config/database.js';
import './config/passport.js';
import { initSocketIO } from './services/socket.js';

import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import songRoutes from './routes/songs.js';
import playerRoutes from './routes/player.js';
import userRoutes from './routes/users.js';
import youtubeRoutes from './routes/youtube.js';
import socialRoutes from './routes/social.js';
import lyricsRoutes from './routes/lyrics.js';
import playlistRoutes from './routes/playlists.js';
import exploreRoutes from './routes/explore.js';
import profileRoutes from './routes/profile.js';
import ogRoutes from './routes/og.js';
import gamificationRoutes from './routes/gamification.js';

const app = express();
const server = createServer(app);

// Init database
initDatabase();

// Init Socket.IO
const io = initSocketIO(server);
app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', songRoutes);
app.use('/api/rooms', playerRoutes);
app.use('/api/rooms', socialRoutes);
app.use('/api/users', userRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/lyrics', lyricsRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/og', ogRoutes);
app.use('/api/gamification', gamificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎵 SoundDen API running on port ${PORT}`);

  // Background: backfill song_history duration=0
  (async () => {
    try {
      const { getDb } = await import('./config/database.js');
      const { fetchVideoMetadata } = await import('./services/youtube.js');
      const db = getDb();
      const zeroDuration = db.prepare('SELECT DISTINCT youtube_id FROM song_history WHERE duration = 0 OR duration IS NULL').all();
      if (zeroDuration.length === 0) return;
      console.log(`🔧 Backfilling duration for ${zeroDuration.length} songs...`);
      let fixed = 0;
      for (const { youtube_id } of zeroDuration) {
        try {
          const meta = await fetchVideoMetadata(youtube_id);
          if (meta?.duration) {
            db.prepare('UPDATE song_history SET duration = ? WHERE youtube_id = ? AND (duration = 0 OR duration IS NULL)').run(meta.duration, youtube_id);
            fixed++;
          }
        } catch (e) { /* skip */ }
      }
      console.log(`✅ Backfilled duration for ${fixed}/${zeroDuration.length} songs`);
    } catch (e) { console.error('Backfill error:', e.message); }
  })();
});

export default app;
