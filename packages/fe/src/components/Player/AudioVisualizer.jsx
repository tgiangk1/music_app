import { useEffect, useRef, useState, useCallback } from 'react';

const VISUALIZER_MODES = ['bars', 'wave', 'pulse'];

/**
 * Audio Visualizer — CSS/Canvas-based visual effects behind the player
 * Uses animated frequency bars (not Web Audio API since YouTube iframe blocks audio access)
 */
export default function AudioVisualizer({ isPlaying, mode = 'bars', colorScheme = 'primary' }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const barsRef = useRef([]);
  const phaseRef = useRef(0);

  // Generate color based on scheme
  const getColors = useCallback(() => {
    switch (colorScheme) {
      case 'neon':
        return ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981'];
      case 'sunset':
        return ['#f97316', '#ef4444', '#f59e0b', '#ec4899'];
      case 'ocean':
        return ['#06b6d4', '#3b82f6', '#8b5cf6', '#14b8a6'];
      case 'primary':
      default:
        return ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed'];
    }
  }, [colorScheme]);

  // Initialize bars data
  useEffect(() => {
    const barCount = 64;
    barsRef.current = Array.from({ length: barCount }, () => ({
      height: Math.random() * 0.3 + 0.1,
      targetHeight: Math.random() * 0.5 + 0.2,
      velocity: 0,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = getColors();
    const barCount = 64;

    const drawBars = (time) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      if (!isPlaying) {
        // Idle state — very low, subtle bars
        barsRef.current.forEach((bar, i) => {
          bar.targetHeight = 0.03 + Math.sin(time * 0.001 + bar.phase) * 0.02;
        });
      } else {
        // Active state — simulated frequency response
        phaseRef.current += 0.02;
        barsRef.current.forEach((bar, i) => {
          const normalizedI = i / barCount;
          // Simulate bass (low freq), mids, highs
          const bass = Math.sin(time * 0.003 + normalizedI * 2) * 0.4 * (1 - normalizedI);
          const mids = Math.sin(time * 0.005 + normalizedI * 4) * 0.3;
          const highs = Math.sin(time * 0.008 + normalizedI * 8) * 0.2 * normalizedI;
          const randomness = Math.sin(time * 0.01 + bar.phase) * 0.15;
          bar.targetHeight = Math.abs(bass + mids + highs + randomness) * 0.8 + 0.05;
        });
      }

      // Smooth interpolation
      barsRef.current.forEach((bar) => {
        const diff = bar.targetHeight - bar.height;
        bar.velocity += diff * 0.15;
        bar.velocity *= 0.7;
        bar.height += bar.velocity;
        bar.height = Math.max(0.02, Math.min(1, bar.height));
      });

      const barWidth = w / barCount;
      const gap = 1;

      barsRef.current.forEach((bar, i) => {
        const x = i * barWidth;
        const barH = bar.height * h * 0.8;
        const colorIdx = Math.floor((i / barCount) * colors.length) % colors.length;

        // Gradient bar
        const gradient = ctx.createLinearGradient(x, h - barH, x, h);
        gradient.addColorStop(0, colors[colorIdx] + 'CC');
        gradient.addColorStop(0.5, colors[(colorIdx + 1) % colors.length] + '99');
        gradient.addColorStop(1, colors[colorIdx] + '33');

        ctx.fillStyle = gradient;
        ctx.fillRect(x + gap, h - barH, barWidth - gap * 2, barH);

        // Glow effect on top
        if (isPlaying && bar.height > 0.3) {
          ctx.shadowColor = colors[colorIdx];
          ctx.shadowBlur = 8;
          ctx.fillStyle = colors[colorIdx] + 'AA';
          ctx.fillRect(x + gap, h - barH, barWidth - gap * 2, 2);
          ctx.shadowBlur = 0;
        }
      });
    };

    const drawWave = (time) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const colors = getColors();
      const amplitude = isPlaying ? h * 0.3 : h * 0.05;
      const centerY = h * 0.6;

      // Draw multiple layered waves
      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let x = 0; x < w; x++) {
          const normalX = x / w;
          const y = centerY +
            Math.sin(normalX * Math.PI * 4 + time * 0.003 + layer) * amplitude * 0.5 +
            Math.sin(normalX * Math.PI * 8 + time * 0.005 + layer * 2) * amplitude * 0.25 +
            Math.sin(normalX * Math.PI * 2 + time * 0.002) * amplitude * 0.3;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, centerY - amplitude, 0, h);
        gradient.addColorStop(0, colors[layer % colors.length] + '40');
        gradient.addColorStop(0.5, colors[(layer + 1) % colors.length] + '20');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    };

    const drawPulse = (time) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const colors = getColors();
      const centerX = w / 2;
      const centerY = h * 0.6;
      const baseRadius = Math.min(w, h) * 0.15;

      for (let ring = 0; ring < 5; ring++) {
        const pulseScale = isPlaying
          ? 1 + Math.sin(time * 0.004 + ring * 0.8) * 0.3 + Math.sin(time * 0.007 + ring) * 0.15
          : 1 + Math.sin(time * 0.001 + ring * 0.5) * 0.05;

        const radius = baseRadius * (1 + ring * 0.4) * pulseScale;
        const alpha = Math.max(0.05, 0.3 - ring * 0.06);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = colors[ring % colors.length] + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = isPlaying ? 2 : 1;
        ctx.stroke();

        // Fill with gradient
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.8, 'transparent');
        gradient.addColorStop(1, colors[ring % colors.length] + '10');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    };

    const animate = (time) => {
      switch (mode) {
        case 'wave': drawWave(time); break;
        case 'pulse': drawPulse(time); break;
        case 'bars':
        default: drawBars(time); break;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying, mode, getColors]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-60"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

export { VISUALIZER_MODES };
