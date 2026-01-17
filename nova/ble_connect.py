#!/usr/bin/env python3
"""
Lumenate Nova BLE Connection using bleak (Python)
Uses scan callback for immediate connection attempt
"""

import asyncio
from bleak import BleakScanner, BleakClient

# Service UUIDs from nRF Connect discovery
CONTROL_SERVICE = "47bbfb1e-670e-4f81-bfb3-78daffc9a783"

# Characteristics
DATA_CHAR = "2b35ef1f-11a6-4089-8cd5-843c5d0c9c55"
COMMAND_CHAR = "3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e"
STATUS_CHAR = "964fbffe-6940-4371-8d48-fe43b07ed00b"
BATTERY_CHAR = "00002a19-0000-1000-8000-00805f9b34fb"


def notification_handler(characteristic, data):
    print(f"[NOTIFY] {data.hex()}")


async def connect_device(device):
    """Connect to the device and discover services"""
    print(f"\nConnecting to {device.name}...")
    print(f"Address: {device.address}")

    client = BleakClient(device, timeout=45.0)

    try:
        connected = await client.connect()
        if not connected:
            print("Connection returned False")
            return

        print("CONNECTED!\n")

        # Get services
        services = client.services
        print(f"Found {len(services)} services:\n")

        for service in services:
            print(f"Service: {service.uuid}")
            for char in service.characteristics:
                props = ", ".join(char.properties)
                print(f"  └─ {char.uuid} ({props})")

                if "read" in char.properties:
                    try:
                        value = await client.read_gatt_char(char.uuid)
                        print(f"     Value: {value.hex()}")
                    except Exception as e:
                        print(f"     Error: {e}")
            print()

        print("=" * 45)
        print("Device ready!")
        print("=" * 45)

        # Subscribe to notifications
        try:
            await client.start_notify(DATA_CHAR, notification_handler)
            print("Subscribed to data char")
        except:
            pass

        try:
            await client.start_notify(STATUS_CHAR, notification_handler)
            print("Subscribed to status char")
        except:
            pass

        print("\nListening... Press Ctrl+C to exit\n")
        await asyncio.sleep(60)

    except asyncio.TimeoutError:
        print("Connection timeout!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if client.is_connected:
            await client.disconnect()
            print("Disconnected")


async def main():
    print("Lumenate Nova BLE Connection")
    print("=" * 45)
    print("\nScanning...")

    device = None

    def detection_callback(dev, adv_data):
        nonlocal device
        if dev.name and "Lumenate" in dev.name and device is None:
            device = dev
            print(f"Found: {dev.name}")

    scanner = BleakScanner(detection_callback=detection_callback)

    await scanner.start()
    # Scan for 10 seconds or until found
    for _ in range(20):
        if device:
            break
        await asyncio.sleep(0.5)
    await scanner.stop()

    if device:
        await connect_device(device)
    else:
        print("Device not found!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting...")
