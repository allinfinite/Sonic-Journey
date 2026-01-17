# Lumenate Nova BLE Control

Documentation for controlling the Lumenate Nova light mask via Web Bluetooth.

## Device Overview

The Lumenate Nova is a light therapy mask that uses stroboscopic flickering to induce neural entrainment. The device connects via Bluetooth Low Energy (BLE) and can be controlled from a web browser using the Web Bluetooth API.

## BLE Protocol

### Service UUIDs

- **Control Service**: `47bbfb1e-670e-4f81-bfb3-78daffc9a783`
- **McuMgr Service**: `b568de7c-b6c6-42cb-8303-fcc9cb25007c` (firmware updates)
- **Battery Service**: `0000180f-0000-1000-8000-00805f9b34fb` (standard)

### Characteristics

#### Control Service Characteristics

1. **Command Characteristic** (`3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e`)
   - Properties: `writeWithoutResponse`
   - **Purpose**: Send commands to control the device
   - **Usage**: This is the primary characteristic for sending control commands

2. **Data Characteristic** (`2b35ef1f-11a6-4089-8cd5-843c5d0c9c55`)
   - Properties: `read`, `writeWithoutResponse`, `notify`
   - **Purpose**: Bidirectional data communication
   - **Usage**: Can receive notifications and send data

3. **Status Characteristic** (`964fbffe-6940-4371-8d48-fe43b07ed00b`)
   - Properties: `read`, `notify`
   - **Purpose**: Device status updates
   - **Usage**: Subscribe to receive status notifications

### Command Protocols

**⚠️ IMPORTANT**: Only the Simple protocol works. The Streaming protocol does not control lights on this device.

#### Protocol 1: Simple (01ff) - ✅ WORKING

| Command | Effect | Notes |
|---------|--------|-------|
| `01fa`-`01ff` | Turn on light | All 6 commands are functionally identical |
| `02ff` | Turn off light | Stops all light output |

**Usage**: Send `01ff` repeatedly at intervals to create flicker effect.

**This is the ONLY working method** - all other commands and protocols do not produce visible light output.

#### Protocol 2: Streaming (Official App Protocol) - ❌ NOT WORKING

**Discovered via iOS PacketLogger capture (January 2026)**

The official Lumenate app uses a **streaming protocol** that sends real-time brightness values:

1. Send `0A` to COMMAND_CHAR to start "journey mode"
2. Stream 12-byte commands to DATA_CHAR at ~15 Hz
3. Device outputs brightness specified in each command
4. Device sends 6-byte feedback notifications

**12-Byte Command Format** (to DATA_CHAR):
```
Bytes 0-1: Intensity (0-65535, little-endian)
Bytes 2-3: Mode (0x0002 = journey mode)
Bytes 4-5: Timestamp (milliseconds, little-endian)
Bytes 6-11: Reserved (zeros)
```

**⚠️ Testing Results**: Despite capturing the exact protocol from the official app, the streaming protocol **does not produce any visible light output** on this device. All tested variations (exact captured bytes, hybrid 01ff+streaming, different modes) failed to activate lights.

**Conclusion**: The streaming protocol may control internal device state, timing patterns, or firmware features that are not directly visible, or may require additional initialization/setup that was not captured. The device only responds to `01ff` commands for light control.

See `PROTOCOL_ANALYSIS.md` for full capture analysis.

#### Flicker Control

Since the device doesn't accept frequency parameters, flickering must be created **programmatically** by repeatedly sending `01ff` (or `01fe`) at the desired frequency.

**Command Formats**:
- `[0x01, 0xFA]` through `[0x01, 0xFF]` - All turn on the light (6 functionally identical commands)
- `[0x02, 0xFF]` - Turn off light

**Confirmed**: Commands `01fa`-`01ff` are functionally identical. Extensive side-by-side comparison testing shows no observable differences in:
- Brightness levels
- Color temperature
- LED activation patterns
- Intensity settings
- Any other visual or behavioral characteristics

**How Flickering Works**:
1. Send any of `01fa`-`01ff` to turn on the light (interface uses `01ff`)
2. To create flickering at a specific frequency, send `01ff` repeatedly at intervals calculated as: `1000ms / frequency`
3. Send `02ff` to turn off the light

**Why Multiple Identical Commands?**
The presence of 6 identical "turn on" commands (`01fa`-`01ff`) suggests they may have been intended for different purposes (brightness levels, modes, etc.) but the firmware implementation treats them identically. Alternatively, they may be legacy commands from different firmware versions.

**Example Frequencies**:
- **3 Hz (Deep Sleep)**: Send `01ff` every 333ms
- **6 Hz (Meditation)**: Send `01ff` every 167ms
- **10 Hz (Visuals)**: Send `01ff` every 100ms
- **15 Hz (Focus)**: Send `01ff` every 67ms

#### Implementation Details

```javascript
// Calculate interval based on desired frequency
const hz = 10; // 10 Hz
const intervalMs = Math.round(1000 / hz); // 100ms

// Send 01ff repeatedly
const trigger = [0x01, 0xFF];
setInterval(async () => {
  await commandChar.writeValue(new Uint8Array(trigger));
}, intervalMs);
```

## Usage

### Web Interface

1. **Connect**: Click "Connect" and select "Lumenate Nova" from the Bluetooth device list
2. **Select State**: Click one of the four states:
   - **Deep Sleep** (3 Hz) - Deep relaxation, sleep onset
   - **Meditation** (6 Hz) - Meditative, hypnagogic states
   - **Visuals** (10 Hz) - Vivid kaleidoscopic patterns (most effective for visuals)
   - **Focus** (15 Hz) - Alertness, mental energy
3. **Switch States**: Click another state to change the flicker frequency
4. **Disconnect**: Click "Disconnect" to stop flickering and disconnect

### Programmatic Control

The interface exposes several functions for console use:

```javascript
// Send raw hex command
sendCommand('01ff');

// Try sending to DATA_CHAR instead
tryDataChar(10);

// Test trigger then frequency separately
testTriggerThenFreq(10);

// Test just the trigger
testTrigger();
```

## Technical Notes

### Protocol Comparison

| Feature | Simple Protocol | Streaming Protocol |
|---------|-----------------|-------------------|
| **Status** | ✅ **WORKING** | ❌ **NOT WORKING** |
| Command target | COMMAND_CHAR | DATA_CHAR |
| Command size | 2 bytes | 12 bytes |
| Frequency control | Software timing | Value in command |
| Brightness control | None (on/off) | Full 16-bit range (theoretical) |
| Waveform | Square wave only | Any waveform (theoretical) |
| Setup required | None | Send `0A` first |
| **Light Output** | ✅ Produces lights | ❌ No visible effect |

### Simple Protocol Details

The simple protocol sends `01ff` repeatedly to create an on/off flicker:

- **Pros**: Easy to implement, works reliably
- **Cons**: Only square wave, no brightness control
- **How**: Send `01ff` at `1000ms / frequency` intervals

### Streaming Protocol Details (Reverse-Engineered) - ❌ NOT FUNCTIONAL

**⚠️ IMPORTANT**: This protocol was reverse-engineered from the official app but **does not produce visible light output** when tested. The device only responds to `01ff` commands.

The official app uses a streaming protocol that was captured via BLE packet logging:

1. **Initialize**: Send `0A` to COMMAND_CHAR (starts journey mode)
2. **Stream**: Send 12-byte commands to DATA_CHAR at ~15 Hz
3. **Feedback**: Receive 6-byte notifications from device

**Testing Results**: All attempts to use this protocol failed:
- Exact captured byte sequences
- Hybrid approach (01ff + streaming)
- Different mode values (0-5)
- Various intensity patterns

**Conclusion**: The streaming protocol may control internal device state, firmware features, or require additional setup not captured in the BLE trace. For light control, only the Simple protocol works.

**Command Structure** (12 bytes, little-endian):
```javascript
const cmd = new Uint8Array(12);
cmd[0] = intensity & 0xFF;        // Intensity low byte
cmd[1] = (intensity >> 8) & 0xFF; // Intensity high byte  
cmd[2] = mode & 0xFF;             // Mode low (0x02)
cmd[3] = (mode >> 8) & 0xFF;      // Mode high (0x00)
cmd[4] = timestamp & 0xFF;        // Timestamp low
cmd[5] = (timestamp >> 8) & 0xFF; // Timestamp high
// Bytes 6-11 are zeros
```

**Waveform Generation**:
```javascript
// Sine wave for smooth flicker
const phase = (Date.now() % (1000 / flickerHz)) / (1000 / flickerHz);
const intensity = Math.floor((Math.sin(phase * 2 * Math.PI) + 1) / 2 * 65535);
```

### Connection Flow

1. Scan for device with name prefix "Lumenate"
2. Connect to GATT server
3. Discover Control Service
4. Find Command Characteristic (writeWithoutResponse)
5. Subscribe to notifications on Data and Status characteristics
6. Ready to send commands

### Battery Level

The device reports battery level via the standard Battery Service (`0000180f`). The interface displays this after connection.

## Troubleshooting

### Lights Don't Flicker

- **Check connection**: Ensure device shows "Connected!" in logs
- **Verify command char**: Should see "Command char ready" in logs
- **Check state activation**: Should see "Activated: [State] (flickering at X Hz)" message
- **Browser console**: Check for JavaScript errors

### Connection Fails

- Ensure device is powered on and in pairing mode
- Disconnect from other devices (phone apps, etc.)
- Try refreshing the page and reconnecting
- Check browser supports Web Bluetooth (Chrome/Edge on desktop, Chrome on Android)

### Flicker Stops

- Check if another state was clicked (stops previous flicker)
- Verify device is still connected
- Check browser console for errors
- Try disconnecting and reconnecting

## Frequency Effects

Based on neuroscience research, different flicker frequencies produce different effects:

- **Delta (1-4 Hz)**: Deep relaxation, sleep onset
- **Theta (4-7 Hz)**: Meditative, hypnagogic, creative states
- **Alpha (8-12 Hz)**: Vivid closed-eye visuals, flow states (10 Hz is optimal for visuals)
- **Beta (13-30 Hz)**: Alertness, focus, mental energy
- **Gamma (30-50+ Hz)**: Cognitive enhancement, research applications

The interface provides four preset states covering the most common use cases.

## Files

- `ble-web.html` - Main web interface for browser control
- `command-discovery.html` - Command discovery tool for testing different command patterns
- `device-simulator.cjs` - BLE peripheral simulator to capture commands from official app
- `ble-connect.cjs` - Node.js connection script (uses @abandonware/noble)
- `ble_connect.py` - Python connection script (uses bleak)

## Command Discovery Tool

The `command-discovery.html` tool allows systematic testing of command patterns to discover new device behaviors:

- **Manual Testing**: Send custom hex commands and test repeated sending
- **Quick Presets**: Test common command variants
- **Automated Discovery**: Systematically test patterns:
  - Single byte (00-FF)
  - Two bytes (all combinations)
  - Three bytes (01ff + byte)
  - Four bytes (01ff + two bytes)
  - Known pattern variants

Use the "Mark as Working" button when you observe a device response during automated testing. Results are logged for review.

## Device Simulator

The `device-simulator.cjs` tool simulates the Nova device to capture commands from the official Lumenate app:

**Purpose**: Reverse-engineer what the official app sends during journeys/sessions

**How it works**:
1. Simulator advertises as "Lumenate Nova" with the same UUIDs
2. Official app connects to simulator (thinking it's the real device)
3. All commands sent by the app are logged to console
4. Analyze the command patterns to discover hidden functionality

**Usage**:
```bash
npm install @abandonware/bleno
sudo node nova/device-simulator.cjs
# Then connect with official app and start a journey
```

See `SIMULATOR_README.md` for detailed instructions and troubleshooting.

## Browser Compatibility

- ✅ Chrome/Edge (desktop) - Full support
- ✅ Chrome (Android) - Full support
- ❌ Safari (iOS) - No Web Bluetooth support
- ❌ Firefox - No Web Bluetooth support

## Complete Protocol Summary

### Working Commands (7 total)

1. **Turn On Commands** (6 identical commands):
   - `01fa`, `01fb`, `01fc`, `01fd`, `01fe`, `01ff`
   - All functionally identical - no observable differences
   - Use any of these to activate the light

2. **Turn Off Command** (1 command):
   - `02ff` - Stops all light output

### Non-Working Patterns (Tested and Confirmed)

The following patterns were systematically tested and **do not work**:
- Single byte commands (except those that happen to match working patterns)
- Two-byte commands (except `01fa`-`01ff`, `02ff`)
- Three-byte commands like `01ff + frequency byte`
- Four-byte commands
- Commands sent to DATA_CHAR instead of COMMAND_CHAR
- Frequency parameters in any format

### Testing Methodology

All findings were confirmed through:
1. **Systematic Testing**: Automated testing of command patterns (single byte, double byte, triple byte, quad byte)
2. **Side-by-Side Comparison**: Direct comparison of `01fa`-`01ff` commands
3. **Visual Observation**: Confirmed device responses through direct observation
4. **BLE Notification Analysis**: Verified device receives commands via BLE notifications

### Protocol Limitations

- **No Frequency Control**: Device firmware does not support frequency parameters
- **No Brightness Control**: No commands found to adjust brightness
- **No Color Control**: No commands found to change color/temperature
- **No Pattern Control**: No commands found to change LED patterns
- **Binary State Only**: Device only supports on/off states

All advanced features (flicker frequency, brightness, etc.) must be implemented in software by controlling the timing and sequence of `01ff` commands.

## License

This code is provided as-is for controlling the Lumenate Nova device. The BLE protocol details were reverse-engineered through systematic testing and experimentation.
