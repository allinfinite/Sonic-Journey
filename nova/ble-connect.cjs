const noble = require('@abandonware/noble');

// Lumenate Nova Service UUIDs (from nRF Connect discovery)
const CONTROL_SERVICE = '47bbfb1e670e4f81bfb378daffc9a783';
const MCUMGR_SERVICE = 'b568de7cb6c642cb8303fcc9cb25007c';
const BATTERY_SERVICE = '180f';

// Control Characteristics
const DATA_CHAR = '2b35ef1f11a640898cd5843c5d0c9c55';      // Read, Write, Notify
const COMMAND_CHAR = '3e25a3bfbfe14c7197c55bdb73fac89e';   // Write
const STATUS_CHAR = '964fbffe69404371bd48fe43b07ed00b';    // Read, Notify

const TARGET_NAME = 'Lumenate Nova';
let foundDevice = false;
let connectedPeripheral = null;

console.log('Lumenate Nova BLE Connection');
console.log('============================\n');
console.log('Make sure to disconnect from nRF Connect first!\n');

noble.on('stateChange', (state) => {
  console.log('Bluetooth:', state);
  if (state === 'poweredOn') {
    console.log('Scanning...\n');
    noble.startScanning([], false);  // Scan for all devices
  }
});

noble.on('discover', (peripheral) => {
  const name = peripheral.advertisement.localName || '';

  if ((name === TARGET_NAME || name.includes('Lumenate')) && !foundDevice) {
    foundDevice = true;
    noble.stopScanning();

    console.log('Found:', name);
    console.log('ID:', peripheral.id);
    console.log('RSSI:', peripheral.rssi);
    console.log('');

    connectToDevice(peripheral);
  }
});

async function connectToDevice(peripheral) {
  console.log('Connecting...');
  connectedPeripheral = peripheral;

  peripheral.on('disconnect', () => {
    console.log('\nDisconnected.');
    process.exit(0);
  });

  peripheral.connect((err) => {
    if (err) {
      console.error('Connection failed:', err.message);
      process.exit(1);
    }

    console.log('Connected!\n');
    console.log('Discovering services...');

    peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
      if (err) {
        console.error('Discovery failed:', err.message);
        peripheral.disconnect();
        return;
      }

      console.log(`Found ${services.length} services:\n`);

      // Find our target characteristics
      let dataChar = null;
      let commandChar = null;
      let statusChar = null;
      let batteryChar = null;

      for (const service of services) {
        const svcUuid = service.uuid.toLowerCase();
        let svcName = 'Unknown';

        if (svcUuid === CONTROL_SERVICE) svcName = 'Control Service';
        else if (svcUuid === MCUMGR_SERVICE) svcName = 'McuMgr DFU';
        else if (svcUuid === BATTERY_SERVICE || svcUuid === '180f') svcName = 'Battery Service';
        else if (svcUuid === '1800') svcName = 'Generic Access';
        else if (svcUuid === '1801') svcName = 'Generic Attribute';

        console.log(`[${svcName}] ${service.uuid}`);

        const svcChars = characteristics.filter(c => c._serviceUuid === service.uuid);
        for (const char of svcChars) {
          const charUuid = char.uuid.toLowerCase();
          const props = char.properties.join(', ');
          console.log(`  └─ ${char.uuid} (${props})`);

          // Map characteristics
          if (charUuid === DATA_CHAR) dataChar = char;
          if (charUuid === COMMAND_CHAR) commandChar = char;
          if (charUuid === STATUS_CHAR) statusChar = char;
          if (charUuid === '2a19') batteryChar = char;
        }
        console.log('');
      }

      // Read battery level
      if (batteryChar) {
        batteryChar.read((err, data) => {
          if (!err && data) {
            console.log(`Battery: ${data[0]}%`);
          }
        });
      }

      // Subscribe to notifications
      if (dataChar && dataChar.properties.includes('notify')) {
        dataChar.subscribe((err) => {
          if (!err) console.log('Subscribed to data notifications');
        });
        dataChar.on('data', (data) => {
          console.log(`[DATA] ${data.toString('hex')}`);
        });
      }

      if (statusChar && statusChar.properties.includes('notify')) {
        statusChar.subscribe((err) => {
          if (!err) console.log('Subscribed to status notifications');
        });
        statusChar.on('data', (data) => {
          console.log(`[STATUS] ${data.toString('hex')}`);
        });

        // Read initial status
        if (statusChar.properties.includes('read')) {
          statusChar.read((err, data) => {
            if (!err && data) {
              console.log(`Initial status: ${data.toString('hex')}`);
            }
          });
        }
      }

      console.log('\n============================');
      console.log('Device ready!');
      console.log('============================\n');

      if (commandChar) {
        console.log('Command characteristic available for writing.');
        console.log('Use writeCommand(buffer) to send commands.\n');

        // Store globally for interactive use
        global.commandChar = commandChar;
        global.dataChar = dataChar;
        global.statusChar = statusChar;
      }

      console.log('Listening for notifications... Press Ctrl+C to exit.\n');
    });
  });
}

// Scan timeout
setTimeout(() => {
  if (!foundDevice) {
    console.log('Device not found after 30s.');
    console.log('Make sure Lumenate Nova is on and not connected to another device.');
    noble.stopScanning();
    process.exit(1);
  }
}, 30000);

// Graceful exit
process.on('SIGINT', () => {
  console.log('\nExiting...');
  if (connectedPeripheral) {
    connectedPeripheral.disconnect();
  }
  noble.stopScanning();
  process.exit(0);
});

// Helper function to write commands
global.writeCommand = (hexString) => {
  if (!global.commandChar) {
    console.log('Command characteristic not available');
    return;
  }
  const buffer = Buffer.from(hexString, 'hex');
  global.commandChar.write(buffer, true, (err) => {
    if (err) console.log('Write error:', err.message);
    else console.log('Command sent:', hexString);
  });
};
