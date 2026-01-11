/**
 * BassPreview - Audio preview and export controls
 * Playback controls with original/bass/mixed toggle and export options
 */

import { useCallback, useRef, useEffect } from 'react';
import { useBassStore } from '../../stores/bassStore';
import type { PreviewMode } from '../../types/bassGenerator';

export function BassPreview() {
  const {
    previewMode,
    isPlaying,
    currentTime,
    analysisResult,
    bassBuffer,
    mixedBuffer,
    originalBuffer,
    exportOptions,
    isExporting,
    setPreviewMode,
    play,
    pause,
    stop,
    seek,
    setExportOptions,
    exportAudio,
  } = useBassStore();

  const progressRef = useRef<HTMLDivElement>(null);

  // Get duration from analysis result
  const duration = analysisResult?.duration || 0;

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    seek(newTime);
  }, [duration, seek]);

  // Handle mode change
  const handleModeChange = useCallback((mode: PreviewMode) => {
    setPreviewMode(mode);
  }, [setPreviewMode]);

  // Handle export
  const handleExport = useCallback(async (bassOnly: boolean) => {
    const blob = await exportAudio(bassOnly);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bassOnly ? 'bass-track.wav' : 'mixed-audio.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [exportAudio]);

  // Check if buffers are available
  const hasOriginal = !!originalBuffer;
  const hasBass = !!bassBuffer;
  const hasMixed = !!mixedBuffer;

  // Update progress bar width
  useEffect(() => {
    if (progressRef.current) {
      const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
      progressRef.current.style.width = `${percent}%`;
    }
  }, [currentTime, duration]);

  return (
    <div className="bass-preview">
      {/* Preview Mode Selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${previewMode === 'original' ? 'active' : ''}`}
          onClick={() => handleModeChange('original')}
          disabled={!hasOriginal}
        >
          Original
        </button>
        <button
          className={`mode-btn ${previewMode === 'bass' ? 'active' : ''}`}
          onClick={() => handleModeChange('bass')}
          disabled={!hasBass}
        >
          Bass Only
        </button>
        <button
          className={`mode-btn ${previewMode === 'mixed' ? 'active' : ''}`}
          onClick={() => handleModeChange('mixed')}
          disabled={!hasMixed}
        >
          Mixed
        </button>
      </div>

      {/* Progress Bar */}
      <div className="progress-container" onClick={handleProgressClick}>
        <div className="progress-track">
          <div ref={progressRef} className="progress-fill" />
        </div>
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="playback-controls">
        <button className="control-btn" onClick={stop} title="Stop">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
        
        <button 
          className="control-btn play-btn" 
          onClick={isPlaying ? pause : play}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        <div className="spacer" />

        {/* Export Options */}
        <div className="export-options">
          <select
            value={exportOptions.format}
            onChange={(e) => setExportOptions({ format: e.target.value as 'wav' | 'mp3' })}
            className="format-select"
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="export-buttons">
        <button
          className="export-btn"
          onClick={() => handleExport(true)}
          disabled={!hasBass || isExporting}
        >
          {isExporting ? (
            <div className="spinner-small" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          Export Bass Track
        </button>
        <button
          className="export-btn export-btn-primary"
          onClick={() => handleExport(false)}
          disabled={!hasMixed || isExporting}
        >
          {isExporting ? (
            <div className="spinner-small" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          Export Mixed Audio
        </button>
      </div>

      <style>{`
        .bass-preview {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .mode-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .mode-btn {
          flex: 1;
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          background: var(--color-surface-light);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn:hover:not(:disabled) {
          background: var(--color-surface-light);
          color: var(--color-text);
        }

        .mode-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .progress-container {
          cursor: pointer;
          margin-bottom: 1rem;
        }

        .progress-track {
          height: 8px;
          background: var(--color-surface-light);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
          border-radius: 4px;
          width: 0%;
          transition: width 0.1s linear;
        }

        .time-display {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .playback-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .control-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--color-surface-light);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .play-btn {
          width: 52px;
          height: 52px;
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .play-btn:hover {
          background: var(--color-accent);
          border-color: var(--color-accent);
          transform: scale(1.05);
        }

        .spacer {
          flex: 1;
        }

        .export-options {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .format-select {
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          background: var(--color-surface-light);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          cursor: pointer;
        }

        .format-select:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .export-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          font-weight: 500;
          background: var(--color-surface-light);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-btn:hover:not(:disabled) {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .export-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .export-btn-primary {
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          color: white;
          border: none;
        }

        .export-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 500px) {
          .export-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
