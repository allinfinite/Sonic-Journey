/**
 * BassGenerator - Main container for bass track generation
 * Includes upload zone, waveform display, and processing controls
 */

import { useCallback, useRef, useEffect } from 'react';
import { useBassStore, decodeAudioFile } from '../../stores/bassStore';
import { BassControls } from './BassControls';
import { BassPreview } from './BassPreview';

export function BassGenerator() {
  const {
    uploadState,
    uploadedFile,
    analysisState,
    analysisResult,
    generationState,
    progress,
    processingMode,
    serverAvailable,
    setUploadedFile,
    setOriginalBuffer,
    setUploadState,
    processAudio,
    setProcessingMode,
    checkServerStatus,
    reset,
  } = useBassStore();
  
  // Check server status on mount
  useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    console.log('handleFileSelect called with file:', file.name, file.type, file.size);
    
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setUploadedFile(file);
    setUploadState('loading');

    try {
      console.log('Starting decode...');
      setUploadState('decoding');
      const audioBuffer = await decodeAudioFile(file);
      console.log('Decoded audio buffer:', audioBuffer.duration, 'seconds');
      setOriginalBuffer(audioBuffer);
      setUploadState('ready');
      console.log('Upload state set to ready');
    } catch (error) {
      console.error('Error decoding audio:', error);
      setUploadState('error');
    }
  }, [setUploadedFile, setOriginalBuffer, setUploadState]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('drag-over');

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle process button
  const handleProcess = useCallback(async () => {
    console.log('handleProcess clicked!');
    console.log('uploadState:', uploadState);
    console.log('analysisState:', analysisState);
    console.log('generationState:', generationState);
    try {
      await processAudio();
      console.log('processAudio completed');
    } catch (error) {
      console.error('processAudio error:', error);
    }
  }, [processAudio, uploadState, analysisState, generationState]);

  // Render upload zone
  const renderUploadZone = () => (
    <div
      ref={dropZoneRef}
      className="upload-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <div className="upload-icon">
        <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 8l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5v9" strokeLinecap="round" />
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      
      <p className="upload-text">
        Drop your audio file here or click to browse
      </p>
      <p className="upload-hint">
        Supports MP3, WAV, FLAC, AAC and other audio formats
      </p>
    </div>
  );

  // Render loading state
  const renderLoading = () => (
    <div className="loading-state">
      <div className="spinner" />
      <p className="loading-text">
        {uploadState === 'loading' && 'Loading file...'}
        {uploadState === 'decoding' && 'Decoding audio...'}
      </p>
    </div>
  );

  // Render file info
  const renderFileInfo = () => (
    <div className="file-info">
      <div className="file-icon">
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <div className="file-details">
        <p className="file-name">{uploadedFile?.name}</p>
        <p className="file-size">
          {uploadedFile && formatFileSize(uploadedFile.size)}
          {analysisResult && ` • ${formatDuration(analysisResult.duration)}`}
        </p>
      </div>
      <button 
        className="remove-file-btn"
        onClick={(e) => {
          e.stopPropagation();
          reset();
        }}
        title="Remove file"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );

  // Render analysis results
  const renderAnalysisResults = () => {
    if (!analysisResult) return null;

    return (
      <div className="analysis-results">
        <h3 className="results-title">Analysis Results</h3>
        <div className="results-grid">
          <div className="result-item">
            <span className="result-label">Tempo</span>
            <span className="result-value">{analysisResult.bpm} BPM</span>
          </div>
          <div className="result-item">
            <span className="result-label">Beats Detected</span>
            <span className="result-value">{analysisResult.beats.length}</span>
          </div>
          {analysisResult.detectedKey && (
            <div className="result-item">
              <span className="result-label">Key</span>
              <span className="result-value">{analysisResult.detectedKey}</span>
            </div>
          )}
          <div className="result-item">
            <span className="result-label">Bass Energy</span>
            <span className="result-value">
              {(analysisResult.averageBassEnergy * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render progress
  const renderProgress = () => {
    if (!progress) return null;

    return (
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-stage">{progress.message}</span>
          <span className="progress-percent">{Math.round(progress.progress)}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>
    );
  };

  // Check if we can process
  const canProcess = uploadState === 'ready' && analysisState !== 'analyzing' && generationState !== 'generating';
  const isProcessing = analysisState === 'analyzing' || generationState === 'generating';

  // Debug log
  console.log('BassGenerator render:', { uploadState, analysisState, generationState, canProcess, isProcessing, hasOriginalBuffer: !!useBassStore.getState().originalBuffer });

  return (
    <div className="bass-generator">
      <div className="bass-generator-header">
        <h2 className="bass-generator-title">Bass Track Generator</h2>
        <p className="bass-generator-subtitle">
          Upload a song to generate a bass track for your vibe table
        </p>
      </div>

      <div className="bass-generator-content">
        {/* Upload Section */}
        <section className="upload-section">
          {uploadState === 'idle' && renderUploadZone()}
          {(uploadState === 'loading' || uploadState === 'decoding') && renderLoading()}
          {(uploadState === 'ready' || uploadState === 'error') && uploadedFile && (
            <div className="file-ready">
              {renderFileInfo()}
              {uploadState === 'error' && (
                <p className="error-message">Error decoding audio file. Please try another file.</p>
              )}
            </div>
          )}
        </section>

        {/* Processing Mode Toggle */}
        {uploadState === 'ready' && generationState !== 'complete' && (
          <div className="processing-mode-section">
            <label className="mode-label">Processing Mode</label>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${processingMode === 'client' ? 'active' : ''}`}
                onClick={() => setProcessingMode('client')}
                disabled={isProcessing}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                Client-side
              </button>
              <button
                className={`mode-btn ${processingMode === 'server' ? 'active' : ''} ${!serverAvailable ? 'unavailable' : ''}`}
                onClick={() => serverAvailable && setProcessingMode('server')}
                disabled={isProcessing || !serverAvailable}
                title={!serverAvailable ? 'Server not running. Start with: npm run dev:server' : 'Process on server (faster)'}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                  <line x1="6" y1="6" x2="6.01" y2="6"/>
                  <line x1="6" y1="18" x2="6.01" y2="18"/>
                </svg>
                Server-side
                {serverAvailable && <span className="server-status online">●</span>}
                {!serverAvailable && <span className="server-status offline">○</span>}
              </button>
            </div>
            {!serverAvailable && processingMode === 'client' && (
              <p className="mode-hint">
                Start the server for faster processing: <code>npm run dev:server</code>
              </p>
            )}
            {serverAvailable && processingMode === 'server' && (
              <p className="mode-hint success">
                ✓ Server connected - processing will be faster
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        {isProcessing && renderProgress()}

        {/* Process Button */}
        {uploadState === 'ready' && generationState !== 'complete' && (
          <button
            className="process-btn"
            onClick={() => {
              console.log('Button clicked directly!');
              handleProcess();
            }}
            disabled={!canProcess}
            type="button"
          >
            {isProcessing ? (
              <>
                <div className="spinner-small" />
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Generate Bass Track
              </>
            )}
          </button>
        )}

        {/* Analysis Results */}
        {analysisState === 'complete' && renderAnalysisResults()}

        {/* Controls (show after processing) */}
        {generationState === 'complete' && (
          <>
            <BassControls />
            <BassPreview />
          </>
        )}
      </div>

      <style>{`
        .bass-generator {
          max-width: 800px;
          margin: 0 auto;
        }

        .bass-generator-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .bass-generator-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }

        .bass-generator-subtitle {
          color: var(--color-text-muted);
          font-size: 0.95rem;
        }

        .bass-generator-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .upload-zone {
          border: 2px dashed var(--color-border);
          border-radius: 12px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--color-surface);
        }

        .upload-zone:hover,
        .upload-zone.drag-over {
          border-color: var(--color-primary);
          background: var(--color-surface-light);
        }

        .upload-icon {
          color: var(--color-text-muted);
          margin-bottom: 1rem;
          display: flex;
          justify-content: center;
        }

        .upload-text {
          font-size: 1.1rem;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }

        .upload-hint {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem;
          background: var(--color-surface);
          border-radius: 12px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spinner-small {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          margin-top: 1rem;
          color: var(--color-text-muted);
        }

        .file-ready {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1rem;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-icon {
          color: var(--color-primary);
        }

        .file-details {
          flex: 1;
        }

        .file-name {
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 0.25rem;
        }

        .file-size {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        .remove-file-btn {
          padding: 0.5rem;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .remove-file-btn:hover {
          background: var(--color-error);
          color: white;
        }

        .error-message {
          color: var(--color-error);
          font-size: 0.9rem;
          margin-top: 0.75rem;
        }

        .progress-section {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1rem 1.25rem;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .progress-stage {
          font-size: 0.9rem;
          color: var(--color-text);
        }

        .progress-percent {
          font-size: 0.9rem;
          color: var(--color-primary);
          font-weight: 600;
        }

        .progress-bar {
          height: 6px;
          background: var(--color-surface-light);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
          border-radius: 3px;
          transition: width 0.2s ease;
        }

        .process-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          padding: 1rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .process-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(var(--color-primary-rgb), 0.4);
        }

        .process-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .analysis-results {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .results-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 1rem;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .result-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .result-label {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .result-value {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .hidden {
          display: none;
        }

        .processing-mode-section {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1.25rem;
        }

        .mode-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 0.75rem;
        }

        .mode-toggle {
          display: flex;
          gap: 0.5rem;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          font-weight: 500;
          background: var(--color-surface-light);
          color: var(--color-text-muted);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn:hover:not(:disabled) {
          background: var(--color-surface-light);
          color: var(--color-text);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          color: white;
          border-color: transparent;
        }

        .mode-btn.unavailable {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-btn:disabled {
          cursor: not-allowed;
        }

        .server-status {
          font-size: 0.7rem;
        }

        .server-status.online {
          color: #10b981;
        }

        .server-status.offline {
          color: var(--color-text-muted);
        }

        .mode-hint {
          margin-top: 0.75rem;
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }

        .mode-hint code {
          background: var(--color-surface-light);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.75rem;
        }

        .mode-hint.success {
          color: #10b981;
        }

        @media (max-width: 600px) {
          .results-grid {
            grid-template-columns: 1fr;
          }
          
          .mode-toggle {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
