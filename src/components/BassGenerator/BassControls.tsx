/**
 * BassControls - Configuration controls for bass generation
 * Sliders for frequency range, intensity, and algorithm blend
 */

import { useCallback } from 'react';
import { useBassStore } from '../../stores/bassStore';

export function BassControls() {
  const {
    config,
    updateConfig,
    regenerateBass,
    generationState,
  } = useBassStore();

  const isRegenerating = generationState === 'generating';

  // Handle config changes
  const handleFrequencyMinChange = useCallback((value: number) => {
    updateConfig({ frequencyMin: value });
  }, [updateConfig]);

  const handleFrequencyMaxChange = useCallback((value: number) => {
    updateConfig({ frequencyMax: value });
  }, [updateConfig]);

  const handleBaseFrequencyChange = useCallback((value: number) => {
    updateConfig({ baseFrequency: value });
  }, [updateConfig]);

  const handleIntensityChange = useCallback((value: number) => {
    updateConfig({ intensity: value });
  }, [updateConfig]);

  const handleDryWetChange = useCallback((value: number) => {
    updateConfig({ dryWetMix: value });
  }, [updateConfig]);

  const handleBeatSyncedWeightChange = useCallback((value: number) => {
    updateConfig({ beatSyncedWeight: value });
  }, [updateConfig]);

  const handleHarmonicWeightChange = useCallback((value: number) => {
    updateConfig({ harmonicWeight: value });
  }, [updateConfig]);

  const handleEnhancedWeightChange = useCallback((value: number) => {
    updateConfig({ enhancedWeight: value });
  }, [updateConfig]);

  const handleRegenerate = useCallback(async () => {
    await regenerateBass();
  }, [regenerateBass]);

  return (
    <div className="bass-controls">
      <div className="controls-header">
        <h3 className="controls-title">Bass Settings</h3>
        <button
          className="regenerate-btn"
          onClick={handleRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <>
              <div className="spinner-small" />
              Regenerating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Regenerate
            </>
          )}
        </button>
      </div>

      <div className="controls-sections">
        {/* Frequency Range */}
        <section className="control-section">
          <h4 className="section-title">Frequency Range</h4>
          <div className="control-group">
            <div className="control-row">
              <label className="control-label">
                Min Frequency
                <span className="control-value">{config.frequencyMin} Hz</span>
              </label>
              <input
                type="range"
                min="20"
                max="60"
                step="1"
                value={config.frequencyMin}
                onChange={(e) => handleFrequencyMinChange(Number(e.target.value))}
                className="slider"
              />
            </div>
            <div className="control-row">
              <label className="control-label">
                Max Frequency
                <span className="control-value">{config.frequencyMax} Hz</span>
              </label>
              <input
                type="range"
                min="40"
                max="120"
                step="1"
                value={config.frequencyMax}
                onChange={(e) => handleFrequencyMaxChange(Number(e.target.value))}
                className="slider"
              />
            </div>
            <div className="control-row">
              <label className="control-label">
                Base Frequency
                <span className="control-value">{config.baseFrequency} Hz</span>
              </label>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={config.baseFrequency}
                onChange={(e) => handleBaseFrequencyChange(Number(e.target.value))}
                className="slider"
              />
            </div>
          </div>
        </section>

        {/* Mix */}
        <section className="control-section">
          <h4 className="section-title">Mix</h4>
          <div className="control-group">
            <div className="control-row">
              <label className="control-label">
                Intensity
                <span className="control-value">{Math.round(config.intensity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.intensity}
                onChange={(e) => handleIntensityChange(Number(e.target.value))}
                className="slider"
              />
            </div>
            <div className="control-row">
              <label className="control-label">
                Original / Bass Mix
                <span className="control-value">
                  {config.dryWetMix < 0.5 ? 'More Bass' : config.dryWetMix > 0.5 ? 'More Original' : 'Balanced'}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.dryWetMix}
                onChange={(e) => handleDryWetChange(Number(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>Bass Only</span>
                <span>Original Only</span>
              </div>
            </div>
          </div>
        </section>

        {/* Algorithm Blend */}
        <section className="control-section">
          <h4 className="section-title">Bass Algorithms</h4>
          <p className="section-hint">Blend different bass generation methods</p>
          <div className="control-group">
            <div className="control-row">
              <label className="control-label">
                Beat-Synced
                <span className="control-value">{Math.round(config.beatSyncedWeight * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.beatSyncedWeight}
                onChange={(e) => handleBeatSyncedWeightChange(Number(e.target.value))}
                className="slider slider-beat"
              />
              <p className="control-hint">Bass pulses that follow the beat</p>
            </div>
            <div className="control-row">
              <label className="control-label">
                Harmonic
                <span className="control-value">{Math.round(config.harmonicWeight * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.harmonicWeight}
                onChange={(e) => handleHarmonicWeightChange(Number(e.target.value))}
                className="slider slider-harmonic"
              />
              <p className="control-hint">Sub-harmonics following the melody</p>
            </div>
            <div className="control-row">
              <label className="control-label">
                Enhanced
                <span className="control-value">{Math.round(config.enhancedWeight * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.enhancedWeight}
                onChange={(e) => handleEnhancedWeightChange(Number(e.target.value))}
                className="slider slider-enhanced"
              />
              <p className="control-hint">Amplified and extended original bass</p>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .bass-controls {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .controls-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }

        .controls-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .regenerate-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          background: var(--color-surface-light);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .regenerate-btn:hover:not(:disabled) {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .regenerate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .controls-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .control-section {
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        .control-section:first-child {
          padding-top: 0;
          border-top: none;
        }

        .section-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }

        .section-hint {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          margin-bottom: 1rem;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .control-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .control-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          color: var(--color-text);
        }

        .control-value {
          font-weight: 600;
          color: var(--color-primary);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .control-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: -0.25rem;
        }

        .slider {
          width: 100%;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: var(--color-surface-light);
          border-radius: 3px;
          outline: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          border: 2px solid var(--color-surface);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.1s;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          border: 2px solid var(--color-surface);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .slider-beat::-webkit-slider-thumb {
          background: #FF6B6B;
        }

        .slider-harmonic::-webkit-slider-thumb {
          background: #4ECDC4;
        }

        .slider-enhanced::-webkit-slider-thumb {
          background: #A78BFA;
        }

        .slider-beat::-moz-range-thumb {
          background: #FF6B6B;
        }

        .slider-harmonic::-moz-range-thumb {
          background: #4ECDC4;
        }

        .slider-enhanced::-moz-range-thumb {
          background: #A78BFA;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--color-text-muted);
          margin-top: -0.25rem;
        }
      `}</style>
    </div>
  );
}
