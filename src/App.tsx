/**
 * Sonic Journey Creator - Vite App
 * Generate therapeutic vibroacoustic audio with live playback and export
 */

import { useState } from 'react';
import { useJourneyStore } from './stores/journeyStore';
import { Timeline } from './components/Timeline/Timeline';
import { PhaseControls } from './components/Controls/PhaseControls';
import { TransportBar } from './components/Transport/TransportBar';
import { PresetBrowser } from './components/PresetBrowser/PresetBrowser';
import { ExportDialog } from './components/ExportDialog/ExportDialog';
import { BassGenerator } from './components/BassGenerator/BassGenerator';
import { JourneyGenerator } from './components/JourneyGenerator/JourneyGenerator';
import { BassPad } from './components/BassPad/BassPad';

type AppMode = 'journey' | 'bass' | 'basspad';

function PhaseSelector() {
  const { journey, selectedPhaseIndex, selectPhase, addPhase, removePhase } = useJourneyStore();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {journey.phases.map((phase, index) => (
        <button
          key={index}
          onClick={() => selectPhase(index)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedPhaseIndex === index
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]/80'
          }`}
        >
          {phase.name}
        </button>
      ))}
      <button
        onClick={addPhase}
        className="px-3 py-2 rounded-lg text-sm bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
        title="Add Phase"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      {journey.phases.length > 1 && (
        <button
          onClick={() => removePhase(selectedPhaseIndex)}
          className="px-3 py-2 rounded-lg text-sm bg-[var(--color-surface-light)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-colors"
          title="Remove Phase"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function LayerToggles() {
  const { journey, setLayers } = useJourneyStore();

  const handleToggle = (layer: keyof typeof journey.layers) => {
    setLayers({ ...journey.layers, [layer]: !journey.layers[layer] });
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[var(--color-text-muted)]">Layers:</span>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={journey.layers.base_carrier}
          onChange={() => handleToggle('base_carrier')}
          className="w-4 h-4 rounded accent-[var(--color-primary)]"
        />
        <span className="text-sm text-[var(--color-text)]">Foundation</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={journey.layers.support_carrier}
          onChange={() => handleToggle('support_carrier')}
          className="w-4 h-4 rounded accent-[var(--color-primary)]"
        />
        <span className="text-sm text-[var(--color-text)]">Harmony</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={journey.layers.texture_layer}
          onChange={() => handleToggle('texture_layer')}
          className="w-4 h-4 rounded accent-[var(--color-primary)]"
        />
        <span className="text-sm text-[var(--color-text)]">Atmosphere</span>
      </label>
    </div>
  );
}

function Header({ mode, onModeChange }: { mode: AppMode; onModeChange: (mode: AppMode) => void }) {
  const { journey, setShowPresetBrowser, setShowJourneyGenerator, saveCurrentJourney, isDirty, savedJourneyId } = useJourneyStore();
  
  const handleSave = () => {
    try {
      saveCurrentJourney();
      alert('Journey saved!');
    } catch (error) {
      alert('Failed to save journey');
      console.error(error);
    }
  };

  return (
    <header className="border-b border-white/10">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 px-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
            Sonic Journey
          </h1>
          {mode === 'journey' && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {journey.name} • {journey.duration_minutes} minutes
            </p>
          )}
          {mode === 'bass' && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Bass Track Generator for Vibe Table
            </p>
          )}
          {mode === 'basspad' && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Interactive Deep Bass Touch Pad
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {mode === 'journey' && (
            <>
              <button
                onClick={() => setShowJourneyGenerator(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white text-sm font-medium transition-opacity flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" />
                </svg>
                Create Journey
              </button>
              {(isDirty || savedJourneyId) && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-light)]/80 text-[var(--color-text)] text-sm font-medium transition-colors flex items-center gap-2"
                  title={savedJourneyId ? 'Update saved journey' : 'Save journey'}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {savedJourneyId ? 'Update' : 'Save'}
                </button>
              )}
              <button
                onClick={() => setShowPresetBrowser(true)}
                className="px-4 py-2 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-light)]/80 text-[var(--color-text)] text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Browse Journeys
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex px-6 gap-1">
        <button
          onClick={() => onModeChange('journey')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all relative ${
            mode === 'journey'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 18v-6a9 9 0 0118 0v6" />
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
            </svg>
            Journey Creator
          </span>
          {mode === 'journey' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>
        <button
          onClick={() => onModeChange('bass')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all relative ${
            mode === 'bass'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            Bass Generator
          </span>
          {mode === 'bass' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>
        <button
          onClick={() => onModeChange('basspad')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all relative ${
            mode === 'basspad'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <circle cx="15.5" cy="8.5" r="1.5" />
              <circle cx="8.5" cy="15.5" r="1.5" />
              <circle cx="15.5" cy="15.5" r="1.5" />
            </svg>
            Bass Pad
          </span>
          {mode === 'basspad' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>
      </div>
    </header>
  );
}

function JourneyCreator() {
  return (
    <>
      {/* Timeline */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">
          Journey Timeline
        </h2>
        <Timeline />
      </section>

      {/* Transport */}
      <TransportBar />

      {/* Phase selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PhaseSelector />
        <LayerToggles />
      </div>

      {/* Phase controls */}
      <PhaseControls />
    </>
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>('journey');

  return (
    <div className="min-h-screen flex flex-col">
      <Header mode={mode} onModeChange={setMode} />

      <main className="flex-1 p-6 space-y-6 bg-[var(--color-surface)]/30">
        {mode === 'journey' && <JourneyCreator />}
        {mode === 'bass' && <BassGenerator />}
        {mode === 'basspad' && <BassPad />}
      </main>

      {/* Modals */}
      <PresetBrowser />
      <ExportDialog />
      <JourneyGenerator />
    </div>
  );
}

export default App;
