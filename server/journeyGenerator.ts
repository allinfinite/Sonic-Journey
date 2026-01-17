/**
 * AI Journey Generator - Uses OpenAI GPT to generate vibroacoustic journeys
 * from natural language prompts
 */

import OpenAI from 'openai';
import type { JourneyConfig, PhaseConfig, RhythmMode } from '../src/types/journey';
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
- "theta": Theta wave entrainment (4-7 Hz)
- "alpha": Alpha wave entrainment (8-12 Hz)

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

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "name": "Journey Name",
  "description": "Brief description",
  "duration_minutes": <number>,
  "sample_rate": 48000,
  "layers": {
    "base_carrier": true,
    "support_carrier": true,
    "texture_layer": false
  },
  "phases": [
    {
      "name": "Phase Name",
      "duration": <minutes>,
      "frequency": { "start": <Hz>, "end": <Hz> },
      "amplitude": { "start": <0-1>, "end": <0-1> },
      "breath_cycle_sec": <seconds>,
      "fm_depth": <0-0.2>,
      "rhythm_mode": "breathing" | "still" | "heartbeat" | "theta" | "alpha",
      "entrainment_mode": "breathing" | "none" | "heartbeat" | "theta" | "alpha"
    }
  ]
}

IMPORTANT:
- Phase durations must sum to exactly match duration_minutes
- All frequencies must be between 20-120 Hz
- All amplitudes must be between 0-1
- Use appropriate rhythm modes for the therapeutic intent
- Create smooth transitions between phases`;
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

    // Validate rhythm mode
    const validRhythms: RhythmMode[] = ['still', 'breathing', 'heartbeat', 'theta', 'alpha'];
    const rhythmMode = validRhythms.includes(phase.rhythm_mode)
      ? phase.rhythm_mode
      : 'breathing';

    return {
      name: phase.name || `Phase ${index + 1}`,
      duration: Math.max(1, Math.min(60, duration)), // 1-60 minutes per phase
      frequency: { start: freqStart, end: freqEnd },
      amplitude: { start: ampStart, end: ampEnd },
      breath_cycle_sec: Math.max(8, Math.min(24, phase.breath_cycle_sec || 12)),
      fm_depth: Math.max(0, Math.min(0.2, phase.fm_depth || 0.1)),
      rhythm_mode: rhythmMode,
      entrainment_mode: phase.entrainment_mode || phase.rhythm_mode || 'breathing',
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
    phases,
  };
}
