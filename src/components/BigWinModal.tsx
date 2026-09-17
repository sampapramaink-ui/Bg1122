import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Sparkles, Crown, Flame, Zap, Award, CheckCircle2, 
  X, ArrowRight, DollarSign, Star, Coins, Gift, Eye, Volume2, VolumeX, ShieldCheck
} from 'lucide-react';
import { SuperCarColor, PlayingCard } from '../types';
import { getSuperCarInfo } from '../utils/supercar';
import { soundFx } from '../utils/audio';
import { triggerGoldConfetti } from '../utils/confetti';

export type BigWinCategory = 
  | 'lottery' 
  | 'supercar' 
  | 'crash' 
  | 'roulette' 
  | 'dragon_tiger' 
  | 'andar_bahar' 
  | 'wheel'
  | 'generic';

export interface BigWinData {
  id: string;
  category: BigWinCategory;
  title?: string;
  subtitle?: string;
  amount: number;
  multiplier?: number | string;
  drawOrRoundId?: string;
  // Game-specific visual metadata
  ticketNumber?: string;
  winningNumbers?: number[];
  carColor?: SuperCarColor;
  carName?: string;
  carImage?: string;
  rouletteNumber?: number;
  rouletteColor?: 'red' | 'black' | 'green';
  crashMultiplier?: number;
  cards?: {
    dragon?: PlayingCard | null;
    tiger?: PlayingCard | null;
    joker?: PlayingCard | null;
    matching?: PlayingCard | null;
    side?: string;
  };
  badgeText?: string;
  walletType?: 'main' | 'bonus';
}

interface BigWinModalProps {
  data: BigWinData | null;
  onClose: () => void;
  onViewDetails?: () => void;
  autoCloseDurationMs?: number;
}

export const BigWinModal: React.FC<BigWinModalProps> = ({
  data,
  onClose,
  onViewDetails,
  autoCloseDurationMs = 8500,
}) => {
  const [displayedAmount, setDisplayedAmount] = useState<number>(0);
  const [progress, setProgress] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getMuted());
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const remainingTimeRef = useRef<number>(autoCloseDurationMs);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!data) {
      setDisplayedAmount(0);
      setProgress(100);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    remainingTimeRef.current = autoCloseDurationMs;
    lastTickRef.current = Date.now();

    // 1. Trigger Grand 8K Gold Confetti & Sparkles Shower
    triggerGoldConfetti();

    // 2. Play Big Win Fanfare & Cheer Audio
    try {
      soundFx.playWinFanfare();
      setTimeout(() => {
        soundFx.playCashoutBigWin();
      }, 400);
      setTimeout(() => {
        soundFx.playCoin();
      }, 900);
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }

    // 3. Counting Number Animation (Smooth Cubic-Ease from 0 to target amount)
    const targetAmt = Math.max(0, Math.round(data.amount));
    const countDuration = 1600;
    const startCountTime = performance.now();

    const updateCounter = (now: number) => {
      const elapsed = now - startCountTime;
      const pct = Math.min(elapsed / countDuration, 1);
      // Ease out cubic
      const easedPct = 1 - Math.pow(1 - pct, 3);
      const current = Math.round(targetAmt * easedPct);
      setDisplayedAmount(current);

      if (pct < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayedAmount(targetAmt);
      }
    };
    requestAnimationFrame(updateCounter);

    // 4. Auto-close Progress Bar loop
    const runProgressBar = () => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - delta);

        const currentPct = (remainingTimeRef.current / autoCloseDurationMs) * 100;
        setProgress(Math.max(0, currentPct));

        if (remainingTimeRef.current <= 0) {
          onClose();
          return;
        }
      } else {
        lastTickRef.current = Date.now();
      }

      animFrameRef.current = requestAnimationFrame(runProgressBar);
    };

    animFrameRef.current = requestAnimationFrame(runProgressBar);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [data?.id, data?.amount, autoCloseDurationMs, isPaused, onClose]);

  if (!data) return null;

  // Category Configuration
  const categoryConfig: Record<
    BigWinCategory,
    {
      titleBn: string;
      titleEn: string;
      accentGradient: string;
      glowColor: string;
      icon: React.ReactNode;
      badgeText: string;
    }
  > = {
    lottery: {
      titleBn: 'লটারি জ্যাকপট বিজয়ী!',
      titleEn: 'MEGA LOTTERY JACKPOT WIN',
      accentGradient: 'from-amber-400 via-yellow-300 to-amber-500',
      glowColor: 'rgba(245, 158, 11, 0.7)',
      icon: <Trophy className="w-9 h-9 text-amber-300 animate-bounce" />,
      badgeText: '★ MEGA LOTTERY JACKPOT ★'
    },
    supercar: {
      titleBn: 'সুপার কার গ্র্যান্ড চ্যাম্পিয়ন!',
      titleEn: 'SUPER CAR GRAND CHAMPION WIN',
      accentGradient: 'from-amber-500 via-rose-500 to-amber-400',
      glowColor: 'rgba(239, 68, 68, 0.7)',
      icon: <Crown className="w-9 h-9 text-yellow-300 animate-pulse" />,
      badgeText: '★ 3 SUPER CAR DRAW ★'
    },
    crash: {
      titleBn: 'এভিয়েটর সুপারসনিক ক্যাশআউট!',
      titleEn: 'AVIATOR SUPERSONIC BIG WIN',
      accentGradient: 'from-rose-500 via-amber-400 to-yellow-300',
      glowColor: 'rgba(244, 63, 94, 0.7)',
      icon: <Flame className="w-9 h-9 text-rose-400 animate-bounce" />,
      badgeText: '★ SPRIBE AVIATOR CASHOUT ★'
    },
    roulette: {
      titleBn: 'লাইটনিং রুলেট বিগ উইন!',
      titleEn: 'HINDI LIGHTNING ROULETTE WIN',
      accentGradient: 'from-yellow-400 via-amber-400 to-yellow-500',
      glowColor: 'rgba(251, 191, 36, 0.8)',
      icon: <Zap className="w-9 h-9 text-yellow-300 animate-pulse" />,
      badgeText: '★ LIGHTNING ROULETTE 500X ★'
    },
    dragon_tiger: {
      titleBn: 'ড্রাগন টাইগার লাইভ বিগ উইন!',
      titleEn: 'DRAGON TIGER ROYAL WIN',
      accentGradient: 'from-red-500 via-amber-400 to-cyan-400',
      glowColor: 'rgba(239, 68, 68, 0.7)',
      icon: <Crown className="w-9 h-9 text-amber-300 animate-bounce" />,
      badgeText: '★ DRAGON TIGER ROYAL ★'
    },
    andar_bahar: {
      titleBn: 'সুপার আন্দার বাহার বিজয়ী!',
      titleEn: 'SUPER ANDAR BAHAR LIVE WIN',
      accentGradient: 'from-emerald-400 via-teal-300 to-emerald-500',
      glowColor: 'rgba(16, 185, 129, 0.7)',
      icon: <Award className="w-9 h-9 text-emerald-300 animate-bounce" />,
      badgeText: '★ ANDAR BAHAR CHAMPION ★'
    },
    wheel: {
      titleBn: 'লাকি হুইল ফরচুন রিওয়ার্ড!',
      titleEn: 'LUCKY WHEEL FORTUNE WIN',
      accentGradient: 'from-purple-400 via-pink-400 to-amber-400',
      glowColor: 'rgba(168, 85, 247, 0.7)',
      icon: <Gift className="w-9 h-9 text-purple-300 animate-pulse" />,
      badgeText: '★ LUCKY SPIN WHEEL ★'
    },
    generic: {
      titleBn: 'বিগ উইন কনগ্রাচুলেশন!',
      titleEn: 'BIG WIN CELEBRATION',
      accentGradient: 'from-amber-400 via-yellow-300 to-amber-500',
      glowColor: 'rgba(245, 158, 11, 0.7)',
      icon: <Trophy className="w-9 h-9 text-amber-300 animate-bounce" />,
      badgeText: '★ BETGURU BIG WIN ★'
    }
  };

  const currentTheme = categoryConfig[data.category] || categoryConfig.generic;

  // Super Car Details
  const carInfo = data.carColor ? getSuperCarInfo(data.carColor) : null;
  const carImg = data.carImage || carInfo?.image;
  const carDisplayName = data.carName || carInfo?.name;

  return (
    <AnimatePresence>
      <div 
        id="big-win-modal-root"
        className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 select-none overflow-y-auto"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Fullscreen Ultra Dark Cinematic Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/92 backdrop-blur-2xl"
          onClick={onClose}
        />

        {/* 8K Rotating Golden Celestial Sunburst Ray Animation */}
        <div 
          className="fixed inset-0 pointer-events-none opacity-50 animate-[spin_40s_linear_infinite]"
          style={{
            backgroundImage: `radial-gradient(circle at center, ${currentTheme.glowColor} 0%, transparent 60%), repeating-conic-gradient(from 0deg, rgba(251, 191, 36, 0.12) 0deg 15deg, transparent 15deg 30deg)`
          }}
        />

        {/* Flanking Ambient Light Spheres */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-400/25 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-yellow-400/25 rounded-full blur-[100px] animate-pulse" />
        </div>

        {/* Main 8K Modal Card Container */}
        <motion.div
          id="big-win-modal-card"
          initial={{ scale: 0.5, y: 50, opacity: 0, rotateX: 18 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
          exit={{ scale: 0.75, y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 280 }}
          className="relative z-10 w-full max-w-lg rounded-3xl sm:rounded-[36px] bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-black/98 border-2 border-amber-400 p-5 sm:p-7 text-center shadow-[0_0_90px_rgba(245,158,11,0.7)] backdrop-blur-3xl overflow-hidden my-auto"
        >
          {/* 8K Metallic Luxury Foil Edge Bevel */}
          <div className="absolute inset-1 rounded-[30px] border border-amber-400/40 pointer-events-none" />
          <div className="absolute inset-2.5 rounded-[26px] border border-yellow-300/20 pointer-events-none" />

          {/* Holographic Light Sweep Shimmer Beam */}
          <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/12 to-transparent rotate-45 pointer-events-none animate-[shimmer_3.5s_infinite]" />

          {/* Top Floating Controls (Mute & Close) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              id="big-win-mute-btn"
              onClick={() => {
                const newMuted = soundFx.toggleMute();
                setIsMuted(newMuted);
              }}
              className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-lg"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              id="big-win-close-btn"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-amber-500/30 transition-all cursor-pointer shadow-lg"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Top Sparkling Crown / Trophy Emblem */}
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 320, damping: 14 }}
            className="mx-auto mb-2 flex items-center justify-center"
          >
            <div className="relative p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-600 text-slate-950 shadow-[0_0_45px_rgba(251,191,36,0.9)] border-2 border-yellow-100">
              <Sparkles className="absolute -top-2.5 -right-2.5 w-6 h-6 text-amber-200 animate-spin" />
              <Sparkles className="absolute -bottom-2.5 -left-2.5 w-5 h-5 text-yellow-100 animate-ping" />
              {currentTheme.icon}
            </div>
          </motion.div>

          {/* Top Category Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-950/90 text-amber-300 text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase border border-amber-400/80 shadow-md mb-2">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
            <span>{data.badgeText || currentTheme.badgeText}</span>
          </div>

          {/* Main Celebration Headings */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-0.5"
          >
            <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 uppercase tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {data.title || currentTheme.titleBn}
            </h2>
            <p className="text-[11px] sm:text-xs text-amber-300/80 font-bold uppercase tracking-wider font-mono">
              {data.subtitle || currentTheme.titleEn}
            </p>
          </motion.div>

          {/* Custom Category 8K Spotlight Showcase */}
          <div className="my-3.5">
            {/* 1. Super Car Draw Win Visual */}
            {data.category === 'supercar' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="relative mx-auto w-full max-w-xs rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-[0_0_35px_rgba(245,158,11,0.5)] group bg-slate-950"
              >
                {carImg ? (
                  <img
                    src={carImg}
                    alt={carDisplayName || 'Winning Car'}
                    className="w-full h-36 sm:h-44 object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center bg-slate-900 text-5xl">
                    🏎️
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-950/95 text-amber-300 font-mono font-black text-[11px] border border-amber-400/70 shadow-lg">
                    🏎️ {carDisplayName?.toUpperCase() || `${data.carColor?.toUpperCase()} SUPER CAR`}
                  </span>
                  {data.multiplier && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-mono font-black text-[11px] border border-yellow-200 shadow-lg">
                      ⚡ {data.multiplier} PAYOUT
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* 2. Lottery Draw Win Visual */}
            {data.category === 'lottery' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/50 space-y-2.5 max-w-sm mx-auto"
              >
                {data.ticketNumber && (
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">WINNING TICKET NO:</span>
                    <span className="font-black text-amber-300 px-2 py-0.5 rounded bg-slate-950/90 border border-amber-400/40">
                      {data.ticketNumber}
                    </span>
                  </div>
                )}
                {data.winningNumbers && data.winningNumbers.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    {data.winningNumbers.map((num, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 text-slate-950 font-black font-mono text-sm sm:text-base flex items-center justify-center shadow-[0_0_18px_rgba(245,158,11,0.7)] border border-white"
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. Aviator Crash Live Win Visual */}
            {data.category === 'crash' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-2xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border border-rose-500/50 max-w-sm mx-auto flex items-center justify-between px-4 shadow-lg"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-xl bg-rose-600/30 border border-rose-400/60 flex items-center justify-center text-2xl shadow-inner">
                    🚀
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-300 font-mono font-bold uppercase">CASHOUT MULTIPLIER</div>
                    <div className="text-xl font-black text-white font-mono">{data.multiplier || `${data.crashMultiplier || 2.0}x`}</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-gradient-to-r from-rose-600 to-red-500 text-white font-black font-mono text-xs rounded-xl border border-rose-300 shadow-md">
                  CLAIMED
                </span>
              </motion.div>
            )}

            {/* 4. Live Roulette Win Visual */}
            {data.category === 'roulette' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-400/50 max-w-sm mx-auto flex items-center justify-between px-4 shadow-lg"
              >
                <div className="flex items-center gap-3 text-left">
                  {typeof data.rouletteNumber === 'number' && (
                    <div
                      className={`w-12 h-12 rounded-full text-white font-black font-mono text-xl flex items-center justify-center shadow-lg border-2 ${
                        data.rouletteColor === 'red'
                          ? 'bg-rose-600 border-rose-300 shadow-rose-600/50'
                          : data.rouletteColor === 'green' || data.rouletteNumber === 0
                          ? 'bg-emerald-600 border-emerald-300 shadow-emerald-600/50'
                          : 'bg-slate-950 border-slate-400 shadow-slate-900/80'
                      }`}
                    >
                      {data.rouletteNumber}
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-amber-300 font-mono font-bold uppercase">LUCKY HIT NUMBER</div>
                    <div className="text-xs font-black text-white font-mono">
                      {data.rouletteColor?.toUpperCase()} • {data.multiplier || '36x'}
                    </div>
                  </div>
                </div>
                <div className="text-amber-400 font-black text-sm flex items-center gap-1 font-mono">
                  <span>⚡ 500X MAX</span>
                </div>
              </motion.div>
            )}

            {/* 5. Live Dragon Tiger Win Visual */}
            {data.category === 'dragon_tiger' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-2xl bg-gradient-to-r from-red-950/60 via-slate-900 to-cyan-950/60 border border-amber-400/50 max-w-sm mx-auto flex items-center justify-around shadow-lg"
              >
                <div className="text-center">
                  <div className="text-[10px] font-mono text-red-400 font-bold">DRAGON</div>
                  <div className={`w-11 h-14 bg-slate-950 border border-red-500 rounded-lg flex items-center justify-center font-mono font-black text-sm shadow-md mt-0.5 ${data.cards?.dragon?.color === 'red' ? 'text-red-500' : 'text-white'}`}>
                    {data.cards?.dragon ? `${data.cards.dragon.rank}${data.cards.dragon.suit}` : '🐉'}
                  </div>
                </div>
                <div className="text-amber-300 font-mono font-black text-xs px-2 py-1 bg-slate-950/80 rounded-lg border border-amber-400/40">
                  VS
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono text-cyan-400 font-bold">TIGER</div>
                  <div className={`w-11 h-14 bg-slate-950 border border-cyan-500 rounded-lg flex items-center justify-center font-mono font-black text-sm shadow-md mt-0.5 ${data.cards?.tiger?.color === 'red' ? 'text-red-500' : 'text-white'}`}>
                    {data.cards?.tiger ? `${data.cards.tiger.rank}${data.cards.tiger.suit}` : '🐯'}
                  </div>
                </div>
              </motion.div>
            )}

            {/* 6. Live Andar Bahar Win Visual */}
            {data.category === 'andar_bahar' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-400/50 max-w-sm mx-auto flex items-center justify-between px-4 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-mono text-amber-300 font-bold">JOKER:</div>
                  <div className={`w-10 h-13 bg-slate-950 border border-amber-400 rounded-lg flex items-center justify-center font-mono font-black text-xs ${data.cards?.joker?.color === 'red' ? 'text-rose-400' : 'text-amber-300'}`}>
                    {data.cards?.joker ? `${data.cards.joker.rank}${data.cards.joker.suit}` : '★'}
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black font-mono text-xs rounded-xl border border-emerald-300 shadow">
                  {data.cards?.side?.toUpperCase() || 'MATCH'} WIN
                </span>
              </motion.div>
            )}

            {/* 7. Lucky Wheel / Fortune Win Visual */}
            {data.category === 'wheel' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-pink-950/60 border border-purple-400/50 max-w-sm mx-auto flex items-center justify-center gap-3 shadow-lg"
              >
                <div className="w-10 h-10 rounded-full bg-purple-600/40 border border-purple-300 flex items-center justify-center text-xl">
                  🎡
                </div>
                <div className="text-left font-mono">
                  <div className="text-[10px] text-purple-300 font-bold">FORTUNE PRIZE REWARD</div>
                  <div className="text-sm font-black text-white">LUCKY SPIN JACKPOT</div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Grand Won Amount Counter Showcase */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260 }}
            className="my-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-500/25 via-yellow-500/15 to-slate-950 border-2 border-amber-400 shadow-[0_0_45px_rgba(245,158,11,0.5)] relative overflow-hidden"
          >
            {/* Background Coins Texture */}
            <div className="absolute top-2 right-3 opacity-20 text-amber-300 pointer-events-none">
              <Coins className="w-16 h-16 animate-pulse" />
            </div>

            <div className="text-[11px] sm:text-xs font-black text-amber-300 tracking-widest uppercase font-mono mb-1">
              TOTAL WON PRIZE AMOUNT
            </div>

            {/* Glowing Big Amount */}
            <div 
              id="big-win-display-amount"
              className="text-3xl sm:text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 tracking-tight drop-shadow-[0_4px_16px_rgba(245,158,11,0.9)]"
            >
              +₹{displayedAmount.toLocaleString('en-IN')}
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                সরাসরি আপনার {data.walletType === 'bonus' ? 'বোনাস' : 'মেইন'} ওয়ালেটে ক্রেডিট করা হয়েছে
              </span>
            </div>
          </motion.div>

          {/* Action CTAs */}
          <div className="mt-4 space-y-2">
            {/* Primary Claim Button */}
            <motion.button
              id="big-win-claim-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                soundFx.playCoin();
                onClose();
              }}
              className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-sm sm:text-base tracking-wide uppercase shadow-[0_0_35px_rgba(251,191,36,0.85)] border-2 border-yellow-100 flex items-center justify-center gap-2 cursor-pointer transition-all relative overflow-hidden group"
            >
              <Sparkles className="w-5 h-5 text-slate-950 animate-spin" />
              <span>সংগ্রহ করুন • COLLECT REWARD</span>
              <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Secondary View Details CTA */}
            {onViewDetails && (
              <button
                id="big-win-view-details-btn"
                onClick={() => {
                  onClose();
                  onViewDetails();
                }}
                className="w-full py-2 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>ফলাফল ও টিকেটের বিস্তারিত দেখুন (View Details)</span>
              </button>
            )}
          </div>

          {/* Auto-Dismiss Progress Bar */}
          <div className="mt-3.5 w-full bg-slate-900/90 rounded-full h-1.5 overflow-hidden border border-white/10 p-0.5 shadow-inner">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>8K ULTRA HD CELEBRATION</span>
            <span>{isPaused ? 'পজ করা হয়েছে' : 'অটো ক্লোজ হচ্ছে...'}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
