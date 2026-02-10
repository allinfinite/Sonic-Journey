/**
 * TransportBar - Play/pause/stop controls with time display
 */

import { useJourneyStore } from '../../stores/journeyStore';
import { synthEngine } from '../../audio/SynthEngine';

export function TransportBar() {
  const {
    journey,
    isPlaying,
    isPaused,
    currentTime,
    play,
    pause,
    stop,
    seek,
    setShowExportDialog,
  } = useJourneyStore();

  const totalDuration = journey.duration_minutes * 60;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    // Initialize on first interaction
    synthEngine.init();
    
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * totalDuration;
    seek(Math.max(0, Math.min(newTime, totalDuration)));
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-3 sm:gap-4">
      {/* Transport buttons */}
      <div className="flex items-center gap-2">
        {/* Stop button */}
        <button
          onClick={stop}
          className="w-10 h-10 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-light)]/80 flex items-center justify-center transition-colors"
          title="Stop"
        >
          <svg className="w-5 h-5 text-[var(--color-text)]" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Play/Pause button */}
        <button
          onClick={handlePlayPause}
          className="w-12 h-12 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] flex items-center justify-center transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Time display */}
      <div className="text-sm font-mono text-[var(--color-text-muted)] min-w-24">
        <span className="text-[var(--color-text)]">{formatTime(currentTime)}</span>
        <span className="mx-1">/</span>
        <span>{formatTime(totalDuration)}</span>
      </div>

      {/* Progress bar */}
      <div
        className="flex-1 h-2 bg-[var(--color-surface-light)] rounded-full cursor-pointer overflow-hidden"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isPlaying && (
          <span className="flex items-center gap-1.5 text-[var(--color-success)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
            Playing
          </span>
        )}
        {isPaused && (
          <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
            Paused
          </span>
        )}
        {!isPlaying && !isPaused && (
          <span className="text-[var(--color-text-muted)]">Ready</span>
        )}
      </div>

      {/* Export button */}
      <button
        onClick={() => setShowExportDialog(true)}
        className="px-4 py-2 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-primary)] text-[var(--color-text)] text-sm font-medium transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
      </button>
    </div>
  );
}
