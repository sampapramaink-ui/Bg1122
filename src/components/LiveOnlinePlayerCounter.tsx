import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Users, TrendingUp, TrendingDown, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type LiveGameKey = 'aviator' | 'andar_bahar' | 'roulette' | 'dragon_tiger';

interface GamePlayerConfig {
  base: number;
  min: number;
  max: number;
  wavePeriod1: number; // in ms
  wavePeriod2: number;
  wavePeriod3: number;
  wavePeriod4: number; // rapid breathing wave
  amp1: number;
  amp2: number;
  amp3: number;
  amp4: number;
  seed: number;
  themeColor: 'rose' | 'emerald' | 'amber' | 'red';
  accentBorder: string;
  glowColor: string;
  badgeBg: string;
  labelBengali: string;
  labelEnglish: string;
}

const GAME_CONFIGS: Record<LiveGameKey, GamePlayerConfig> = {
  aviator: {
    base: 210627,
    min: 196000,
    max: 238000,
    wavePeriod1: 72000,
    wavePeriod2: 19000,
    wavePeriod3: 6500,
    wavePeriod4: 2100,
    amp1: 14500,
    amp2: 4800,
    amp3: 1400,
    amp4: 380,
    seed: 13.37,
    themeColor: 'rose',
    accentBorder: 'border-rose-500/60',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    badgeBg: 'from-rose-950/80 via-slate-900/90 to-rose-950/70',
    labelBengali: 'অনলাইন প্লেয়ার',
    labelEnglish: 'ONLINE NOW'
  },
  andar_bahar: {
    base: 184375,
    min: 169000,
    max: 214000,
    wavePeriod1: 65000,
    wavePeriod2: 16000,
    wavePeriod3: 5500,
    wavePeriod4: 1900,
    amp1: 12000,
    amp2: 3900,
    amp3: 1100,
    amp4: 320,
    seed: 42.19,
    themeColor: 'emerald',
    accentBorder: 'border-emerald-500/60',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'from-emerald-950/80 via-slate-900/90 to-emerald-950/70',
    labelBengali: 'অনলাইন প্লেয়ার',
    labelEnglish: 'ONLINE NOW'
  },
  roulette: {
    base: 375410,
    min: 348000,
    max: 422000,
    wavePeriod1: 85000,
    wavePeriod2: 23000,
    wavePeriod3: 7200,
    wavePeriod4: 2400,
    amp1: 22000,
    amp2: 6800,
    amp3: 1950,
    amp4: 520,
    seed: 77.77,
    themeColor: 'amber',
    accentBorder: 'border-amber-500/60',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'from-amber-950/80 via-slate-900/90 to-amber-950/70',
    labelBengali: 'অনলাইন প্লেয়ার',
    labelEnglish: 'ONLINE NOW'
  },
  dragon_tiger: {
    base: 289650,
    min: 268000,
    max: 328000,
    wavePeriod1: 78000,
    wavePeriod2: 21000,
    wavePeriod3: 6800,
    wavePeriod4: 2200,
    amp1: 17500,
    amp2: 5400,
    amp3: 1600,
    amp4: 450,
    seed: 99.41,
    themeColor: 'red',
    accentBorder: 'border-red-500/60',
    glowColor: 'rgba(239, 68, 68, 0.45)',
    badgeBg: 'from-red-950/80 via-slate-900/90 to-red-950/70',
    labelBengali: 'অনলাইন প্লেয়ার',
    labelEnglish: 'ONLINE NOW'
  }
};

/**
 * Calculates continuous, multi-harmonic synchronized online count for any game at an exact timestamp.
 * Integrates 4 harmonic waves with phase shifts and continuous Brownian noise modulation.
 */
export function calculateSynchronizedOnlinePlayers(gameKey: LiveGameKey, nowMs: number): number {
  const cfg = GAME_CONFIGS[gameKey];
  const t = nowMs;

  const w1 = Math.sin((t / cfg.wavePeriod1) * Math.PI * 2) * cfg.amp1;
  const w2 = Math.cos((t / cfg.wavePeriod2) * Math.PI * 2) * cfg.amp2;
  const w3 = Math.sin((t / cfg.wavePeriod3) * Math.PI * 2 + cfg.seed) * cfg.amp3;
  const w4 = Math.cos((t / cfg.wavePeriod4) * Math.PI * 2 + (cfg.seed * 2.3)) * cfg.amp4;

  // Ultra smooth continuous micro-drift based on non-linear polynomial sine combinations
  const microJitter = (Math.sin(t * 0.0017 + cfg.seed) * 45) + (Math.cos(t * 0.0031 - cfg.seed) * 35);

  const calculated = Math.round(cfg.base + w1 + w2 + w3 + w4 + microJitter);
  return Math.min(cfg.max, Math.max(cfg.min, calculated));
}

// Single Digit Rolling Odometer Component with Lightweight GPU CSS
const RollingDigit: React.FC<{ digit: string; themeColor: 'rose' | 'emerald' | 'amber' | 'red' }> = React.memo(({ digit, themeColor }) => {
  if (digit === ',' || digit === '.') {
    return <span className="text-white/60 px-0.5 select-none font-bold text-xs sm:text-sm">{digit}</span>;
  }

  const colorClasses = {
    rose: 'text-rose-200',
    emerald: 'text-emerald-200',
    amber: 'text-amber-200',
    red: 'text-red-200'
  };

  return (
    <span className={`inline-block font-black text-xs sm:text-sm tracking-tighter ${colorClasses[themeColor]} drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] select-none transition-all duration-300 transform-gpu`}>
      {digit}
    </span>
  );
});

interface LiveOnlinePlayerCounterProps {
  gameKey: LiveGameKey;
  className?: string;
  size?: 'normal' | 'compact' | 'large';
  showBengaliLabel?: boolean;
}

export const LiveOnlinePlayerCounter: React.FC<LiveOnlinePlayerCounterProps> = React.memo(({
  gameKey,
  className = '',
  size = 'normal',
  showBengaliLabel = true
}) => {
  const config = GAME_CONFIGS[gameKey];
  
  // Initial count
  const initialCalculated = useMemo(() => calculateSynchronizedOnlinePlayers(gameKey, Date.now()), [gameKey]);
  const [displayedCount, setDisplayedCount] = useState<number>(initialCalculated);
  const currentCountRef = useRef<number>(initialCalculated);
  const [delta, setDelta] = useState<number>(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'steady'>('steady');

  // 1. Organic Random-Interval Update Loop (Ultra low CPU: ticks every 2.5s-4s)
  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;

    const scheduleNextFluctuation = () => {
      // Realistic update interval between 2.5s and 4.5s
      const randomInterval = Math.floor(2500 + Math.random() * 2000 + (config.seed % 300));
      
      timerId = setTimeout(() => {
        if (!isMounted) return;
        const now = Date.now();
        const nextTarget = calculateSynchronizedOnlinePlayers(gameKey, now);

        const diff = nextTarget - currentCountRef.current;
        if (Math.abs(diff) > 0) {
          setDelta(diff);
          if (diff > 0) setTrend('up');
          else if (diff < 0) setTrend('down');
          else setTrend('steady');
          
          currentCountRef.current = nextTarget;
          setDisplayedCount(nextTarget);
        }

        scheduleNextFluctuation();
      }, randomInterval);
    };

    scheduleNextFluctuation();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [gameKey, config.seed]);

  // Formatted with Indian locale comma separator (e.g. 2,10,627)
  const formattedString = useMemo(() => {
    return displayedCount.toLocaleString('en-IN');
  }, [displayedCount]);

  const digitsArray = useMemo(() => {
    return formattedString.split('');
  }, [formattedString]);

  const themeBadgeStyles = {
    rose: {
      radarDot: 'bg-rose-500',
      pingDot: 'bg-rose-400',
      iconText: 'text-rose-400',
      borderGlow: 'border-rose-500/50 shadow-[0_0_14px_rgba(244,63,94,0.35)]',
      trendUp: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      trendDown: 'bg-rose-950/80 text-rose-400 border-rose-500/30',
      gradientBg: 'bg-gradient-to-r from-slate-950/95 via-rose-950/80 to-slate-950/95'
    },
    emerald: {
      radarDot: 'bg-emerald-500',
      pingDot: 'bg-emerald-400',
      iconText: 'text-emerald-400',
      borderGlow: 'border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.35)]',
      trendUp: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      trendDown: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30',
      gradientBg: 'bg-gradient-to-r from-slate-950/95 via-emerald-950/80 to-slate-950/95'
    },
    amber: {
      radarDot: 'bg-amber-400',
      pingDot: 'bg-amber-300',
      iconText: 'text-amber-400',
      borderGlow: 'border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
      trendUp: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      trendDown: 'bg-amber-950/80 text-amber-400 border-amber-500/30',
      gradientBg: 'bg-gradient-to-r from-slate-950/95 via-amber-950/80 to-slate-950/95'
    },
    red: {
      radarDot: 'bg-red-500',
      pingDot: 'bg-red-400',
      iconText: 'text-red-400',
      borderGlow: 'border-red-500/50 shadow-[0_0_14px_rgba(239,68,68,0.35)]',
      trendUp: 'bg-red-500/20 text-red-300 border-red-500/30',
      trendDown: 'bg-red-950/80 text-red-400 border-red-500/30',
      gradientBg: 'bg-gradient-to-r from-slate-950/95 via-red-950/80 to-slate-950/95'
    }
  }[config.themeColor];

  return (
    <div
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl border backdrop-blur-md transition-all duration-300 ${themeBadgeStyles.borderGlow} ${themeBadgeStyles.gradientBg} ${className}`}
    >
      {/* Real-time Pulsing Radar Dot */}
      <div className="relative flex items-center justify-center w-2.5 h-2.5 flex-shrink-0">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${themeBadgeStyles.pingDot}`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 shadow-[0_0_8px_currentColor] ${themeBadgeStyles.radarDot}`}
        />
      </div>

      {/* Users Icon */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${themeBadgeStyles.iconText}`} />
      </div>

      {/* Rolling Digits Display */}
      <div className="flex items-center font-mono">
        <div className="flex items-center tracking-tight">
          {digitsArray.map((digit, idx) => (
            <RollingDigit key={`${idx}-${digit}`} digit={digit} themeColor={config.themeColor} />
          ))}
        </div>
      </div>

      {/* Fluctuation Indicator (Up / Down Delta Pill) with Organic Animation */}
      <div className="flex items-center flex-shrink-0">
        <AnimatePresence mode="wait">
          {trend === 'up' && (
            <motion.div
              key="trend-up"
              initial={{ scale: 0.8, opacity: 0, y: 3 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -3 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded-md border border-emerald-500/40 shadow-sm"
              title="প্লেয়ার সংখ্যা বাড়ছে"
            >
              <TrendingUp className="w-2.5 h-2.5" />
              <span>+{Math.abs(delta)}</span>
            </motion.div>
          )}

          {trend === 'down' && (
            <motion.div
              key="trend-down"
              initial={{ scale: 0.8, opacity: 0, y: -3 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 3 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded-md border border-amber-500/40 shadow-sm"
              title="প্লেয়ার সংখ্যা কমছে"
            >
              <TrendingDown className="w-2.5 h-2.5" />
              <span>-{Math.abs(delta)}</span>
            </motion.div>
          )}

          {trend === 'steady' && (
            <motion.div
              key="trend-steady"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1"
            >
              LIVE
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bengali / English Subtitle Chip */}
      {showBengaliLabel && (
        <span className="hidden sm:inline-block text-[9px] text-slate-300 font-semibold uppercase tracking-wider opacity-90 pl-0.5 border-l border-white/10">
          {config.labelBengali}
        </span>
      )}
    </div>
  );
});
