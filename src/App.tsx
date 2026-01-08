/**
 * Sonic Journey Creator - Vite App
 * Generate therapeutic vibroacoustic audio with live playback and export
 */

import { useJourneyStore } from './stores/journeyStore';
import { Timeline } from './components/Timeline/Timeline';
import { PhaseControls } from './components/Controls/PhaseControls';
import { TransportBar } from './components/Transport/TransportBar';
import { PresetBrowser } from './components/PresetBrowser/PresetBrowser';
import { ExportDialog } from './components/ExportDialog/ExportDialog';

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

function Header() {
  const { journey, setShowPresetBrowser } = useJourneyStore();

  return (
    <header className="flex items-center justify-between p-6 border-b border-white/10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
          Sonic Journey Creator
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {journey.name} • {journey.duration_minutes} minutes
        </p>
      </div>
      <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 p-6 space-y-6">
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
        <div className="flex items-center justify-between">
          <PhaseSelector />
          <LayerToggles />
        </div>

        {/* Phase controls */}
        <PhaseControls />
      </main>

      {/* Modals */}
      <PresetBrowser />
      <ExportDialog />
    </div>
  );
}

export default App;
