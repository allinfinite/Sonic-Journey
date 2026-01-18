/**
 * Zustand store for journey state management
 */

import { create } from 'zustand';
import type { JourneyConfig, PhaseConfig, AudioParams, RhythmMode, ExportSettings, RenderProgress } from '../types/journey';
import { DEFAULT_LAYERS, DEFAULT_EXPORT_SETTINGS } from '../types/journey';
import { synthEngine } from '../audio/SynthEngine';
import { generateJourney as generateJourneyApi } from '../api/journeyGeneratorApi';
import { saveJourney, updateSavedJourney } from '../utils/journeyStorage';

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
      melody_enabled: true,
      melody_style: 'drone',
      melody_scale: 'pentatonic_minor',
      melody_intensity: 0.25,
      melody_density: 'sparse',
    },
    {
      name: 'Going Deeper',
      duration: 20,
      frequency: { start: 38, end: 32 },
      amplitude: { start: 0.5, end: 0.65 },
      breath_cycle_sec: 14,
      fm_depth: 0.1,
      rhythm_mode: 'breathing',
      melody_enabled: true,
      melody_style: 'drone',
      melody_scale: 'pentatonic_minor',
      melody_intensity: 0.3,
      melody_density: 'sparse',
    },
    {
      name: 'Deep Rest',
      duration: 30,
      frequency: { start: 32, end: 28 },
      amplitude: { start: 0.65, end: 0.7 },
      breath_cycle_sec: 16,
      fm_depth: 0.15,
      rhythm_mode: 'theta',
      melody_enabled: true,
      melody_style: 'drone',
      melody_scale: 'pentatonic_minor',
      melody_intensity: 0.25,
      melody_density: 'sparse',
    },
    {
      name: 'Rising Up',
      duration: 15,
      frequency: { start: 28, end: 38 },
      amplitude: { start: 0.7, end: 0.5 },
      breath_cycle_sec: 12,
      fm_depth: 0.1,
      rhythm_mode: 'breathing',
      melody_enabled: true,
      melody_style: 'mixed',
      melody_scale: 'pentatonic_major',
      melody_intensity: 0.3,
      melody_density: 'moderate',
    },
    {
      name: 'Coming Home',
      duration: 10,
      frequency: { start: 38, end: 45 },
      amplitude: { start: 0.5, end: 0.2 },
      breath_cycle_sec: 10,
      fm_depth: 0,
      rhythm_mode: 'breathing',
      melody_enabled: true,
      melody_style: 'drone',
      melody_scale: 'pentatonic_major',
      melody_intensity: 0.2,
      melody_density: 'sparse',
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
  showJourneyGenerator: boolean;

  // Generation state
  isGenerating: boolean;
  generationError: string | null;
  savedJourneyId: string | null; // ID of currently loaded saved journey

  // Actions
  setJourney: (journey: JourneyConfig) => void;
  setJourneyWithId: (journey: JourneyConfig, savedId: string | null) => void;
  saveCurrentJourney: () => string;
  updateCurrentJourney: () => void;
  updatePhase: (index: number, updates: Partial<PhaseConfig>) => void;
  selectPhase: (index: number) => void;
  addPhase: () => void;
  removePhase: (index: number) => void;
  setLayers: (layers: JourneyConfig['layers']) => void;
  toggleMelodyLayer: (enabled: boolean) => void;

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
  setShowJourneyGenerator: (show: boolean) => void;

  // Generation actions
  generateJourney: (prompt: string, duration: number) => Promise<void>;
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
  showJourneyGenerator: false,

  isGenerating: false,
  generationError: null,
  savedJourneyId: null,

  // Journey actions
  setJourney: (journey) => {
    set({ journey, isDirty: false, selectedPhaseIndex: 0, savedJourneyId: null });
    synthEngine.setJourneyConfig(journey);
  },

  setJourneyWithId: (journey, savedId) => {
    set({ journey, isDirty: false, selectedPhaseIndex: 0, savedJourneyId: savedId });
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

  toggleMelodyLayer: (enabled) => {
    const { journey } = get();
    const newLayers = { ...journey.layers, melody_layer: enabled };
    const newJourney = { ...journey, layers: newLayers };
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

  setShowJourneyGenerator: (show) => {
    set({ showJourneyGenerator: show });
  },

  // Generation actions
  generateJourney: async (prompt, duration) => {
    set({ isGenerating: true, generationError: null });

    try {
      const journey = await generateJourneyApi(prompt, duration);
      
      // Auto-save generated journeys
      const savedId = saveJourney(journey);
      
      set({ 
        journey, 
        isDirty: false, 
        selectedPhaseIndex: 0,
        savedJourneyId: savedId,
      });
      synthEngine.setJourneyConfig(journey);
      set({ isGenerating: false, showJourneyGenerator: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate journey';
      set({ isGenerating: false, generationError: errorMessage });
      throw error;
    }
  },

  // Save current journey
  saveCurrentJourney: () => {
    const { journey, savedJourneyId } = get();
    
    try {
      if (savedJourneyId) {
        // Update existing
        updateSavedJourney(savedJourneyId, journey);
        return savedJourneyId;
      } else {
        // Save new
        const id = saveJourney(journey);
        set({ savedJourneyId: id, isDirty: false });
        return id;
      }
    } catch (error) {
      console.error('Error saving journey:', error);
      throw error;
    }
  },

  // Update current saved journey
  updateCurrentJourney: () => {
    const { journey, savedJourneyId } = get();
    
    if (!savedJourneyId) {
      throw new Error('No saved journey to update');
    }
    
    try {
      updateSavedJourney(savedJourneyId, journey);
      set({ isDirty: false });
    } catch (error) {
      console.error('Error updating journey:', error);
      throw error;
    }
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
