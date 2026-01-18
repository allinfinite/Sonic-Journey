/**
 * PhaseControls - Parameter sliders for adjusting phase settings
 */

import { useJourneyStore } from '../../stores/journeyStore';
import type { RhythmMode, NovaPattern } from '../../types/journey';
import { NOVA_PATTERN_PRESETS } from '../../types/journey';
import { mapRhythmModeToNova, novaController } from '../../audio/NovaController';

const RHYTHM_OPTIONS: { value: RhythmMode; label: string; description: string }[] = [
  { value: 'still', label: 'Still', description: 'No rhythmic pulse' },
  { value: 'breathing', label: 'Breathing', description: '~12 sec cycle' },
  { value: 'heartbeat', label: 'Heartbeat', description: '~60 BPM' },
  { value: 'theta', label: 'Theta Waves', description: '5 Hz meditation' },
  { value: 'alpha', label: 'Alpha Waves', description: '10 Hz relaxation' },
];

// Pattern options for the Nova flicker UI
const NOVA_PATTERN_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Automatic based on rhythm mode' },
  { value: 'steady', label: 'Steady', description: 'Constant frequency' },
  { value: 'sweep', label: 'Sweep', description: 'Frequency transition' },
  { value: 'wave', label: 'Wave', description: 'Smooth oscillation' },
  { value: 'burst', label: 'Burst', description: 'Flash groups with pauses' },
  { value: 'rhythm', label: 'Rhythm', description: 'Custom pattern' },
];

// Get display text for a pattern
function getPatternDescription(pattern: NovaPattern | undefined, rhythmMode?: RhythmMode): string {
  if (!pattern) {
    if (rhythmMode === 'breathing') return 'Wave ~10 Hz (organic)';
    if (rhythmMode === 'heartbeat') return 'Heartbeat rhythm';
    if (rhythmMode === 'theta') return 'Wave ~6 Hz (gentle)';
    if (rhythmMode === 'alpha') return 'Wave ~10 Hz (visuals)';
    return 'Auto-selected based on mode';
  }
  
  switch (pattern.type) {
    case 'steady':
      return `Steady ${pattern.baseFrequency} Hz`;
    case 'sweep':
      return `Sweep ${pattern.baseFrequency}→${pattern.targetFrequency} Hz`;
    case 'wave':
      return `Wave ${pattern.baseFrequency}±${pattern.waveAmplitude || 2} Hz`;
    case 'burst':
      return `Burst ${pattern.burstCount || 5}× @ ${pattern.baseFrequency} Hz`;
    case 'rhythm':
      return `Rhythm @ ${pattern.baseFrequency} Hz`;
    case 'pulse':
      return `Pulse ${Math.round((pattern.dutyCycle || 0.5) * 100)}% @ ${pattern.baseFrequency} Hz`;
    case 'random':
      return `Random ~${pattern.baseFrequency} Hz`;
    default:
      return `${pattern.type} @ ${pattern.baseFrequency} Hz`;
  }
}

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
        <div className="grid grid-cols-5 gap-2">
          {RHYTHM_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleRhythmChange(option.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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

      {/* Nova Flicker Control */}
      {novaController.isAvailable() && (
        <div className="space-y-3 pt-4 border-t border-[var(--color-surface-light)]">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              Nova Light Mask
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={phase.nova_enabled !== false && (journey.nova_enabled !== false)}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  updatePhase(selectedPhaseIndex, { nova_enabled: enabled });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-surface-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>
          
          {phase.nova_enabled !== false && (journey.nova_enabled !== false) && (
            <div className="space-y-3 pl-6">
              {/* Pattern Type Selection */}
              <div className="space-y-2">
                <label className="text-xs text-[var(--color-text-muted)]">Pattern</label>
                <div className="grid grid-cols-3 gap-1">
                  {NOVA_PATTERN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (option.value === 'auto') {
                          // Remove custom pattern, let auto-selection work
                          updatePhase(selectedPhaseIndex, { 
                            nova_pattern: undefined,
                            nova_frequency: undefined 
                          });
                        } else if (option.value === 'steady') {
                          // Set simple frequency-based (no pattern)
                          const baseFreq = phase.entrainment_rate || mapRhythmModeToNova(phase.rhythm_mode || 'alpha');
                          updatePhase(selectedPhaseIndex, { 
                            nova_pattern: undefined,
                            nova_frequency: baseFreq
                          });
                        } else {
                          // Create pattern of selected type
                          const baseFreq = phase.entrainment_rate || mapRhythmModeToNova(phase.rhythm_mode || 'alpha');
                          let pattern: NovaPattern;
                          switch (option.value) {
                            case 'sweep':
                              pattern = { type: 'sweep', baseFrequency: baseFreq, targetFrequency: baseFreq * 0.6 };
                              break;
                            case 'wave':
                              pattern = { type: 'wave', baseFrequency: baseFreq, waveAmplitude: 2, wavePeriod: 6000 };
                              break;
                            case 'burst':
                              pattern = { type: 'burst', baseFrequency: baseFreq, burstCount: 5, burstGap: 500 };
                              break;
                            case 'rhythm':
                              pattern = { type: 'rhythm', baseFrequency: baseFreq, rhythmPattern: [100, 200, 100, 600] };
                              break;
                            default:
                              pattern = { type: 'steady', baseFrequency: baseFreq };
                          }
                          updatePhase(selectedPhaseIndex, { nova_pattern: pattern, nova_frequency: undefined });
                        }
                      }}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        (option.value === 'auto' && !phase.nova_pattern && !phase.nova_frequency) ||
                        (option.value === 'steady' && !phase.nova_pattern && phase.nova_frequency) ||
                        (phase.nova_pattern?.type === option.value)
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
              
              {/* Pattern Description */}
              <div className="text-xs text-[var(--color-text-muted)]">
                {getPatternDescription(phase.nova_pattern, phase.rhythm_mode)}
              </div>
              
              {/* Pattern-specific controls */}
              {phase.nova_pattern && (
                <div className="space-y-2">
                  {/* Base Frequency */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--color-text-muted)] w-20">Base Hz</label>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      step="1"
                      value={phase.nova_pattern.baseFrequency}
                      onChange={(e) => {
                        const newPattern = { ...phase.nova_pattern!, baseFrequency: Number(e.target.value) };
                        updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                      }}
                      className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-warning)]"
                    />
                    <span className="text-xs text-[var(--color-text)] w-8">{phase.nova_pattern.baseFrequency}</span>
                  </div>
                  
                  {/* Sweep: Target Frequency */}
                  {phase.nova_pattern.type === 'sweep' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[var(--color-text-muted)] w-20">Target Hz</label>
                      <input
                        type="range"
                        min="1"
                        max="40"
                        step="1"
                        value={phase.nova_pattern.targetFrequency || phase.nova_pattern.baseFrequency}
                        onChange={(e) => {
                          const newPattern = { ...phase.nova_pattern!, targetFrequency: Number(e.target.value) };
                          updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                        }}
                        className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                      />
                      <span className="text-xs text-[var(--color-text)] w-8">{phase.nova_pattern.targetFrequency || phase.nova_pattern.baseFrequency}</span>
                    </div>
                  )}
                  
                  {/* Wave: Amplitude */}
                  {phase.nova_pattern.type === 'wave' && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--color-text-muted)] w-20">Wave ±Hz</label>
                        <input
                          type="range"
                          min="0.5"
                          max="5"
                          step="0.5"
                          value={phase.nova_pattern.waveAmplitude || 2}
                          onChange={(e) => {
                            const newPattern = { ...phase.nova_pattern!, waveAmplitude: Number(e.target.value) };
                            updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                          }}
                          className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text)] w-8">±{phase.nova_pattern.waveAmplitude || 2}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--color-text-muted)] w-20">Period</label>
                        <input
                          type="range"
                          min="2000"
                          max="15000"
                          step="1000"
                          value={phase.nova_pattern.wavePeriod || 5000}
                          onChange={(e) => {
                            const newPattern = { ...phase.nova_pattern!, wavePeriod: Number(e.target.value) };
                            updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                          }}
                          className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text)] w-8">{((phase.nova_pattern.wavePeriod || 5000) / 1000).toFixed(0)}s</span>
                      </div>
                    </>
                  )}
                  
                  {/* Burst: Count and Gap */}
                  {phase.nova_pattern.type === 'burst' && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--color-text-muted)] w-20">Flashes</label>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={phase.nova_pattern.burstCount || 5}
                          onChange={(e) => {
                            const newPattern = { ...phase.nova_pattern!, burstCount: Number(e.target.value) };
                            updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                          }}
                          className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text)] w-8">{phase.nova_pattern.burstCount || 5}×</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--color-text-muted)] w-20">Gap</label>
                        <input
                          type="range"
                          min="200"
                          max="1500"
                          step="100"
                          value={phase.nova_pattern.burstGap || 500}
                          onChange={(e) => {
                            const newPattern = { ...phase.nova_pattern!, burstGap: Number(e.target.value) };
                            updatePhase(selectedPhaseIndex, { nova_pattern: newPattern });
                          }}
                          className="flex-1 h-1.5 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <span className="text-xs text-[var(--color-text)] w-8">{phase.nova_pattern.burstGap || 500}ms</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {/* Quick Pattern Presets */}
              <div className="pt-2">
                <label className="text-xs text-[var(--color-text-muted)] block mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'organic_theta', label: 'Organic θ' },
                    { key: 'organic_alpha', label: 'Organic α' },
                    { key: 'heartbeat', label: 'Heartbeat' },
                    { key: 'alpha_burst', label: 'α Burst' },
                    { key: 'alpha_to_theta', label: 'α→θ' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        const preset = NOVA_PATTERN_PRESETS[key];
                        if (preset) {
                          updatePhase(selectedPhaseIndex, { nova_pattern: { ...preset } });
                        }
                      }}
                      className="px-2 py-1 rounded text-xs bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div className="space-y-2 pl-6">
            <div className="text-xs text-[var(--color-text-muted)]">
              {phase.binaural_beat_frequency 
                ? `Beat: ${phase.binaural_beat_frequency} Hz`
                : phase.rhythm_mode === 'theta'
                  ? `Auto: 6 Hz (Theta)`
                  : phase.rhythm_mode === 'alpha'
                    ? `Auto: 10 Hz (Alpha)`
                    : `Auto: ${(() => {
                        const avgFreq = (phase.frequency.start + phase.frequency.end) / 2;
                        if (avgFreq <= 4) return '3 Hz (Delta)';
                        if (avgFreq <= 7) return '6 Hz (Theta)';
                        if (avgFreq <= 12) return '10 Hz (Alpha)';
                        if (avgFreq <= 30) return '15 Hz (Beta)';
                        return '10 Hz (Alpha)';
                      })()}`
              }
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Carrier: {phase.binaural_carrier_frequency || 200} Hz
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
