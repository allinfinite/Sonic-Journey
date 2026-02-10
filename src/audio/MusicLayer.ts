/**
 * MusicLayer - Streams continuous AI-generated music via Lyria RealTime SSE
 * Receives raw PCM audio chunks and schedules gapless playback
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // 16-bit
const BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;

// Prompt length limits — must match server-side validation in api/music-stream.ts
const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 1000;

/**
 * Validate and sanitize a prompt for the music stream SSE URL query parameter.
 * Returns the trimmed prompt, or null if invalid.
 */
function validatePrompt(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (trimmed.length < MIN_PROMPT_LENGTH) {
    console.warn(`MusicLayer: Prompt too short (${trimmed.length} chars, min ${MIN_PROMPT_LENGTH})`);
    return null;
  }
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    console.warn(`MusicLayer: Prompt too long (${trimmed.length} chars, max ${MAX_PROMPT_LENGTH}) — truncating`);
    return trimmed.substring(0, MAX_PROMPT_LENGTH);
  }
  return trimmed;
}

import { getApiUrl } from '../utils/apiUrl';

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
  private streamEndHandled: boolean = false; // prevents duplicate reconnects from onerror + onmessage race
  private connectionId: number = 0; // monotonic counter to detect stale reconnects

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

    // Validate prompt before building URL query parameter
    const validatedPrompt = validatePrompt(prompt);
    if (!validatedPrompt) return;

    this.wantStreaming = true;

    // Already streaming with same prompt and vocalization — nothing to do
    if (this.isStreaming && this.currentPrompt === validatedPrompt && this.currentVocalization === vocalization) return;

    // Already streaming — just update prompt/vocalization
    if (this.isStreaming) {
      this.updatePrompt(validatedPrompt, vocalization);
      return;
    }

    // Waiting for reconnect with same prompt — nothing to do
    if (this.reconnectTimer && this.currentPrompt === validatedPrompt && this.currentVocalization === vocalization) return;

    this.currentVocalization = vocalization;
    this.connectStream(validatedPrompt);
  }

  /**
   * Open a new SSE connection to the music stream endpoint.
   *
   * IMPORTANT: EventSource has built-in auto-reconnect on network errors.
   * We disable that by always closing on error and managing reconnection
   * ourselves via handleStreamEnd(). This prevents duplicate connections
   * when both onerror and onmessage({done}) fire during server shutdown.
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
    this.streamEndHandled = false;
    this.scheduledEndTime = this.ctx.currentTime + 0.1;

    // Increment connection ID so stale callbacks from old connections are ignored
    const thisConnectionId = ++this.connectionId;

    const apiUrl = getApiUrl();
    const params = new URLSearchParams({ prompt });
    if (this.currentVocalization) params.set('vocalization', 'true');
    const url = `${apiUrl}/api/music-stream?${params}`;

    console.log(`MusicLayer: Starting stream [conn=${thisConnectionId}]...${this.currentVocalization ? ' [vocalization]' : ''}`);
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = async (event) => {
      // Ignore events from a stale connection
      if (thisConnectionId !== this.connectionId) return;

      try {
        const data = JSON.parse(event.data);

        if (data.audio) {
          this.scheduleChunk(data.audio);
        }

        if (data.error) {
          console.error('MusicLayer: Stream error:', data.error);
          this.handleStreamEnd(thisConnectionId);
        }

        if (data.done) {
          console.log('MusicLayer: Stream ended, will reconnect...');
          this.handleStreamEnd(thisConnectionId);
        }
      } catch (e) {
        console.error('MusicLayer: Failed to process chunk:', e);
      }
    };

    this.eventSource.onerror = () => {
      // Ignore errors from a stale connection
      if (thisConnectionId !== this.connectionId) return;

      // ALWAYS close on error to prevent EventSource's built-in auto-reconnect.
      // We manage reconnection ourselves in handleStreamEnd() to avoid
      // duplicate connections (the core bug this fixes).
      console.warn(`MusicLayer: SSE error [conn=${thisConnectionId}], closing to prevent auto-reconnect`);
      this.handleStreamEnd(thisConnectionId);
    };
  }

  /**
   * Handle the end of a stream — reconnect after a short delay if we still want music.
   *
   * Uses connectionId to ensure this is only processed once per connection,
   * even if both onerror and onmessage({done}) fire (which happens when
   * the server sends done + closes the connection simultaneously).
   */
  private handleStreamEnd(forConnectionId?: number): void {
    // Guard: if a connectionId is provided, only process if it matches current
    if (forConnectionId !== undefined && forConnectionId !== this.connectionId) {
      return;
    }

    // Guard: prevent duplicate handling (onerror + onmessage race)
    if (this.streamEndHandled) {
      return;
    }
    this.streamEndHandled = true;

    this.isStreaming = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.wantStreaming && this.currentPrompt) {
      // Cancel any existing reconnect timer to prevent stacking
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
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

    // Validate prompt before building URL query parameter
    const validatedPrompt = validatePrompt(prompt);
    if (!validatedPrompt) return;

    this.currentPrompt = validatedPrompt;
    if (vocalization !== undefined) this.currentVocalization = vocalization;

    console.log('MusicLayer: Prompt updated, reconnecting stream...');
    this.connectStream(validatedPrompt);
  }

  /**
   * Stop streaming and all playback
   */
  stopStreaming(): void {
    this.wantStreaming = false;
    this.isStreaming = false;
    this.streamEndHandled = true; // prevent any pending callbacks from reconnecting
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
