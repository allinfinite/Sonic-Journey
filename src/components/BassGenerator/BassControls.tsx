/**
 * BassLayerControls - Configuration for real-time bass layer
 * Musical key, rhythm pattern, BPM with tap tempo, and intensity
 */

import { useBassLayerStore } from '../../stores/bassLayerStore';
import { MUSICAL_KEYS, KEY_FREQUENCIES, RHYTHM_PATTERNS } from '../../types/bassLayer';
import type { MusicalKey, RhythmPattern } from '../../types/bassLayer';

export function BassLayerControls() {
  const {
    config,
    setMusicalKey,
    setRhythmPattern,
    setBPM,
    setIntensity,
    recordTap,
  } = useBassLayerStore();

  return (
    <div className="space-y-6">
      {/* Musical Key */}
      <section>
        <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">Musical Key</h4>
        <div className="flex flex-wrap gap-2">
          {MUSICAL_KEYS.map((key: MusicalKey) => (
            <button
              key={key}
              onClick={() => setMusicalKey(key)}
              className={`flex flex-col items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                config.musicalKey === key
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25'
                  : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
              }`}
            >
              <span className="text-base font-bold">{key}</span>
              <span className="text-[10px] opacity-70">{KEY_FREQUENCIES[key].toFixed(1)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Rhythm Pattern */}
      <section>
        <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">Rhythm Pattern</h4>
        <div className="flex flex-wrap gap-2">
          {RHYTHM_PATTERNS.map((p) => (
            <button
              key={p.id}
              onClick={() => setRhythmPattern(p.id as RhythmPattern)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                config.rhythmPattern === p.id
                  ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/25'
                  : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
              }`}
            >
              <span className="block font-semibold">{p.name}</span>
              <span className="block text-[10px] opacity-70">{p.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* BPM + Tap Tempo */}
      <section>
        <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
          BPM
          <span className="ml-2 text-[var(--color-primary)] font-mono">{config.bpm}</span>
        </h4>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={config.rhythmPattern === 'breathing' ? 2 : 40}
            max={config.rhythmPattern === 'breathing' ? 20 : 200}
            step="1"
            value={config.bpm}
            onChange={(e) => setBPM(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--color-surface-light)] accent-[var(--color-primary)] [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
          />
          <button
            onClick={recordTap}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-surface-light)] text-[var(--color-text)] text-sm font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-all active:scale-95 select-none"
          >
            Tap
          </button>
        </div>
        {config.rhythmPattern === 'breathing' && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Breathing rate: {config.bpm} breaths/min ({(60 / config.bpm).toFixed(1)}s per cycle)
          </p>
        )}
      </section>

      {/* Intensity */}
      <section>
        <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">
          Intensity
          <span className="ml-2 text-[var(--color-primary)] font-mono">{Math.round(config.intensity * 100)}%</span>
        </h4>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={config.intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-[var(--color-surface-light)] accent-[var(--color-primary)] [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-primary)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
        />
      </section>
    </div>
  );
}
