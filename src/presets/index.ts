/**
 * Presets module - Static imports of journey presets
 */

import type { JourneyConfig, PresetIndex, PhaseConfig } from '../types/journey';

// Import preset JSON files
import deepRestJson from './deep_rest.json';
import blissWaveJson from './bliss_wave.json';
import clearMindJson from './clear_mind.json';
import deepFocusJson from './deep_focus.json';
import earthConnectionJson from './earth_connection.json';
import extendedPracticeJson from './extended_practice.json';
import gentleEnergizeJson from './gentle_energize.json';
import gentleReleaseJson from './gentle_release.json';
import gentleWavesJson from './gentle_waves.json';
import heartOpeningJson from './heart_opening.json';
import innerStillnessJson from './inner_stillness.json';
import joyJourneyJson from './joy_journey.json';
import morningRiseJson from './morning_rise.json';
import quickGroundJson from './quick_ground.json';
import stressReleaseJson from './stress_release.json';
import windDownJson from './wind_down.json';
import ketamineJourneyJson from './ketamine_journey.json';
import tantricConnectionJson from './tantric_connection.json';
import indexJson from './index.json';

// Helper to convert preset JSON to proper JourneyConfig
function convertPreset(json: Record<string, unknown>): JourneyConfig {
  const phases = (json.phases as Array<Record<string, unknown>>).map((p): PhaseConfig => ({
    name: p.name as string,
    duration: ((p.end_min as number) - (p.start_min as number)) || (p.duration as number) || 15,
    frequency: p.frequency as PhaseConfig['frequency'],
    amplitude: p.amplitude as PhaseConfig['amplitude'],
    breath_cycle_sec: p.breath_cycle_sec as number | undefined,
    fm_depth: p.fm_depth as number | undefined,
    fm_rate: p.fm_rate as number | undefined,
    rhythm_mode: p.rhythm_mode as PhaseConfig['rhythm_mode'],
    entrainment_mode: p.entrainment_mode as PhaseConfig['entrainment_mode'],
    entrainment_rate: p.entrainment_rate as number | undefined,
    support_frequency: p.support_frequency as PhaseConfig['support_frequency'],
  }));

  return {
    name: json.name as string,
    description: json.description as string | undefined,
    duration_minutes: json.duration_minutes as number,
    sample_rate: (json.sample_rate as number) || 48000,
    layers: json.layers as JourneyConfig['layers'],
    phases,
    safety: json.safety as JourneyConfig['safety'],
  };
}

// Export converted presets
export const presets: Record<string, JourneyConfig> = {
  deep_rest: convertPreset(deepRestJson as unknown as Record<string, unknown>),
  bliss_wave: convertPreset(blissWaveJson as unknown as Record<string, unknown>),
  clear_mind: convertPreset(clearMindJson as unknown as Record<string, unknown>),
  deep_focus: convertPreset(deepFocusJson as unknown as Record<string, unknown>),
  earth_connection: convertPreset(earthConnectionJson as unknown as Record<string, unknown>),
  extended_practice: convertPreset(extendedPracticeJson as unknown as Record<string, unknown>),
  gentle_energize: convertPreset(gentleEnergizeJson as unknown as Record<string, unknown>),
  gentle_release: convertPreset(gentleReleaseJson as unknown as Record<string, unknown>),
  gentle_waves: convertPreset(gentleWavesJson as unknown as Record<string, unknown>),
  heart_opening: convertPreset(heartOpeningJson as unknown as Record<string, unknown>),
  inner_stillness: convertPreset(innerStillnessJson as unknown as Record<string, unknown>),
  joy_journey: convertPreset(joyJourneyJson as unknown as Record<string, unknown>),
  morning_rise: convertPreset(morningRiseJson as unknown as Record<string, unknown>),
  quick_ground: convertPreset(quickGroundJson as unknown as Record<string, unknown>),
  stress_release: convertPreset(stressReleaseJson as unknown as Record<string, unknown>),
  wind_down: convertPreset(windDownJson as unknown as Record<string, unknown>),
  ketamine_journey: convertPreset(ketamineJourneyJson as unknown as Record<string, unknown>),
  tantric_connection: convertPreset(tantricConnectionJson as unknown as Record<string, unknown>),
};

// Export preset index
export const presetIndex: PresetIndex = indexJson as PresetIndex;

// Get preset by ID
export function getPreset(id: string): JourneyConfig | undefined {
  return presets[id];
}

// Get all presets in a category
export function getPresetsByCategory(categoryId: string): JourneyConfig[] {
  const category = presetIndex.categories.find((c) => c.name === categoryId);
  if (!category) return [];
  return category.presets.map((id) => presets[id]).filter(Boolean);
}
