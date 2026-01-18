/**
 * MelodyControls - Configuration controls for melody generation
 * Allows users to configure melody style, scale, density, and intensity
 */

import { useCallback, useRef, useState } from 'react';
import type { MelodyStyle, MelodyScale, NoteDensity } from '../../types/melodyGenerator';
import { createMelodyProcessor } from '../../audio/melodyGenerator';

interface MelodyControlsProps {
  enabled: boolean;
  style: MelodyStyle;
  scale: MelodyScale;
  intensity: number;
  density: NoteDensity;
  onEnabledChange: (enabled: boolean) => void;
  onStyleChange: (style: MelodyStyle) => void;
  onScaleChange: (scale: MelodyScale) => void;
  onIntensityChange: (intensity: number) => void;
  onDensityChange: (density: NoteDensity) => void;
  onMelodyUpload?: (buffer: AudioBuffer) => void;
  compact?: boolean;
}

const STYLE_OPTIONS: { value: MelodyStyle; label: string; description: string }[] = [
  { value: 'mixed', label: 'Mixed', description: 'Blend of all styles' },
  { value: 'drone', label: 'Drone', description: 'Long sustained tones' },
  { value: 'arpeggio', label: 'Arpeggio', description: 'Rhythmic patterns' },
  { value: 'evolving', label: 'Evolving', description: 'Generative sequences' },
  { value: 'harmonic', label: 'Harmonic', description: 'Upper overtones' },
  { value: 'upload', label: 'Upload', description: 'Use uploaded file' },
];

const SCALE_OPTIONS: { value: MelodyScale; label: string }[] = [
  { value: 'pentatonic_minor', label: 'Pentatonic Minor' },
  { value: 'pentatonic_major', label: 'Pentatonic Major' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'aeolian', label: 'Aeolian (Natural Minor)' },
  { value: 'harmonic_minor', label: 'Harmonic Minor' },
  { value: 'whole_tone', label: 'Whole Tone' },
];

const DENSITY_OPTIONS: { value: NoteDensity; label: string; description: string }[] = [
  { value: 'sparse', label: 'Sparse', description: 'Few notes, spacious' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced density' },
  { value: 'dense', label: 'Dense', description: 'Many notes, active' },
];

export function MelodyControls({
  enabled,
  style,
  scale,
  intensity,
  density,
  onEnabledChange,
  onStyleChange,
  onScaleChange,
  onIntensityChange,
  onDensityChange,
  onMelodyUpload,
  compact = false,
}: MelodyControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onMelodyUpload) return;

    setIsProcessing(true);
    try {
      const processor = createMelodyProcessor();
      const buffer = await processor.loadFile(file);
      setUploadedFileName(file.name);
      onMelodyUpload(buffer);
      onStyleChange('upload');
    } catch (error) {
      console.error('Error loading melody file:', error);
      setUploadedFileName(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onMelodyUpload, onStyleChange]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (compact) {
    return (
      <div className="melody-controls-compact">
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            Melody
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-surface-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
          </label>
        </div>
        
        {enabled && (
          <div className="mt-3 space-y-3 pl-6">
            <div className="flex gap-2">
              <select
                value={style}
                onChange={(e) => onStyleChange(e.target.value as MelodyStyle)}
                className="flex-1 px-2 py-1 text-sm bg-[var(--color-surface-light)] rounded border-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {STYLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={scale}
                onChange={(e) => onScaleChange(e.target.value as MelodyScale)}
                className="flex-1 px-2 py-1 text-sm bg-[var(--color-surface-light)] rounded border-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {SCALE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] w-12">Vol</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={intensity}
                onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-[var(--color-primary)]"
              />
              <span className="text-xs text-[var(--color-text-muted)] w-8">{Math.round(intensity * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="melody-controls bg-[var(--color-surface)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[var(--color-text)] flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Melody Layer
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-[var(--color-surface-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
        </label>
      </div>

      {enabled && (
        <div className="space-y-5">
          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-text-muted)]">Style</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.filter(s => s.value !== 'upload').map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onStyleChange(opt.value)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    style === opt.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-lighter)]'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          {onMelodyUpload && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={triggerFileUpload}
                disabled={isProcessing}
                className={`w-full px-4 py-2 text-sm rounded-lg border-2 border-dashed transition-colors ${
                  style === 'upload'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                }`}
              >
                {isProcessing ? (
                  'Processing...'
                ) : uploadedFileName ? (
                  <>
                    <span className="opacity-60">Uploaded: </span>
                    {uploadedFileName}
                  </>
                ) : (
                  'Upload Melody File'
                )}
              </button>
            </div>
          )}

          {/* Scale Selection */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-text-muted)]">Scale / Mode</label>
            <select
              value={scale}
              onChange={(e) => onScaleChange(e.target.value as MelodyScale)}
              className="w-full px-3 py-2 bg-[var(--color-surface-light)] rounded-lg border-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)]"
            >
              {SCALE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Density Selection */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-text-muted)]">Note Density</label>
            <div className="flex gap-2">
              {DENSITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onDensityChange(opt.value)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                    density === opt.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-lighter)]'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-[var(--color-text-muted)]">Volume</label>
              <span className="text-sm text-[var(--color-text-muted)]">{Math.round(intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={intensity}
              onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--color-surface-light)] accent-[var(--color-primary)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MelodyControls;
