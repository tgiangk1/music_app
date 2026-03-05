# Antigravity Jukebox 🎵

A real-time collaborative music listening app for teams. Each team gets their own room with an independent queue, YouTube player, and real-time sync via Socket.IO.

## Features

- 🔐 **Google OAuth** — login with your company Google account
- 🏠 **Room System** — public/private rooms per team with independent queues
- 🎶 **YouTube Playback** — paste a URL, fetch metadata, play it
- 🗳️ **Voting** — upvote/downvote to reorder the queue
- ⚡ **Real-time Sync** — player state syncs across all browsers in a room
- 👑 **Admin Controls** — skip songs, clear queue, manage users, ban/unban

## Tech Stack

| Layer    | Tech                                       |
|----------|---------------------------------------------|
| Backend  | Express, Socket.IO, better-sqlite3, Passport |
| Frontend | React, Vite, Tailwind, Zustand, react-youtube |
| Auth     | Google OAuth 2.0, JWT (access + refresh)     |
| Realtime | Socket.IO namespaces per room                |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your Google OAuth credentials

# 3. Run development
npm run dev
```

The API runs on `http://localhost:3001` and the frontend on `http://localhost:5173`.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Set authorized redirect URI to `http://localhost:3001/auth/google/callback`
6. Copy Client ID and Client Secret to `packages/api/.env`

## Environment Variables

See `.env.example` for all required variables.
