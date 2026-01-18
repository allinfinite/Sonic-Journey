/**
 * NovaController - BLE control for Lumenate Nova device
 * Provides flicker control synchronized with journey phases
 * 
 * Supports both simple steady flickering and complex patterns
 * (sweeps, bursts, rhythms, waves) via the NovaPatternEngine
 */

import type { NovaPattern } from '../types/journey';
import { NovaPatternEngine } from './NovaPatternEngine';

// BLE Service and Characteristic UUIDs
const CONTROL_SERVICE = '47bbfb1e-670e-4f81-bfb3-78daffc9a783';
const COMMAND_CHAR = '3e25a3bf-bfe1-4c71-97c5-5bdb73fac89e';

/**
 * Nova Flicker Frequency Bands - Based on Neural Entrainment Research
 * 
 * The frequency of light flashes determines neural entrainment effects:
 * - Delta (1-4 Hz): Deep relaxation, sleep onset, trance states
 * - Theta (4-7 Hz): Meditative, hypnagogic, creative/dreamlike states
 * - Alpha (8-12 Hz): Vivid closed-eye visuals, calm alertness, flow states
 * - Beta (13-30 Hz): Alertness, focus, mental energy
 * - Gamma (30-50+ Hz): Cognitive enhancement, memory (40 Hz research)
 * 
 * Key findings:
 * - Rhythmic, periodic flashes produce stronger entrainment than random
 * - 10 Hz is the "sweet spot" for kaleidoscopic visual experiences
 * - Frequencies above 20 Hz can be uncomfortable with weaker visuals
 * - 40 Hz is researched for cognitive enhancement (Alzheimer's studies)
 */
export const NOVA_FREQUENCY_MAP: Record<string, number> = {
  // Delta (1-4 Hz) - Deep sleep, relaxation, trance
  delta: 3,
  // Theta (4-7 Hz) - Meditation, hypnagogic states, creativity
  theta: 6,
  // Alpha (8-12 Hz) - Vivid visuals, flow states (sweet spot)
  alpha: 10,
  // Beta (13-30 Hz) - Alertness, focus, mental energy
  beta: 15,
  // Gamma (30-50 Hz) - Cognitive enhancement, 40 Hz research
  gamma: 40,
  // Default fallback - alpha for best visual experience
  default: 10,
};

/**
 * Map journey frequency (Hz) to Nova flicker frequency
 * Uses the audio/entrainment frequency to select appropriate brain state
 */
export function mapFrequencyToNova(freq: number): number {
  // Direct frequency mapping based on entrainment bands
  if (freq <= 4) return Math.max(1, Math.round(freq));     // Delta: use actual frequency (1-4 Hz)
  if (freq <= 7) return Math.round(freq);                   // Theta: use actual frequency (4-7 Hz)  
  if (freq <= 12) return Math.round(freq);                  // Alpha: use actual frequency (8-12 Hz)
  if (freq <= 30) return Math.min(20, Math.round(freq));    // Beta: cap at 20 Hz for comfort
  if (freq <= 50) return 40;                                // Gamma: use 40 Hz (research optimal)
  return NOVA_FREQUENCY_MAP.default;                        // Default: alpha
}

/**
 * Map rhythm/entrainment mode to Nova frequency
 * Uses the brain state name to get optimal flicker Hz
 */
export function mapRhythmModeToNova(rhythmMode: string): number {
  switch (rhythmMode) {
    case 'delta':
      return NOVA_FREQUENCY_MAP.delta;     // 3 Hz - deep sleep/trance
    case 'theta':
      return NOVA_FREQUENCY_MAP.theta;     // 6 Hz - meditation/hypnagogic
    case 'alpha':
      return NOVA_FREQUENCY_MAP.alpha;     // 10 Hz - visuals/flow states
    case 'beta':
      return NOVA_FREQUENCY_MAP.beta;      // 15 Hz - focus/alertness
    case 'gamma':
      return NOVA_FREQUENCY_MAP.gamma;     // 40 Hz - cognitive enhancement
    case 'breathing':
      return NOVA_FREQUENCY_MAP.alpha;     // Alpha for calm, breathing-synced experience
    case 'heartbeat':
      return NOVA_FREQUENCY_MAP.alpha;     // Alpha for grounded, rhythmic experience
    case 'still':
    case 'none':
      return 0;                            // No flicker
    default:
      return NOVA_FREQUENCY_MAP.alpha;     // Default to alpha for best visuals
  }
}

/**
 * Get optimal Nova frequency from a phase configuration
 * Priority: nova_frequency > entrainment_rate > rhythm_mode > frequency range
 */
export function getNovaFrequencyForPhase(phase: {
  nova_frequency?: number;
  entrainment_rate?: number;
  rhythm_mode?: string;
  entrainment_mode?: string;
  frequency?: { start: number; end: number };
}, progress: number = 0.5): number {
  // 1. Explicit nova_frequency override takes priority
  if (phase.nova_frequency !== undefined && phase.nova_frequency > 0) {
    return phase.nova_frequency;
  }
  
  // 2. Use entrainment_rate if specified (this is the exact Hz for neural entrainment)
  if (phase.entrainment_rate !== undefined && phase.entrainment_rate > 0) {
    // Clamp to safe range (1-50 Hz)
    return Math.min(50, Math.max(1, phase.entrainment_rate));
  }
  
  // 3. Map from rhythm_mode or entrainment_mode
  const mode = phase.rhythm_mode || phase.entrainment_mode;
  if (mode && mode !== 'none' && mode !== 'still') {
    return mapRhythmModeToNova(mode);
  }
  
  // 4. Interpolate from frequency range based on progress
  if (phase.frequency) {
    const interpolatedFreq = phase.frequency.start + (phase.frequency.end - phase.frequency.start) * progress;
    return mapFrequencyToNova(interpolatedFreq);
  }
  
  // Default to alpha
  return NOVA_FREQUENCY_MAP.alpha;
}

export interface NovaState {
  isConnected: boolean;
  isFlickering: boolean;
  currentFrequency: number | null;
  currentPattern: NovaPattern | null;
  patternType: string | null; // Current pattern type for display
  device: BluetoothDevice | null;
  commandChar: BluetoothRemoteGATTCharacteristic | null;
}

export class NovaController {
  private state: NovaState = {
    isConnected: false,
    isFlickering: false,
    currentFrequency: null,
    currentPattern: null,
    patternType: null,
    device: null,
    commandChar: null,
  };

  private flickerInterval: ReturnType<typeof setInterval> | null = null;
  private flickerTimeout: ReturnType<typeof setTimeout> | null = null; // For pattern-based scheduling
  private patternEngine: NovaPatternEngine = new NovaPatternEngine();
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
    // Stop flicker interval/timeout first (don't try to write to disconnected device)
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
      this.addDebugLog('Flicker interval stopped', 'info');
    }
    if (this.flickerTimeout) {
      clearTimeout(this.flickerTimeout);
      this.flickerTimeout = null;
      this.addDebugLog('Flicker timeout stopped', 'info');
    }
    this.patternEngine.stopPattern();
    
    // Update state (don't call stopFlicker as it tries to write to device)
    this.updateState({
      isConnected: false,
      isFlickering: false,
      device: null,
      commandChar: null,
      currentFrequency: null,
      currentPattern: null,
      patternType: null,
    });
    this.addDebugLog('Disconnected', 'error');
  }

  /**
   * Start flickering at specified frequency
   * Returns false if device is not connected, true on success
   */
  async startFlicker(frequencyHz: number): Promise<boolean> {
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

    // Stop any existing flicker interval (but don't send 02ff - we're about to start new flicker)
    // Match ble-web.html behavior: just clear interval, don't turn off light
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
      this.addDebugLog('Cleared existing flicker interval', 'info');
    }

    // Calculate interval (ms) from frequency (Hz)
    // Minimum interval of 150ms to avoid overwhelming the device
    const minIntervalMs = 150;
    const calculatedIntervalMs = Math.round(1000 / frequencyHz);
    const intervalMs = Math.max(calculatedIntervalMs, minIntervalMs);
    
    // Log if we're throttling the frequency
    if (calculatedIntervalMs < minIntervalMs) {
      const throttledHz = Math.round(1000 / intervalMs);
      this.addDebugLog(`Frequency ${frequencyHz} Hz throttled to ${throttledHz} Hz (min interval: ${minIntervalMs}ms)`, 'warn');
    }

    // Send 01ff command repeatedly to create flicker
    const trigger = new Uint8Array([0x01, 0xff]);

    // Send initial command - wait for it to complete before starting interval
    try {
      this.addDebugLog('Sending initial 01ff command...', 'info');
      
      // Wait a bit after connection before sending first command (device might need initialization)
      // But we already connected, so let's just send it
      
      // Use await to ensure the initial command completes before starting interval
      await this.state.commandChar.writeValue(trigger);
      this.addDebugLog('Initial 01ff command sent successfully', 'success');
      
      // Match ble-web.html behavior: start interval immediately after initial command
      // No delay needed - device accepts commands immediately
    } catch (error) {
      this.addDebugLog(`Initial flicker command error: ${error}`, 'error');
      // Check if device disconnected due to the error
      if (!this.state.device?.gatt?.connected) {
        this.addDebugLog('Device disconnected during initial command', 'error');
        this.updateState({
          isConnected: false,
          isFlickering: false,
          currentFrequency: null,
        });
      }
      this.isStartingFlicker = false;
      return false;
    }

    // Match ble-web.html exactly: simple check, silent fail on error
    this.flickerInterval = setInterval(async () => {
      if (!this.state.commandChar) {
        if (this.flickerInterval) {
          clearInterval(this.flickerInterval);
          this.flickerInterval = null;
        }
        return;
      }
      try {
        await this.state.commandChar.writeValue(trigger);
      } catch (error) {
        // Silent fail - just like ble-web.html
        // The device disconnect event will handle cleanup
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
   * Stop flickering (just stops the interval, doesn't send 02ff)
   */
  stopFlicker(): void {
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
      this.addDebugLog('Flicker interval stopped', 'info');
    }
    
    if (this.flickerTimeout) {
      clearTimeout(this.flickerTimeout);
      this.flickerTimeout = null;
      this.addDebugLog('Flicker timeout stopped', 'info');
    }
    
    this.patternEngine.stopPattern();

    // Don't send 02ff - it turns off the device and causes issues
    // Just stopping the interval is enough

    this.updateState({
      isFlickering: false,
      currentFrequency: null,
      currentPattern: null,
      patternType: null,
    });
  }

  /**
   * Start a complex pattern-based flicker sequence
   * Uses NovaPatternEngine for dynamic timing calculations
   */
  async startPattern(pattern: NovaPattern, phaseDurationMs: number): Promise<boolean> {
    this.addDebugLog(`startPattern called: ${pattern.type} @ ${pattern.baseFrequency} Hz`, 'info');
    
    // Guard against concurrent calls
    if (this.isStartingFlicker) {
      this.addDebugLog('Flicker start already in progress, skipping', 'warn');
      return false;
    }

    // Connection checks
    if (!this.state.isConnected || !this.state.commandChar) {
      this.addDebugLog('Device not connected, cannot start pattern', 'warn');
      return false;
    }

    if (!this.state.device?.gatt?.connected) {
      this.addDebugLog('Device connection lost', 'error');
      this.updateState({
        isConnected: false,
        isFlickering: false,
        currentFrequency: null,
        currentPattern: null,
        patternType: null,
      });
      return false;
    }

    this.isStartingFlicker = true;

    // Stop any existing flicker
    if (this.flickerInterval) {
      clearInterval(this.flickerInterval);
      this.flickerInterval = null;
    }
    if (this.flickerTimeout) {
      clearTimeout(this.flickerTimeout);
      this.flickerTimeout = null;
    }

    // Initialize pattern engine
    this.patternEngine.startPattern(pattern, phaseDurationMs);
    
    const trigger = new Uint8Array([0x01, 0xff]);

    // Send initial command
    try {
      this.addDebugLog('Sending initial pattern command...', 'info');
      await this.state.commandChar.writeValue(trigger);
      this.addDebugLog('Initial pattern command sent', 'success');
    } catch (error) {
      this.addDebugLog(`Initial pattern command error: ${error}`, 'error');
      this.isStartingFlicker = false;
      return false;
    }

    // Update state
    this.updateState({
      isFlickering: true,
      currentFrequency: pattern.baseFrequency,
      currentPattern: pattern,
      patternType: pattern.type,
    });

    // Start pattern-driven scheduling
    this.scheduleNextFlash();

    this.addDebugLog(`Pattern started: ${pattern.type}`, 'success');
    this.isStartingFlicker = false;
    return true;
  }

  /**
   * Schedule the next flash based on pattern engine
   * Uses setTimeout for variable timing (patterns with changing intervals)
   */
  private scheduleNextFlash(): void {
    if (!this.state.isFlickering || !this.state.commandChar) {
      return;
    }

    const { interval, shouldFlash } = this.patternEngine.getNextFlash();
    
    // Update current frequency in state for display
    const currentFreq = this.patternEngine.getCurrentFrequency();
    if (currentFreq !== this.state.currentFrequency) {
      this.updateState({ currentFrequency: currentFreq });
    }

    this.flickerTimeout = setTimeout(async () => {
      if (!this.state.commandChar || !this.state.isFlickering) {
        return;
      }

      if (shouldFlash) {
        try {
          await this.state.commandChar.writeValue(new Uint8Array([0x01, 0xff]));
        } catch (error) {
          // Silent fail - device disconnect event will handle cleanup
        }
      }

      // Schedule next flash
      this.scheduleNextFlash();
    }, interval);
  }

  /**
   * Get current state
   */
  getState(): Readonly<NovaState> {
    return { ...this.state };
  }

  /**
   * Get the pattern engine for direct access if needed
   */
  getPatternEngine(): NovaPatternEngine {
    return this.patternEngine;
  }
}

// Singleton instance
export const novaController = new NovaController();
