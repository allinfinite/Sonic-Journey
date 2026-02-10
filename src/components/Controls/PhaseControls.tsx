/**
 * PhaseControls - Parameter sliders for adjusting phase settings
 */

import { useJourneyStore } from '../../stores/journeyStore';
import type { RhythmMode } from '../../types/journey';

const RHYTHM_OPTIONS: { value: RhythmMode; label: string; description: string }[] = [
  { value: 'still', label: 'Still', description: 'No rhythmic pulse' },
  { value: 'breathing', label: 'Breathing', description: '~12 sec cycle' },
  { value: 'heartbeat', label: 'Heartbeat', description: '~60 BPM' },
  { value: 'theta', label: 'Theta Waves', description: '5 Hz meditation' },
  { value: 'alpha', label: 'Alpha Waves', description: '10 Hz relaxation' },
];

export function PhaseControls() {
  const {
    journey,
    selectedPhaseIndex,
    updatePhase,
    updateLiveParameter,
    isPlaying,
  } = useJourneyStore();

  const phase = journey.phases[selectedPhaseIndex];
  if (!phase) return null;

  const handleFrequencyChange = (type: 'start' | 'end', value: number) => {
    updatePhase(selectedPhaseIndex, {
      frequency: { ...phase.frequency, [type]: value },
    });
    // Live modulation when playing
    if (isPlaying) {
      updateLiveParameter('foundationFreq', value);
    }
  };

  const handleAmplitudeChange = (type: 'start' | 'end', value: number) => {
    updatePhase(selectedPhaseIndex, {
      amplitude: { ...phase.amplitude, [type]: value },
    });
    if (isPlaying) {
      updateLiveParameter('intensity', value);
    }
  };

  const handleRhythmChange = (mode: RhythmMode) => {
    updatePhase(selectedPhaseIndex, { rhythm_mode: mode });
    if (isPlaying) {
      updateLiveParameter('rhythmMode', mode);
    }
  };

  const handleFlowChange = (value: number) => {
    updatePhase(selectedPhaseIndex, { fm_depth: value });
    if (isPlaying) {
      updateLiveParameter('flowDepth', value);
    }
  };

  const handleDurationChange = (value: number) => {
    updatePhase(selectedPhaseIndex, { duration: value });
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          {phase.name}
        </h3>
        <input
          type="text"
          value={phase.name}
          onChange={(e) => updatePhase(selectedPhaseIndex, { name: e.target.value })}
          className="bg-[var(--color-surface-light)] border border-white/10 rounded px-3 py-1 text-sm text-[var(--color-text)] max-w-48"
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <label className="text-[var(--color-text-muted)]">Duration</label>
          <span className="text-[var(--color-text)]">{phase.duration} minutes</span>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          step="5"
          value={phase.duration}
          onChange={(e) => handleDurationChange(Number(e.target.value))}
          className="w-full h-2 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
        />
      </div>

      {/* Frequency (Energy Level) */}
      <div className="space-y-3">
        <label className="text-sm text-[var(--color-text-muted)] block">
          Energy Level (Frequency)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">Start</span>
              <span className="text-[var(--color-text)]">{phase.frequency.start} Hz</span>
            </div>
            <input
              type="range"
              min="28"
              max="90"
              step="1"
              value={phase.frequency.start}
              onChange={(e) => handleFrequencyChange('start', Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #6366f1, #22d3ee)`,
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">End</span>
              <span className="text-[var(--color-text)]">{phase.frequency.end} Hz</span>
            </div>
            <input
              type="range"
              min="28"
              max="90"
              step="1"
              value={phase.frequency.end}
              onChange={(e) => handleFrequencyChange('end', Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #6366f1, #22d3ee)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Amplitude (Intensity) */}
      <div className="space-y-3">
        <label className="text-sm text-[var(--color-text-muted)] block">
          Intensity (Amplitude)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">Start</span>
              <span className="text-[var(--color-text)]">{Math.round(phase.amplitude.start * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={phase.amplitude.start * 100}
              onChange={(e) => handleAmplitudeChange('start', Number(e.target.value) / 100)}
              className="w-full h-2 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-warning)]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">End</span>
              <span className="text-[var(--color-text)]">{Math.round(phase.amplitude.end * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={phase.amplitude.end * 100}
              onChange={(e) => handleAmplitudeChange('end', Number(e.target.value) / 100)}
              className="w-full h-2 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-warning)]"
            />
          </div>
        </div>
      </div>

      {/* Rhythm Mode */}
      <div className="space-y-3">
        <label className="text-sm text-[var(--color-text-muted)] block">
          Rhythm Pattern
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {RHYTHM_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleRhythmChange(option.value)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors truncate ${
                phase.rhythm_mode === option.value
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flow (FM Depth) */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <label className="text-[var(--color-text-muted)]">Flow (Modulation)</label>
          <span className="text-[var(--color-text)]">{Math.round((phase.fm_depth || 0) * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={(phase.fm_depth || 0) * 100}
          onChange={(e) => handleFlowChange(Number(e.target.value) / 100)}
          className="w-full h-2 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
        />
      </div>

      {/* Binaural Beats Control */}
      <div className="space-y-2 pt-2 border-t border-[var(--color-surface-light)]">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M8 6h8M8 12h8M8 18h8" />
            </svg>
            Binaural Beats
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={phase.binaural_enabled === true}
              onChange={(e) => {
                const enabled = e.target.checked;
                updatePhase(selectedPhaseIndex, { binaural_enabled: enabled });
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-surface-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
          </label>
        </div>
        {phase.binaural_enabled && (
          <div className="space-y-3 pl-6">
            {/* Beat Frequency */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--color-text-muted)]">Beat Frequency</label>
                <span className="text-xs text-[var(--color-text)]">
                  {phase.binaural_beat_frequency || (() => {
                    if (phase.rhythm_mode === 'delta') return 3;
                    if (phase.rhythm_mode === 'theta') return 6;
                    if (phase.rhythm_mode === 'alpha') return 10;
                    if (phase.rhythm_mode === 'beta') return 15;
                    if (phase.rhythm_mode === 'gamma') return 30;
                    const avgFreq = (phase.frequency.start + phase.frequency.end) / 2;
                    if (avgFreq <= 4) return 3;
                    if (avgFreq <= 7) return 6;
                    if (avgFreq <= 12) return 10;
                    if (avgFreq <= 30) return 15;
                    return 10;
                  })()} Hz
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={phase.binaural_beat_frequency || (() => {
                  if (phase.rhythm_mode === 'delta') return 3;
                  if (phase.rhythm_mode === 'theta') return 6;
                  if (phase.rhythm_mode === 'alpha') return 10;
                  if (phase.rhythm_mode === 'beta') return 15;
                  if (phase.rhythm_mode === 'gamma') return 30;
                  return 10;
                })()}
                onChange={(e) => updatePhase(selectedPhaseIndex, { binaural_beat_frequency: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
                <span>1 Hz</span>
                <span>30 Hz</span>
              </div>
            </div>

            {/* Carrier Frequency */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--color-text-muted)]">Carrier Frequency</label>
                <span className="text-xs text-[var(--color-text)]">{phase.binaural_carrier_frequency || 200} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="400"
                step="10"
                value={phase.binaural_carrier_frequency || 200}
                onChange={(e) => updatePhase(selectedPhaseIndex, { binaural_carrier_frequency: Number(e.target.value) })}
                className="w-full h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
                <span>100 Hz</span>
                <span>400 Hz</span>
              </div>
            </div>

            {/* Volume */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--color-text-muted)]">Volume</label>
                <span className="text-xs text-[var(--color-text)]">{Math.round((phase.binaural_volume ?? 0.3) * 100)}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={(phase.binaural_volume ?? 0.3) * 100}
                onChange={(e) => updatePhase(selectedPhaseIndex, { binaural_volume: Number(e.target.value) / 100 })}
                className="w-full h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
                <span>10%</span>
                <span>80%</span>
              </div>
            </div>

            {/* Waveform */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-muted)]">Waveform</label>
              <div className="grid grid-cols-4 gap-1">
                {(['sine', 'triangle', 'sawtooth', 'square'] as const).map((waveform) => (
                  <button
                    key={waveform}
                    onClick={() => updatePhase(selectedPhaseIndex, { binaural_waveform: waveform })}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors capitalize ${
                      (phase.binaural_waveform || 'sine') === waveform
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
                    }`}
                  >
                    {waveform}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
