# Binaural Beats Integration

## Overview

Binaural beats have been integrated into the Sonic Journey app, providing an additional neural entrainment method that works alongside the existing vibroacoustic audio and Nova flicker.

## How Binaural Beats Work

Binaural beats are created by playing slightly different frequencies in each ear:
- **Left ear**: `carrierFreq - beatFreq/2`
- **Right ear**: `carrierFreq + beatFreq/2`
- **Perceived beat**: The difference between the two frequencies (the beat frequency)

For example, for a 10 Hz Alpha binaural beat with 200 Hz carrier:
- Left: 200 - 5 = 195 Hz
- Right: 200 + 5 = 205 Hz
- Perceived: 10 Hz beat

## Neuroscience Basis

Binaural beats work through **interaural frequency differences**:
- The brain processes the difference between left and right ear frequencies
- This creates a perceived "beat" at the difference frequency
- The brain can entrain to this perceived beat frequency
- Works best with headphones (stereo separation required)

### Frequency Bands

- **Delta (3 Hz)**: Deep sleep, relaxation
- **Theta (6 Hz)**: Meditation, hypnagogic states
- **Alpha (10 Hz)**: Vivid visuals, flow states
- **Beta (15 Hz)**: Alertness, focus

## Automatic Frequency Mapping

The system automatically maps journey phases to binaural beat frequencies:

1. **From rhythm_mode**: If phase has `rhythm_mode: 'theta'` → 6 Hz, `'alpha'` → 10 Hz
2. **From audio frequency**: Average of phase start/end frequencies:
   - ≤ 4 Hz → 3 Hz (Delta)
   - ≤ 7 Hz → 6 Hz (Theta)
   - ≤ 12 Hz → 10 Hz (Alpha)
   - ≤ 30 Hz → 15 Hz (Beta)
   - > 30 Hz → 10 Hz (Alpha default)

3. **Explicit override**: `binaural_beat_frequency` in phase config

## Configuration

### Enable for Phase

```typescript
{
  name: "Deep Meditation",
  binaural_enabled: true,  // Enable binaural beats
  // ... other phase config
}
```

### Custom Beat Frequency

```typescript
{
  name: "Alpha State",
  binaural_enabled: true,
  binaural_beat_frequency: 10,  // Force 10 Hz Alpha beat
  // ... other phase config
}
```

### Custom Carrier Frequency

```typescript
{
  name: "Custom Beat",
  binaural_enabled: true,
  binaural_beat_frequency: 6,
  binaural_carrier_frequency: 250,  // Default is 200 Hz
  // ... other phase config
}
```

## Carrier Frequency Guidelines

- **Default**: 200 Hz (optimal for most users)
- **Range**: 100-400 Hz recommended
- **Lower (100-150 Hz)**: More subtle, less noticeable
- **Higher (300-400 Hz)**: More prominent, may be distracting
- **200 Hz**: Best balance (most common in research)

## Usage

1. **Enable in Phase Controls**: Toggle "Binaural Beats" switch for any phase
2. **Automatic Mapping**: System automatically selects beat frequency based on phase settings
3. **Custom Override**: Set `binaural_beat_frequency` for explicit control
4. **Headphones Required**: Binaural beats require stereo headphones to work properly

## Technical Details

### Audio Graph

- Two oscillators (left and right channels)
- StereoPannerNode for channel separation
- Gain nodes for volume control (30% volume by default)
- Smooth frequency transitions (0.5s ramp time)

### Volume Level

Binaural beats are set to **30% volume** by default to:
- Provide subtle background entrainment
- Not overpower the main vibroacoustic audio
- Allow for comfortable long-term listening

### Synchronization

- Starts/stops with journey playback
- Updates frequency on phase transitions
- Pauses/resumes with playback controls

## Combining with Other Features

Binaural beats work alongside:
- **Vibroacoustic audio**: Main journey audio (foundation, harmony, atmosphere)
- **Nova flicker**: Visual entrainment (if enabled)
- **Entrainment patterns**: Breathing, heartbeat, theta, alpha rhythms

All three entrainment methods can be used simultaneously for maximum effect:
- **Audio**: Vibroacoustic frequencies
- **Visual**: Nova flicker patterns
- **Binaural**: Perceived beat frequencies

## Research Notes

Binaural beats are most effective when:
- Used with headphones (stereo separation required)
- Beat frequency matches target brainwave state
- Combined with other entrainment methods
- Used for extended periods (15+ minutes)

The combination of audio frequencies, visual flicker, and binaural beats creates a **multi-modal entrainment** approach that can be more effective than any single method alone.
