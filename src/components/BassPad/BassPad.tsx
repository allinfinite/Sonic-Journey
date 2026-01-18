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

    // Start tone (audio will be initialized automatically on first touch)
    await engineRef.current.startTouch(e.pointerId, coords.x, coords.y);
    updateActiveTouches();
  }, [getNormalizedCoords, updateActiveTouches]);

  // Handle pointer move (touch/click drag)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!engineRef.current) return;

    const coords = getNormalizedCoords(e);
    if (!coords) return;

    // Update tone position
    engineRef.current.updateTouch(e.pointerId, coords.x, coords.y);
    updateActiveTouches();
  }, [getNormalizedCoords, updateActiveTouches]);

  // Handle pointer up (touch/click end)
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || !engineRef.current) return;

    // Release pointer capture
    container.releasePointerCapture(e.pointerId);

    // Stop tone
    engineRef.current.stopTouch(e.pointerId);
    updateActiveTouches();
  }, [updateActiveTouches]);

  // Handle pointer cancel (touch interrupted)
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e);
  }, [handlePointerUp]);

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
          Touch or click to play sub-bass tones • X = Frequency (20-80 Hz) • Y = Filter
        </p>
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
                Touch or drag to play deep bass tones
              </div>
              <div className="instruction-hint">
                Multiple touches create layered tones
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        {activeTouches.length > 0 && (
          <div className="bass-pad-info">
            <div className="info-title">Active Tones: {activeTouches.length}</div>
            <div className="info-list">
              {activeTouches.map(touch => (
                <div key={touch.id} className="info-item">
                  <span className="info-label">Touch {touch.id}:</span>
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

        .info-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 1rem;
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
