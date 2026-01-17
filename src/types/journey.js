/**
 * TypeScript interfaces for vibroacoustic journey configuration
 */
// Default safety settings
export const DEFAULT_SAFETY = {
    max_rms_db: -12,
    peak_ceiling_db: -1,
    lowpass_hz: 120,
    highpass_hz: 20,
};
// Default layer configuration
export const DEFAULT_LAYERS = {
    base_carrier: true,
    support_carrier: true,
    texture_layer: false,
};
export const ENTRAINMENT_PRESETS = {
    none: { rate: 0, depth: 0 },
    breathing: { rate: 0.083, depth: 0.15 }, // ~12 sec cycle
    heartbeat: { rate: 1.0, depth: 0.25 }, // ~60 BPM
    delta: { rate: 2.0, depth: 0.2 }, // 2 Hz - deep sleep
    theta: { rate: 5.0, depth: 0.25 }, // 5 Hz - meditation
    alpha: { rate: 10.0, depth: 0.2 }, // 10 Hz - relaxation
};
// Energy level mapping (user-friendly frequency ranges)
export const ENERGY_LEVELS = {
    deep_grounding: [28, 32],
    grounding: [32, 38],
    centered: [38, 45],
    balanced: [45, 52],
    uplifting: [52, 62],
    energizing: [62, 75],
    activating: [75, 90],
};
// Default export settings
export const DEFAULT_EXPORT_SETTINGS = {
    format: 'wav',
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
};
