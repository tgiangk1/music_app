import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const MOODS = [
  { id: 'chill', emoji: '😌', label: 'Chill', color: '#06b6d4' },
  { id: 'party', emoji: '🎉', label: 'Party', color: '#ec4899' },
  { id: 'focus', emoji: '🎯', label: 'Focus', color: '#8b5cf6' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', color: '#f97316' },
];

/**
 * Radio Mode — AI DJ that auto-queues songs when queue is empty
 * Uses existing /api/recommendations endpoint
 */
export default function RadioMode({ slug, isEnabled, onToggle, onAddSong, queueLength }) {
  const [mood, setMood] = useState(() => localStorage.getItem('jukebox_radio_mood') || 'chill');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoAddCooldown, setAutoAddCooldown] = useState(false);

  // Fetch recommendations based on mood
  const fetchSuggestions = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/rooms/${slug}/recommendations`);
      if (res.data?.recommendations) {
        setSuggestions(res.data.recommendations.slice(0, 6));
      }
    } catch (err) {
      console.error('Failed to fetch radio suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (isEnabled) fetchSuggestions();
  }, [isEnabled, fetchSuggestions, mood]);

  // Auto-add song when queue is empty
  useEffect(() => {
    if (!isEnabled || queueLength > 0 || suggestions.length === 0 || autoAddCooldown) return;

    const timer = setTimeout(() => {
      const randomSong = suggestions[Math.floor(Math.random() * suggestions.length)];
      if (randomSong) {
        onAddSong(randomSong);
        toast(`🤖 AI DJ picked: ${randomSong.title}`, {
          icon: '🎵',
          duration: 3000,
          style: { background: '#1e1e2e', color: '#fff', borderRadius: '12px' },
        });
        // Cooldown to prevent spamming
        setAutoAddCooldown(true);
        setTimeout(() => setAutoAddCooldown(false), 15000);
        // Refresh suggestions
        fetchSuggestions();
      }
    }, 3000); // Wait 3s before auto-adding

    return () => clearTimeout(timer);
  }, [isEnabled, queueLength, suggestions, autoAddCooldown, onAddSong, fetchSuggestions]);

  const handleMoodChange = (newMood) => {
    setMood(newMood);
    localStorage.setItem('jukebox_radio_mood', newMood);
  };

  const currentMood = MOODS.find(m => m.id === mood) || MOODS[0];

  return (
    <div className="glass-card p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-primary/20 animate-pulse' : 'bg-card'}`}>
            <svg className={`w-5 h-5 ${isEnabled ? 'text-primary' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5l16.5-4.125M12 6.75c-2.708 0-5.363.224-7.948.655C2.999 7.58 2.25 8.507 2.25 9.574v9.176A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169A48.329 48.329 0 0012 6.75zm-1.683 6.443l-.005.005-.006-.005.006-.005.005.005zm-.005 2.127l-.005-.006.005-.005.005.005-.005.006zm-2.116-.006l-.005.006-.006-.006.005-.005.006.005zm-.005-2.116l-.006-.005.006-.005.005.005-.005.005zM9.255 10.5v.008h-.008V10.5h.008zm3.249 1.88l-.007.004-.003-.007.006-.003.004.006zm-1.128 5.716l-.007.003-.003-.006.006-.003.004.006zm-1.623-2.021l-.007.004-.004-.007.007-.003.004.006zm-1.129-5.715l-.006.004-.004-.007.006-.003.004.006zm1.129 2.021l-.007.004-.004-.007.007-.004.004.007zm6.498-2.021l.007.004.003-.007-.006-.003-.004.006z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Radio Mode</h3>
            <p className="text-[10px] text-text-muted">AI DJ • {currentMood.emoji} {currentMood.label}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isEnabled ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${isEnabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {isEnabled && (
        <>
          {/* Mood Selector */}
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {MOODS.map(m => (
              <button
                key={m.id}
                onClick={() => handleMoodChange(m.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${
                  mood === m.id
                    ? 'bg-primary/15 ring-1 ring-primary/30'
                    : 'hover:bg-card-hover'
                }`}
              >
                <span className="text-lg">{m.emoji}</span>
                <span className="text-[10px] font-medium">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Up Next */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted font-medium">Up Next (AI picks)</p>
              <button
                onClick={fetchSuggestions}
                disabled={isLoading}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {isLoading ? '...' : '↻ Refresh'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {suggestions.length === 0 && !isLoading && (
                <p className="text-text-muted text-xs text-center py-4">No suggestions yet. Play some songs first!</p>
              )}
              {suggestions.map((song, i) => (
                <div
                  key={`${song.youtube_id || song.youtubeId}-${i}`}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-card-hover transition-colors group"
                >
                  <img
                    src={song.thumbnail || `https://img.youtube.com/vi/${song.youtube_id || song.youtubeId}/default.jpg`}
                    alt=""
                    className="w-9 h-6 rounded object-cover flex-shrink-0"
                  />
                  <p className="text-xs truncate flex-1">{song.title}</p>
                  <button
                    onClick={() => {
                      onAddSong(song);
                      toast.success(`Added: ${song.title}`);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-primary text-xs transition-opacity flex-shrink-0"
                  >
                    +Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
