import React, { useEffect, useState, useMemo } from 'react';
import { Zap, Sparkles, AlertCircle } from 'lucide-react';
import { LightningMultiplier, getRouletteNumberColor } from '../utils/rouletteRiskEngine';
import { soundFx } from '../utils/audio';

interface LightningStrikeStormProps {
  isActive: boolean;
  roundId: string;
  lightningNumbers: LightningMultiplier[];
  onComplete?: () => void;
  onDismiss?: () => void;
}

interface BoltPath {
  main: string;
  branches: string[];
}

/**
 * Generates a realistic jagged procedural electric bolt path from (x1, y1) to (x2, y2)
 */
function generateLightningPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displace: number = 22,
  seed: number = 0
): BoltPath {
  const steps = 9;
  const points: [number, number][] = [[x1, y1]];
  const branches: string[] = [];

  const dx = (x2 - x1) / steps;
  const dy = (y2 - y1) / steps;

  // Simple pseudo-random using seed
  let s = seed + 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 1; i < steps; i++) {
    const factor = Math.sin((i / steps) * Math.PI); // max displacement in middle
    const offsetX = (rnd() * 2 - 1) * displace * factor;
    const offsetY = (rnd() * 2 - 1) * (displace * 0.4) * factor;
    const curX = x1 + dx * i + offsetX;
    const curY = y1 + dy * i + offsetY;
    points.push([curX, curY]);

    // Occasionally generate a branching fork
    if (i === 3 || i === 6) {
      const branchAngle = (rnd() > 0.5 ? 1 : -1) * (0.4 + rnd() * 0.5);
      const branchLen = 20 + rnd() * 25;
      const bX = curX + Math.sin(branchAngle) * branchLen;
      const bY = curY + Math.cos(branchAngle) * branchLen;
      branches.push(`M ${curX.toFixed(1)} ${curY.toFixed(1)} Q ${(curX + bX) / 2 + (rnd() * 10 - 5)} ${(curY + bY) / 2} ${bX.toFixed(1)} ${bY.toFixed(1)}`);
    }
  }

  points.push([x2, y2]);

  let pathStr = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    pathStr += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  }

  return { main: pathStr, branches };
}

export const LightningStrikeStorm: React.FC<LightningStrikeStormProps> = ({
  isActive,
  roundId,
  lightningNumbers,
  onComplete,
  onDismiss
}) => {
  const [phase, setPhase] = useState<'idle' | 'charging' | 'striking' | 'shocking' | 'dissipating'>('idle');
  const [tick, setTick] = useState(0);

  // Trigger sound, shock and animation sequence when isActive turns true
  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    // Step 1: Pre-charge at header (0ms)
    setPhase('charging');
    
    // Step 2: Main lightning strike shoots down (120ms)
    const tStrike = setTimeout(() => {
      setPhase('striking');
      soundFx.playThunderStrike();
    }, 120);

    // Step 3: High-voltage electric shock on numbers (350ms)
    const tShock = setTimeout(() => {
      setPhase('shocking');
    }, 350);

    // Step 4: Electricity dissipating (2200ms)
    const tDissipate = setTimeout(() => {
      setPhase('dissipating');
    }, 2200);

    // Step 5: Finished (2700ms)
    const tComplete = setTimeout(() => {
      setPhase('idle');
      if (onComplete) onComplete();
    }, 2700);

    return () => {
      clearTimeout(tStrike);
      clearTimeout(tShock);
      clearTimeout(tDissipate);
      clearTimeout(tComplete);
    };
  }, [isActive, roundId, onComplete]);

  // Jitter the lightning bolt path on a rapid frame loop while striking/shocking
  useEffect(() => {
    if (phase !== 'striking' && phase !== 'shocking') return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60);
    return () => clearInterval(interval);
  }, [phase]);

  if (!isActive && phase === 'idle') return null;

  // Calculate coordinates for SVG lightning bolts
  // Viewbox coordinates: 0 0 1000 600
  // Header origin: (500, 30)
  const headerX = 500;
  const headerY = 35;
  const targetCount = Math.max(1, lightningNumbers.length);
  const targetY = 280;

  const targetCoords = lightningNumbers.map((_, idx) => {
    const total = targetCount;
    // Spread evenly across 200 to 800 width
    const step = 640 / (total + 1);
    const x = 180 + step * (idx + 1);
    return { x, y: targetY };
  });

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden flex flex-col items-center justify-start select-none">
      
      {/* 1. THUNDER SCREEN FLASH OVERLAY */}
      {(phase === 'striking' || phase === 'shocking') && (
        <div className="absolute inset-0 bg-cyan-100/40 mix-blend-screen animate-thunder-flash pointer-events-none z-10" />
      )}

      {/* 2. HEADER LIGHTNING GENERATOR & CHARGING EMITTER */}
      <div className="w-full max-w-xl mx-auto px-4 pt-1 z-30 flex flex-col items-center">
        <div
          className={`relative px-4 py-1 rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 border-2 transition-all duration-300 shadow-2xl flex items-center gap-2 ${
            phase === 'striking' || phase === 'shocking'
              ? 'border-cyan-300 shadow-[0_0_35px_rgba(56,189,248,1),0_0_70px_rgba(245,158,11,0.9)] animate-header-surge scale-105'
              : 'border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
          }`}
        >
          {/* Electric energy core indicator */}
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping absolute" />
            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-yellow-300 to-cyan-300 flex items-center justify-center shadow-md">
              <Zap className="w-2.5 h-2.5 text-slate-950 fill-slate-950 animate-bounce" />
            </div>
          </div>

          <div className="leading-tight text-center">
            <span className="text-[11px] sm:text-xs font-black tracking-wider text-cyan-300 flex items-center gap-1">
              ⚡ HIGH-VOLTAGE LIGHTNING STRIKE ⚡
            </span>
            <span className="text-[9px] font-mono font-bold text-amber-300 block">
              ROUND: #{roundId.slice(-6)} • {lightningNumbers.length} LUCKY NUMBERS CHARGING
            </span>
          </div>

          {/* Dismiss switch if user wants to close immediately */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="pointer-events-auto text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-[10px] ml-1"
              title="Close Animation"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. DYNAMIC SVG PROCEDURAL LIGHTNING BOLTS (SHOOTING FROM HEADER TO NUMBERS) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="bolt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="15" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {(phase === 'striking' || phase === 'shocking') &&
          targetCoords.map((coord, idx) => {
            const bolt = generateLightningPath(
              headerX,
              headerY,
              coord.x,
              coord.y,
              28,
              tick * 17 + idx * 43
            );

            return (
              <g key={`bolt_${idx}`}>
                {/* Cyan electric aura */}
                <path
                  d={bolt.main}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                  filter="url(#bolt-glow)"
                />
                {/* Amber/Gold electric charge */}
                <path
                  d={bolt.main}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
                {/* White-hot inner core */}
                <path
                  d={bolt.main}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="1"
                />

                {/* Secondary branching forks */}
                {bolt.branches.map((b, bIdx) => (
                  <path
                    key={`b_${idx}_${bIdx}`}
                    d={b}
                    fill="none"
                    stroke="#67e8f9"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                ))}

                {/* Ground/Target impact spark circle */}
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="24"
                  fill="url(#bolt-glow)"
                  className="animate-ping"
                  opacity="0.7"
                />
              </g>
            );
          })}
      </svg>

      {/* 4. TARGET LUCKY NUMBERS STRUCK BY ELECTRIC SHOCK */}
      <div className="w-full max-w-2xl px-4 mt-12 z-30 flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
        {lightningNumbers.map((l, idx) => {
          const col = getRouletteNumberColor(l.number);
          const isShocking = phase === 'striking' || phase === 'shocking';

          return (
            <div
              key={l.number}
              className={`relative flex flex-col items-center transition-all duration-300 ${
                isShocking ? 'animate-electric-shock scale-110' : 'scale-100'
              }`}
            >
              {/* Radial electric spark halo */}
              {isShocking && (
                <div className="absolute -inset-4 rounded-3xl border-2 border-cyan-400 bg-cyan-400/20 blur-sm animate-electric-sparks pointer-events-none" />
              )}

              {/* Spark particles bursting out */}
              {isShocking && (
                <>
                  <div className="absolute -top-3 -left-3 w-3 h-3 rounded-full bg-yellow-300 animate-ping shadow-[0_0_10px_#f59e0b]" />
                  <div className="absolute -bottom-3 -right-3 w-3 h-3 rounded-full bg-cyan-300 animate-ping shadow-[0_0_10px_#38bdf8]" />
                  <div className="absolute -top-2 right-1 w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                </>
              )}

              {/* Struck Number Box */}
              <div
                className={`relative w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center font-mono font-black shadow-2xl transition-all border-4 ${
                  isShocking
                    ? 'border-yellow-200 bg-gradient-to-b from-amber-500 via-rose-600 to-amber-700 text-white shadow-[0_0_35px_rgba(245,158,11,1),0_0_50px_rgba(56,189,248,0.9)] animate-lightning-strike'
                    : col === 'green'
                    ? 'border-emerald-400 bg-emerald-800 text-white shadow-emerald-500/50'
                    : col === 'red'
                    ? 'border-rose-400 bg-rose-800 text-white shadow-rose-500/50'
                    : 'border-slate-400 bg-slate-950 text-white shadow-slate-900/80'
                }`}
              >
                {/* Corner lightning icon */}
                <Zap
                  className={`w-3.5 h-3.5 absolute top-1 left-1.5 transition-colors ${
                    isShocking ? 'text-yellow-200 fill-yellow-200 animate-spin' : 'text-amber-400 fill-amber-400'
                  }`}
                />

                {/* Struck Number */}
                <span className="text-xl sm:text-2xl font-black tracking-tight leading-none drop-shadow-md">
                  {l.number}
                </span>

                <span className="text-[7px] sm:text-[8px] tracking-widest text-white/80 uppercase font-sans mt-0.5">
                  {col}
                </span>
              </div>

              {/* Multiplier Badge with High-Voltage Golden Glow */}
              <div
                className={`mt-1.5 px-2.5 py-0.5 rounded-full font-mono font-black text-xs sm:text-sm tracking-wider flex items-center gap-1 shadow-lg border-2 ${
                  isShocking
                    ? 'bg-amber-300 text-slate-950 border-white shadow-[0_0_20px_rgba(251,191,36,1)] animate-multiplier-blink'
                    : 'bg-amber-500 text-slate-950 border-amber-300'
                }`}
              >
                <span>⚡{l.multiplier}X</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. VIBRANT SHOCKWAVE TEXT BANNER */}
      {(phase === 'striking' || phase === 'shocking') && (
        <div className="mt-6 z-30 px-4 py-1.5 rounded-full bg-black/80 border border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.8)] flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
          <span className="font-mono font-black text-xs sm:text-sm text-yellow-300 tracking-wide uppercase">
            ⚡ ELECTRIC SHOCK ACTIVE • LUCKY MULTIPLIERS APPLIED! ⚡
          </span>
          <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
        </div>
      )}

    </div>
  );
};
