/**
 * NovaController - BLE control for Lumenate Nova device
 * Provides flicker control synchronized with journey phases
 */

// BLE Service and Characteristic UUIDs
const CONTROL_SERVICE = '47bbfb1e-670e-4f81-bfb3-78daffc9a783';
const COMMAND_CHAR = '3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e';

// Frequency band mappings based on neuroscience research
export const NOVA_FREQUENCY_MAP: Record<string, number> = {
  // Delta (1-4 Hz) - Deep sleep, relaxation
  delta: 3,
  // Theta (4-7 Hz) - Meditation, hypnagogic states
  theta: 6,
  // Alpha (8-12 Hz) - Vivid visuals, flow states
  alpha: 10,
  // Beta (13-30 Hz) - Alertness, focus
  beta: 15,
  // Default fallback
  default: 10,
};

/**
 * Map journey frequency (Hz) to Nova flicker frequency
 * Based on neuroscience: frequency bands determine neural entrainment effects
 */
export function mapFrequencyToNova(audioFreq: number): number {
  if (audioFreq <= 4) return NOVA_FREQUENCY_MAP.delta;      // Delta: deep sleep
  if (audioFreq <= 7) return NOVA_FREQUENCY_MAP.theta;     // Theta: meditation
  if (audioFreq <= 12) return NOVA_FREQUENCY_MAP.alpha;     // Alpha: visuals
  if (audioFreq <= 30) return NOVA_FREQUENCY_MAP.beta;     // Beta: focus
  return NOVA_FREQUENCY_MAP.default;                        // Default: alpha
}

/**
 * Map rhythm mode to Nova frequency
 */
export function mapRhythmModeToNova(rhythmMode: string): number {
  switch (rhythmMode) {
    case 'theta':
      return NOVA_FREQUENCY_MAP.theta;
    case 'alpha':
      return NOVA_FREQUENCY_MAP.alpha;
    default:
      return NOVA_FREQUENCY_MAP.alpha; // Default to alpha for breathing/heartbeat
  }
}

export interface NovaState {
  isConnected: boolean;
  isFlickering: boolean;
  currentFrequency: number | null;
  device: BluetoothDevice | null;
  commandChar: BluetoothRemoteGATTCharacteristic | null;
}

export class NovaController {
  private state: NovaState = {
    isConnected: false,
    isFlickering: false,
    currentFrequency: null,
    device: null,
    commandChar: null,
  };

  private flickerInterval: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (state: NovaState) => void;
  private isStartingFlicker = false; // Guard against concurrent startFlicker calls
  private debugLog: Array<{ timestamp: number; message: string; type: 'info' | 'warn' | 'error' | 'success' }> = [];
  private onDebugLog?: (log: Array<{ timestamp: number; message: string; type: 'info' | 'warn' | 'error' | 'success' }>) => void;
  private maxLogEntries = 50;

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: NovaState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Set callback for debug log updates
   */
  setOnDebugLog(callback: (log: Array<{ timestamp: number; message: string; type: 'info' | 'warn' | 'error' | 'success' }>) => void) {
    this.onDebugLog = callback;
  }

  /**
   * Get current debug log
   */
  getDebugLog(): Array<{ timestamp: number; message: string; type: 'info' | 'warn' | 'error' | 'success' }> {
    return [...this.debugLog];
  }

  /**
   * Add entry to debug log
   */
  private addDebugLog(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const entry = {
      timestamp: Date.now(),
      message,
      type,
    };
    this.debugLog.push(entry);
    // Keep only last maxLogEntries
    if (this.debugLog.length > this.maxLogEntries) {
      this.debugLog.shift();
    }
    this.onDebugLog?.(this.getDebugLog());
  }

  /**
   * Clear debug log
   */
  clearDebugLog() {
    this.debugLog = [];
    this.onDebugLog?.(this.getDebugLog());
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<NovaState>) {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  /**
   * Check if Web Bluetooth is available
   */
  isAvailable(): boolean {
    return 'bluetooth' in navigator;
  }

  /**
   * Connect to Nova device
   */
  async connect(): Promise<boolean> {
    this.addDebugLog('Starting connection...', 'info');
    if (!this.isAvailable() || !navigator.bluetooth) {
      this.addDebugLog('Web Bluetooth not available', 'error');
      throw new Error('Web Bluetooth is not available in this browser');
    }

    try {
      this.addDebugLog('Requesting device...', 'info');
      // Request device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Lumenate' }],
        optionalServices: [CONTROL_SERVICE],
      });
      this.addDebugLog(`Device found: ${device.name || 'Unknown'}`, 'success');

      device.addEventListener('gattserverdisconnected', () => {
        this.addDebugLog('Device disconnected event received', 'warn');
        this.handleDisconnect();
      });

      // Connect to GATT server
      this.addDebugLog('Connecting to GATT server...', 'info');
      const server = await device.gatt?.connect();
      if (!server) {
        this.addDebugLog('GATT server connection failed', 'error');
        throw new Error('Failed to connect to GATT server');
      }
      this.addDebugLog('GATT server connected', 'success');

      // Get control service
      this.addDebugLog('Getting control service...', 'info');
      const service = await server.getPrimaryService(CONTROL_SERVICE);
      this.addDebugLog('Control service found', 'success');

      // Get command characteristic
      this.addDebugLog('Getting command characteristic...', 'info');
      const commandChar = await service.getCharacteristic(COMMAND_CHAR);
      this.addDebugLog('Command characteristic ready', 'success');

      this.updateState({
        isConnected: true,
        device,
        commandChar,
      });

      this.addDebugLog('Nova connection complete!', 'success');
      return true;
    } catch (error: any) {
      let errorMessage = 'Unknown error';
      if (error.name === 'NotFoundError') {
        errorMessage = 'Nova device not found. Make sure it is powered on and in pairing mode.';
        this.addDebugLog(errorMessage, 'error');
        throw new Error(errorMessage);
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Bluetooth permission denied. Please allow access in your browser settings.';
        this.addDebugLog(errorMessage, 'error');
        throw new Error(errorMessage);
      } else {
        errorMessage = `Connection failed: ${error.message || error}`;
        this.addDebugLog(errorMessage, 'error');
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    this.stopFlicker();
    
    if (this.state.device?.gatt?.connected) {
      this.state.device.gatt.disconnect();
    }

    this.updateState({
      isConnected: false,
      device: null,
      commandChar: null,
      currentFrequency: null,
    });
  }

  /**
   * Handle device disconnection
   */
  private handleDisconnect() {
    this.addDebugLog('Handling disconnect...', 'warn');
    // Stop flicker interval first (don't try to write to disconnected device)
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
      this.addDebugLog('Flicker interval stopped', 'info');
    }
    
    // Update state (don't call stopFlicker as it tries to write to device)
    this.updateState({
      isConnected: false,
      isFlickering: false,
      device: null,
      commandChar: null,
      currentFrequency: null,
    });
    this.addDebugLog('Disconnected', 'error');
  }

  /**
   * Start flickering at specified frequency
   * Returns false if device is not connected, true on success
   */
  startFlicker(frequencyHz: number): boolean {
    this.addDebugLog(`startFlicker called: ${frequencyHz} Hz`, 'info');
    
    // Guard against concurrent calls
    if (this.isStartingFlicker) {
      this.addDebugLog('Flicker start already in progress, skipping', 'warn');
      return false;
    }

    // First check state flags
    if (!this.state.isConnected || !this.state.commandChar) {
      this.addDebugLog('Device not connected (state check), cannot start flicker', 'warn');
      return false;
    }

    // Then verify actual device connection
    if (!this.state.device?.gatt?.connected) {
      this.addDebugLog('Device connection lost (GATT check)', 'error');
      // Don't call handleDisconnect here - it might already be disconnected
      // Just update state silently
      this.updateState({
        isConnected: false,
        isFlickering: false,
        currentFrequency: null,
      });
      return false;
    }

    // Double-check commandChar is still valid
    if (!this.state.commandChar) {
      this.addDebugLog('Command characteristic not available', 'warn');
      return false;
    }

    this.isStartingFlicker = true;
    this.addDebugLog(`Starting flicker at ${frequencyHz} Hz`, 'info');

    // Stop any existing flicker
    this.stopFlicker();

    // Calculate interval (ms) from frequency (Hz)
    const intervalMs = Math.round(1000 / frequencyHz);

    // Send 01ff command repeatedly to create flicker
    const trigger = new Uint8Array([0x01, 0xff]);

    // Send initial command
    try {
      this.addDebugLog('Sending initial 01ff command...', 'info');
      // Use await to ensure the initial command is sent before starting interval
      this.state.commandChar.writeValue(trigger).then(() => {
        this.addDebugLog('Initial 01ff command sent successfully', 'success');
      }).catch((error: unknown) => {
        this.addDebugLog(`Initial flicker command failed: ${error}`, 'error');
        // Don't disconnect immediately - might be a transient error
        // Just stop the flicker interval
        if (this.flickerInterval) {
          clearInterval(this.flickerInterval);
          this.flickerInterval = null;
        }
        this.updateState({
          isFlickering: false,
          currentFrequency: null,
        });
      });
    } catch (error) {
      this.addDebugLog(`Initial flicker command error: ${error}`, 'error');
      // Don't disconnect on initial command error - might be transient
      this.isStartingFlicker = false;
      return false;
    }

    this.flickerInterval = setInterval(async () => {
      try {
        // Check connection state before each write
        if (!this.state.device?.gatt?.connected) {
          // Device disconnected, stop flicker but don't call handleDisconnect
          // (it might already be handling the disconnect event)
          this.stopFlicker();
          return;
        }
        
        if (!this.state.commandChar) {
          this.stopFlicker();
          return;
        }
        
        await this.state.commandChar.writeValue(trigger);
      } catch (error) {
        // On error, check if device is still connected
        if (!this.state.device?.gatt?.connected) {
          // Device disconnected, stop flicker
          this.addDebugLog('Device disconnected during flicker write', 'error');
          this.stopFlicker();
        } else {
          // Transient error, continue trying
          // Don't stop flicker on single write failures
          // Only log every 10th error to avoid spam
          if (Math.random() < 0.1) {
            this.addDebugLog(`Flicker write error (transient): ${error}`, 'warn');
          }
        }
      }
    }, intervalMs);

    this.updateState({
      isFlickering: true,
      currentFrequency: frequencyHz,
    });

    this.addDebugLog(`Flicker started successfully at ${frequencyHz} Hz`, 'success');
    this.isStartingFlicker = false;
    return true;
  }

  /**
   * Stop flickering and turn off light
   */
  stopFlicker(): void {
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
    }

    // Send 02ff to turn off light
    if (this.state.commandChar && this.state.isConnected) {
      this.state.commandChar.writeValue(new Uint8Array([0x02, 0xff])).catch((error: unknown) => {
        console.error('Failed to turn off Nova:', error);
      });
    }

    this.updateState({
      isFlickering: false,
      currentFrequency: null,
    });
  }

  /**
   * Get current state
   */
  getState(): Readonly<NovaState> {
    return { ...this.state };
  }
}

// Singleton instance
export const novaController = new NovaController();
