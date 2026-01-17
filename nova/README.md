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

### Command Protocol

**Known Working Commands**:
- `01ff` - Turns on the light
- `01fe` - Turns on the light (indistinguishable from `01ff`)
- `02ff` - Turns off the light

**Critical Finding**: The device only responds to a few specific command codes. Most commands are ignored.

#### Flicker Control

Since the device doesn't accept frequency parameters, flickering must be created **programmatically** by repeatedly sending `01ff` (or `01fe`) at the desired frequency.

**Command Formats**:
- `[0x01, 0xFF]` - Turn on light
- `[0x01, 0xFE]` - Turn on light (indistinguishable from `01ff`)
- `[0x02, 0xFF]` - Turn off light

**How It Works**:
1. Send `01ff` (or `01fe`) to turn on the light
2. To create flickering at a specific frequency, send `01ff` repeatedly at intervals calculated as: `1000ms / frequency`
3. Send `02ff` to turn off the light

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

### Why Programmatic Flickering?

The device firmware appears to only recognize `01ff` as a valid command. Attempts to send:
- `01ff + frequency byte` (e.g., `01ff03`)
- Just frequency bytes
- Other command formats

...all result in no response. The device receives these commands (confirmed by notifications), but doesn't activate the lights.

**Solution**: Create the flicker pattern by sending `01ff` repeatedly at JavaScript intervals, effectively creating the flicker effect in software rather than relying on device firmware.

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

## Browser Compatibility

- ✅ Chrome/Edge (desktop) - Full support
- ✅ Chrome (Android) - Full support
- ❌ Safari (iOS) - No Web Bluetooth support
- ❌ Firefox - No Web Bluetooth support

## License

This code is provided as-is for controlling the Lumenate Nova device. The BLE protocol details were reverse-engineered through testing.
