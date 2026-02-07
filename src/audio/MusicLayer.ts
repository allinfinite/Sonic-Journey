/**
 * MusicLayer - Streams continuous AI-generated music via Lyria RealTime SSE
 * Receives raw PCM audio chunks and schedules gapless playback
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // 16-bit
const BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;

// Determine API URL (same pattern as musicApi.ts)
function getApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window as any).__API_URL__) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (window as any).__API_URL__; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3002';
}

/**
 * Decode base64 PCM (16-bit LE, stereo, 48kHz) directly into an AudioBuffer.
 * Bypasses decodeAudioData entirely to avoid AudioContext renderer errors.
 */
function pcmToAudioBuffer(ctx: AudioContext, base64Pcm: string): AudioBuffer | null {
  let binaryStr: string;
  try {
    binaryStr = atob(base64Pcm);
  } catch {
    return null;
  }

  const byteLen = binaryStr.length;
  const alignedLen = Math.floor(byteLen / BYTES_PER_FRAME) * BYTES_PER_FRAME;

  // Need at least ~1ms of audio (48 frames) to be worth scheduling
  if (alignedLen < BYTES_PER_FRAME * 48) return null;

  const numFrames = alignedLen / BYTES_PER_FRAME;
  const audioBuffer = ctx.createBuffer(CHANNELS, numFrames, SAMPLE_RATE);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  // Convert interleaved 16-bit LE PCM to float32 per-channel
  for (let i = 0; i < numFrames; i++) {
    const byteOffset = i * BYTES_PER_FRAME;
    // Left channel: little-endian 16-bit signed
    const lLo = binaryStr.charCodeAt(byteOffset);
    const lHi = binaryStr.charCodeAt(byteOffset + 1);
    const lSample = (lHi << 8) | lLo;
    left[i] = (lSample > 32767 ? lSample - 65536 : lSample) / 32768;
    // Right channel
    const rLo = binaryStr.charCodeAt(byteOffset + 2);
    const rHi = binaryStr.charCodeAt(byteOffset + 3);
    const rSample = (rHi << 8) | rLo;
    right[i] = (rSample > 32767 ? rSample - 65536 : rSample) / 32768;
  }

  return audioBuffer;
}

export class MusicLayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  // Streaming state
  private eventSource: EventSource | null = null;
  private scheduledEndTime: number = 0;
  private activeNodes: AudioBufferSourceNode[] = [];
  private isStreaming: boolean = false;
  private currentPrompt: string = '';
  private currentVocalization: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantStreaming: boolean = false; // true while we intend to keep streaming

  private volume: number = 0.3;
  private enabled: boolean = false;

  /**
   * Initialize with an audio context and destination node
   */
  init(ctx: AudioContext, destination: AudioNode): void {
    this.ctx = ctx;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.enabled ? this.volume : 0;
    this.gainNode.connect(destination);
  }

  /**
   * Start streaming music with the given prompt.
   * If already streaming with the same prompt, this is a no-op.
   * If streaming with a different prompt, updates the prompt on the active session.
   */
  startStreaming(prompt: string, vocalization: boolean = false): void {
    if (!this.ctx || !this.gainNode || !this.enabled) return;

    this.wantStreaming = true;

    // Already streaming with same prompt and vocalization — nothing to do
    if (this.isStreaming && this.currentPrompt === prompt && this.currentVocalization === vocalization) return;

    // Already streaming — just update prompt/vocalization
    if (this.isStreaming) {
      this.updatePrompt(prompt, vocalization);
      return;
    }

    // Waiting for reconnect with same prompt — nothing to do
    if (this.reconnectTimer && this.currentPrompt === prompt && this.currentVocalization === vocalization) return;

    this.currentVocalization = vocalization;
    this.connectStream(prompt);
  }

  /**
   * Open a new SSE connection to the music stream endpoint
   */
  private connectStream(prompt: string): void {
    if (!this.ctx || !this.gainNode) return;

    // Clean up any existing connection (but don't send server stop — we're reconnecting)
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.currentPrompt = prompt;
    this.isStreaming = true;
    this.scheduledEndTime = this.ctx.currentTime + 0.1;

    const apiUrl = getApiUrl();
    const params = new URLSearchParams({ prompt });
    if (this.currentVocalization) params.set('vocalization', 'true');
    const url = `${apiUrl}/api/music-stream?${params}`;

    console.log(`MusicLayer: Starting stream...${this.currentVocalization ? ' [vocalization]' : ''}`);
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.audio) {
          this.scheduleChunk(data.audio);
        }

        if (data.error) {
          console.error('MusicLayer: Stream error:', data.error);
          this.handleStreamEnd();
        }

        if (data.done) {
          console.log('MusicLayer: Stream ended, will reconnect...');
          this.handleStreamEnd();
        }
      } catch (e) {
        console.error('MusicLayer: Failed to process chunk:', e);
      }
    };

    this.eventSource.onerror = () => {
      if (!this.wantStreaming) {
        this.eventSource?.close();
        this.eventSource = null;
      }
      // Otherwise EventSource will auto-reconnect
    };
  }

  /**
   * Handle the end of a stream — reconnect after a short delay if we still want music
   */
  private handleStreamEnd(): void {
    this.isStreaming = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.wantStreaming && this.currentPrompt) {
      // Reconnect after a short gap to keep music continuous
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.wantStreaming && this.currentPrompt) {
          console.log('MusicLayer: Reconnecting stream...');
          this.connectStream(this.currentPrompt);
        }
      }, 500);
    }
  }

  /**
   * Schedule a PCM audio chunk for gapless playback
   */
  private scheduleChunk(base64Pcm: string): void {
    if (!this.ctx || !this.gainNode) return;

    const now = this.ctx.currentTime;

    // Backpressure: if we're already buffered >5s ahead, drop this chunk
    if (this.scheduledEndTime > now + 5) return;

    // If scheduledEndTime fell behind (audio underrun), reset to now
    if (this.scheduledEndTime < now) {
      this.scheduledEndTime = now + 0.05;
    }

    const audioBuffer = pcmToAudioBuffer(this.ctx, base64Pcm);
    if (!audioBuffer) return; // Skip invalid/tiny chunks

    // Limit active nodes — prune finished ones proactively
    if (this.activeNodes.length > 30) {
      this.activeNodes = this.activeNodes.slice(-20);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    // Schedule right after the previous chunk (gapless)
    const startTime = Math.max(now + 0.02, this.scheduledEndTime);
    source.start(startTime);
    this.scheduledEndTime = startTime + audioBuffer.duration;

    // Track for cleanup
    this.activeNodes.push(source);
    source.onended = () => {
      const idx = this.activeNodes.indexOf(source);
      if (idx >= 0) this.activeNodes.splice(idx, 1);
    };
  }

  /**
   * Update the music prompt (for phase transitions).
   * Reconnects the SSE stream with the new prompt so this works in both
   * Express (stateful) and Vercel serverless (stateless) environments.
   */
  async updatePrompt(prompt: string, vocalization?: boolean): Promise<void> {
    if (!this.isStreaming) return;
    this.currentPrompt = prompt;
    if (vocalization !== undefined) this.currentVocalization = vocalization;

    console.log('MusicLayer: Prompt updated, reconnecting stream...');
    this.connectStream(prompt);
  }

  /**
   * Stop streaming and all playback
   */
  stopStreaming(): void {
    this.wantStreaming = false;
    this.isStreaming = false;
    this.currentPrompt = '';

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Stop all scheduled audio nodes
    for (const node of this.activeNodes) {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* ignore */ }
    }
    this.activeNodes = [];
    this.scheduledEndTime = 0;

    // Tell server to close the Lyria session
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/music-stream/stop`, { method: 'POST' }).catch(() => {});
  }

  /**
   * Check if currently streaming
   */
  getIsStreaming(): boolean {
    return this.isStreaming || this.wantStreaming;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx && this.enabled) {
      this.gainNode.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Enable or disable the music layer
   */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(
        on ? this.volume : 0,
        this.ctx.currentTime,
        0.3
      );
    }
    if (!on) {
      this.stopStreaming();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.stopStreaming();
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.ctx = null;
  }
}

// Singleton instance
export const musicLayer = new MusicLayer();
