import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeSwitcher from '../components/ThemeSwitcher';
import api from '../lib/api';

const SORT_OPTIONS = [
  { value: 'active', label: '🔥 Most Active' },
  { value: 'popular', label: '⭐ Popular' },
  { value: 'newest', label: '🆕 Newest' },
];

export default function Explore() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [genres, setGenres] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sort, setSort] = useState('active');
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  useEffect(() => {
    api.get('/api/explore/genres').then(res => setGenres(res.data.genres)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [search, selectedGenre, sort]);

  const fetchRooms = async (offset = 0) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedGenre) params.set('genre', selectedGenre);
      params.set('sort', sort);
      params.set('limit', '20');
      params.set('offset', String(offset));

      const res = await api.get(`/api/explore/rooms?${params.toString()}`);
      if (offset === 0) {
        setRooms(res.data.rooms);
      } else {
        setRooms(prev => [...prev, ...res.data.rooms]);
      }
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearch = (value) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {}, 300));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                </svg>
              </div>
              <h1 className="font-display text-xl font-bold">Sound<span className="text-primary">Den</span></h1>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/" className="btn-ghost text-sm">My Rooms</Link>
                <img src={user?.avatar} alt="" className="w-8 h-8 rounded-full border border-border" />
              </>
            ) : (
              <a
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/google`}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Login with Google
              </a>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            Discover <span className="text-primary">Music Rooms</span>
          </h2>
          <p className="text-text-secondary text-lg max-w-lg mx-auto mb-8">
            Join a room and listen to music together with people around the world
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search rooms by name..."
              className="input-field w-full pl-12 pr-4 py-3 text-base"
              id="explore-search"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Genre Chips */}
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => setSelectedGenre('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                !selectedGenre
                  ? 'bg-primary text-white'
                  : 'bg-card hover:bg-card-hover text-text-secondary'
              }`}
            >
              All
            </button>
            {genres.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenre(selectedGenre === g ? '' : g)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedGenre === g
                    ? 'bg-primary text-white'
                    : 'bg-card hover:bg-card-hover text-text-secondary'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-field text-sm py-1.5 px-3 bg-card"
            id="explore-sort"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Room Grid */}
        {isLoading && rooms.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-card flex items-center justify-center">
              <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold text-text-secondary mb-2">No rooms found</h3>
            <p className="text-text-muted text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room, i) => (
                <Link
                  key={room.id}
                  to={`/room/${room.slug}`}
                  className="glass-card-hover p-6 block animate-fade-in group relative overflow-hidden"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Now Playing indicator */}
                  {room.now_playing && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-success animate-pulse" />
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: room.cover_color?.startsWith('linear') ? room.cover_color : `${room.cover_color}20` }}
                    >
                      {room.room_icon || '🎵'}
                    </div>
                    <div className="flex items-center gap-2">
                      {room.online_count > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs">
                          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          {room.online_count} live
                        </span>
                      )}
                      {room.genre && (
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          {room.genre}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-semibold mb-1 text-text-primary group-hover:text-primary transition-colors">
                    {room.name}
                  </h3>
                  {room.description && (
                    <p className="text-text-secondary text-sm mb-3 line-clamp-2">{room.description}</p>
                  )}

                  {/* Now Playing */}
                  {room.now_playing && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-card mb-3">
                      <img
                        src={room.now_playing.thumbnail || `https://img.youtube.com/vi/${room.now_playing.youtubeId}/default.jpg`}
                        alt=""
                        className="w-10 h-7 rounded object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-text-primary truncate">🎵 {room.now_playing.title}</p>
                        <p className="text-[10px] text-text-muted truncate">{room.now_playing.artist}</p>
                      </div>
                      {/* Audio bars animation */}
                      <div className="flex items-end gap-[2px] h-3 flex-shrink-0">
                        <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '0.8s' }} />
                        <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '100%', animationDelay: '200ms', animationDuration: '0.6s' }} />
                        <span className="w-[3px] bg-primary rounded-full animate-bounce" style={{ height: '40%', animationDelay: '400ms', animationDuration: '0.9s' }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                      {room.member_count || 0} members
                    </span>
                    {room.creator_name && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                        </svg>
                        {room.creator_name}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Load More */}
            {pagination.hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => fetchRooms(rooms.length)}
                  className="btn-ghost px-6 py-2 text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load More Rooms'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Stats Footer */}
        <div className="text-center py-8 mt-8 border-t border-border">
          <p className="text-text-muted text-sm">
            {pagination.total} public room{pagination.total !== 1 ? 's' : ''} available
          </p>
        </div>
      </main>
    </div>
  );
}
