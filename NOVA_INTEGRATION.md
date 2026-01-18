# Nova Integration Guide

## Overview

The Lumenate Nova device has been integrated into the Sonic Journey app, allowing all journeys to optionally include synchronized flicker patterns that enhance neural entrainment through photic stimulation.

## How It Works

### Automatic Frequency Mapping

The integration automatically maps journey phases to appropriate Nova flicker frequencies based on neuroscience research:

- **Delta (1-4 Hz audio)** → **3 Hz Nova** - Deep sleep, relaxation
- **Theta (4-7 Hz audio)** → **6 Hz Nova** - Meditation, hypnagogic states  
- **Alpha (8-12 Hz audio)** → **10 Hz Nova** - Vivid visuals, flow states
- **Beta (13-30 Hz audio)** → **15 Hz Nova** - Alertness, focus

### Phase-Based Control

Nova flicker automatically:
- Starts when a phase with Nova enabled begins
- Updates frequency when transitioning between phases
- Stops when playback is paused or stopped
- Respects per-phase enable/disable settings

## Usage

### 1. Connect Nova Device

1. Click "Connect Nova" button in the transport bar
2. Select "Lumenate Nova" from the Bluetooth device list
3. Wait for connection confirmation

### 2. Enable Nova for Journey

Nova can be enabled at two levels:

**Global (Journey Level):**
- Set `nova_enabled: true` in journey config
- Enables Nova for all phases (unless phase explicitly disables)

**Per-Phase:**
- Set `nova_enabled: true` in phase config
- Overrides global setting for that phase
- Can enable Nova for specific phases only

### 3. Customize Frequency (Optional)

By default, Nova frequency is auto-mapped from audio frequency or rhythm mode. To override:

```typescript
{
  name: "Deep Meditation",
  nova_enabled: true,
  nova_frequency: 6,  // Force 6 Hz (Theta) regardless of audio
  // ... other phase config
}
```

## Configuration Examples

### Enable Nova for Entire Journey

```typescript
{
  name: "Deep Rest Journey",
  nova_enabled: true,  // Enable for all phases
  phases: [
    { name: "Settling", nova_enabled: true, ... },
    { name: "Deep Rest", nova_enabled: true, ... },
    // ...
  ]
}
```

### Enable Nova for Specific Phases Only

```typescript
{
  name: "Meditation Journey",
  nova_enabled: false,  // Disable globally
  phases: [
    { name: "Introduction", nova_enabled: false, ... },
    { name: "Deep State", nova_enabled: true, ... },  // Only this phase
    { name: "Return", nova_enabled: false, ... },
  ]
}
```

### Custom Frequency Override

```typescript
{
  name: "Visual Journey",
  phases: [
    {
      name: "Alpha State",
      nova_enabled: true,
      nova_frequency: 10,  // Force 10 Hz for vivid visuals
      frequency: { start: 40, end: 45 },  // Audio frequency
      // ...
    }
  ]
}
```

## Frequency Mapping Details

### From Audio Frequency

The system uses the average of phase start/end frequencies:

```typescript
avgFreq = (phase.frequency.start + phase.frequency.end) / 2
novaFreq = mapFrequencyToNova(avgFreq)
```

### From Rhythm Mode

If phase has a `rhythm_mode`, it takes precedence:

- `rhythm_mode: 'theta'` → 6 Hz Nova
- `rhythm_mode: 'alpha'` → 10 Hz Nova
- `rhythm_mode: 'breathing'` → 10 Hz Nova (default)
- `rhythm_mode: 'heartbeat'` → 10 Hz Nova (default)

### Priority Order

1. `phase.nova_frequency` (explicit override)
2. `phase.rhythm_mode` (if present)
3. `mapFrequencyToNova(avgAudioFreq)` (auto-mapping)

## Technical Details

### Files Added

- `src/audio/NovaController.ts` - BLE device control
- `src/components/Nova/NovaControl.tsx` - UI component

### Files Modified

- `src/types/journey.ts` - Added `nova_enabled` and `nova_frequency` fields
- `src/audio/SynthEngine.ts` - Integrated Nova control
- `src/components/Transport/TransportBar.tsx` - Added Nova control UI

### BLE Protocol

Uses the Simple Protocol (01ff commands):
- Sends `01ff` repeatedly at calculated intervals
- Interval = `1000ms / frequencyHz`
- Sends `02ff` to turn off light

## Neuroscience Basis

The frequency mapping is based on research showing:

1. **Frequency is primary** - Neural entrainment depends primarily on flicker frequency
2. **Band-specific effects** - Each frequency band produces distinct states:
   - Delta (3 Hz): Deep relaxation, sleep onset
   - Theta (6 Hz): Meditative, hypnagogic states
   - Alpha (10 Hz): Vivid closed-eye visuals, flow states
   - Beta (15 Hz): Alertness, focus, mental energy

3. **Synchronization** - Combining audio and visual entrainment at matching frequencies enhances the effect

## Browser Compatibility

- **Chrome/Edge/Opera**: Full support (Web Bluetooth API)
- **Safari/Firefox**: Not supported (no Web Bluetooth)

The UI gracefully handles unsupported browsers.

## Troubleshooting

### Device Not Found
- Ensure Nova is powered on
- Put device in pairing mode (usually just power on)
- Check Bluetooth is enabled on computer

### Connection Fails
- Try disconnecting and reconnecting
- Check browser permissions for Bluetooth
- Ensure no other app is connected to Nova

### Flicker Not Starting
- Verify `nova_enabled: true` in journey or phase config
- Check Nova is connected (green indicator)
- Verify phase has valid frequency/rhythm_mode

## Future Enhancements

Potential improvements:
- Per-phase frequency ramping
- Smooth frequency transitions
- Brightness control (if streaming protocol becomes available)
- Multiple device support
- Preset frequency patterns
