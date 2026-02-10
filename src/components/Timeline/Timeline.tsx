/**
 * Timeline component - Canvas-based journey visualization with playhead
 */

import { useRef, useEffect, useCallback } from 'react';
import { useJourneyStore } from '../../stores/journeyStore';

const COLORS = {
  background: '#1e1e2e',
  grid: '#2a2a3e',
  text: '#a1a1aa',
  phase: '#6366f1',
  phaseHover: '#818cf8',
  phaseSelected: '#4f46e5',
  playhead: '#22d3ee',
  frequency: '#22c55e',
  amplitude: '#f59e0b',
};

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    journey,
    selectedPhaseIndex,
    currentTime,
    isPlaying,
    selectPhase,
    seek,
  } = useJourneyStore();

  const totalDuration = journey.duration_minutes * 60;

  // Draw the timeline
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    // Vertical grid lines (time)
    const timeSteps = Math.ceil(journey.duration_minutes / 10);
    for (let i = 0; i <= timeSteps; i++) {
      const x = padding.left + (i / timeSteps) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Time labels
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${i * 10}m`, x, height - padding.bottom + 20);
    }

    // Horizontal grid lines (frequency)
    const freqSteps = 5;
    for (let i = 0; i <= freqSteps; i++) {
      const y = padding.top + (i / freqSteps) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Frequency labels
      const freq = 90 - (i / freqSteps) * 62; // 28-90 Hz range
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(freq)} Hz`, padding.left - 8, y + 4);
    }

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Energy Level', 0, 0);
    ctx.restore();

    // Draw phases
    let elapsed = 0;
    journey.phases.forEach((phase, index) => {
      const phaseDuration = phase.duration * 60;
      const startX = padding.left + (elapsed / totalDuration) * graphWidth;
      const endX = padding.left + ((elapsed + phaseDuration) / totalDuration) * graphWidth;
      const phaseWidth = endX - startX;

      // Phase background
      ctx.fillStyle = index === selectedPhaseIndex ? COLORS.phaseSelected : COLORS.phase;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(startX, padding.top, phaseWidth, graphHeight);
      ctx.globalAlpha = 1;

      // Phase border
      ctx.strokeStyle = index === selectedPhaseIndex ? COLORS.phaseSelected : COLORS.phase;
      ctx.lineWidth = index === selectedPhaseIndex ? 2 : 1;
      ctx.strokeRect(startX, padding.top, phaseWidth, graphHeight);

      // Phase name (truncate to fit within phase width)
      ctx.fillStyle = COLORS.text;
      const fontSize = phaseWidth < 60 ? 9 : phaseWidth < 100 ? 10 : 12;
      ctx.font = index === selectedPhaseIndex ? `bold ${fontSize}px system-ui` : `${fontSize}px system-ui`;
      ctx.textAlign = 'center';
      const nameX = startX + phaseWidth / 2;
      const maxNameWidth = phaseWidth - 4;
      let displayName = phase.name;
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (displayName.length > 1 && ctx.measureText(displayName + '…').width > maxNameWidth) {
          displayName = displayName.slice(0, -1);
        }
        displayName = displayName + '…';
      }
      if (maxNameWidth > 10) {
        ctx.fillText(displayName, nameX, padding.top - 10);
      }

      // Frequency curve
      const freqToY = (freq: number) => {
        const normalized = (freq - 28) / 62; // 28-90 Hz range
        return padding.top + graphHeight - normalized * graphHeight;
      };

      ctx.strokeStyle = COLORS.frequency;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, freqToY(phase.frequency.start));
      ctx.lineTo(endX, freqToY(phase.frequency.end));
      ctx.stroke();

      // Amplitude indicator (as line thickness variation)
      ctx.strokeStyle = COLORS.amplitude;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const ampToY = (amp: number) => {
        return padding.top + graphHeight - amp * graphHeight * 0.8;
      };
      ctx.beginPath();
      ctx.moveTo(startX, ampToY(phase.amplitude.start));
      ctx.lineTo(endX, ampToY(phase.amplitude.end));
      ctx.stroke();
      ctx.setLineDash([]);

      elapsed += phaseDuration;
    });

    // Draw playhead
    if (currentTime > 0 || isPlaying) {
      const playheadX = padding.left + (currentTime / totalDuration) * graphWidth;

      // Playhead line
      ctx.strokeStyle = COLORS.playhead;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, padding.top);
      ctx.lineTo(playheadX, height - padding.bottom);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = COLORS.playhead;
      ctx.beginPath();
      ctx.moveTo(playheadX, padding.top);
      ctx.lineTo(playheadX - 6, padding.top - 8);
      ctx.lineTo(playheadX + 6, padding.top - 8);
      ctx.closePath();
      ctx.fill();

      // Time display
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      ctx.fillStyle = COLORS.playhead;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${minutes}:${seconds.toString().padStart(2, '0')}`,
        playheadX,
        height - padding.bottom + 35
      );
    }

    // Legend (inside chart area, top-right)
    const legendX = width - padding.right - 90;
    const legendY = padding.top + 8;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';

    ctx.fillStyle = COLORS.frequency;
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Frequency', legendX + 14, legendY + 9);

    ctx.fillStyle = COLORS.amplitude;
    ctx.fillRect(legendX, legendY + 16, 10, 10);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Intensity', legendX + 14, legendY + 25);
  }, [journey, selectedPhaseIndex, currentTime, isPlaying, totalDuration]);

  // Handle click to select phase or seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const padding = { left: 60, right: 20 };
      const graphWidth = rect.width - padding.left - padding.right;

      // Calculate clicked time
      const clickedTime = ((x - padding.left) / graphWidth) * totalDuration;

      if (clickedTime >= 0 && clickedTime <= totalDuration) {
        // Seek to clicked position
        seek(clickedTime);

        // Find which phase was clicked
        let elapsed = 0;
        for (let i = 0; i < journey.phases.length; i++) {
          const phaseDuration = journey.phases[i].duration * 60;
          if (clickedTime < elapsed + phaseDuration) {
            selectPhase(i);
            break;
          }
          elapsed += phaseDuration;
        }
      }
    },
    [journey.phases, totalDuration, seek, selectPhase]
  );

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Animation loop for playhead
  useEffect(() => {
    if (!isPlaying) return;

    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, draw]);

  return (
    <div
      ref={containerRef}
      className="w-full h-64 rounded-lg overflow-hidden border border-white/10"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="cursor-pointer"
      />
    </div>
  );
}
