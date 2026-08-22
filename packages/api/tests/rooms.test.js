import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.SESSION_SECRET = 'test-session-secret';

vi.mock('../src/services/youtube.js', () => ({
  fetchVideoMetadata: vi.fn(async (idOrUrl) => {
    const videoId = String(idOrUrl).replace(/.*v=/, '').replace(/.*youtu\.be\//, '').slice(0, 11);
    return {
      videoId,
      title: `Mock Video ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 180,
      channelName: 'Mock Channel',
    };
  }),
}));

const { initDatabase, getDb } = await import('../src/config/database.js');
const { default: songRoutes } = await import('../src/routes/songs.js');
const { default: socialRoutes } = await import('../src/routes/social.js');
const { default: suggestionRoutes } = await import('../src/routes/suggestions.js');

let app;
let db;
const tokens = {};

beforeAll(async () => {
  db = initDatabase();

  const users = [
    { id: 'user-1', google_id: 'g1', email: 'u1@test.com', display_name: 'Alice' },
    { id: 'user-2', google_id: 'g2', email: 'u2@test.com', display_name: 'Bob' },
  ];
  for (const u of users) {
    db.prepare('INSERT INTO users (id, google_id, email, display_name) VALUES (?, ?, ?, ?)').run(u.id, u.google_id, u.email, u.display_name);
    tokens[u.id] = jwt.sign({ userId: u.id }, process.env.JWT_SECRET);
  }

  db.prepare('INSERT INTO rooms (id, name, slug, created_by) VALUES (?, ?, ?, ?)').run('room-1', 'Test Room', 'test-room', 'user-1');

  app = express();
  app.use(express.json());
  app.use('/api/rooms', songRoutes);
  app.use('/api/rooms', socialRoutes);
  app.use('/api/rooms', suggestionRoutes);
});

afterAll(() => {
  db?.close();
});

describe('Queue API', () => {
  it('returns 401 when adding a song without a token', async () => {
    const res = await request(app).post('/api/rooms/test-room/songs').send({ videoId: 'vid12345678' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app).get('/api/rooms/nope/songs').set('Authorization', `Bearer ${tokens['user-1']}`);
    expect(res.status).toBe(404);
  });

  it('adds a song by videoId and returns the queue', async () => {
    const res = await request(app)
      .post('/api/rooms/test-room/songs')
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ videoId: 'aaaaaaaaaaa', title: 'First Song' });
    expect(res.status).toBe(201);
    // Background metadata enrichment may overwrite title asynchronously
    expect(res.body.song.youtube_id).toBe('aaaaaaaaaaa');
    expect(res.body.song.is_playing).toBe(1);

    const queue = await request(app).get('/api/rooms/test-room/songs');
    expect(queue.status).toBe(200);
    expect(queue.body.songs).toHaveLength(1);
  });

  it('rejects duplicate songs in queue with 409', async () => {
    const res = await request(app)
      .post('/api/rooms/test-room/songs')
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ videoId: 'aaaaaaaaaaa', title: 'First Song' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_IN_QUEUE');
  });

  it('blocks videos blocked in the room with 403 SONG_BLOCKED', async () => {
    db.prepare(`INSERT INTO room_blocklist (id, room_id, type, value, title, added_by) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('blk-1', 'room-1', 'video', 'blocked1111', 'Bad Video', 'user-1');

    const res = await request(app)
      .post('/api/rooms/test-room/songs')
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ videoId: 'blocked1111', title: 'Bad Video' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SONG_BLOCKED');
  });
});

describe('Voting API', () => {
  let songA;
  let songB;

  beforeAll(async () => {
    const addB = await request(app)
      .post('/api/rooms/test-room/songs')
      .set('Authorization', `Bearer ${tokens['user-2']}`)
      .send({ videoId: 'bbbbbbbbbbb', title: 'Song B' });
    songB = addB.body.song;

    const queue = await request(app).get('/api/rooms/test-room/songs');
    songA = queue.body.songs.find(s => s.youtube_id === 'aaaaaaaaaaa');
  });

  it('rejects invalid vote type with 400', async () => {
    const res = await request(app)
      .post(`/api/rooms/test-room/songs/${songA.id}/vote`)
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ type: 'sideways' });
    expect(res.status).toBe(400);
  });

  it('upvote increases score and records my_vote', async () => {
    const res = await request(app)
      .post(`/api/rooms/test-room/songs/${songB.id}/vote`)
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ type: 'up' });
    expect(res.status).toBe(200);
    expect(res.body.song.vote_score).toBe(1);
    expect(res.body.song.my_vote).toBe('up');
  });

  it('voting up again toggles off back to score 0', async () => {
    const res = await request(app)
      .post(`/api/rooms/test-room/songs/${songB.id}/vote`)
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ type: 'up' });
    expect(res.status).toBe(200);
    expect(res.body.song.vote_score).toBe(0);
    expect(res.body.song.my_vote).toBeNull();
  });

  it('switching from down to up changes score by +2', async () => {
    await request(app).post(`/api/rooms/test-room/songs/${songB.id}/vote`).set('Authorization', `Bearer ${tokens['user-1']}`).send({ type: 'down' });
    const res = await request(app).post(`/api/rooms/test-room/songs/${songB.id}/vote`).set('Authorization', `Bearer ${tokens['user-1']}`).send({ type: 'up' });
    expect(res.body.song.vote_score).toBe(1);
  });

  it('orders the queue by vote_score DESC before position', async () => {
    // songB has +1; add another song C at a later position with no votes
    await request(app).post('/api/rooms/test-room/songs').set('Authorization', `Bearer ${tokens['user-1']}`).send({ videoId: 'ccccccccccc', title: 'Song C' });

    const queue = await request(app).get('/api/rooms/test-room/songs');
    const ids = queue.body.songs.map(s => s.youtube_id);
    expect(ids.indexOf('bbbbbbbbbbb')).toBeLessThan(ids.indexOf('ccccccccccc'));
  });
});

describe('Suggestions API', () => {
  it('requires auth to suggest', async () => {
    const res = await request(app).post('/api/rooms/test-room/suggestions').send({ videoId: 'ddddddddddd' });
    expect(res.status).toBe(401);
  });

  it('creates a suggestion with an implicit self-vote', async () => {
    const res = await request(app)
      .post('/api/rooms/test-room/suggestions')
      .set('Authorization', `Bearer ${tokens['user-1']}`)
      .send({ videoId: 'ddddddddddd', title: 'Suggested Song' });
    expect(res.status).toBe(201);
    expect(res.body.suggestion.vote_count).toBe(1);
    expect(res.body.suggestion.my_vote).toBe(1);
  });

  it('rejects duplicate suggestions with 409', async () => {
    const res = await request(app)
      .post('/api/rooms/test-room/suggestions')
      .set('Authorization', `Bearer ${tokens['user-2']}`)
      .send({ videoId: 'ddddddddddd' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_SUGGESTION');
  });

  it('auto-moves suggestion into the queue at the vote threshold', async () => {
    // Second user votes → threshold (2) reached
    const list = await request(app).get('/api/rooms/test-room/suggestions');
    const suggestion = list.body.suggestions.find(s => s.youtube_id === 'ddddddddddd');
    expect(suggestion).toBeTruthy();

    const vote = await request(app)
      .post(`/api/rooms/test-room/suggestions/${suggestion.id}/vote`)
      .set('Authorization', `Bearer ${tokens['user-2']}`);
    expect(vote.status).toBe(200);
    expect(vote.body.movedToQueue).toBe(true);
    expect(vote.body.suggestions.find(s => s.id === suggestion.id)).toBeUndefined();

    const queue = await request(app).get('/api/rooms/test-room/songs');
    expect(queue.body.songs.some(s => s.youtube_id === 'ddddddddddd')).toBe(true);
  });
});

describe('Social API', () => {
  beforeAll(async () => {
    db.prepare(`INSERT INTO song_history (id, room_id, youtube_id, title, thumbnail, duration, channel_name, added_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('hist-1', 'room-1', 'aaaaaaaaaaa', 'First Song', '', 180, 'Mock Channel', 'user-1');
  });

  it('returns leaderboard ordered by weekly contributions', async () => {
    const res = await request(app).get('/api/rooms/test-room/leaderboard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
    expect(res.body.leaderboard.length).toBeGreaterThan(0);
    expect(res.body.leaderboard[0]).toHaveProperty('display_name');
    expect(res.body.leaderboard[0]).toHaveProperty('total_songs');
  });

  it('stats/me requires auth', async () => {
    const res = await request(app).get('/api/rooms/test-room/stats/me');
    expect(res.status).toBe(401);
  });

  it('stats/me returns personal counters for the current user', async () => {
    const res = await request(app).get('/api/rooms/test-room/stats/me').set('Authorization', `Bearer ${tokens['user-1']}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      songsTotal: expect.any(Number),
      songsInQueue: expect.any(Number),
      messageCount: expect.any(Number),
    });
  });
});
