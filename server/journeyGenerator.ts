/**
 * AI Journey Generator - Uses OpenAI GPT to generate vibroacoustic journeys
 * from natural language prompts
 */

import OpenAI from 'openai';
import type { JourneyConfig, PhaseConfig, RhythmMode, NovaPattern } from '../src/types/journey';
import { DEFAULT_LAYERS, DEFAULT_SAFETY } from '../src/types/journey';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerationRequest {
  prompt: string;
  duration: number; // in minutes
}

/**
 * Generate a journey configuration from a user prompt
 */
export async function generateJourney(
  request: GenerationRequest
): Promise<JourneyConfig> {
  const { prompt, duration } = request;

  const systemPrompt = createSystemPrompt();
  const userPrompt = createUserPrompt(prompt, duration);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o (latest available)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(responseContent);
    const journey = validateAndNormalizeJourney(parsed, duration);

    return journey;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(
      `Failed to generate journey: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create the system prompt with instructions and examples
 */
function createSystemPrompt(): string {
  return `You are an expert in vibroacoustic therapy and sound healing. Your task is to generate therapeutic audio journey configurations based on user descriptions.

VIBROACOUSTIC PRINCIPLES:
- Frequencies 20-40 Hz: Deep grounding, body resonance, delta/theta states
- Frequencies 40-60 Hz: Centered, balanced, alpha states
- Frequencies 60-90 Hz: Energizing, activating, beta states
- Lower frequencies (20-40 Hz) promote deep relaxation and rest
- Higher frequencies (60-90 Hz) promote alertness and energy

RHYTHM MODES:
- "still": No pulsing (for steady states)
- "breathing": Slow breathing rhythm (~12-16 sec cycles)
- "heartbeat": Heartbeat rhythm (~60 BPM)
- "delta": Delta wave entrainment (1-4 Hz) - deep sleep, trance
- "theta": Theta wave entrainment (4-7 Hz) - meditation, hypnagogic
- "alpha": Alpha wave entrainment (8-12 Hz) - visuals, flow states
- "beta": Beta wave entrainment (13-30 Hz) - focus, alertness
- "gamma": Gamma wave entrainment (30-50 Hz) - cognitive enhancement

PHASE STRUCTURE:
A journey typically has 3-6 phases:
1. Opening/Settling (10-20% of duration) - Gentle entry, fade in
2. Main Journey (40-60% of duration) - Core therapeutic experience
3. Transition/Integration (10-20% of duration) - Processing and shifting
4. Closing/Return (10-20% of duration) - Gentle return, fade out

AMPLITUDE GUIDELINES:
- Start phases at 0.0-0.3 for gentle entry
- Peak at 0.5-0.7 for main journey phases
- End at 0.0-0.3 for gentle exit
- Never exceed 0.8 for safety

FREQUENCY GUIDELINES:
- Deep relaxation/meditation: 28-40 Hz
- Balanced/centered: 40-50 Hz
- Energizing/uplifting: 50-70 Hz
- Activating: 70-90 Hz
- Always stay within 20-120 Hz range

NOVA LIGHT MASK PATTERNS:
Nova patterns create synchronized light flicker for enhanced entrainment:
- "steady": Fixed frequency flicker (simple, effective)
- "sweep": Smooth frequency transition (e.g., 10Hz to 6Hz over phase)
- "wave": Sinusoidal modulation (organic, breathing feel)
- "burst": Groups of flashes with pauses (attention-grabbing)
- "rhythm": Custom on/off pattern (heartbeat, breathing)

Nova pattern guidelines:
- Use "sweep" for transition phases (settling, returning)
- Use "wave" for meditative states (theta, delta)
- Use "burst" for activation/focus phases (beta)
- Use "steady" for simple entrainment
- Base frequency should match entrainment: delta=3Hz, theta=6Hz, alpha=10Hz, beta=15Hz

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "name": "Journey Name",
  "description": "Brief description",
  "duration_minutes": <number>,
  "sample_rate": 48000,
  "nova_enabled": true,
  "layers": {
    "base_carrier": true,
    "support_carrier": true,
    "texture_layer": false,
    "melody_layer": true
  },
  "phases": [
    {
      "name": "Phase Name",
      "duration": <minutes>,
      "frequency": { "start": <Hz>, "end": <Hz> },
      "amplitude": { "start": <0-1>, "end": <0-1> },
      "breath_cycle_sec": <seconds>,
      "fm_depth": <0-0.2>,
      "rhythm_mode": "breathing" | "still" | "heartbeat" | "delta" | "theta" | "alpha" | "beta" | "gamma",
      "entrainment_mode": "breathing" | "none" | "heartbeat" | "delta" | "theta" | "alpha" | "beta" | "gamma",
      "entrainment_rate": <optional Hz for exact entrainment>,
      "nova_enabled": true,
      "nova_pattern": {
        "type": "steady" | "sweep" | "wave" | "burst" | "rhythm",
        "baseFrequency": <Hz>,
        "targetFrequency": <Hz for sweep>,
        "waveAmplitude": <Hz variation for wave>,
        "wavePeriod": <ms for wave>,
        "burstCount": <flashes for burst>,
        "burstGap": <ms gap for burst>
      },
      "binaural_enabled": true,
      "binaural_beat_frequency": <Hz matching entrainment>,
      "melody_enabled": true,
      "melody_style": "drone" | "arpeggio" | "evolving" | "harmonic" | "mixed",
      "melody_scale": "pentatonic_minor" | "pentatonic_major" | "dorian" | "lydian" | "natural_minor",
      "melody_intensity": <0-1, typically 0.2-0.4>,
      "melody_density": "sparse" | "moderate" | "dense"
    }
  ]
}

IMPORTANT:
- Phase durations must sum to exactly match duration_minutes
- All frequencies must be between 20-120 Hz
- All amplitudes must be between 0-1
- Use appropriate rhythm modes for the therapeutic intent
- Create smooth transitions between phases
- Include nova_pattern for each phase to create dynamic light experiences
- Match nova_pattern type to phase purpose (sweep for transitions, wave for meditation, burst for activation)
- Include binaural_enabled and binaural_beat_frequency matching the entrainment for enhanced neural synchronization

MELODY LAYER:
The melody layer adds ambient melodic content that enhances the therapeutic experience:
- "drone": Long sustained pad tones - use for deep meditation, theta/delta states, settling phases
- "arpeggio": Rhythmic arpeggiated patterns - use for active focus, alpha/beta states, energizing phases
- "evolving": Probabilistic evolving sequences - use for dynamic flow states, peak experiences
- "harmonic": Harmonic overtones based on foundation frequency - use for rich, resonant phases
- "mixed": Combination of styles - use for transitions and complex phases

Melody scale guidelines:
- "pentatonic_minor": Darker, meditative - use for deep rest, theta states
- "pentatonic_major": Brighter, uplifting - use for energizing, alpha states
- "dorian": Mystical, flowing - use for transitions and flow states
- "lydian": Ethereal, spacious - use for peak experiences
- "natural_minor": Melancholic, introspective - use for emotional processing

Melody intensity: 0.2-0.4 (keep subtle, supporting the foundation frequencies)
Melody density: "sparse" for deep states, "moderate" for active states, "dense" for peak experiences
- Always include melody_enabled: true and appropriate melody configuration for each phase`;
}

/**
 * Create the user prompt from their input
 */
function createUserPrompt(userPrompt: string, duration: number): string {
  return `Create a vibroacoustic therapy journey based on this description:

"${userPrompt}"

Requirements:
- Total duration: ${duration} minutes
- Generate 3-6 phases that create a complete therapeutic arc
- Match the frequency ranges and rhythms to the user's intent
- Ensure smooth transitions between phases
- Make phase names descriptive and meaningful

Return the journey configuration as JSON.`;
}

/**
 * Generate a Nova pattern based on rhythm mode if not provided
 */
function generateNovaPattern(
  rhythmMode: RhythmMode,
  entrainmentRate?: number,
  phaseIndex?: number,
  totalPhases?: number
): NovaPattern {
  // Get base frequency from entrainment rate or rhythm mode
  let baseFreq = entrainmentRate || 10;
  if (!entrainmentRate) {
    switch (rhythmMode) {
      case 'delta': baseFreq = 3; break;
      case 'theta': baseFreq = 6; break;
      case 'alpha': baseFreq = 10; break;
      case 'beta': baseFreq = 15; break;
      case 'gamma': baseFreq = 40; break;
      default: baseFreq = 10;
    }
  }

  // Determine pattern type based on context
  const isFirstPhase = phaseIndex === 0;
  const isLastPhase = totalPhases && phaseIndex === totalPhases - 1;

  // First/last phases get sweeps for transition
  if (isFirstPhase) {
    return {
      type: 'sweep',
      baseFrequency: Math.max(baseFreq, 8), // Start higher
      targetFrequency: baseFreq,
      randomVariation: 10,
    };
  }

  if (isLastPhase) {
    return {
      type: 'sweep',
      baseFrequency: baseFreq,
      targetFrequency: Math.max(baseFreq, 10), // End at alert state
      randomVariation: 10,
    };
  }

  // Pattern type based on rhythm mode
  switch (rhythmMode) {
    case 'delta':
      // Very slow wave for deep states
      return {
        type: 'wave',
        baseFrequency: baseFreq,
        waveAmplitude: 0.5,
        wavePeriod: 20000,
        randomVariation: 25,
      };

    case 'theta':
      // Gentle wave for meditation
      return {
        type: 'wave',
        baseFrequency: baseFreq,
        waveAmplitude: 1,
        wavePeriod: 12000,
        randomVariation: 15,
      };

    case 'alpha':
      // Smooth wave for visuals/flow
      return {
        type: 'wave',
        baseFrequency: baseFreq,
        waveAmplitude: 1.5,
        wavePeriod: 6000,
        randomVariation: 15,
      };

    case 'beta':
      // Burst pattern for focus/activation
      return {
        type: 'burst',
        baseFrequency: baseFreq,
        burstCount: 5,
        burstGap: 400,
      };

    case 'gamma':
      // Steady with slight variation for cognitive enhancement
      return {
        type: 'steady',
        baseFrequency: 40,
        randomVariation: 5,
      };

    case 'heartbeat':
      // Heartbeat rhythm pattern
      return {
        type: 'rhythm',
        baseFrequency: baseFreq,
        rhythmPattern: [100, 200, 100, 600],
      };

    case 'breathing':
      // Organic wave that feels like breathing
      return {
        type: 'wave',
        baseFrequency: baseFreq,
        waveAmplitude: 2,
        wavePeriod: 12000, // ~12 sec breath cycle
        randomVariation: 15,
      };

    default:
      // Default to wave pattern
      return {
        type: 'wave',
        baseFrequency: baseFreq,
        waveAmplitude: 1.5,
        wavePeriod: 8000,
        randomVariation: 10,
      };
  }
}

/**
 * Get binaural beat frequency from rhythm mode
 */
function getBinauralFrequency(rhythmMode: RhythmMode, entrainmentRate?: number): number {
  if (entrainmentRate) return entrainmentRate;
  
  switch (rhythmMode) {
    case 'delta': return 3;
    case 'theta': return 6;
    case 'alpha': return 10;
    case 'beta': return 15;
    case 'gamma': return 40;
    default: return 10;
  }
}

/**
 * Validate and normalize the generated journey config
 */
function validateAndNormalizeJourney(
  parsed: any,
  requestedDuration: number
): JourneyConfig {
  // Validate structure
  if (!parsed.name || !parsed.phases || !Array.isArray(parsed.phases)) {
    throw new Error('Invalid journey structure from AI');
  }

  const totalPhases = parsed.phases.length;

  // Normalize phases
  const phases: PhaseConfig[] = parsed.phases.map((phase: any, index: number) => {
    // Calculate duration from start/end or use duration field
    let duration = phase.duration;
    if (phase.start_min !== undefined && phase.end_min !== undefined) {
      duration = phase.end_min - phase.start_min;
    }
    if (!duration || duration <= 0) {
      duration = 15; // Default
    }

    // Validate frequency
    const freqStart = Math.max(20, Math.min(120, phase.frequency?.start || 40));
    const freqEnd = Math.max(20, Math.min(120, phase.frequency?.end || 40));

    // Validate amplitude
    const ampStart = Math.max(0, Math.min(1, phase.amplitude?.start || 0.5));
    const ampEnd = Math.max(0, Math.min(1, phase.amplitude?.end || 0.5));

    // Validate rhythm mode (expanded set)
    const validRhythms: RhythmMode[] = ['still', 'breathing', 'heartbeat', 'delta', 'theta', 'alpha', 'beta', 'gamma'];
    const rhythmMode = validRhythms.includes(phase.rhythm_mode)
      ? phase.rhythm_mode
      : 'breathing';

    // Get entrainment rate if provided
    const entrainmentRate = phase.entrainment_rate ? 
      Math.max(1, Math.min(50, phase.entrainment_rate)) : undefined;

    // Generate or validate nova pattern
    let novaPattern: NovaPattern | undefined;
    if (phase.nova_pattern && phase.nova_pattern.type) {
      // Validate provided pattern
      const validTypes = ['steady', 'sweep', 'wave', 'burst', 'rhythm', 'pulse', 'random'];
      if (validTypes.includes(phase.nova_pattern.type)) {
        novaPattern = {
          type: phase.nova_pattern.type,
          baseFrequency: Math.max(1, Math.min(50, phase.nova_pattern.baseFrequency || 10)),
          targetFrequency: phase.nova_pattern.targetFrequency ? 
            Math.max(1, Math.min(50, phase.nova_pattern.targetFrequency)) : undefined,
          waveAmplitude: phase.nova_pattern.waveAmplitude ?
            Math.max(0.5, Math.min(5, phase.nova_pattern.waveAmplitude)) : undefined,
          wavePeriod: phase.nova_pattern.wavePeriod ?
            Math.max(2000, Math.min(20000, phase.nova_pattern.wavePeriod)) : undefined,
          burstCount: phase.nova_pattern.burstCount ?
            Math.max(2, Math.min(10, phase.nova_pattern.burstCount)) : undefined,
          burstGap: phase.nova_pattern.burstGap ?
            Math.max(200, Math.min(2000, phase.nova_pattern.burstGap)) : undefined,
          randomVariation: phase.nova_pattern.randomVariation ?
            Math.max(0, Math.min(50, phase.nova_pattern.randomVariation)) : undefined,
        };
      }
    }
    
    // Auto-generate nova pattern if not provided
    if (!novaPattern) {
      novaPattern = generateNovaPattern(rhythmMode, entrainmentRate, index, totalPhases);
    }

    // Get binaural frequency
    const binauralFreq = phase.binaural_beat_frequency ?
      Math.max(1, Math.min(50, phase.binaural_beat_frequency)) :
      getBinauralFrequency(rhythmMode, entrainmentRate);

    return {
      name: phase.name || `Phase ${index + 1}`,
      duration: Math.max(1, Math.min(60, duration)), // 1-60 minutes per phase
      frequency: { start: freqStart, end: freqEnd },
      amplitude: { start: ampStart, end: ampEnd },
      breath_cycle_sec: Math.max(8, Math.min(24, phase.breath_cycle_sec || 12)),
      fm_depth: Math.max(0, Math.min(0.2, phase.fm_depth || 0.1)),
      rhythm_mode: rhythmMode,
      entrainment_mode: phase.entrainment_mode || rhythmMode || 'breathing',
      entrainment_rate: entrainmentRate,
      nova_enabled: phase.nova_enabled !== false,
      nova_pattern: novaPattern,
      binaural_enabled: phase.binaural_enabled !== false,
      binaural_beat_frequency: binauralFreq,
      binaural_carrier_frequency: phase.binaural_carrier_frequency || 200,
      // Melody configuration
      melody_enabled: phase.melody_enabled !== false,
      melody_style: phase.melody_style || (rhythmMode === 'theta' || rhythmMode === 'delta' ? 'drone' : 
                                          rhythmMode === 'alpha' || rhythmMode === 'beta' ? 'arpeggio' : 'mixed'),
      melody_scale: phase.melody_scale || (rhythmMode === 'theta' || rhythmMode === 'delta' ? 'pentatonic_minor' : 'pentatonic_major'),
      melody_intensity: phase.melody_intensity !== undefined ? 
        Math.max(0.1, Math.min(0.5, phase.melody_intensity)) : 
        Math.max(0.2, Math.min(0.4, ((ampStart + ampEnd) / 2) * 0.5)),
      melody_density: phase.melody_density || 
        (rhythmMode === 'theta' || rhythmMode === 'delta' ? 'sparse' : 
         rhythmMode === 'alpha' || rhythmMode === 'beta' ? 'moderate' : 'sparse'),
    };
  });

  // Adjust phase durations to match requested duration
  const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);
  if (Math.abs(totalDuration - requestedDuration) > 1) {
    // Scale durations proportionally
    const scale = requestedDuration / totalDuration;
    phases.forEach((phase) => {
      phase.duration = Math.max(1, Math.round(phase.duration * scale));
    });

    // Fine-tune to exact duration
    const newTotal = phases.reduce((sum, p) => sum + p.duration, 0);
    const diff = requestedDuration - newTotal;
    if (diff !== 0 && phases.length > 0) {
      // Adjust the longest phase
      const longestIndex = phases.reduce(
        (maxIdx, p, idx) => (p.duration > phases[maxIdx].duration ? idx : maxIdx),
        0
      );
      phases[longestIndex].duration += diff;
    }
  }

  // Final validation
  const finalTotal = phases.reduce((sum, p) => sum + p.duration, 0);
  if (Math.abs(finalTotal - requestedDuration) > 1) {
    throw new Error(`Phase durations don't match requested duration: ${finalTotal} vs ${requestedDuration}`);
  }

  return {
    name: parsed.name || 'Generated Journey',
    description: parsed.description || `A ${requestedDuration}-minute therapeutic journey`,
    duration_minutes: requestedDuration,
    sample_rate: parsed.sample_rate || 48000,
    layers: parsed.layers || DEFAULT_LAYERS,
    safety: parsed.safety || DEFAULT_SAFETY,
    nova_enabled: parsed.nova_enabled !== false, // Enable Nova by default
    phases,
  };
}
