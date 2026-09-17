import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayingCard } from '../types';
import { Crown, Sparkles, Flame, ShieldAlert, Award, X, Zap } from 'lucide-react';
import { soundFx } from '../utils/audio';

export type GameSpotlightType = 'dragon_tiger' | 'andar_bahar';

export interface Card8KSpotlightData {
  gameType: GameSpotlightType;
  winner: 'dragon' | 'tiger' | 'tie' | 'suited_tie' | 'andar' | 'bahar';
  isSuitedTie?: boolean;
  winningCard?: PlayingCard | null;
  // Dragon Tiger specific
  dragonCard?: PlayingCard | null;
  tigerCard?: PlayingCard | null;
  // Andar Bahar specific
  jokerCard?: PlayingCard | null;
  matchingCard?: PlayingCard | null;
  totalCardsDealt?: number;
  multiplier?: number;
  userWonAmount?: number;
}

interface Card8KSpotlightModalProps {
  isOpen: boolean;
  data: Card8KSpotlightData | null;
  onClose: () => void;
  autoCloseDurationMs?: number;
}

// Ultra 8K High Definition Card Vector Art Component
export const Ultra8KPlayingCard: React.FC<{
  card: PlayingCard;
  isWinning?: boolean;
  label?: string;
  glowTheme?: 'red' | 'cyan' | 'emerald' | 'amber' | 'gold';
  className?: string;
}> = ({ card, isWinning = true, label, glowTheme = 'gold', className = '' }) => {
  const isRed = card.color === 'red';
  const suitSymbol = card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠';

  const themeGlowMap = {
    red: 'shadow-[0_0_50px_rgba(239,68,68,0.85)] border-red-500 ring-4 ring-red-500/60',
    cyan: 'shadow-[0_0_50px_rgba(6,182,212,0.85)] border-cyan-400 ring-4 ring-cyan-400/60',
    emerald: 'shadow-[0_0_50px_rgba(16,185,129,0.85)] border-emerald-400 ring-4 ring-emerald-400/60',
    amber: 'shadow-[0_0_50px_rgba(245,158,11,0.85)] border-amber-400 ring-4 ring-amber-400/60',
    gold: 'shadow-[0_0_60px_rgba(251,191,36,0.95)] border-amber-300 ring-4 ring-yellow-400/70',
  };

  return (
    <motion.div
      initial={{ scale: 0.8, rotateY: -20, opacity: 0 }}
      animate={{ scale: 1, rotateY: 0, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.175, 0.885, 0.32, 1.275] }}
      className={`relative w-48 h-72 sm:w-64 sm:h-96 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-100 border-[3px] p-3 sm:p-4 flex flex-col justify-between select-none overflow-hidden ${themeGlowMap[glowTheme]} ${className}`}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(255,255,255,0.8)'
      }}
    >
      {/* 8K Metallic Luxury Foil Edge Bevel */}
      <div className="absolute inset-0.5 rounded-[18px] sm:rounded-[22px] border border-amber-400/50 pointer-events-none" />
      <div className="absolute inset-1.5 rounded-[14px] sm:rounded-[18px] border border-slate-300/60 pointer-events-none" />

      {/* Holographic 3D Light Sweep Reflection Overlay */}
      <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/35 to-transparent rotate-45 pointer-events-none animate-[shimmer_2s_infinite]" />

      {/* Micro-Linen Woven Embossed Texture */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '4px 4px'
        }}
      />

      {/* Top Banner Tag if provided */}
      {label && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20">
          <div className="px-3 py-0.5 rounded-full bg-slate-950/90 text-amber-300 text-[10px] sm:text-xs font-black tracking-widest uppercase border border-amber-400/80 shadow-md flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
            <span>{label}</span>
          </div>
        </div>
      )}

      {/* Top Left Rank & Suit Pip */}
      <div className={`flex flex-col items-center leading-none z-10 ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono text-2xl sm:text-4xl tracking-tighter drop-shadow-sm">{card.rank}</span>
        <span className="text-xl sm:text-3xl font-black -mt-1 drop-shadow-sm">{suitSymbol}</span>
      </div>

      {/* Center 8K High Definition Court Emblem / Pip */}
      <div className="relative my-auto flex flex-col items-center justify-center z-10">
        {['K', 'Q', 'J'].includes(card.rank) ? (
          <div className={`relative flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-b from-amber-500/10 via-slate-100/50 to-amber-500/10 border border-amber-400/30 ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
            <Crown className="w-14 h-14 sm:w-24 sm:h-24 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)] animate-pulse" />
            <div className="text-xs sm:text-sm font-black font-mono tracking-widest text-slate-800 uppercase mt-1">
              {card.rank === 'K' ? 'ROYAL KING' : card.rank === 'Q' ? 'ROYAL QUEEN' : 'ROYAL JACK'}
            </div>
            <div className="text-xl sm:text-2xl font-black mt-0.5">{suitSymbol}</div>
          </div>
        ) : card.rank === 'A' ? (
          <div className={`relative flex flex-col items-center justify-center ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
            <div className="relative">
              <span className="text-6xl sm:text-8xl font-black drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]">
                {suitSymbol}
              </span>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 text-amber-400 animate-bounce" />
            </div>
            <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-slate-700 mt-1 font-mono">
              ACE OF {card.suit.toUpperCase()}
            </span>
          </div>
        ) : (
          <div className={`relative flex flex-col items-center justify-center ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
            <span className="text-5xl sm:text-7xl font-black drop-shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
              {suitSymbol}
            </span>
            <div className="flex items-center gap-1 mt-1 font-mono font-black text-xs sm:text-sm opacity-80">
              <span>{card.rank}</span>
              <span>OF</span>
              <span>{card.suit.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* BETGURU 8K Hologram Watermark Seal */}
        <div className="absolute -bottom-5 opacity-20 font-black font-mono text-[9px] sm:text-[11px] tracking-[0.3em] text-slate-900 pointer-events-none">
          ★ 8K ULTRA HD CASINO ★
        </div>
      </div>

      {/* Bottom Right Inverted Rank & Suit Pip */}
      <div className={`flex flex-col items-center leading-none rotate-180 z-10 ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono text-2xl sm:text-4xl tracking-tighter drop-shadow-sm">{card.rank}</span>
        <span className="text-xl sm:text-3xl font-black -mt-1 drop-shadow-sm">{suitSymbol}</span>
      </div>

      {/* Winner Floating Crown & Sparkle Badge */}
      {isWinning && (
        <div className="absolute bottom-2 right-2 z-20">
          <div className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 text-[9px] sm:text-[11px] font-black font-mono shadow-lg flex items-center gap-1 border border-yellow-200">
            <Sparkles className="w-3 h-3 text-slate-950" />
            <span>WINNER</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const Card8KSpotlightModal: React.FC<Card8KSpotlightModalProps> = ({
  isOpen,
  data,
  onClose,
  autoCloseDurationMs = 2200,
}) => {
  const [progress, setProgress] = useState<number>(100);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const timerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Trigger when modal opens or new data arrives
  useEffect(() => {
    if (!isOpen || !data) {
      setProgress(100);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    // Play distinct winning music fanfare immediately on popup reveal
    if (data.gameType === 'dragon_tiger') {
      soundFx.playDragonTigerWinFanfare();
    } else if (data.gameType === 'andar_bahar') {
      soundFx.playAndarBaharWinFanfare();
    }

    const startTime = performance.now();

    // 1. Guaranteed timeout to auto-close
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
    }, autoCloseDurationMs);

    // 2. Smooth UI Progress Bar using requestAnimationFrame
    const updateProgress = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / autoCloseDurationMs) * 100);
      setProgress(pct);

      if (elapsed < autoCloseDurationMs) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, data?.gameType, data?.winningCard?.rank, data?.winningCard?.suit, autoCloseDurationMs]);

  if (!isOpen || !data) return null;

  // Determine Title, Subtitle, and Theme Colors
  let titleBengali = '';
  let titleEnglish = '';
  let themeAura = 'from-amber-500/20 via-yellow-500/10 to-transparent';
  let badgeColor = 'bg-amber-500 text-slate-950';
  let cardGlow: 'red' | 'cyan' | 'emerald' | 'amber' | 'gold' = 'gold';

  if (data.gameType === 'dragon_tiger') {
    if (data.winner === 'dragon') {
      titleBengali = '🐉 ড্রাগন জয়ী!';
      titleEnglish = 'DRAGON WINS';
      themeAura = 'from-red-600/35 via-rose-900/20 to-transparent';
      badgeColor = 'bg-gradient-to-r from-red-600 to-rose-700 text-white';
      cardGlow = 'red';
    } else if (data.winner === 'tiger') {
      titleBengali = '🐅 টাইগার জয়ী!';
      titleEnglish = 'TIGER WINS';
      themeAura = 'from-cyan-600/35 via-blue-900/20 to-transparent';
      badgeColor = 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950';
      cardGlow = 'cyan';
    } else if (data.isSuitedTie) {
      titleBengali = '👑 সুটেড টাই! ৫০ গুণ পেআউট!';
      titleEnglish = 'SUITED TIE • 50:1 PAYOUT';
      themeAura = 'from-amber-500/40 via-purple-900/25 to-transparent';
      badgeColor = 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-slate-950';
      cardGlow = 'gold';
    } else {
      titleBengali = '🤝 টাই! ১১ গুণ পেআউট!';
      titleEnglish = 'TIE GAME • 11:1 PAYOUT';
      themeAura = 'from-amber-500/30 via-slate-900/40 to-transparent';
      badgeColor = 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950';
      cardGlow = 'amber';
    }
  } else {
    // Andar Bahar
    if (data.winner === 'andar') {
      titleBengali = '🟢 আন্দার জয়ী!';
      titleEnglish = `ANDAR WINS (Card #${data.totalCardsDealt || 1})`;
      themeAura = 'from-emerald-600/35 via-emerald-950/30 to-transparent';
      badgeColor = 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950';
      cardGlow = 'emerald';
    } else {
      titleBengali = '🔵 বাহার জয়ী!';
      titleEnglish = `BAHAR WINS (Card #${data.totalCardsDealt || 1})`;
      themeAura = 'from-blue-600/35 via-indigo-950/30 to-transparent';
      badgeColor = 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white';
      cardGlow = 'cyan';
    }
  }

  const primaryCard = data.winningCard || data.matchingCard || (data.winner === 'dragon' ? data.dragonCard : data.tigerCard) || data.jokerCard;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Deep Backdrop with Radial Glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Rotating 3D Radial Sunburst Background */}
        <div className={`absolute inset-0 bg-gradient-to-radial ${themeAura} pointer-events-none animate-[pulse_3s_infinite]`} />
        
        {/* Left & Right Flanking Confetti / Fireworks Particles */}
        <div className="absolute inset-x-4 top-1/4 flex justify-between pointer-events-none">
          <div className="w-16 h-48 bg-gradient-to-b from-amber-400/30 to-transparent blur-2xl animate-bounce" />
          <div className="w-16 h-48 bg-gradient-to-b from-amber-400/30 to-transparent blur-2xl animate-bounce" />
        </div>

        {/* Main 8K Reveal Container */}
        <motion.div
          initial={{ scale: 0.6, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.7, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="relative z-10 flex flex-col items-center max-w-lg w-full text-center"
        >
          {/* Header Banner */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-4 space-y-1.5"
          >
            <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-wider uppercase shadow-2xl border border-white/20 ${badgeColor}`}>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{titleBengali}</span>
              <span className="opacity-75">|</span>
              <span>{titleEnglish}</span>
            </div>

            {/* Subtitle / Bet result */}
            {data.userWonAmount !== undefined && data.userWonAmount > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-amber-400 font-black text-sm sm:text-lg drop-shadow-[0_2px_8px_rgba(245,158,11,0.8)]"
              >
                🎉 আপনি জিতেছেন: ₹{data.userWonAmount.toLocaleString('en-IN')}!
              </motion.div>
            )}
          </motion.div>

          {/* Card Presentation Area */}
          <div className="relative flex items-center justify-center gap-3 sm:gap-6 my-2">
            {/* Dragon Tiger Dual Card View */}
            {data.gameType === 'dragon_tiger' && data.dragonCard && data.tigerCard ? (
              <div className="flex items-center gap-2 sm:gap-5">
                {/* Dragon Card */}
                <div className={`flex flex-col items-center ${data.winner === 'dragon' || data.winner === 'tie' || data.winner === 'suited_tie' ? 'scale-105 sm:scale-110 z-20' : 'scale-90 opacity-60'}`}>
                  <Ultra8KPlayingCard
                    card={data.dragonCard}
                    isWinning={data.winner === 'dragon' || data.winner === 'tie' || data.winner === 'suited_tie'}
                    label="DRAGON"
                    glowTheme={data.winner === 'dragon' ? 'red' : 'gold'}
                  />
                  <span className="text-[11px] sm:text-xs font-black text-red-400 uppercase tracking-widest mt-2">
                    🐉 DRAGON
                  </span>
                </div>

                {/* VS Emblem */}
                <div className="flex flex-col items-center justify-center px-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 border-2 border-amber-400 text-amber-300 font-black text-xs sm:text-sm flex items-center justify-center shadow-2xl">
                    VS
                  </div>
                </div>

                {/* Tiger Card */}
                <div className={`flex flex-col items-center ${data.winner === 'tiger' || data.winner === 'tie' || data.winner === 'suited_tie' ? 'scale-105 sm:scale-110 z-20' : 'scale-90 opacity-60'}`}>
                  <Ultra8KPlayingCard
                    card={data.tigerCard}
                    isWinning={data.winner === 'tiger' || data.winner === 'tie' || data.winner === 'suited_tie'}
                    label="TIGER"
                    glowTheme={data.winner === 'tiger' ? 'cyan' : 'gold'}
                  />
                  <span className="text-[11px] sm:text-xs font-black text-cyan-400 uppercase tracking-widest mt-2">
                    🐅 TIGER
                  </span>
                </div>
              </div>
            ) : data.gameType === 'andar_bahar' && data.jokerCard && data.matchingCard ? (
              /* Andar Bahar Joker + Match Comparison */
              <div className="flex items-center gap-3 sm:gap-6">
                {/* Joker Card */}
                <div className="flex flex-col items-center scale-95 opacity-85">
                  <Ultra8KPlayingCard
                    card={data.jokerCard}
                    isWinning={false}
                    label="JOKER TRUMP"
                    glowTheme="amber"
                  />
                  <span className="text-[11px] sm:text-xs font-black text-amber-400 uppercase tracking-widest mt-2">
                    🃏 JOKER CARD
                  </span>
                </div>

                {/* Match Sparkle Icon */}
                <div className="flex flex-col items-center justify-center">
                  <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-bounce drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-300 uppercase tracking-wider font-mono">
                    MATCH!
                  </span>
                </div>

                {/* Winning Dealt Card */}
                <div className="flex flex-col items-center scale-105 sm:scale-110 z-20">
                  <Ultra8KPlayingCard
                    card={data.matchingCard}
                    isWinning={true}
                    label={data.winner.toUpperCase()}
                    glowTheme={data.winner === 'andar' ? 'emerald' : 'cyan'}
                  />
                  <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest mt-2 ${data.winner === 'andar' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {data.winner === 'andar' ? '🟢 ANDAR (WINNER)' : '🔵 BAHAR (WINNER)'}
                  </span>
                </div>
              </div>
            ) : primaryCard ? (
              /* Single Spotlight Winning Card */
              <Ultra8KPlayingCard
                card={primaryCard}
                isWinning={true}
                label={data.winner.toUpperCase()}
                glowTheme={cardGlow}
              />
            ) : null}
          </div>

          {/* 2-Second Countdown Progress Bar */}
          <div className="w-64 sm:w-80 mt-4 bg-slate-900/80 rounded-full h-1.5 sm:h-2 overflow-hidden border border-white/10 p-0.5 shadow-inner">
            <motion.div
              className={`h-full rounded-full ${
                cardGlow === 'red' ? 'bg-red-500' :
                cardGlow === 'cyan' ? 'bg-cyan-400' :
                cardGlow === 'emerald' ? 'bg-emerald-400' :
                'bg-amber-400'
              }`}
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          <div className="mt-1 flex items-center justify-between w-64 sm:w-80 text-[9px] text-slate-400 font-mono font-semibold">
            <span>8K HD REVEAL</span>
            <span>অটো ক্লোজ হচ্ছে...</span>
          </div>

          {/* Manual Dismiss Button */}
          <button
            onClick={onClose}
            className="mt-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1 px-3"
          >
            <X className="w-3.5 h-3.5" />
            <span>বন্ধ করুন (Close)</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
