#!/usr/bin/env python3
"""
Lumenate Nova BLE Connection using bleak (Python)
"""

import asyncio
from bleak import BleakScanner, BleakClient

# Service UUIDs from nRF Connect discovery
CONTROL_SERVICE = "47bbfb1e-670e-4f81-bfb3-78daffc9a783"
MCUMGR_SERVICE = "b568de7c-b6c6-42cb-8303-fcc9cb25007c"
BATTERY_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb"

# Characteristics
DATA_CHAR = "2b35ef1f-11a6-4089-8cd5-843c5d0c9c55"      # Read, Write, Notify
COMMAND_CHAR = "3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e"   # Write
STATUS_CHAR = "964fbffe-6940-4371-8d48-fe43b07ed00b"    # Read, Notify
BATTERY_CHAR = "00002a19-0000-1000-8000-00805f9b34fb"   # Battery Level


def notification_handler(characteristic, data):
    """Handle incoming notifications"""
    print(f"[NOTIFY {characteristic.uuid[:8]}] {data.hex()}")


async def main():
    print("Lumenate Nova BLE Connection (Python/bleak)")
    print("=" * 45)
    print("\nScanning for Lumenate Nova...")

    # Scan for the device
    device = None
    devices = await BleakScanner.discover(timeout=10.0)

    for d in devices:
        if d.name and "Lumenate" in d.name:
            device = d
            print(f"\nFound: {d.name}")
            print(f"Address: {d.address}")
            break

    if not device:
        print("\nLumenate Nova not found!")
        print("Make sure it's powered on and not connected to another device.")
        return

    print(f"\nConnecting to {device.name}...")

    async with BleakClient(device.address, timeout=30.0) as client:
        if client.is_connected:
            print("Connected!\n")

            # List all services
            print("Services discovered:")
            print("-" * 40)

            for service in client.services:
                svc_name = "Unknown"
                if "180f" in service.uuid.lower():
                    svc_name = "Battery Service"
                elif "47bbfb1e" in service.uuid.lower():
                    svc_name = "Control Service"
                elif "b568de7c" in service.uuid.lower():
                    svc_name = "McuMgr DFU"
                elif "1800" in service.uuid.lower():
                    svc_name = "Generic Access"
                elif "1801" in service.uuid.lower():
                    svc_name = "Generic Attribute"

                print(f"\n[{svc_name}] {service.uuid}")

                for char in service.characteristics:
                    props = ", ".join(char.properties)
                    print(f"  └─ {char.uuid}")
                    print(f"     Properties: {props}")

                    # Try to read if readable
                    if "read" in char.properties:
                        try:
                            value = await client.read_gatt_char(char.uuid)
                            print(f"     Value: {value.hex()}")
                        except Exception as e:
                            print(f"     Read error: {e}")

            print("\n" + "=" * 45)
            print("Device ready!")
            print("=" * 45)

            # Read battery level
            try:
                battery = await client.read_gatt_char(BATTERY_CHAR)
                print(f"\nBattery: {battery[0]}%")
            except:
                pass

            # Subscribe to notifications
            try:
                await client.start_notify(DATA_CHAR, notification_handler)
                print("Subscribed to data notifications")
            except Exception as e:
                print(f"Could not subscribe to data: {e}")

            try:
                await client.start_notify(STATUS_CHAR, notification_handler)
                print("Subscribed to status notifications")
            except Exception as e:
                print(f"Could not subscribe to status: {e}")

            print("\nListening for notifications (30 seconds)...")
            print("Press Ctrl+C to exit early.\n")

            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                pass

            print("\nDisconnecting...")
        else:
            print("Failed to connect!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting...")
