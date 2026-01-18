# Nova Integration Guide

## Overview

The Lumenate Nova device has been integrated into the Sonic Journey app, allowing all journeys to optionally include synchronized flicker patterns that enhance neural entrainment through photic stimulation.

## Neural Entrainment Science

The effects of flickering light are determined by the **frequency** of flashes, which influences the brain through **neural entrainment**. By synchronizing the brain's electrical activity with external rhythms, different flicker patterns can guide users into specific states of consciousness.

### Frequency Bands & Effects

| Band | Frequency | Nova Hz | Effects |
|------|-----------|---------|---------|
| **Delta** | 1-4 Hz | 1-4 Hz | Deep sleep, relaxation, trance states |
| **Theta** | 4-7 Hz | 4-7 Hz | Meditation, hypnagogic states, creativity, dreamlike imagery |
| **Alpha** | 8-12 Hz | 8-12 Hz | **Vivid visuals**, calm alertness, flow states (sweet spot at 10 Hz) |
| **Beta** | 13-30 Hz | 13-20 Hz | Focus, alertness, mental energy (capped at 20 Hz for comfort) |
| **Gamma** | 30-50+ Hz | 40 Hz | Cognitive enhancement, memory research |

### Key Research Findings

- **Rhythmic > Random**: Perfectly periodic flashes produce much stronger entrainment than random patterns
- **10 Hz Sweet Spot**: Alpha frequencies produce the most vivid kaleidoscopic visuals
- **Comfort Ceiling**: Frequencies above 20 Hz can become uncomfortable
- **40 Hz Research**: Gamma stimulation studied for cognitive enhancement and Alzheimer's therapy
- **Multi-Modal Enhancement**: Combining audio + visual entrainment at matching frequencies amplifies effects

## How It Works

### Smart Frequency Mapping

The integration uses a priority-based system to determine the optimal flicker frequency:

1. **`nova_frequency`** - Explicit override (if specified)
2. **`entrainment_rate`** - Exact Hz from preset (e.g., 5.5 Hz, 11 Hz)
3. **`rhythm_mode`/`entrainment_mode`** - Maps brain state to frequency
4. **Frequency ramping** - Interpolates from phase start/end frequencies based on progress

### Synchronized Entrainment

The Nova flicker automatically stays in sync with:
- **Audio entrainment frequency** from the journey phase
- **Binaural beat frequency** (if enabled)
- **Phase progress** for smooth frequency transitions

### Phase-Based Control

Nova flicker automatically:
- Starts when a phase with Nova enabled begins
- Updates frequency smoothly during phase transitions
- Supports frequency ramping within phases
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
- Use the "Nova Light Mask" toggle in Phase Controls
- Or set `nova_enabled: true` in phase config
- Can set custom `nova_frequency` per phase

### 3. Let It Sync Automatically

If your journey has `entrainment_rate` specified (like `5.5` Hz for theta), the Nova will automatically use that exact frequency. Otherwise it maps from `rhythm_mode`:

| Rhythm Mode | Nova Frequency | Brain State |
|-------------|----------------|-------------|
| `delta` | 3 Hz | Deep sleep, trance |
| `theta` | 6 Hz | Meditation, creativity |
| `alpha` | 10 Hz | Visuals, flow states |
| `beta` | 15 Hz | Focus, alertness |
| `gamma` | 40 Hz | Cognitive enhancement |
| `breathing` | 10 Hz | Calm, synced to breath |
| `heartbeat` | 10 Hz | Grounded, rhythmic |

## Configuration Examples

### Journey with Theta Entrainment

```json
{
  "name": "Deep Meditation",
  "nova_enabled": true,
  "phases": [
    {
      "name": "Settling",
      "rhythm_mode": "breathing",
      "entrainment_rate": 10.0,
      "nova_enabled": true
    },
    {
      "name": "Deepening",
      "rhythm_mode": "theta",
      "entrainment_rate": 5.5,
      "nova_enabled": true
    }
  ]
}
```

Nova will flicker at 10 Hz during "Settling" and 5.5 Hz during "Deepening".

### Frequency Ramping Journey

```json
{
  "name": "Frequency Descent",
  "nova_enabled": true,
  "phases": [
    {
      "name": "Beta to Alpha",
      "frequency": { "start": 15, "end": 10 },
      "nova_enabled": true
    }
  ]
}
```

Nova will smoothly transition from 15 Hz to 10 Hz as the phase progresses.

### Custom Nova Frequency

```json
{
  "name": "Visual Journey",
  "phases": [
    {
      "name": "Peak Visuals",
      "nova_enabled": true,
      "nova_frequency": 10,
      "frequency": { "start": 40, "end": 45 }
    }
  ]
}
```

Overrides auto-mapping to force 10 Hz for maximum visual intensity.

## Combined with Binaural Beats

For maximum entrainment effect, enable both Nova and binaural beats at matching frequencies:

```json
{
  "name": "Full Entrainment",
  "nova_enabled": true,
  "phases": [
    {
      "name": "Deep Theta",
      "rhythm_mode": "theta",
      "entrainment_rate": 6.0,
      "nova_enabled": true,
      "binaural_enabled": true
    }
  ]
}
```

Both will use 6 Hz, providing synchronized audio and visual entrainment.

## Technical Details

### Files

- `src/audio/NovaController.ts` - BLE device control, frequency mapping
- `src/components/Nova/NovaControl.tsx` - Connection UI with debug log
- `src/components/Controls/PhaseControls.tsx` - Per-phase Nova controls

### BLE Protocol

Uses the Simple Protocol (01ff commands):
- Sends `01ff` repeatedly at calculated intervals
- Interval = `1000ms / frequencyHz`
- No turn-off command (just stops interval)

### Frequency Mapping Functions

```typescript
// Get optimal frequency for a phase (exported from NovaController)
getNovaFrequencyForPhase(phase, progress) → number

// Map brain state to frequency
mapRhythmModeToNova(rhythmMode) → number

// Map Hz to appropriate band frequency
mapFrequencyToNova(freq) → number
```

## Browser Compatibility

- **Chrome/Edge/Opera**: Full support (Web Bluetooth API)
- **Safari/Firefox**: Not supported (no Web Bluetooth)

The UI gracefully handles unsupported browsers.

## Troubleshooting

### Device Disconnects on Play
- Check debug log in Nova control panel
- Ensure device is close to computer
- Try reconnecting before pressing play

### Frequency Not Changing
- Verify `entrainment_rate` is set in phase config
- Check phase progress (frequency ramping may be gradual)
- Use explicit `nova_frequency` for immediate control

### Flicker Seems Wrong
- Enable debug log to see actual frequency being used
- Check priority: nova_frequency > entrainment_rate > rhythm_mode > frequency range
