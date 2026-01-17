#!/usr/bin/env node
/**
 * Lumenate Nova BLE Device Simulator
 * 
 * Simulates the Nova device to capture commands from the official Lumenate app.
 * Run this, then connect with the official app to see what commands it sends.
 * 
 * Installation:
 *   npm install @abandonware/bleno
 * 
 * Usage:
 *   node nova/device-simulator.js
 * 
 * Then:
 *   1. Open the official Lumenate app on your phone
 *   2. Try to connect to "Lumenate Nova" (it will connect to this simulator)
 *   3. Start a journey/session in the app
 *   4. Watch the console to see all commands being sent
 */

const bleno = require('@abandonware/bleno');

// Service UUIDs (same as real device)
const CONTROL_SERVICE_UUID = '47bbfb1e670e4f81bfb378daffc9a783';
const MCUMGR_SERVICE_UUID = 'b568de7cb6c642cb8303fcc9cb25007c';
const BATTERY_SERVICE_UUID = '180f';

// Characteristic UUIDs
const DATA_CHAR_UUID = '2b35ef1f11a640898cd5843c5d0c9c55';
const COMMAND_CHAR_UUID = '3e25a3bfbfe14c7197c55bdb73fac89e';
const STATUS_CHAR_UUID = '964fbffe69404371bd48fe43b07ed00b';
const BATTERY_CHAR_UUID = '2a19';

// Store received commands
const receivedCommands = [];
let commandCount = 0;

// Command Characteristic
class CommandCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: COMMAND_CHAR_UUID,
      properties: ['writeWithoutResponse'],
      descriptors: []
    });
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    const hex = data.toString('hex');
    const bytes = Array.from(data).map(b => b.toString(16).padStart(2, '0'));
    const timestamp = new Date().toISOString();
    
    commandCount++;
    const command = {
      number: commandCount,
      timestamp,
      hex,
      bytes: bytes.join(' '),
      raw: Array.from(data),
      length: data.length
    };
    
    receivedCommands.push(command);
    
    console.log(`\n[COMMAND #${commandCount}] ${timestamp}`);
    console.log(`  Hex: ${hex}`);
    console.log(`  Bytes: ${bytes.join(' ')}`);
    console.log(`  Length: ${data.length} bytes`);
    console.log(`  Raw: [${data.join(', ')}]`);
    
    // Try to interpret the command
    if (data.length >= 2) {
      const first = data[0];
      const second = data[1];
      if (first === 0x01 && second >= 0xFA && second <= 0xFF) {
        console.log(`  → Turn on light (01${second.toString(16).padStart(2, '0')})`);
      } else if (first === 0x02 && second === 0xFF) {
        console.log(`  → Turn off light (02ff)`);
      } else if (data.length === 3 && first === 0x01 && second === 0xFF) {
        const freq = data[2];
        console.log(`  → 01ff + frequency byte: ${freq} (0x${freq.toString(16).padStart(2, '0')})`);
      } else {
        console.log(`  → Unknown pattern`);
      }
    }
    
    callback(this.RESULT_SUCCESS);
  }
}

// Data Characteristic
class DataCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: DATA_CHAR_UUID,
      properties: ['read', 'writeWithoutResponse', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([0x2b]); // Default value
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    const hex = data.toString('hex');
    const bytes = Array.from(data).map(b => b.toString(16).padStart(2, '0'));
    const timestamp = new Date().toISOString();
    
    commandCount++;
    const command = {
      number: commandCount,
      timestamp,
      hex,
      bytes: bytes.join(' '),
      raw: Array.from(data),
      length: data.length,
      characteristic: 'DATA'
    };
    
    receivedCommands.push(command);
    
    console.log(`\n[DATA #${commandCount}] ${timestamp}`);
    console.log(`  Hex: ${hex}`);
    console.log(`  Bytes: ${bytes.join(' ')}`);
    console.log(`  Length: ${data.length} bytes`);
    
    this._value = data;
    callback(this.RESULT_SUCCESS);
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('  Client subscribed to DATA notifications');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    console.log('  Client unsubscribed from DATA notifications');
    this._updateValueCallback = null;
  }
}

// Status Characteristic
class StatusCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: STATUS_CHAR_UUID,
      properties: ['read', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([0x00, 0x00]); // Default status
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('  Client subscribed to STATUS notifications');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    console.log('  Client unsubscribed from STATUS notifications');
    this._updateValueCallback = null;
  }
}

// Battery Characteristic
class BatteryCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: BATTERY_CHAR_UUID,
      properties: ['read', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([95]); // 95% battery
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('  Client subscribed to BATTERY notifications');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    console.log('  Client unsubscribed from BATTERY notifications');
    this._updateValueCallback = null;
  }
}

// Control Service
const controlService = new bleno.PrimaryService({
  uuid: CONTROL_SERVICE_UUID,
  characteristics: [
    new CommandCharacteristic(),
    new DataCharacteristic(),
    new StatusCharacteristic()
  ]
});

// McuMgr Service (for firmware updates - minimal implementation)
const mcuMgrService = new bleno.PrimaryService({
  uuid: MCUMGR_SERVICE_UUID,
  characteristics: [] // Empty for now, just needs to exist
});

// Battery Service
const batteryService = new bleno.PrimaryService({
  uuid: BATTERY_SERVICE_UUID,
  characteristics: [
    new BatteryCharacteristic()
  ]
});

// Track if services are set
let servicesSet = false;

// Set services first (before advertising)
function setupServices() {
  // Set all services to match the real device exactly
  // Order: Control Service (primary), McuMgr Service, Battery Service
  bleno.setServices([controlService, mcuMgrService, batteryService], (err) => {
    if (err) {
      console.warn('Service setup error (Battery may be restricted on macOS):', err.message);
      // Try without battery service (macOS restriction)
      bleno.setServices([controlService, mcuMgrService], (err2) => {
        if (err2) {
          console.error('Set services error:', err2);
          servicesSet = false;
        } else {
          servicesSet = true;
          console.log('Services set successfully');
          console.log('  - Control Service (47bbfb1e-670e-4f81-bfb3-78daffc9a783)');
          console.log('  - McuMgr Service (b568de7c-b6c6-42cb-8303-fcc9cb25007c)');
          console.log('  - Battery Service (skipped - macOS restriction)');
          startAdvertising();
        }
      });
    } else {
      servicesSet = true;
      console.log('Services set successfully');
      console.log('  - Control Service (47bbfb1e-670e-4f81-bfb3-78daffc9a783)');
      console.log('  - McuMgr Service (b568de7c-b6c6-42cb-8303-fcc9cb25007c)');
      console.log('  - Battery Service (180f)');
      startAdvertising();
    }
  });
}

// Start advertising after services are set
function startAdvertising() {
  // Format UUIDs with dashes for advertising (bleno accepts both formats)
  // The real device advertises these exact service UUIDs
  const serviceUUIDs = [
    CONTROL_SERVICE_UUID,  // 47bbfb1e670e4f81bfb378daffc9a783
    MCUMGR_SERVICE_UUID     // b568de7cb6c642cb8303fcc9cb25007c
  ];
  
  bleno.startAdvertising('Lumenate Nova', serviceUUIDs, (err) => {
    if (err) {
      console.error('Advertising error:', err);
    } else {
      console.log('\n✅ Advertising as "Lumenate Nova"');
      console.log('   Service UUIDs in advertisement:');
      console.log('   - 47bbfb1e-670e-4f81-bfb3-78daffc9a783 (Control)');
      console.log('   - b568de7c-b6c6-42cb-8303-fcc9cb25007c (McuMgr)');
      console.log('   Waiting for official app to connect...\n');
      console.log('📱 Make sure:');
      console.log('   - Your phone Bluetooth is on');
      console.log('   - You\'re within Bluetooth range');
      console.log('   - The official app is looking for devices\n');
      console.log('⚠️  NOTE: iOS apps may not discover macOS BLE peripherals.');
      console.log('   If the app can\'t find the device, try:');
      console.log('   - Using an Android phone instead');
      console.log('   - Running simulator on Linux/Raspberry Pi');
      console.log('   - Using a BLE packet sniffer tool\n');
    }
  });
}

// Main
bleno.on('stateChange', (state) => {
  console.log(`Bluetooth state: ${state}`);
  
  if (state === 'poweredOn') {
    // Set services first, then advertise
    setupServices();
  } else {
    bleno.stopAdvertising();
    servicesSet = false;
  }
});

bleno.on('advertisingStart', (err) => {
  if (err) {
    console.error('Advertising start error:', err);
  } else {
    console.log('✅ Advertising started successfully');
  }
});

bleno.on('accept', (clientAddress) => {
  console.log(`\n📱 Client connected: ${clientAddress}`);
  console.log('   Ready to capture commands from official app...\n');
});

bleno.on('disconnect', (clientAddress) => {
  console.log(`\n📱 Client disconnected: ${clientAddress}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total commands received: ${commandCount}`);
  console.log(`\n📝 All Commands:`);
  receivedCommands.forEach(cmd => {
    console.log(`\n#${cmd.number} [${cmd.timestamp}]`);
    console.log(`   Hex: ${cmd.hex}`);
    console.log(`   Bytes: ${cmd.bytes}`);
    console.log(`   Length: ${cmd.length} bytes`);
    if (cmd.characteristic) {
      console.log(`   Characteristic: ${cmd.characteristic}`);
    }
  });
  console.log('\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📊 Final Summary:');
  console.log(`   Total commands: ${commandCount}`);
  console.log('\n📝 Command Log:');
  receivedCommands.forEach(cmd => {
    console.log(`   ${cmd.hex} (${cmd.bytes})`);
  });
  console.log('\nShutting down...\n');
  bleno.stopAdvertising();
  process.exit(0);
});

console.log('Lumenate Nova BLE Device Simulator');
console.log('====================================\n');
console.log('This simulator acts as the Nova device.');
console.log('Connect with the official Lumenate app to capture commands.\n');
