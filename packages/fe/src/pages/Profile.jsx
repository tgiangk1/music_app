import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeSwitcher from '../components/ThemeSwitcher';
import api from '../lib/api';
import toast from 'react-hot-toast';

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [topSongs, setTopSongs] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editGenre, setEditGenre] = useState('');

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/api/profile/${userId}`);
      setProfile(res.data.profile);
      setStats(res.data.stats);
      setTopSongs(res.data.topSongs);
      setTopArtists(res.data.topArtists);
      setRecentSongs(res.data.recentSongs);
      setEditBio(res.data.profile.bio || '');
      setEditGenre(res.data.profile.favoriteGenre || '');
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const res = await api.patch('/api/profile', {
        bio: editBio,
        favoriteGenre: editGenre,
      });
      setProfile(res.data.profile);
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold mb-2">User not found</h2>
          <Link to="/" className="text-primary hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
              </svg>
            </div>
            <h1 className="font-display text-xl font-bold">Antigravity <span className="text-primary">Jukebox</span></h1>
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header */}
        <div className="glass-card p-8 mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <img
              src={profile.avatar}
              alt={profile.displayName}
              className="w-24 h-24 rounded-2xl border-2 border-border shadow-xl"
              referrerPolicy="no-referrer"
            />
            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-3 justify-center sm:justify-start mb-1">
                <h2 className="font-display text-2xl font-bold">{profile.displayName}</h2>
                {profile.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium">Admin</span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 mt-3">
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="input-field w-full resize-none text-sm"
                    rows={3}
                    placeholder="Tell us about your music taste..."
                    maxLength={500}
                  />
                  <input
                    type="text"
                    value={editGenre}
                    onChange={(e) => setEditGenre(e.target.value)}
                    className="input-field w-full text-sm"
                    placeholder="Favorite genre (e.g., Lo-fi, Jazz, EDM)"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} className="btn-primary text-sm">Save</button>
                    <button onClick={() => setIsEditing(false)} className="btn-ghost text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {profile.bio && <p className="text-text-secondary text-sm mb-2">{profile.bio}</p>}
                  {profile.favoriteGenre && (
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
                      🎵 {profile.favoriteGenre}
                    </span>
                  )}
                  <p className="text-text-muted text-xs">
                    Joined {new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  {isOwnProfile && (
                    <button onClick={() => setIsEditing(true)} className="btn-ghost text-xs mt-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                      Edit Profile
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Songs Added', value: stats.songsAdded, icon: '🎵' },
            { label: 'Listening Time', value: formatDuration(stats.totalListeningTime), icon: '⏱️' },
            { label: 'Rooms Joined', value: stats.roomsJoined, icon: '🏠' },
            { label: 'Unique Artists', value: stats.uniqueArtists, icon: '🎤' },
          ].map((stat, i) => (
            <div key={stat.label} className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <p className="font-display text-xl font-bold text-text-primary">{stat.value}</p>
              <p className="text-text-muted text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Songs */}
          <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              🏆 Top Songs
            </h3>
            {topSongs.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">No songs yet</p>
            ) : (
              <div className="space-y-3">
                {topSongs.map((song, i) => (
                  <div key={song.youtube_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors">
                    <span className="text-text-muted text-sm font-mono w-5 text-right">#{i + 1}</span>
                    <img
                      src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id}/default.jpg`}
                      alt=""
                      className="w-12 h-8 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs text-text-muted">{song.channel_name}</p>
                    </div>
                    <span className="text-xs text-text-secondary bg-card px-2 py-1 rounded-full">
                      {song.play_count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Artists */}
          <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              🎤 Favorite Artists
            </h3>
            {topArtists.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">No artists yet</p>
            ) : (
              <div className="space-y-3">
                {topArtists.map((artist, i) => (
                  <div key={artist.channel_name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors">
                    <span className="text-text-muted text-sm font-mono w-5 text-right">#{i + 1}</span>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🎵</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{artist.channel_name}</p>
                    </div>
                    <span className="text-xs text-text-secondary bg-card px-2 py-1 rounded-full">
                      {artist.song_count} songs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        {recentSongs.length > 0 && (
          <div className="glass-card p-5 mt-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              🕐 Recent Activity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recentSongs.map((song) => (
                <div key={`${song.youtube_id}-${song.played_at}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors">
                  <img
                    src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id}/default.jpg`}
                    alt=""
                    className="w-10 h-7 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{song.title}</p>
                    <p className="text-[10px] text-text-muted">
                      {new Date(song.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
