# iOS PacketLogger Guide for Lumenate Nova

Capture all BLE traffic between the official Lumenate app and the real Nova device.

## Prerequisites

- Mac with Xcode installed
- Apple Developer account (free or paid)
- iPhone/iPad with the Lumenate app installed
- USB cable to connect iOS device to Mac
- Real Lumenate Nova device

## Step 1: Download PacketLogger

1. Open Xcode
2. Go to **Xcode → Open Developer Tool → More Developer Tools...**
3. This opens Apple's download page - sign in with your Apple Developer account
4. Download **Additional Tools for Xcode** (matching your Xcode version)
5. Open the downloaded DMG
6. Find **PacketLogger.app** in the **Hardware** folder
7. Copy it to your Applications folder

## Step 2: Install Bluetooth Logging Profile on iOS Device

1. On your Mac, go to: https://developer.apple.com/bug-reporting/profiles-and-logs/
2. Sign in with your Apple Developer account
3. Find and download the **iOS Bluetooth Logging Profile**
4. AirDrop or email the profile to your iOS device
5. On iOS: **Settings → General → VPN & Device Management**
6. Install the profile (you may need to restart)

**Note**: This profile enables detailed Bluetooth logging. Remove it after you're done to preserve battery.

## Step 3: Start Capture

1. Connect your iOS device to your Mac via USB
2. Open **PacketLogger** on your Mac
3. Go to **File → New iOS Trace**
4. Select your iOS device from the list
5. Click **Start** - you should see packets appearing

## Step 4: Capture the Lumenate App Commands

1. Make sure your real Lumenate Nova is **ON** and in **pairing mode**
2. On your iOS device, open the **official Lumenate app**
3. Connect to the Nova device
4. **Start a journey/session** in the app
5. Let it run for a bit - try different features
6. When done, stop the journey and disconnect

## Step 5: Analyze the Capture

In PacketLogger, you'll see all BLE traffic. Look for:

### ATT (Attribute Protocol) Packets
These contain the actual commands being sent:
- **Write Request** / **Write Command** - Commands sent TO the device
- **Read Response** - Data read FROM the device
- **Handle Value Notification** - Notifications from device

### What to Look For

1. **Service Discovery** - The app discovering what services/characteristics exist
2. **Write Commands** - The actual commands sent during the journey
   - Look for writes to our known characteristic UUID: `3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e`
3. **Patterns** - Sequences of commands, timing, repetition

### Filtering Tips

- Filter by **ATT** protocol to see only attribute operations
- Filter by **Handle** to see specific characteristic writes
- Look for the hex values we know: `01ff`, `02ff`, etc.
- Note any NEW hex values you haven't seen before

## Step 6: Export/Save

1. **File → Save** to save as `.pklg` (PacketLogger format)
2. **File → Export** to export as PCAP for Wireshark

## Expected Findings

Based on what we know, you should see:

| Known Command | Expected in Capture | What It Does |
|---------------|---------------------|--------------|
| `01ff` | Yes | Turn on light |
| `01fa`-`01fe` | Maybe | Also turn on light |
| `02ff` | Yes | Turn off light |
| `??` | **Look for these!** | Unknown commands |

## Commands We're Looking For

The app likely sends commands that control:
- **Frequency** - How fast the light flickers (Hz)
- **Intensity/Brightness** - How bright the light is
- **Pattern** - Ramping, pulsing, steady
- **Duration** - How long the session runs
- **Color** - If device supports multiple colors

## Recording Your Findings

When you find new commands, note:
1. The **hex value** (e.g., `0312`)
2. The **context** (what was happening in the app)
3. The **timing** (was it repeated? how often?)
4. Any **response** from the device

## After Capture

Once you have the capture:
1. Save the `.pklg` file
2. Note any new command patterns
3. Test them using `command-discovery.html`
4. Update `README.md` with findings

## Troubleshooting

### "No device found"
- Make sure iOS device is unlocked
- Trust the computer on iOS: Settings → General → Reset → Reset Location & Privacy
- Try a different USB cable/port

### "No packets appearing"
- Make sure Bluetooth logging profile is installed
- Restart iOS device after installing profile
- Make sure Bluetooth is ON on iOS device

### "Can't find Lumenate traffic"
- Filter by device name "Lumenate Nova"
- Look for the characteristic UUIDs we know
- The traffic might be encrypted (unlikely for this device)

## Remove Logging Profile (After Done)

1. **Settings → General → VPN & Device Management**
2. Find the Bluetooth Logging profile
3. Tap **Remove Profile**

This is important for battery life and privacy!

---

## Quick Reference

**PacketLogger Download**: Xcode → Open Developer Tool → More Developer Tools

**Logging Profile**: https://developer.apple.com/bug-reporting/profiles-and-logs/

**Known Characteristic UUID**: `3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e` (Command)

**Known Commands**:
- `01ff` = Light ON
- `02ff` = Light OFF
