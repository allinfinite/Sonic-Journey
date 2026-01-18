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

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: NovaState) => void) {
    this.onStateChange = callback;
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
    if (!this.isAvailable() || !navigator.bluetooth) {
      throw new Error('Web Bluetooth is not available in this browser');
    }

    try {
      // Request device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Lumenate' }],
        optionalServices: [CONTROL_SERVICE],
      });

      device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      // Connect to GATT server
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      // Get control service
      const service = await server.getPrimaryService(CONTROL_SERVICE);

      // Get command characteristic
      const commandChar = await service.getCharacteristic(COMMAND_CHAR);

      this.updateState({
        isConnected: true,
        device,
        commandChar,
      });

      return true;
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        throw new Error('Nova device not found. Make sure it is powered on and in pairing mode.');
      } else if (error.name === 'SecurityError') {
        throw new Error('Bluetooth permission denied. Please allow access in your browser settings.');
      } else {
        throw new Error(`Connection failed: ${error.message || error}`);
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
    // Stop flicker interval first (don't try to write to disconnected device)
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
    }
    
    // Update state (don't call stopFlicker as it tries to write to device)
    this.updateState({
      isConnected: false,
      isFlickering: false,
      device: null,
      commandChar: null,
      currentFrequency: null,
    });
  }

  /**
   * Start flickering at specified frequency
   * Returns false if device is not connected, true on success
   */
  startFlicker(frequencyHz: number): boolean {
    if (!this.state.isConnected || !this.state.commandChar) {
      console.warn('Nova device not connected, cannot start flicker');
      return false;
    }

    // Verify device is still connected
    if (!this.state.device?.gatt?.connected) {
      console.warn('Nova device connection lost');
      this.handleDisconnect();
      return false;
    }

    // Stop any existing flicker
    this.stopFlicker();

    // Calculate interval (ms) from frequency (Hz)
    const intervalMs = Math.round(1000 / frequencyHz);

    // Send 01ff command repeatedly to create flicker
    const trigger = new Uint8Array([0x01, 0xff]);

    // Send initial command
    try {
      // Use await to ensure the initial command is sent before starting interval
      this.state.commandChar.writeValue(trigger).catch((error: unknown) => {
        console.error('Nova initial flicker command failed:', error);
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
      console.error('Nova initial flicker command error:', error);
      // Don't disconnect on initial command error - might be transient
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
        console.error('Nova flicker write error:', error);
        // On error, check if device is still connected
        if (!this.state.device?.gatt?.connected) {
          // Device disconnected, stop flicker
          this.stopFlicker();
        } else {
          // Transient error, continue trying
          // Don't stop flicker on single write failures
        }
      }
    }, intervalMs);

    this.updateState({
      isFlickering: true,
      currentFrequency: frequencyHz,
    });

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
