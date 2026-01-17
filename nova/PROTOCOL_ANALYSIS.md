# Lumenate Nova Protocol Analysis

## Overview

This document contains reverse-engineered protocol details captured from the official Lumenate iOS app using `idevicebtlogger` on January 17, 2026.

**Key Discovery**: The official app uses a **streaming protocol** - it continuously sends real-time brightness/state values to the device, rather than sending a "start flicker at X Hz" command.

## Connection Sequence

### 1. BLE Connection Setup

```
Device: Lumenate Nova
Address Type: Random (static) Identity (Resolved Private)
Connection: Encrypted (LE Start Encryption)
PHY: 2M PHY (upgraded after connection)
MTU: 527 requested → 498 negotiated
Connection Interval: 30ms → 45ms (updated)
```

### 2. Handle Mapping (Discovered from ATT operations)

| Handle | Characteristic | Purpose | Value/Usage |
|--------|---------------|---------|-------------|
| `0x0004` | Service Changed | Enable indications | Write `0200` |
| `0x0012` | Battery Level | Read battery | Returns e.g. `5F` (95%) |
| `0x0013` | Battery Level CCCD | Enable notifications | Write `0100` |
| `0x001B` | Unknown CCCD | Enable notifications | Write `0100` |
| `0x0023` | Model Number | Device model | "nrf52833" |
| `0x0027` | Serial Number | Device serial | "8A7202062A32928D" |
| `0x0029` | Firmware Version | FW version | "1.0.2" |
| `0x002B` | Hardware Version | HW version | "1.0" |
| `0x002F` | Unknown CCCD | Enable notifications | Write `0100` |
| **`0x0034`** | **DATA_CHAR** | **Streaming commands** | **12-byte packets** |
| **`0x0036`** | **STATUS_CHAR** | **Device feedback** | **6-byte notifications** |
| `0x0037` | DATA_CHAR CCCD | Enable notifications | Write `0100` |
| **`0x0039`** | **COMMAND_CHAR** | **Start journey** | Write `0A` |

### 3. Initialization Sequence

```
1. Connect with encryption
2. Exchange MTU Request (527) → Response (498)
3. Enable Service Changed indications: Write 0x0004 = 0200
4. Enable Battery notifications: Write 0x0013 = 0100
5. Read Battery Level: Read 0x0012 → 5F (95%)
6. Read Model Number: Read 0x0023 → "nrf52833"
7. Read Serial Number: Read 0x0027 → "8A7202062A32928D"
8. Read Firmware Version: Read 0x0029 → "1.0.2"
9. Read Hardware Version: Read 0x002B → "1.0"
10. Enable DATA_CHAR notifications: Write 0x001B = 0100
11. Enable STATUS_CHAR notifications: Write 0x002F = 0100
12. **START JOURNEY**: Write Command 0x0039 = 0A
13. Enable streaming feedback: Write 0x0037 = 0100
14. Begin streaming commands to 0x0034
```

## Streaming Protocol

### Command Format (Handle 0x0034)

The app sends 12-byte commands at approximately 10-15 Hz (every 70-100ms):

```
Byte Layout: [B0 B1] [B2 B3] [B4 B5] [B6 B7 B8 B9 B10 B11]
             Param1  Param2  Param3  Reserved (zeros)
```

#### Example Commands (from capture):

```
Initial:     0000 0000 0000 0000 0000 0000 (reset/off)
First cmd:   0032 0200 CF31 0000 0000 0000
             └─┬─┘└─┬─┘└─┬─┘
              │    │    └── Position/timestamp (little-endian)
              │    └─────── Mode/type (0x0002 = journey mode?)
              └──────────── Intensity/phase value
```

#### Intensity Patterns Observed:

```
Start of journey:
0032 → 2AD1 → 2452 → 1DFF → 17D5 → 11C2 → 0BD4 → 0606 → 005A
       (decreasing intensity - light ramping up?)

During journey (constant changes):
F7EA01 → E141DE → 9A9269 → C892BE → 25B5 → 1AAC → 8DA3 → 029C...
       (oscillating values - the flicker pattern itself!)
```

### Status Notifications (Handle 0x0036)

The device sends 6-byte notifications back containing sensor/status data:

```
Format: [XX XX] [YY YY] [ZZ ZZ]
Example: 9900 57F1 4E06
         AB00 2DF1 0306
         6600 45F1 CA05
```

This appears to be sensor readings (possibly EEG/biosensor data) that the app uses to adapt the journey.

## Key Insights

### 1. Streaming, Not Commands

The device doesn't store flickering patterns. The app:
- Calculates the exact brightness for each moment
- Streams values continuously (~10-15 times per second)
- The device just outputs whatever brightness it receives

### 2. Journey Mode Activation

The `0A` command to handle `0x0039` (COMMAND_CHAR) starts "journey mode":
- This prepares the device to receive streaming commands
- Without this, the device may not respond to DATA_CHAR writes

### 3. Bidirectional Communication

The device sends continuous feedback (6-byte notifications):
- This may be sensor data (EEG, light levels, etc.)
- The app may use this to adapt the experience in real-time

### 4. The `01ff` Commands

Our discovered `01ff` command is likely a **basic turn-on** that doesn't engage the streaming protocol. The official app uses a completely different approach.

## Protocol Implementation

### Starting a Journey

```javascript
// 1. Start journey mode
await commandChar.writeValue(new Uint8Array([0x0A]));

// 2. Enable notifications on data char
await dataChar.startNotifications();

// 3. Stream brightness values
function streamBrightness(intensity, mode = 0x0002, timestamp = 0) {
  const cmd = new Uint8Array(12);
  // Little-endian 16-bit values
  cmd[0] = intensity & 0xFF;
  cmd[1] = (intensity >> 8) & 0xFF;
  cmd[2] = mode & 0xFF;
  cmd[3] = (mode >> 8) & 0xFF;
  cmd[4] = timestamp & 0xFF;
  cmd[5] = (timestamp >> 8) & 0xFF;
  // Bytes 6-11 are zeros
  return dataChar.writeValue(cmd);
}
```

### Creating a Flicker Pattern

```javascript
// 10 Hz flicker at streaming rate of 100ms
let timestamp = 0;
setInterval(() => {
  // Sine wave for smooth flicker
  const phase = (Date.now() % (1000 / flickerHz)) / (1000 / flickerHz);
  const intensity = Math.floor(Math.sin(phase * 2 * Math.PI) * 32767 + 32768);
  
  streamBrightness(intensity, 0x0002, timestamp);
  timestamp += 100; // Increment timestamp
}, 100);
```

## Captured Session Data

### Full 5-Minute Journey Summary

- **Total commands sent**: ~3000 (at ~10 Hz)
- **Command handle**: 0x0034 (DATA_CHAR)
- **Notifications received**: ~3000 (device feedback)
- **Notification handle**: 0x0036 (STATUS_CHAR)
- **Initial command**: `0A` to handle 0x0039

### Command Value Distribution

The intensity values (first 2 bytes) follow a complex pattern:
- Range: 0x0000 to ~0xFFFF (full 16-bit range)
- Pattern: Oscillating with varying frequency
- Not a simple sine wave - likely a designed "journey" pattern

### Mode Values (bytes 2-3)

Most commands use `0200` (mode 2), suggesting this is the standard journey mode.

## Comparison: Old vs New Protocol

| Aspect | Old (01ff) | New (Streaming) |
|--------|-----------|-----------------|
| Command size | 2 bytes | 12 bytes |
| Target | COMMAND_CHAR | DATA_CHAR |
| Frequency control | Software timing | Value in command |
| Brightness control | None (on/off) | Full 16-bit range |
| Pattern complexity | Square wave only | Any waveform |
| Device feedback | None | 6-byte notifications |

## Next Steps

1. **Implement streaming protocol** in ble-web.html
2. **Test `0A` command** to see if it enables journey mode
3. **Experiment with intensity values** to understand the mapping
4. **Decode notification format** to understand device feedback
5. **Create journey patterns** matching official app behavior

## Raw Capture Excerpts

### Journey Start
```
Write Command 0x0039: 0A
Write Request 0x0037: 0100
[Notifications begin]
Write Command 0x0034: 0000 0000 0000 0000 0000 0000
Write Command 0x0034: 0032 0200 CF31 0000 0000 0000
Write Command 0x0034: D12A 0200 7335 0000 0000 0000
...
```

### Mid-Journey (Active Flickering)
```
Write Command 0x0034: C247 0100 B299 0000 0000 0000
Write Command 0x0034: 8050 0100 2995 0000 0000 0000
Write Command 0x0034: 0146 0200 6210 0000 0000 0000
...
```

### Device Feedback
```
Handle Value Notification 0x0036: 9900 57F1 4E06
Handle Value Notification 0x0036: 8A00 2DF1 0306
Handle Value Notification 0x0036: 6600 45F1 CA05
...
```

## Credits

Protocol reverse-engineered using:
- iOS PacketLogger via `idevicebtlogger`
- Real Lumenate Nova device
- Official Lumenate iOS app
- January 17, 2026
