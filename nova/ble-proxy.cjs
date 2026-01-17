#!/usr/bin/env node
/**
 * Lumenate Nova BLE Proxy/MITM
 * 
 * This creates a proxy that:
 * 1. Connects to the REAL Nova device (as a central)
 * 2. Exposes itself as a fake Nova (as a peripheral)
 * 3. Forwards commands between the app and real device
 * 4. Logs ALL commands in both directions
 * 
 * This way we can capture what the official app sends while it thinks
 * it's talking to the real device!
 * 
 * Note: This requires both @abandonware/noble and @abandonware/bleno
 * 
 * Usage:
 *   sudo node nova/ble-proxy.cjs
 */

const noble = require('@abandonware/noble');
const bleno = require('@abandonware/bleno');

// Service UUIDs
const CONTROL_SERVICE_UUID = '47bbfb1e670e4f81bfb378daffc9a783';
const MCUMGR_SERVICE_UUID = 'b568de7cb6c642cb8303fcc9cb25007c';
const BATTERY_SERVICE_UUID = '180f';

// Characteristic UUIDs
const DATA_CHAR_UUID = '2b35ef1f11a640898cd5843c5d0c9c55';
const COMMAND_CHAR_UUID = '3e25a3bfbfe14c7197c55bdb73fac89e';
const STATUS_CHAR_UUID = '964fbffe69404371bd48fe43b07ed00b';
const BATTERY_CHAR_UUID = '2a19';

// State
let realDevice = null;
let realCommandChar = null;
let realDataChar = null;
let realStatusChar = null;
let commandCount = 0;
const receivedCommands = [];

console.log('Lumenate Nova BLE Proxy');
console.log('========================\n');
console.log('This proxy connects to the real Nova and exposes a fake one.');
console.log('The official app connects to the fake, commands are forwarded to real.\n');

// ============ NOBLE (Central) - Connect to real device ============

noble.on('stateChange', (state) => {
  console.log(`[CENTRAL] Bluetooth state: ${state}`);
  if (state === 'poweredOn') {
    console.log('[CENTRAL] Scanning for real Lumenate Nova...');
    noble.startScanning([], false);
  }
});

noble.on('discover', async (peripheral) => {
  const name = peripheral.advertisement.localName || '';
  
  if (name === 'Lumenate Nova' && !realDevice) {
    console.log(`[CENTRAL] Found real device: ${name}`);
    noble.stopScanning();
    realDevice = peripheral;
    
    try {
      await connectToRealDevice(peripheral);
    } catch (err) {
      console.error('[CENTRAL] Connection error:', err.message);
    }
  }
});

async function connectToRealDevice(peripheral) {
  return new Promise((resolve, reject) => {
    console.log('[CENTRAL] Connecting to real device...');
    
    peripheral.connect((err) => {
      if (err) return reject(err);
      
      console.log('[CENTRAL] Connected to real device!');
      
      peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
        if (err) return reject(err);
        
        // Find our characteristics
        for (const char of characteristics) {
          const uuid = char.uuid.toLowerCase();
          if (uuid === COMMAND_CHAR_UUID) realCommandChar = char;
          if (uuid === DATA_CHAR_UUID) realDataChar = char;
          if (uuid === STATUS_CHAR_UUID) realStatusChar = char;
        }
        
        console.log('[CENTRAL] Characteristics found:');
        console.log(`  - Command: ${realCommandChar ? 'Yes' : 'No'}`);
        console.log(`  - Data: ${realDataChar ? 'Yes' : 'No'}`);
        console.log(`  - Status: ${realStatusChar ? 'Yes' : 'No'}`);
        console.log('');
        
        // Subscribe to notifications from real device
        if (realDataChar && realDataChar.properties.includes('notify')) {
          realDataChar.subscribe();
          realDataChar.on('data', (data) => {
            console.log(`[REAL→APP] Data notification: ${data.toString('hex')}`);
          });
        }
        
        if (realStatusChar && realStatusChar.properties.includes('notify')) {
          realStatusChar.subscribe();
          realStatusChar.on('data', (data) => {
            console.log(`[REAL→APP] Status notification: ${data.toString('hex')}`);
          });
        }
        
        console.log('[CENTRAL] Real device ready!');
        console.log('[CENTRAL] Now starting peripheral to accept app connections...\n');
        
        // Now start the peripheral (bleno) to accept connections
        startPeripheral();
        
        resolve();
      });
    });
  });
}

// ============ BLENO (Peripheral) - Accept app connections ============

// Command Characteristic (receives commands from app, forwards to real device)
class ProxyCommandCharacteristic extends bleno.Characteristic {
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
    receivedCommands.push({ timestamp, hex, bytes: bytes.join(' ') });
    
    console.log(`\n[APP→REAL] COMMAND #${commandCount}`);
    console.log(`  Hex: ${hex}`);
    console.log(`  Bytes: ${bytes.join(' ')}`);
    console.log(`  Time: ${timestamp}`);
    
    // Forward to real device
    if (realCommandChar) {
      realCommandChar.write(data, true, (err) => {
        if (err) {
          console.log(`  → Forward FAILED: ${err.message}`);
        } else {
          console.log(`  → Forwarded to real device ✓`);
        }
      });
    } else {
      console.log(`  → Cannot forward (real device not connected)`);
    }
    
    callback(this.RESULT_SUCCESS);
  }
}

// Data Characteristic
class ProxyDataCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: DATA_CHAR_UUID,
      properties: ['read', 'writeWithoutResponse', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([0x2b]);
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    const hex = data.toString('hex');
    console.log(`\n[APP→REAL] DATA: ${hex}`);
    
    // Forward to real device
    if (realDataChar) {
      realDataChar.write(data, true, (err) => {
        if (err) console.log(`  → Forward FAILED`);
        else console.log(`  → Forwarded ✓`);
      });
    }
    
    this._value = data;
    callback(this.RESULT_SUCCESS);
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('[APP] Subscribed to DATA notifications');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    this._updateValueCallback = null;
  }
}

// Status Characteristic
class ProxyStatusCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: STATUS_CHAR_UUID,
      properties: ['read', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([0x00, 0x00]);
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('[APP] Subscribed to STATUS notifications');
    this._updateValueCallback = updateValueCallback;
  }

  onUnsubscribe() {
    this._updateValueCallback = null;
  }
}

// Battery Characteristic
class ProxyBatteryCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: BATTERY_CHAR_UUID,
      properties: ['read', 'notify'],
      descriptors: []
    });
    this._value = Buffer.from([95]);
  }

  onReadRequest(offset, callback) {
    callback(this.RESULT_SUCCESS, this._value);
  }
}

// Services
const proxyControlService = new bleno.PrimaryService({
  uuid: CONTROL_SERVICE_UUID,
  characteristics: [
    new ProxyCommandCharacteristic(),
    new ProxyDataCharacteristic(),
    new ProxyStatusCharacteristic()
  ]
});

const proxyMcuMgrService = new bleno.PrimaryService({
  uuid: MCUMGR_SERVICE_UUID,
  characteristics: []
});

const proxyBatteryService = new bleno.PrimaryService({
  uuid: BATTERY_SERVICE_UUID,
  characteristics: [new ProxyBatteryCharacteristic()]
});

function startPeripheral() {
  // Note: On macOS, bleno and noble may conflict
  // This is a limitation - you may need to run on Linux/RPi
  console.log('[PERIPHERAL] Starting advertising...');
  
  bleno.startAdvertising('Lumenate Nova', [], (err) => {
    if (err) {
      console.error('[PERIPHERAL] Advertising error:', err);
    } else {
      console.log('[PERIPHERAL] Advertising as "Lumenate Nova" (proxy)');
    }
  });
}

bleno.on('advertisingStart', (err) => {
  if (!err) {
    bleno.setServices([proxyControlService, proxyMcuMgrService, proxyBatteryService], (err) => {
      if (err) {
        // Try without battery service
        bleno.setServices([proxyControlService, proxyMcuMgrService], (err2) => {
          if (!err2) {
            console.log('[PERIPHERAL] Services set (without battery)');
          }
        });
      } else {
        console.log('[PERIPHERAL] Services set');
      }
    });
  }
});

bleno.on('accept', (clientAddress) => {
  console.log(`\n[PERIPHERAL] App connected: ${clientAddress}`);
  console.log('[PERIPHERAL] Ready to capture and forward commands!\n');
});

bleno.on('disconnect', (clientAddress) => {
  console.log(`\n[PERIPHERAL] App disconnected`);
  console.log(`\n📊 Session Summary:`);
  console.log(`   Total commands captured: ${commandCount}`);
  console.log(`\n📝 All Commands:`);
  receivedCommands.forEach((cmd, i) => {
    console.log(`   ${i+1}. ${cmd.hex} (${cmd.bytes})`);
  });
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📊 Final Summary:');
  console.log(`   Total commands: ${commandCount}`);
  console.log('\n📝 Command Log:');
  receivedCommands.forEach((cmd, i) => {
    console.log(`   ${cmd.hex} (${cmd.bytes})`);
  });
  console.log('\nShutting down...\n');
  bleno.stopAdvertising();
  if (realDevice) realDevice.disconnect();
  process.exit(0);
});
