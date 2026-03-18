import { useState, useEffect } from 'react';

/**
 * CrossfadeIndicator — Shows visual feedback during song transitions
 * Uses volume fade since YouTube iframe doesn't allow direct audio crossfade
 */
export default function CrossfadeIndicator({ isActive, currentSong, nextSong, fadeProgress }) {
  if (!isActive) return null;

  return (
    <div className="glass-card p-3 animate-fade-in border border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
          <svg className="w-3 h-3 text-primary animate-spin" style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </div>
        <span className="text-xs font-medium text-primary">Crossfading...</span>
      </div>

      {/* Transition visualization */}
      <div className="flex items-center gap-2">
        {/* Current song (fading out) */}
        <div className="flex-1 flex items-center gap-2 min-w-0" style={{ opacity: 1 - (fadeProgress || 0) }}>
          {currentSong && (
            <>
              <img
                src={currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.youtube_id}/default.jpg`}
                alt=""
                className="w-8 h-6 rounded object-cover flex-shrink-0"
              />
              <p className="text-[10px] truncate text-text-muted">{currentSong.title}</p>
            </>
          )}
        </div>

        {/* Transition arrow */}
        <div className="flex-shrink-0 px-1">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </div>

        {/* Next song (fading in) */}
        <div className="flex-1 flex items-center gap-2 min-w-0" style={{ opacity: fadeProgress || 0 }}>
          {nextSong && (
            <>
              <img
                src={nextSong.thumbnail || `https://img.youtube.com/vi/${nextSong.youtube_id}/default.jpg`}
                alt=""
                className="w-8 h-6 rounded object-cover flex-shrink-0"
              />
              <p className="text-[10px] truncate text-text-secondary">{nextSong.title}</p>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-border/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-300"
          style={{ width: `${(fadeProgress || 0) * 100}%` }}
        />
      </div>
    </div>
  );
}
