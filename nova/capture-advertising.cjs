#!/usr/bin/env node
/**
 * Capture Real Device Advertising Data
 * 
 * This script scans for the real Lumenate Nova and logs ALL advertising data
 * so we can replicate it exactly in the simulator.
 */

const noble = require('@abandonware/noble');

const TARGET_NAME = 'Lumenate Nova';
let foundDevice = false;

console.log('Lumenate Nova Advertising Capture');
console.log('===================================\n');
console.log('Scanning for real device to capture advertising data...\n');
console.log('Make sure your real Lumenate Nova is ON and not connected to another device.\n');

noble.on('stateChange', (state) => {
  console.log('Bluetooth:', state);
  if (state === 'poweredOn') {
    console.log('Scanning...\n');
    noble.startScanning([], false);  // Scan for all devices, no filters
  }
});

noble.on('discover', (peripheral) => {
  const name = peripheral.advertisement.localName || '';
  
  if ((name === TARGET_NAME || name.includes('Lumenate')) && !foundDevice) {
    foundDevice = true;
    noble.stopScanning();
    
    console.log('='.repeat(60));
    console.log('FOUND: Lumenate Nova');
    console.log('='.repeat(60));
    console.log('');
    
    // Device Info
    console.log('📱 Device Information:');
    console.log(`   Name: ${peripheral.advertisement.localName || 'N/A'}`);
    console.log(`   ID: ${peripheral.id}`);
    console.log(`   Address: ${peripheral.address || 'N/A'}`);
    console.log(`   Address Type: ${peripheral.addressType || 'N/A'}`);
    console.log(`   RSSI: ${peripheral.rssi} dBm`);
    console.log(`   Connectable: ${peripheral.advertisement.connectable !== false ? 'Yes' : 'No'}`);
    console.log('');
    
    // Advertising Data
    const adv = peripheral.advertisement;
    console.log('📡 Advertising Data:');
    console.log('');
    
    // Service UUIDs
    if (adv.serviceUuids && adv.serviceUuids.length > 0) {
      console.log('   Service UUIDs in Advertising:');
      adv.serviceUuids.forEach(uuid => {
        console.log(`     - ${uuid}`);
      });
      console.log('');
    } else {
      console.log('   Service UUIDs: None (services discovered after connection)');
      console.log('');
    }
    
    // Service Data
    if (adv.serviceData && adv.serviceData.length > 0) {
      console.log('   Service Data:');
      adv.serviceData.forEach(sd => {
        console.log(`     - ${sd.uuid}: ${sd.data.toString('hex')}`);
      });
      console.log('');
    }
    
    // Manufacturer Data
    if (adv.manufacturerData) {
      console.log('   Manufacturer Data:');
      console.log(`     Hex: ${adv.manufacturerData.toString('hex')}`);
      console.log(`     Length: ${adv.manufacturerData.length} bytes`);
      console.log(`     Raw: [${Array.from(adv.manufacturerData).join(', ')}]`);
      console.log('');
    } else {
      console.log('   Manufacturer Data: None');
      console.log('');
    }
    
    // TX Power
    if (adv.txPowerLevel !== undefined) {
      console.log(`   TX Power Level: ${adv.txPowerLevel} dBm`);
      console.log('');
    }
    
    // Solicitation UUIDs
    if (adv.solicitationServiceUuids && adv.solicitationServiceUuids.length > 0) {
      console.log('   Solicitation Service UUIDs:');
      adv.solicitationServiceUuids.forEach(uuid => {
        console.log(`     - ${uuid}`);
      });
      console.log('');
    }
    
    // Appearance
    if (adv.appearance !== undefined) {
      console.log(`   Appearance: 0x${adv.appearance.toString(16).padStart(4, '0')}`);
      console.log('');
    }
    
    // Flags
    if (adv.flags !== undefined) {
      console.log(`   Flags: 0x${adv.flags.toString(16).padStart(2, '0')}`);
      console.log('');
    }
    
    // Raw advertising data (if available)
    console.log('📦 Raw Advertising Data:');
    console.log(`   Local Name: ${adv.localName || 'N/A'}`);
    console.log(`   Shortened Local Name: ${adv.shortenedLocalName || 'N/A'}`);
    console.log('');
    
    // Try to get scan response data
    console.log('🔍 Scan Response Data:');
    console.log('   (Will be captured when device responds to scan request)');
    console.log('');
    
    console.log('='.repeat(60));
    console.log('Copy the above information to match in simulator');
    console.log('='.repeat(60));
    console.log('');
    
    process.exit(0);
  }
});

// Timeout
setTimeout(() => {
  if (!foundDevice) {
    console.log('❌ Device not found after 30 seconds.');
    console.log('Make sure:');
    console.log('  - Lumenate Nova is powered ON');
    console.log('  - Device is not connected to another app');
    console.log('  - You are within Bluetooth range');
    noble.stopScanning();
    process.exit(1);
  }
}, 30000);

// Graceful exit
process.on('SIGINT', () => {
  console.log('\nExiting...');
  noble.stopScanning();
  process.exit(0);
});
