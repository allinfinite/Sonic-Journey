/**
 * Vercel serverless function for journey generation
 * Self-contained with all necessary code to avoid import issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Types (inlined to avoid import issues)
type RhythmMode = 'still' | 'breathing' | 'heartbeat' | 'theta' | 'alpha';
type EntrainmentMode = 'none' | 'breathing' | 'heartbeat' | 'delta' | 'theta' | 'alpha';

interface FrequencyRange {
  start: number;
  end: number;
}

interface AmplitudeRange {
  start: number;
  end: number;
}

interface PhaseConfig {
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

interface LayerConfig {
  base_carrier: boolean;
  support_carrier: boolean;
  texture_layer: boolean;
}

interface SafetyConfig {
  max_rms_db: number;
  peak_ceiling_db: number;
}

interface JourneyConfig {
  name: string;
  description?: string;
  duration_minutes: number;
  sample_rate: number;
  layers: LayerConfig;
  safety: SafetyConfig;
  phases: PhaseConfig[];
}

const DEFAULT_LAYERS: LayerConfig = {
  base_carrier: true,
  support_carrier: true,
  texture_layer: false,
};

const DEFAULT_SAFETY: SafetyConfig = {
  max_rms_db: -14,
  peak_ceiling_db: -1,
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      "rhythm_mode": "breathing" | "still" | "heartbeat" | "theta" | "alpha",
      "entrainment_mode": "breathing" | "none" | "heartbeat" | "theta" | "alpha",
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

MELODY LAYER:
The melody layer adds ambient melodic content:
- "drone": Long sustained pad tones - for deep meditation, theta/delta states
- "arpeggio": Rhythmic arpeggiated patterns - for active focus, alpha/beta states
- "evolving": Probabilistic evolving sequences - for dynamic flow states
- "harmonic": Harmonic overtones - for rich, resonant phases
- "mixed": Combination of styles - for transitions

Melody scales: "pentatonic_minor" (meditative), "pentatonic_major" (uplifting), "dorian" (flowing), "lydian" (ethereal), "natural_minor" (introspective)
Melody intensity: 0.2-0.4 (keep subtle, supporting foundation)
Melody density: "sparse" (deep states), "moderate" (active states), "dense" (peak experiences)
- Always include melody configuration for each phase`;
}

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

function validateAndNormalizeJourney(
  parsed: any,
  requestedDuration: number
): JourneyConfig {
  if (!parsed.name || !parsed.phases || !Array.isArray(parsed.phases)) {
    throw new Error('Invalid journey structure from AI');
  }

  const phases: PhaseConfig[] = parsed.phases.map((phase: any, index: number) => {
    let duration = phase.duration;
    if (phase.start_min !== undefined && phase.end_min !== undefined) {
      duration = phase.end_min - phase.start_min;
    }
    if (!duration || duration <= 0) {
      duration = 15;
    }

    const freqStart = Math.max(20, Math.min(120, phase.frequency?.start || 40));
    const freqEnd = Math.max(20, Math.min(120, phase.frequency?.end || 40));

    const ampStart = Math.max(0, Math.min(1, phase.amplitude?.start || 0.5));
    const ampEnd = Math.max(0, Math.min(1, phase.amplitude?.end || 0.5));

    const validRhythms: RhythmMode[] = ['still', 'breathing', 'heartbeat', 'theta', 'alpha'];
    const rhythmMode = validRhythms.includes(phase.rhythm_mode)
      ? phase.rhythm_mode
      : 'breathing';

    return {
      name: phase.name || `Phase ${index + 1}`,
      duration: Math.max(1, Math.min(60, duration)),
      frequency: { start: freqStart, end: freqEnd },
      amplitude: { start: ampStart, end: ampEnd },
      breath_cycle_sec: Math.max(8, Math.min(24, phase.breath_cycle_sec || 12)),
      fm_depth: Math.max(0, Math.min(0.2, phase.fm_depth || 0.1)),
      rhythm_mode: rhythmMode,
      entrainment_mode: phase.entrainment_mode || phase.rhythm_mode || 'breathing',
    };
  });

  const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);
  if (Math.abs(totalDuration - requestedDuration) > 1) {
    const scale = requestedDuration / totalDuration;
    phases.forEach((phase) => {
      phase.duration = Math.max(1, Math.round(phase.duration * scale));
    });

    const newTotal = phases.reduce((sum, p) => sum + p.duration, 0);
    const diff = requestedDuration - newTotal;
    if (diff !== 0 && phases.length > 0) {
      const longestIndex = phases.reduce(
        (maxIdx, p, idx) => (p.duration > phases[maxIdx].duration ? idx : maxIdx),
        0
      );
      phases[longestIndex].duration += diff;
    }
  }

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

async function generateJourney(prompt: string, duration: number): Promise<JourneyConfig> {
  const systemPrompt = createSystemPrompt();
  const userPrompt = createUserPrompt(prompt, duration);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
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
  return validateAndNormalizeJourney(parsed, duration);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'OPENAI_API_KEY environment variable is not set. Please configure it in Vercel project settings.',
    });
  }

  const { prompt, duration } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!duration || typeof duration !== 'number' || duration < 5 || duration > 180) {
    return res.status(400).json({ error: 'Duration must be between 5 and 180 minutes' });
  }

  console.log(`Generating journey: "${prompt}" (${duration} minutes)`);

  try {
    const journey = await generateJourney(prompt, duration);
    
    console.log(`Journey generated: ${journey.name} with ${journey.phases.length} phases`);
    
    return res.json({
      success: true,
      journey,
    });
  } catch (error) {
    console.error('Journey generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
    });
    
    return res.status(500).json({
      error: 'Journey generation failed',
      message: errorMessage,
      ...(process.env.VERCEL_ENV !== 'production' && errorStack ? { stack: errorStack } : {}),
    });
  }
}
