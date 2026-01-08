/**
 * Zustand store for journey state management
 */

import { create } from 'zustand';
import type { JourneyConfig, PhaseConfig, AudioParams, RhythmMode, ExportSettings, RenderProgress } from '../types/journey';
import { DEFAULT_LAYERS, DEFAULT_EXPORT_SETTINGS } from '../types/journey';
import { synthEngine } from '../audio/SynthEngine';

// Default journey configuration
const defaultJourney: JourneyConfig = {
  name: 'Deep Rest Journey',
  description: 'A gentle 90-minute journey for deep relaxation',
  duration_minutes: 90,
  sample_rate: 48000,
  layers: { ...DEFAULT_LAYERS },
  phases: [
    {
      name: 'Settling In',
      duration: 15,
      frequency: { start: 45, end: 38 },
      amplitude: { start: 0.3, end: 0.5 },
      breath_cycle_sec: 12,
      fm_depth: 0,
      rhythm_mode: 'breathing',
    },
    {
      name: 'Going Deeper',
      duration: 20,
      frequency: { start: 38, end: 32 },
      amplitude: { start: 0.5, end: 0.65 },
      breath_cycle_sec: 14,
      fm_depth: 0.1,
      rhythm_mode: 'breathing',
    },
    {
      name: 'Deep Rest',
      duration: 30,
      frequency: { start: 32, end: 28 },
      amplitude: { start: 0.65, end: 0.7 },
      breath_cycle_sec: 16,
      fm_depth: 0.15,
      rhythm_mode: 'theta',
    },
    {
      name: 'Rising Up',
      duration: 15,
      frequency: { start: 28, end: 38 },
      amplitude: { start: 0.7, end: 0.5 },
      breath_cycle_sec: 12,
      fm_depth: 0.1,
      rhythm_mode: 'breathing',
    },
    {
      name: 'Coming Home',
      duration: 10,
      frequency: { start: 38, end: 45 },
      amplitude: { start: 0.5, end: 0.2 },
      breath_cycle_sec: 10,
      fm_depth: 0,
      rhythm_mode: 'breathing',
    },
  ],
};

interface JourneyState {
  // Journey config
  journey: JourneyConfig;
  selectedPhaseIndex: number;
  isDirty: boolean;

  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  currentPhaseIndex: number;

  // Export state
  isExporting: boolean;
  exportProgress: RenderProgress | null;
  exportSettings: ExportSettings;

  // UI state
  showPresetBrowser: boolean;
  showExportDialog: boolean;

  // Actions
  setJourney: (journey: JourneyConfig) => void;
  updatePhase: (index: number, updates: Partial<PhaseConfig>) => void;
  selectPhase: (index: number) => void;
  addPhase: () => void;
  removePhase: (index: number) => void;
  setLayers: (layers: JourneyConfig['layers']) => void;

  // Playback actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setCurrentPhaseIndex: (index: number) => void;

  // Live modulation
  updateLiveParameter: (param: keyof AudioParams, value: number | RhythmMode | AudioParams['layers']) => void;

  // Export actions
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: RenderProgress | null) => void;

  // UI actions
  setShowPresetBrowser: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
}

export const useJourneyStore = create<JourneyState>((set, get) => ({
  // Initial state
  journey: defaultJourney,
  selectedPhaseIndex: 0,
  isDirty: false,

  isPlaying: false,
  isPaused: false,
  currentTime: 0,
  currentPhaseIndex: 0,

  isExporting: false,
  exportProgress: null,
  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },

  showPresetBrowser: false,
  showExportDialog: false,

  // Journey actions
  setJourney: (journey) => {
    set({ journey, isDirty: false, selectedPhaseIndex: 0 });
    synthEngine.setJourneyConfig(journey);
  },

  updatePhase: (index, updates) => {
    const { journey } = get();
    const newPhases = [...journey.phases];
    newPhases[index] = { ...newPhases[index], ...updates };

    const newJourney = {
      ...journey,
      phases: newPhases,
      duration_minutes: newPhases.reduce((sum, p) => sum + p.duration, 0),
    };

    set({ journey: newJourney, isDirty: true });
    synthEngine.setJourneyConfig(newJourney);
  },

  selectPhase: (index) => {
    set({ selectedPhaseIndex: index });
  },

  addPhase: () => {
    const { journey } = get();
    const newPhase: PhaseConfig = {
      name: `Phase ${journey.phases.length + 1}`,
      duration: 10,
      frequency: { start: 40, end: 40 },
      amplitude: { start: 0.5, end: 0.5 },
      breath_cycle_sec: 12,
      fm_depth: 0,
      rhythm_mode: 'breathing',
    };

    const newJourney = {
      ...journey,
      phases: [...journey.phases, newPhase],
      duration_minutes: journey.duration_minutes + 10,
    };

    set({ journey: newJourney, isDirty: true });
    synthEngine.setJourneyConfig(newJourney);
  },

  removePhase: (index) => {
    const { journey, selectedPhaseIndex } = get();
    if (journey.phases.length <= 1) return;

    const removedDuration = journey.phases[index].duration;
    const newPhases = journey.phases.filter((_, i) => i !== index);

    const newJourney = {
      ...journey,
      phases: newPhases,
      duration_minutes: journey.duration_minutes - removedDuration,
    };

    set({
      journey: newJourney,
      isDirty: true,
      selectedPhaseIndex: Math.min(selectedPhaseIndex, newPhases.length - 1),
    });
    synthEngine.setJourneyConfig(newJourney);
  },

  setLayers: (layers) => {
    const { journey } = get();
    const newJourney = { ...journey, layers };
    set({ journey: newJourney, isDirty: true });
    synthEngine.setJourneyConfig(newJourney);
  },

  // Playback actions
  play: () => {
    synthEngine.play();
    set({ isPlaying: true, isPaused: false });
  },

  pause: () => {
    synthEngine.pause();
    set({ isPlaying: false, isPaused: true });
  },

  stop: () => {
    synthEngine.stop();
    set({ isPlaying: false, isPaused: false, currentTime: 0, currentPhaseIndex: 0 });
  },

  seek: (time) => {
    synthEngine.seek(time);
    set({ currentTime: time });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setCurrentPhaseIndex: (index) => {
    set({ currentPhaseIndex: index });
  },

  // Live modulation
  updateLiveParameter: (param, value) => {
    synthEngine.updateParameter(param, value);
  },

  // Export actions
  setExportSettings: (settings) => {
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...settings },
    }));
  },

  setExporting: (isExporting) => {
    set({ isExporting });
  },

  setExportProgress: (progress) => {
    set({ exportProgress: progress });
  },

  // UI actions
  setShowPresetBrowser: (show) => {
    set({ showPresetBrowser: show });
  },

  setShowExportDialog: (show) => {
    set({ showExportDialog: show });
  },
}));

// Initialize synth engine callbacks
synthEngine.setCallbacks({
  onTimeUpdate: (time) => {
    useJourneyStore.getState().setCurrentTime(time);
  },
  onPlayStateChange: (isPlaying) => {
    if (isPlaying) {
      useJourneyStore.setState({ isPlaying: true, isPaused: false });
    } else {
      useJourneyStore.setState({ isPlaying: false });
    }
  },
  onPhaseChange: (index) => {
    useJourneyStore.getState().setCurrentPhaseIndex(index);
  },
});

// Set initial journey config
synthEngine.setJourneyConfig(defaultJourney);
