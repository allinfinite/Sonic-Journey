/**
 * BassPad - Interactive deep bass touch pad component
 * Touch/mouse to play sub-bass tones (20-80 Hz)
 * X-axis controls frequency, Y-axis controls filter/modulation
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { BassPadEngine, TouchPoint } from '../../audio/bassPad/BassPadEngine';

export function BassPad() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BassPadEngine | null>(null);
  const [activeTouches, setActiveTouches] = useState<TouchPoint[]>([]);
  const touchActionRef = useRef<'create' | 'delete' | null>(null);
  const nextToneIdRef = useRef<number>(1000); // Start from 1000 to avoid conflicts with pointer IDs
  const [addMode, setAddMode] = useState(false); // When true, clicking pad always adds (doesn't remove existing)
  const pointerToToneIdRef = useRef<Map<number, number>>(new Map()); // Map pointer ID to tone ID for add mode

  // Initialize engine on mount
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new BassPadEngine({
        frequencyMin: 20,
        frequencyMax: 80,
        filterMin: 100,
        filterMax: 800,
        masterVolume: 0.5,
      });
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  // Get normalized coordinates from pointer event
  const getNormalizedCoords = useCallback((e: React.PointerEvent | PointerEvent): { x: number; y: number } | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    return { x, y };
  }, []);

  // Update active touches state for visualization
  const updateActiveTouches = useCallback(() => {
    if (engineRef.current) {
      setActiveTouches(engineRef.current.getActiveTouches());
    }
  }, []);

  // Handle pointer down (touch/click start)
  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || !engineRef.current) return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;

    // Set pointer capture for this element
    container.setPointerCapture(e.pointerId);

    // Check if there's already a tone at this position
    const existingTouch = engineRef.current.getTouchAtPosition(coords.x, coords.y, 0.05);
    
    if (addMode) {
      // Add mode: Always add a new tone (even if one exists at this position)
      // Use a unique ID for each click to allow multiple tones
      const toneId = nextToneIdRef.current++;
      await engineRef.current.startTouch(toneId, coords.x, coords.y);
      touchActionRef.current = 'create';
      // Store mapping from pointer ID to tone ID so we can update it on drag
      pointerToToneIdRef.current.set(e.pointerId, toneId);
      // Disable add mode after adding one tone
      setAddMode(false);
    } else {
      // Normal mode: Toggle behavior (add if empty, remove if exists)
      if (existingTouch) {
        // Remove existing tone at this position
        engineRef.current.stopTouch(existingTouch.id);
        touchActionRef.current = 'delete';
      } else {
        // Start new tone (audio will be initialized automatically on first touch)
        await engineRef.current.startTouch(e.pointerId, coords.x, coords.y);
        touchActionRef.current = 'create';
        // In normal mode, pointer ID = tone ID
        pointerToToneIdRef.current.set(e.pointerId, e.pointerId);
      }
    }
    
    updateActiveTouches();
  }, [getNormalizedCoords, updateActiveTouches, addMode]);

  // Handle pointer move (touch/click drag)
  // Only update position if we created a tone (not if we deleted one)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!engineRef.current || touchActionRef.current !== 'create') return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;

    // Get the correct tone ID for this pointer (handles add mode where pointer ID != tone ID)
    const toneId = pointerToToneIdRef.current.get(e.pointerId) ?? e.pointerId;
    
    // Update tone position (only if we created a tone, not deleted one)
    engineRef.current.updateTouch(toneId, coords.x, coords.y);
    updateActiveTouches();
  }, [getNormalizedCoords, updateActiveTouches]);

  // Handle pointer up (touch/click end)
  // Tones now sustain - we just release pointer capture but keep tone playing
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    // Release pointer capture (tone continues playing)
    container.releasePointerCapture(e.pointerId);
    // Note: We don't stop the tone here - it sustains indefinitely
    
    // Reset touch action tracking
    touchActionRef.current = null;
    // Clean up pointer to tone ID mapping (pointer is done, tone continues)
    pointerToToneIdRef.current.delete(e.pointerId);
  }, []);

  // Handle pointer cancel (touch interrupted)
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e);
  }, [handlePointerUp]);

  // Handle clear all tones
  const handleClearAll = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stopAllTouches();
      updateActiveTouches();
    }
  }, [updateActiveTouches]);

  // Handle add tone button - enables add mode (next click on pad will add a tone)
  const handleAddTone = useCallback(() => {
    setAddMode(true);
  }, []);

  // Draw visual feedback on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gradient background hint (optional)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw touch indicators
    activeTouches.forEach(touch => {
      const x = touch.x * canvas.width;
      const y = touch.y * canvas.height;

      // Draw outer glow ring
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 40);
      glowGradient.addColorStop(0, `rgba(99, 102, 241, 0.3)`);
      glowGradient.addColorStop(0.5, `rgba(99, 102, 241, 0.1)`);
      glowGradient.addColorStop(1, `rgba(99, 102, 241, 0)`);
      
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();

      // Draw inner circle
      ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw frequency label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${touch.frequency.toFixed(1)} Hz`, x, y - 20);
    });
  }, [activeTouches]);

  // Redraw canvas when active touches change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // Format frequency for display
  const formatFrequency = (freq: number): string => {
    return `${freq.toFixed(1)} Hz`;
  };

  return (
    <div className="bass-pad-container">
      <div className="bass-pad-header">
        <h2 className="bass-pad-title">Deep Bass Touch Pad</h2>
        <p className="bass-pad-subtitle">
          Touch to add tones, touch again to remove • X = Frequency (20-80 Hz) • Y = Filter
        </p>
        
        {/* Add Tone button */}
        <button
          onClick={handleAddTone}
          className={`add-tone-btn ${addMode ? 'active' : ''}`}
          title={addMode ? "Add mode active: Click pad to add tones" : "Enable add mode: Click pad to add a new tone"}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          {addMode ? 'Add Mode Active' : 'Add Tone'}
        </button>
      </div>

      <div className="bass-pad-content">
        <div
          ref={containerRef}
          className="bass-pad-touch-area"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            className="bass-pad-canvas"
          />
          
          {/* Instructions overlay */}
          {activeTouches.length === 0 && (
            <div className="bass-pad-instructions">
              <div className="instruction-text">
                Touch to add a tone, touch again to remove it
              </div>
              <div className="instruction-hint">
                Tones sustain after you lift your finger
              </div>
            </div>
          )}
        </div>

        {/* Info panel and controls */}
        {activeTouches.length > 0 && (
          <div className="bass-pad-info">
            <div className="info-header">
              <div className="info-title">Active Tones: {activeTouches.length}</div>
              <button
                onClick={handleClearAll}
                className="clear-all-btn"
                title="Clear all tones"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Clear All
              </button>
            </div>
            <div className="info-list">
              {activeTouches.map(touch => (
                <div key={touch.id} className="info-item">
                  <span className="info-label">Tone {touch.id}:</span>
                  <span className="info-value">
                    {formatFrequency(touch.frequency)} • {touch.filterCutoff.toFixed(0)} Hz filter
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .bass-pad-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .bass-pad-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .bass-pad-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }

        .bass-pad-subtitle {
          color: var(--color-text-muted);
          font-size: 0.95rem;
          margin-bottom: 1rem;
        }

        .add-tone-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 1rem auto 0;
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-tone-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.4);
        }

        .add-tone-btn:active {
          transform: translateY(0);
        }

        .add-tone-btn.active {
          background: linear-gradient(135deg, var(--color-accent), var(--color-primary));
          box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.5);
        }

        .bass-pad-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .bass-pad-touch-area {
          position: relative;
          width: 100%;
          min-height: 500px;
          background: var(--color-surface);
          border: 2px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          cursor: crosshair;
          touch-action: none;
        }

        .bass-pad-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .bass-pad-instructions {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }

        .instruction-text {
          font-size: 1.2rem;
          color: var(--color-text);
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .instruction-hint {
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }

        .bass-pad-info {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid var(--color-border);
        }

        .info-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .info-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .clear-all-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--color-error);
          background: transparent;
          border: 1px solid var(--color-error);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-all-btn:hover {
          background: var(--color-error);
          color: white;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: var(--color-surface-light);
          border-radius: 6px;
        }

        .info-label {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .info-value {
          font-size: 0.9rem;
          color: var(--color-primary);
          font-family: monospace;
        }

        @media (max-width: 768px) {
          .bass-pad-touch-area {
            min-height: 400px;
          }
        }
      `}</style>
    </div>
  );
}
