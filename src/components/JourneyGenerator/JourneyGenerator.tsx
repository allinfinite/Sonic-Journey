/**
 * JourneyGenerator - Modal for AI-powered journey generation
 * Users input a prompt and duration to generate custom journeys
 */

import { useState, useCallback } from 'react';
import { useJourneyStore } from '../../stores/journeyStore';

export function JourneyGenerator() {
  const {
    showJourneyGenerator,
    setShowJourneyGenerator,
    isGenerating,
    generationError,
    generateJourney,
  } = useJourneyStore();

  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(60);

  const handleClose = useCallback(() => {
    setShowJourneyGenerator(false);
    setPrompt('');
    setDuration(60);
  }, [setShowJourneyGenerator]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    try {
      await generateJourney(prompt.trim(), duration);
    } catch (error) {
      // Error is handled by store
      console.error('Generation error:', error);
    }
  }, [prompt, duration, generateJourney]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  }, [handleGenerate]);

  if (!showJourneyGenerator) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">
              Create Journey with AI
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Describe your desired journey and we'll generate it for you
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-light)] transition-colors"
            disabled={isGenerating}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Describe your journey
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 'Deep meditation for stress relief', 'Energizing morning routine', 'Gentle sleep journey'..."
              className="w-full px-4 py-3 bg-[var(--color-surface-light)] border border-white/10 rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              rows={4}
              disabled={isGenerating}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Be specific about the mood, purpose, or therapeutic goal
            </p>
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                Duration
              </label>
              <span className="text-sm font-semibold text-[var(--color-primary)]">
                {duration} minutes
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="180"
              step="5"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-2 bg-[var(--color-surface-light)] rounded-lg appearance-none cursor-pointer slider"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>5 min</span>
              <span>90 min</span>
              <span>180 min</span>
            </div>
          </div>

          {/* Error Display */}
          {generationError && (
            <div className="p-4 bg-[var(--color-error)]/20 border border-[var(--color-error)]/50 rounded-lg">
              <p className="text-sm text-[var(--color-error)]">
                {generationError}
              </p>
            </div>
          )}

          {/* Examples */}
          <div className="p-4 bg-[var(--color-surface-light)] rounded-lg">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
              Example Prompts
            </p>
            <div className="space-y-1">
              {[
                'Deep relaxation for sleep',
                'Morning energizer with uplifting frequencies',
                'Meditation journey for anxiety relief',
                'Grounding session after stress',
                'Creative flow state activation',
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(example)}
                  disabled={isGenerating}
                  className="block w-full text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  • {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="spinner-small" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" />
                </svg>
                Generate Journey
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-primary);
          cursor: pointer;
          border: 2px solid var(--color-surface);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
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
      `}</style>
    </div>
  );
}
