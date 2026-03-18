import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'jukebox.db');

let db;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations();
  console.log('✅ Database initialized at', DB_PATH);
  return db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'member',
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      cover_color TEXT DEFAULT '#8b5cf6',
      is_public INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      youtube_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbnail TEXT,
      duration INTEGER,
      channel_name TEXT,
      added_by TEXT NOT NULL,
      vote_score INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      is_playing INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS votes (
      song_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (song_id, user_id),
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_songs_room ON songs(room_id);
    CREATE INDEX IF NOT EXISTS idx_songs_vote ON songs(room_id, vote_score DESC);
    CREATE INDEX IF NOT EXISTS idx_room_members ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS song_history (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      youtube_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbnail TEXT,
      duration INTEGER,
      channel_name TEXT,
      added_by TEXT NOT NULL,
      played_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_history_room ON song_history(room_id);
    CREATE INDEX IF NOT EXISTS idx_history_played ON song_history(room_id, played_at DESC);
  `);
  try { db.exec(`ALTER TABLE rooms ADD COLUMN song_limit INTEGER DEFAULT 0`); } catch (e) { }
  try { db.exec(`ALTER TABLE rooms ADD COLUMN room_password TEXT`); } catch (e) { }
  try { db.exec(`ALTER TABLE room_members ADD COLUMN password_verified_at TEXT`); } catch (e) { }
  try { db.exec(`ALTER TABLE room_members ADD COLUMN room_role TEXT DEFAULT 'listener'`); } catch (e) { }
  try { db.exec(`ALTER TABLE rooms ADD COLUMN room_icon TEXT DEFAULT '🎵'`); } catch (e) { }
  try { db.exec(`ALTER TABLE rooms ADD COLUMN autoplay_enabled INTEGER DEFAULT 1`); } catch (e) { }
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      song_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id, created_at DESC);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT,
      action_type TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_activity_room ON activity_log(room_id, created_at DESC);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      song_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      youtube_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbnail TEXT,
      duration INTEGER,
      channel_name TEXT,
      position INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_songs ON playlist_songs(playlist_id, position);
  `);

  // Feature: Discover & Share
  try { db.exec(`ALTER TABLE rooms ADD COLUMN genre TEXT`); } catch (e) { }
  try { db.exec(`ALTER TABLE rooms ADD COLUMN tags TEXT`); } catch (e) { }
  try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT`); } catch (e) { }
  try { db.exec(`ALTER TABLE users ADD COLUMN favorite_genre TEXT`); } catch (e) { }

  db.exec(`
    CREATE TABLE IF NOT EXISTS room_schedules (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      notify_members INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_room ON room_schedules(room_id, scheduled_at);
  `);
}
