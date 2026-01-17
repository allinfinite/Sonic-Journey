# Nova Device Simulator

This simulator acts as a fake Lumenate Nova device to capture commands from the official Lumenate app.

## Purpose

By simulating the device, we can see exactly what commands the official app sends during a journey/session, which may reveal:
- Command sequences we haven't discovered
- Frequency control methods
- Brightness/pattern commands
- Session start/stop sequences
- Any other hidden functionality

## Installation

```bash
npm install @abandonware/bleno
```

**Note**: On macOS, you may need to run with sudo for BLE peripheral support:
```bash
sudo node nova/device-simulator.js
```

On Linux, you may need to set capabilities:
```bash
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

## Usage

1. **Start the simulator**:
   ```bash
   node nova/device-simulator.js
   # or with sudo on macOS:
   sudo node nova/device-simulator.js
   ```

2. **You should see**:
   ```
   Bluetooth state: poweredOn
   ✅ Advertising as "Lumenate Nova"
      Waiting for official app to connect...
   ```

3. **On your phone**:
   - Open the official Lumenate app
   - Try to connect to your Nova device
   - The app should see "Lumenate Nova" and connect to the simulator

4. **Start a journey** in the app:
   - Select any journey/session
   - Start it
   - Watch the console output

5. **The simulator will log**:
   - Every command sent to COMMAND_CHAR
   - Every command sent to DATA_CHAR
   - Hex representation
   - Byte-by-byte breakdown
   - Attempts to interpret the commands

## Output Example

```
[COMMAND #1] 2024-01-17T12:34:56.789Z
  Hex: 01ff
  Bytes: 01 ff
  Length: 2 bytes
  Raw: [1, 255]
  → Turn on light (01ff)

[DATA #2] 2024-01-17T12:34:57.123Z
  Hex: 03
  Bytes: 03
  Length: 1 bytes
```

## What to Look For

When running a journey in the app, watch for:
- **Command sequences**: Multiple commands sent in sequence
- **Timing patterns**: Intervals between commands
- **Frequency encoding**: How frequencies are represented
- **Session control**: Start/stop/pause commands
- **Pattern commands**: Different flicker patterns

## Troubleshooting

### "Bluetooth state: unsupported"
- BLE peripheral mode may not be supported on your system
- Try running with sudo (macOS)
- Check if your Bluetooth adapter supports BLE peripheral mode

### App can't find device
- Make sure simulator is running and shows "Advertising as Lumenate Nova"
- Make sure your phone's Bluetooth is on
- Try disconnecting from any real Nova devices first
- The simulator uses the exact same name and UUIDs as the real device

### Permission errors
- On macOS: Run with `sudo`
- On Linux: Set capabilities (see Installation)
- On Windows: May require admin privileges

## Analysis

After capturing commands, analyze:
1. **Command patterns**: What sequences appear?
2. **Frequency encoding**: How are frequencies represented?
3. **Timing**: What are the intervals between commands?
4. **Journey structure**: How does a full journey look?

This data can then be used to improve our web interface!
