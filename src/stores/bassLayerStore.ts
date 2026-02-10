/**
 * Bass Layer Store - Zustand state management for real-time bass synthesis
 * Supports two modes: "manual" (user controls) and "listen" (music-reactive)
 */

import { create } from 'zustand';
import { BassLayerEngine } from '../audio/bassLayer/BassLayerEngine';
import { MusicAnalyser } from '../audio/bassLayer/MusicAnalyser';
import type { AnalysisResult } from '../audio/bassLayer/MusicAnalyser';
import type { BassLayerConfig, BassLayerPreset, RhythmPattern, MusicalKey } from '../types/bassLayer';
import { DEFAULT_BASS_LAYER_CONFIG, KEY_FREQUENCIES, BASS_LAYER_PRESETS } from '../types/bassLayer';

export type BassLayerMode = 'manual' | 'listen';

interface BassLayerStore {
  mode: BassLayerMode;
  isPlaying: boolean;
  config: BassLayerConfig;
  currentPresetId: string | null;
  gainLevel: number;
  tapTimestamps: number[];
  engine: BassLayerEngine | null;

  // Listen mode state
  analyser: MusicAnalyser | null;
  analysisResult: AnalysisResult | null;
  listenError: string | null;

  // Mode switching
  setMode: (mode: BassLayerMode) => Promise<void>;

  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;

  setFrequency: (hz: number) => void;
  setMusicalKey: (key: MusicalKey) => void;
  setIntensity: (intensity: number) => void;
  setRhythmPattern: (pattern: RhythmPattern) => void;
  setBPM: (bpm: number) => void;

  applyPreset: (preset: BassLayerPreset) => void;

  recordTap: () => void;
  resetTaps: () => void;

  pollGainLevel: () => void;

  dispose: () => void;
}

export const useBassLayerStore = create<BassLayerStore>((set, get) => ({
  mode: 'manual',
  isPlaying: false,
  config: { ...DEFAULT_BASS_LAYER_CONFIG },
  currentPresetId: null,
  gainLevel: 0,
  tapTimestamps: [],
  engine: null,
  analyser: null,
  analysisResult: null,
  listenError: null,

  setMode: async (mode: BassLayerMode) => {
    const { isPlaying, analyser, engine, config } = get();

    // Stop listen mode analyser if switching away
    if (mode === 'manual' && analyser) {
      analyser.stop();
      // Restore the user's manual config
      engine?.setRhythmPattern(config.rhythmPattern);
      engine?.setBPM(config.bpm);
      engine?.setIntensity(config.intensity);
      engine?.setFrequency(config.frequency);
      set({ analyser: null, analysisResult: null, listenError: null });
    }

    // Start analyser if switching to listen mode while playing
    if (mode === 'listen' && isPlaying) {
      // Use breathing pattern for a smooth inhale/exhale pulse
      engine?.setRhythmPattern('breathing');
      engine?.setIntensity(0); // Start silent, will ramp up when music detected
      let a = get().analyser;
      if (!a) {
        a = new MusicAnalyser();
        set({ analyser: a, listenError: null });
      }
      try {
        await a.start();
      } catch (err) {
        // Restore manual config on failure
        engine?.setRhythmPattern(config.rhythmPattern);
        engine?.setIntensity(config.intensity);
        set({ listenError: 'Microphone access denied. Please allow microphone access to use Listen mode.' });
        set({ mode: 'manual' });
        return;
      }
    }

    set({ mode, listenError: null });
  },

  start: async () => {
    let { engine, mode } = get();
    if (!engine) {
      engine = new BassLayerEngine(get().config);
      set({ engine });
    }
    await engine.start();

    // Start analyser in listen mode
    if (mode === 'listen') {
      // Use breathing pattern for a smooth inhale/exhale pulse
      engine.setRhythmPattern('breathing');
      engine.setIntensity(0); // Start silent, ramps up when music detected
      let analyser = get().analyser;
      if (!analyser) {
        analyser = new MusicAnalyser();
        set({ analyser });
      }
      try {
        await analyser.start();
        set({ listenError: null });
      } catch {
        set({ listenError: 'Microphone access denied. Please allow microphone access to use Listen mode.' });
      }
    }

    set({ isPlaying: true });
  },

  stop: () => {
    const { engine, analyser } = get();
    engine?.stop();

    if (analyser) {
      analyser.stop();
    }

    set({ isPlaying: false, gainLevel: 0, analysisResult: null });
  },

  toggle: async () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().stop();
    } else {
      await get().start();
    }
  },

  setFrequency: (hz: number) => {
    const { engine, config } = get();
    engine?.setFrequency(hz);
    set({ config: { ...config, frequency: hz }, currentPresetId: null });
  },

  setMusicalKey: (key: MusicalKey) => {
    const hz = KEY_FREQUENCIES[key];
    const { engine, config } = get();
    engine?.setFrequency(hz);
    set({ config: { ...config, musicalKey: key, frequency: hz }, currentPresetId: null });
  },

  setIntensity: (intensity: number) => {
    const { engine, config } = get();
    engine?.setIntensity(intensity);
    set({ config: { ...config, intensity }, currentPresetId: null });
  },

  setRhythmPattern: (pattern: RhythmPattern) => {
    const { engine, config } = get();
    engine?.setRhythmPattern(pattern);
    set({ config: { ...config, rhythmPattern: pattern }, currentPresetId: null });
  },

  setBPM: (bpm: number) => {
    const clamped = Math.max(1, Math.min(200, Math.round(bpm)));
    const { engine, config } = get();
    engine?.setBPM(clamped);
    set({ config: { ...config, bpm: clamped }, currentPresetId: null });
  },

  applyPreset: (preset: BassLayerPreset) => {
    const { engine } = get();
    const newConfig = { ...preset.config };
    engine?.updateConfig(newConfig);
    set({ config: newConfig, currentPresetId: preset.id });
  },

  recordTap: () => {
    const now = Date.now();
    const { tapTimestamps } = get();

    // Reset if more than 2 seconds since last tap
    const lastTap = tapTimestamps[tapTimestamps.length - 1];
    if (lastTap && now - lastTap > 2000) {
      set({ tapTimestamps: [now] });
      return;
    }

    const newTaps = [...tapTimestamps, now].slice(-8);
    set({ tapTimestamps: newTaps });

    if (newTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(Math.max(40, Math.min(200, 60000 / avgInterval)));
      get().setBPM(bpm);
    }
  },

  resetTaps: () => {
    set({ tapTimestamps: [] });
  },

  pollGainLevel: () => {
    const { engine, isPlaying, mode, analyser } = get();

    // In listen mode, run analysis and drive the engine via patterns
    if (mode === 'listen' && analyser && isPlaying && engine) {
      const result = analyser.analyse();
      if (result) {
        set({ analysisResult: result });

        if (result.musicPresent) {
          // Lock oscillator to detected musical key
          const keyFreq = KEY_FREQUENCIES[result.musicalKey];
          engine.setFrequency(keyFreq);

          // Only update BPM if it changed by more than 5 to avoid
          // constant loop recreation which causes jolts
          if (result.bpm > 0) {
            const currentBpm = engine.getConfig().bpm;
            if (Math.abs(result.bpm - currentBpm) > 5) {
              engine.setBPM(result.bpm);
            }
          }

          // Smoothly breathe in the bass when music is playing
          engine.fadeIntensity(0.7, 2.0);
        } else {
          // Smoothly breathe out when music stops
          engine.fadeIntensity(0, 2.0);
        }
      }
    }

    if (!engine || !isPlaying) {
      set({ gainLevel: 0 });
      return;
    }
    set({ gainLevel: engine.getGainValue() });
  },

  dispose: () => {
    const { engine, analyser } = get();
    engine?.dispose();
    analyser?.dispose();
    set({ engine: null, analyser: null, isPlaying: false, gainLevel: 0, analysisResult: null, listenError: null });
  },
}));

export { BASS_LAYER_PRESETS };
