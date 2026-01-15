/**
 * ExportDialog - Format selection, quality options, and export progress
 */

import { useState } from 'react';
import { useJourneyStore } from '../../stores/journeyStore';
import { OfflineRenderer } from '../../audio/OfflineRenderer';
import { encodeWavWithProgress, downloadBlob } from '../../audio/encoders/wav';
import { formatFileSize } from '../../audio/encoders/mp3';
import type { ExportSettings } from '../../types/journey';

const SAMPLE_RATES = [
  { value: 22050, label: '22.05 kHz (Draft)' },
  { value: 44100, label: '44.1 kHz (Standard)' },
  { value: 48000, label: '48 kHz (High Quality)' },
] as const;

const WAV_BIT_DEPTHS = [
  { value: 16, label: '16-bit (Standard)' },
  { value: 24, label: '24-bit (High Quality)' },
  { value: 32, label: '32-bit Float (Studio)' },
] as const;

export function ExportDialog() {
  const {
    showExportDialog,
    setShowExportDialog,
    journey,
    exportSettings,
    setExportSettings,
    isExporting,
    setExporting,
    exportProgress,
    setExportProgress,
  } = useJourneyStore();

  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('');

  if (!showExportDialog) return null;

  const durationSeconds = journey.duration_minutes * 60;
  const estimatedSize = durationSeconds * exportSettings.sampleRate * exportSettings.channels * ((exportSettings.bitDepth || 16) / 8);

  const handleExport = async (e?: React.MouseEvent) => {
    // Prevent any default behavior that might cause page refresh
    e?.preventDefault();
    e?.stopPropagation();

    setError(null);
    setExporting(true);
    setExportProgress({ phase: 'Starting', stage: 'init', progress: 0 });

    try {
      // Create renderer with chosen sample rate
      const renderer = new OfflineRenderer(
        exportSettings.sampleRate,
        exportSettings.channels
      );

      // Render to AudioBuffer using memory-efficient Web Audio method
      const audioBuffer = await renderer.renderWithWebAudio(journey, (progress) => {
        setExportProgress(progress);
      });

      // Encode to WAV
      const timestamp = Date.now();

      setExportProgress({
        phase: 'Encoding',
        stage: 'wav',
        progress: 0,
        message: 'Encoding to WAV...',
      });

      const blob = await encodeWavWithProgress(
        audioBuffer,
        exportSettings.bitDepth || 16,
        (percent) => {
          setExportProgress({
            phase: 'Encoding',
            stage: 'wav',
            progress: percent,
            message: `Encoding WAV... ${percent}%`,
          });
        }
      );
      const filename = `journey_${timestamp}.wav`;

      // Check device type
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (iOS) {
        // On iOS, create download link for manual tap
        console.log('iOS detected - creating manual download link');
        const url = URL.createObjectURL(blob);
        console.log('Created blob URL:', url);
        setDownloadUrl(url);
        setDownloadFilename(filename);

        setExportProgress({
          phase: 'Complete',
          stage: 'done',
          progress: 100,
          message: 'Ready! Tap the download button below to save your file.',
        });

        setExporting(false);
        console.log('iOS export complete, downloadUrl set');
      } else {
        // Trigger download automatically on non-iOS
        downloadBlob(blob, filename);

        setExportProgress({
          phase: 'Complete',
          stage: 'done',
          progress: 100,
          message: 'Export complete!',
        });

        if (!isMobile) {
          // Close dialog after short delay on desktop
          setTimeout(() => {
            setShowExportDialog(false);
            setExporting(false);
            setExportProgress(null);
          }, 1500);
        } else {
          // On mobile, show a "Done" button instead
          setExporting(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      // Clean up blob URL if exists
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
        setDownloadFilename('');
      }
      setShowExportDialog(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Export Journey
          </h2>
          {!isExporting && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Export progress */}
          {(isExporting || exportProgress) && exportProgress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text)]">{exportProgress.phase}</span>
                <span className="text-[var(--color-text-muted)]">{exportProgress.progress}%</span>
              </div>
              <div className="h-2 bg-[var(--color-surface-light)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-200"
                  style={{ width: `${exportProgress.progress}%` }}
                />
              </div>
              {exportProgress.message && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {exportProgress.message}
                </p>
              )}
            </div>
          )}

          {/* Settings (hidden during export and when complete) */}
          {!isExporting && !exportProgress && (
            <>
              {/* Format info */}
              <div className="p-4 bg-[var(--color-surface-light)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-text)]">WAV Format</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Lossless, full quality audio</div>
                  </div>
                </div>
              </div>

              {/* Sample rate */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-muted)]">Sample Rate</label>
                <select
                  value={exportSettings.sampleRate}
                  onChange={(e) => setExportSettings({ sampleRate: Number(e.target.value) as ExportSettings['sampleRate'] })}
                  className="w-full bg-[var(--color-surface-light)] border border-white/10 rounded-lg px-3 py-2 text-[var(--color-text)]"
                >
                  {SAMPLE_RATES.map((rate) => (
                    <option key={rate.value} value={rate.value}>
                      {rate.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bit Depth */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-muted)]">Bit Depth</label>
                <select
                  value={exportSettings.bitDepth || 16}
                  onChange={(e) => setExportSettings({ bitDepth: Number(e.target.value) as ExportSettings['bitDepth'] })}
                  className="w-full bg-[var(--color-surface-light)] border border-white/10 rounded-lg px-3 py-2 text-[var(--color-text)]"
                >
                  {WAV_BIT_DEPTHS.map((depth) => (
                    <option key={depth.value} value={depth.value}>
                      {depth.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Channels */}
              <div className="space-y-2">
                <label className="text-sm text-[var(--color-text-muted)]">Channels</label>
                <div className="grid grid-cols-2 gap-3">
                  {([1, 2] as const).map((channels) => (
                    <button
                      key={channels}
                      onClick={() => setExportSettings({ channels })}
                      className={`p-3 rounded-lg border transition-colors ${
                        exportSettings.channels === channels
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-sm text-[var(--color-text)]">
                        {channels === 1 ? 'Mono' : 'Stereo'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated size */}
              <div className="flex items-center justify-between text-sm py-3 px-4 bg-[var(--color-surface-light)] rounded-lg">
                <span className="text-[var(--color-text-muted)]">Estimated file size</span>
                <span className="text-[var(--color-text)] font-medium">
                  {formatFileSize(estimatedSize)}
                </span>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg text-sm text-[var(--color-error)]">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isExporting && (
          <div className="p-6 border-t border-white/10 flex justify-end gap-3">
            {downloadUrl ? (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
                <a
                  href={downloadUrl}
                  download={downloadFilename}
                  className="px-6 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download WAV
                </a>
              </>
            ) : (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-[var(--color-text-muted)] hover:bg-white/5 transition-colors"
                >
                  {exportProgress?.phase === 'Complete' ? 'Done' : 'Cancel'}
                </button>
                {exportProgress?.phase !== 'Complete' && (
                  <button
                    onClick={handleExport}
                    className="px-6 py-2 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium transition-colors"
                  >
                    Export WAV
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
