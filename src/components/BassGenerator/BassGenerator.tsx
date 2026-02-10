/**
 * BassGenerator - Real-time bass layer that plays alongside user's music
 * Supports "Manual" mode (user controls) and "Listen" mode (music-reactive via mic)
 */

import { useEffect, useRef } from 'react';
import { useBassLayerStore, BASS_LAYER_PRESETS } from '../../stores/bassLayerStore';
import type { BassLayerMode } from '../../stores/bassLayerStore';
import { BassLayerControls } from './BassControls';
import { KEY_FREQUENCIES } from '../../types/bassLayer';

function ModeToggle() {
  const { mode, setMode } = useBassLayerStore();

  const modes: { id: BassLayerMode; label: string; desc: string }[] = [
    { id: 'manual', label: 'Manual', desc: 'Set controls yourself' },
    { id: 'listen', label: 'Listen', desc: 'Reacts to your music' },
  ];

  return (
    <div className="flex rounded-xl bg-[var(--color-surface-light)] p-1">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === m.id
              ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-md'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {m.id === 'listen' && (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            {m.id === 'manual' && (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            )}
            {m.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function ListenDisplay() {
  const { analysisResult, listenError, isPlaying } = useBassLayerStore();

  if (listenError) {
    return (
      <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-xl p-4 text-center">
        <p className="text-sm text-[var(--color-error)]">{listenError}</p>
      </div>
    );
  }

  if (!isPlaying) {
    return (
      <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Press play to start listening to your music
        </p>
        <p className="text-xs text-[var(--color-text-muted)]/70 mt-1">
          Uses your microphone to detect bass frequencies, energy, and tempo
        </p>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="bg-[var(--color-surface)] rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <p className="text-sm text-[var(--color-text-muted)]">Listening...</p>
        </div>
      </div>
    );
  }

  const { dominantFrequency, musicalKey, energy, bpm, beatDetected } = analysisResult;
  const keyFreq = KEY_FREQUENCIES[musicalKey];

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${beatDetected ? 'bg-[var(--color-accent)] scale-150' : 'bg-[var(--color-primary)]'} transition-all`} />
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Live Analysis</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Detected Key */}
        <div className="bg-[var(--color-surface-light)] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Key</p>
          <p className="text-2xl font-bold text-[var(--color-text)]">{musicalKey}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{keyFreq.toFixed(1)} Hz</p>
        </div>

        {/* Detected Frequency */}
        <div className="bg-[var(--color-surface-light)] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Bass Freq</p>
          <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{dominantFrequency.toFixed(0)}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">Hz</p>
        </div>

        {/* Energy */}
        <div className="bg-[var(--color-surface-light)] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Energy</p>
          <p className="text-2xl font-bold text-[var(--color-text)]">{Math.round(energy * 100)}%</p>
          <div className="mt-1 h-1 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-100"
              style={{ width: `${energy * 100}%` }}
            />
          </div>
        </div>

        {/* BPM */}
        <div className="bg-[var(--color-surface-light)] rounded-xl p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Tempo</p>
          <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{bpm || '...'}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">BPM</p>
        </div>
      </div>
    </div>
  );
}

export function BassGenerator() {
  const {
    mode,
    isPlaying,
    config,
    currentPresetId,
    gainLevel,
    toggle,
    applyPreset,
    pollGainLevel,
    dispose,
  } = useBassLayerStore();

  const animFrameRef = useRef<number>(0);

  // Poll gain level for visualization when playing
  useEffect(() => {
    if (!isPlaying) return;

    const poll = () => {
      pollGainLevel();
      animFrameRef.current = requestAnimationFrame(poll);
    };
    animFrameRef.current = requestAnimationFrame(poll);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, pollGainLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => dispose();
  }, [dispose]);

  const glowSize = 20 + gainLevel * 60;
  const glowOpacity = 0.1 + gainLevel * 0.4;
  const scale = 1 + gainLevel * 0.08;

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <ModeToggle />

      {/* Presets (manual mode only) */}
      {mode === 'manual' && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Presets</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {BASS_LAYER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  currentPresetId === preset.id
                    ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-lg'
                    : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
                }`}
              >
                <span className="block font-semibold">{preset.name}</span>
                <span className="block text-[10px] opacity-70">{preset.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Listen mode display */}
      {mode === 'listen' && <ListenDisplay />}

      {/* Play/Stop + Visualization */}
      <section className="flex flex-col items-center py-8">
        {/* Frequency display */}
        <div className="text-center mb-6">
          <span className="text-3xl font-bold text-[var(--color-text)] font-mono">
            {config.frequency.toFixed(1)}
          </span>
          <span className="text-lg text-[var(--color-text-muted)] ml-1">Hz</span>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {mode === 'listen'
              ? 'Listening to your music'
              : `${config.musicalKey}1 \u00b7 ${config.rhythmPattern === 'continuous' ? 'Drone' : `${config.bpm} BPM`}`
            }
          </p>
        </div>

        {/* Big play/stop button with pulsing glow */}
        <button
          onClick={toggle}
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-transform duration-100"
          style={{
            background: isPlaying
              ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))'
              : 'var(--color-surface-light)',
            boxShadow: isPlaying
              ? `0 0 ${glowSize}px ${glowSize / 2}px rgba(99, 102, 241, ${glowOpacity})`
              : 'none',
            transform: `scale(${isPlaying ? scale : 1})`,
          }}
        >
          {isPlaying ? (
            // Stop icon
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // Play icon
            <svg className="w-10 h-10 text-[var(--color-text)]" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="8,5 20,12 8,19" />
            </svg>
          )}
        </button>

        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          {isPlaying
            ? mode === 'listen'
              ? 'Listening \u2014 bass reacts to your music'
              : 'Bass layer active \u2014 plays alongside your music'
            : mode === 'listen'
              ? 'Tap to start listening'
              : 'Tap to start the bass layer'
          }
        </p>
      </section>

      {/* Controls (manual mode only) */}
      {mode === 'manual' && (
        <section className="bg-[var(--color-surface)] rounded-2xl p-4 sm:p-5">
          <BassLayerControls />
        </section>
      )}
    </div>
  );
}
