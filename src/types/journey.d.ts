/**
 * TypeScript interfaces for vibroacoustic journey configuration
 */
export type EntrainmentMode = 'none' | 'breathing' | 'heartbeat' | 'delta' | 'theta' | 'alpha';
export type RhythmMode = 'still' | 'breathing' | 'heartbeat' | 'theta' | 'alpha';
export interface FrequencyRange {
    start: number;
    end: number;
}
export interface AmplitudeRange {
    start: number;
    end: number;
}
export interface PhaseConfig {
    name: string;
    duration: number;
    frequency: FrequencyRange;
    amplitude: AmplitudeRange;
    breath_cycle_sec?: number;
    fm_depth?: number;
    fm_rate?: number;
    rhythm_mode?: RhythmMode;
    entrainment_mode?: EntrainmentMode;
    entrainment_rate?: number;
    support_frequency?: FrequencyRange;
}
export interface LayerConfig {
    base_carrier: boolean;
    support_carrier: boolean;
    texture_layer: boolean;
}
export interface JourneyConfig {
    name: string;
    description?: string;
    duration_minutes: number;
    sample_rate: number;
    phases: PhaseConfig[];
    layers: LayerConfig;
    safety?: SafetyConfig;
}
export interface SafetyConfig {
    max_rms_db: number;
    peak_ceiling_db: number;
    lowpass_hz: number;
    highpass_hz: number;
}
export declare const DEFAULT_SAFETY: SafetyConfig;
export declare const DEFAULT_LAYERS: LayerConfig;
export interface AudioParams {
    foundationFreq: number;
    harmonyFreq: number;
    intensity: number;
    rhythmMode: RhythmMode;
    rhythmRate: number;
    flowDepth: number;
    layers: {
        foundation: boolean;
        harmony: boolean;
        atmosphere: boolean;
    };
}
export interface EntrainmentPreset {
    rate: number;
    depth: number;
}
export declare const ENTRAINMENT_PRESETS: Record<EntrainmentMode, EntrainmentPreset>;
export declare const ENERGY_LEVELS: Record<string, [number, number]>;
export interface PresetCategory {
    name: string;
    description: string;
    icon: string;
    presets: string[];
}
export interface PresetIndex {
    categories: PresetCategory[];
}
export type ProgressCallback = (progress: RenderProgress) => void;
export interface RenderProgress {
    phase: string;
    stage: string;
    progress: number;
    message?: string;
}
export type ExportFormat = 'wav' | 'mp3';
export interface ExportSettings {
    format: ExportFormat;
    sampleRate: 22050 | 44100 | 48000;
    bitDepth?: 16 | 24 | 32;
    bitrate?: 128 | 192 | 256 | 320;
    channels: 1 | 2;
}
export declare const DEFAULT_EXPORT_SETTINGS: ExportSettings;
