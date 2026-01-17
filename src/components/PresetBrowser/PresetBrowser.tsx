/**
 * PresetBrowser - Modal for browsing and loading journey presets
 */

import { useState, useEffect } from 'react';
import { useJourneyStore } from '../../stores/journeyStore';
import { presets, presetIndex } from '../../presets';
import { getSavedJourneys, deleteSavedJourney, type SavedJourney } from '../../utils/journeyStorage';

export function PresetBrowser() {
  const { showPresetBrowser, setShowPresetBrowser, setJourney, setJourneyWithId } = useJourneyStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [savedJourneys, setSavedJourneys] = useState<SavedJourney[]>([]);

  // Load saved journeys when modal opens
  useEffect(() => {
    if (showPresetBrowser) {
      setSavedJourneys(getSavedJourneys());
    }
  }, [showPresetBrowser]);

  if (!showPresetBrowser) return null;

  const handlePresetSelect = (presetId: string) => {
    const preset = presets[presetId as keyof typeof presets];
    if (preset) {
      setJourney(preset);
      setShowPresetBrowser(false);
    }
  };

  const handleSavedJourneySelect = (savedJourney: SavedJourney) => {
    setJourneyWithId(savedJourney.journey, savedJourney.id);
    setShowPresetBrowser(false);
  };

  const handleDeleteSavedJourney = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this saved journey?')) {
      deleteSavedJourney(id);
      setSavedJourneys(getSavedJourneys());
    }
  };

  const handleClose = () => {
    setShowPresetBrowser(false);
  };

  const isShowingSaved = selectedCategory === 'my-journeys';

  const filteredPresets = isShowingSaved
    ? []
    : selectedCategory
    ? presetIndex.categories
        .find((c) => c.name === selectedCategory)
        ?.presets.map((id) => ({ id, preset: presets[id as keyof typeof presets] }))
        .filter((p) => p.preset) || []
    : Object.entries(presets).map(([id, preset]) => ({ id, preset }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Journey Library
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* Categories sidebar */}
          <div className="w-48 border-r border-white/10 p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === null
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/5'
              }`}
            >
              All Journeys
            </button>
            <button
              onClick={() => setSelectedCategory('my-journeys')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === 'my-journeys'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-white/5'
              }`}
            >
              <span className="mr-2">💾</span>
              My Journeys
              {savedJourneys.length > 0 && (
                <span className="ml-auto text-xs opacity-75">({savedJourneys.length})</span>
              )}
            </button>
            {presetIndex.categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category.name
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:bg-white/5'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          {/* Presets grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isShowingSaved ? (
              savedJourneys.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-16 h-16 text-[var(--color-text-muted)] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <p className="text-[var(--color-text-muted)] mb-2">No saved journeys yet</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Generate a journey to save it here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {savedJourneys.map((savedJourney) => (
                    <div
                      key={savedJourney.id}
                      className="bg-[var(--color-surface-light)] rounded-xl p-4 border border-transparent hover:border-[var(--color-primary)]/50 transition-colors relative group"
                    >
                      <button
                        onClick={() => handleSavedJourneySelect(savedJourney)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-[var(--color-text)] pr-8">
                            {savedJourney.journey.name}
                          </h3>
                          <button
                            onClick={(e) => handleDeleteSavedJourney(e, savedJourney.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[var(--color-error)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-2">
                          {savedJourney.journey.description || 'A therapeutic vibroacoustic journey'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {savedJourney.journey.duration_minutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                            {savedJourney.journey.phases.length} stages
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Saved {new Date(savedJourney.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredPresets.map(({ id, preset }) => (
                  <button
                    key={id}
                    onClick={() => handlePresetSelect(id)}
                    className="bg-[var(--color-surface-light)] rounded-xl p-4 text-left hover:bg-[var(--color-surface-light)]/80 transition-colors border border-transparent hover:border-[var(--color-primary)]/50"
                  >
                    <h3 className="font-medium text-[var(--color-text)] mb-1">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-2">
                      {preset.description || 'A therapeutic vibroacoustic journey'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {preset.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                        {preset.phases.length} stages
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
