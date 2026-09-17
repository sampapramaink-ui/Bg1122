import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Zap, Gift, Trophy, Wallet, ShieldCheck, Play, ArrowRight, Star, Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BannerSlide, BannerCategory } from '../types';
import { soundFx } from '../utils/audio';
import {
  bannerAviator8k,
  bannerAndarBahar8k,
  bannerDragonTiger8k,
  bannerSupercar8k,
  bannerDepositBonus8k,
  bannerLotteryMega8k,
  bannerRoulette8k,
  bannerFerrari8k
} from '../assets/sliderBanners';

interface PromotionalSliderProps {
  category?: BannerCategory;
  slides?: BannerSlide[];
  title?: string;
  onAction?: (actionType: string, targetUrl?: string) => void;
}

// 8K Ultra-Realistic High-Converting Default Banner Slides
export const DEFAULT_BANNER_SLIDES: BannerSlide[] = [
  // 1. Aviator Crash 8K Multiplier Slide
  {
    id: 'default-aviator-crash-8k',
    category: 'supercar',
    title: '✈️ AVIATOR CRASH 8K • 500X MULTIPLIER',
    subtitle: 'Cash out before the supersonic jet crashes! Instant real-time multiplayer payouts with 99% RTP.',
    imageUrl: bannerAviator8k,
    actionType: 'crash',
    badgeText: '🔥 HOT 500X',
    bgGradient: 'from-rose-950/95 via-slate-950/85 to-amber-950/60',
    active: true,
    order: 1
  },

  // 2. 3 Super Car Live VIP Jackpot Slide
  {
    id: 'default-supercar-vip-8k',
    category: 'supercar',
    title: '🏎️ 3 SUPER CAR LIVE VIP JACKPOT',
    subtitle: 'Win 2.8x instant cash payout every 10 minutes on Red, Black or Yellow Luxury Super Cars!',
    imageUrl: bannerSupercar8k,
    actionType: 'supercar',
    badgeText: '⚡ 2.8X PAYOUT',
    bgGradient: 'from-amber-600/95 via-red-950/90 to-slate-950/70',
    active: true,
    order: 2
  },

  // 3. Live Andar Bahar HD 8K Card Table Slide
  {
    id: 'default-andar-bahar-8k',
    category: 'supercar',
    title: '🎴 ANDAR BAHAR 8K ROYAL CASINO',
    subtitle: 'Match the Joker Card on Andar or Bahar for instant 2.0x real cash payouts with Live HD Dealers!',
    imageUrl: bannerAndarBahar8k,
    actionType: 'andar_bahar',
    badgeText: '👑 ROYAL JOKER',
    bgGradient: 'from-emerald-950/95 via-slate-950/90 to-amber-950/60',
    active: true,
    order: 3
  },

  // 4. Dragon Tiger 8K Macau VIP Slide
  {
    id: 'default-dragon-tiger-8k',
    category: 'supercar',
    title: '🐉 DRAGON vs TIGER 8K LIVE',
    subtitle: 'High-card showdown with 50:1 Suited Tie bonus payouts. Fast 15-second lightning rounds!',
    imageUrl: bannerDragonTiger8k,
    actionType: 'dragon_tiger',
    badgeText: '⚡ 50:1 SUITED TIE',
    bgGradient: 'from-red-950/95 via-purple-950/90 to-slate-950/70',
    active: true,
    order: 4
  },

  // 5. 100% Instant First Deposit Bonus 8K Slide
  {
    id: 'default-deposit-bonus-8k',
    category: 'deposit',
    title: '💰 100% INSTANT FIRST DEPOSIT BONUS',
    subtitle: 'Deposit ₹500+ via PhonePe, GPay, Paytm or Crypto & get 100% double cash bonus + VIP Spin Credits!',
    imageUrl: bannerDepositBonus8k,
    actionType: 'deposit',
    badgeText: '💎 100% CASH MATCH',
    bgGradient: 'from-emerald-900/95 via-teal-950/90 to-slate-950/70',
    active: true,
    order: 1
  },

  // 6. 4D Express & Mega Bumper Draws 8K Slide
  {
    id: 'default-lottery-mega-8k',
    category: 'lottery',
    title: '🎟️ ₹2,50,000 MEGA BUMPER LOTTERY',
    subtitle: 'Match 4 lucky digits to win the grand bumper prize pool! 100% provably fair live draws.',
    imageUrl: bannerLotteryMega8k,
    actionType: 'lottery',
    badgeText: '🌟 ₹2.5 LAKH PRIZE',
    bgGradient: 'from-amber-700/95 via-yellow-950/90 to-slate-950/70',
    active: true,
    order: 1
  },

  // 7. Daily Speed 1-Min Lottery Slide
  {
    id: 'default-lottery-speed-8k',
    category: 'lottery',
    title: '⚡ SPEED 1-MIN LIVE LOTTERY',
    subtitle: 'Tickets starting at just ₹10 with lightning-fast 60-second transparent draw rounds!',
    imageUrl: bannerFerrari8k,
    actionType: 'lottery',
    badgeText: '⏱️ 1-MIN ROUNDS',
    bgGradient: 'from-blue-950/95 via-indigo-950/90 to-slate-950/70',
    active: true,
    order: 2
  },

  // 8. Daily VIP Lucky Wheel Spin Slide
  {
    id: 'default-offers-wheel-8k',
    category: 'offers',
    title: '🎡 DAILY VIP LUCKY WHEEL & SPIN',
    subtitle: 'Spin the fortune wheel every 24 hours to claim up to ₹5,000 in free real cash bonus multipliers!',
    imageUrl: bannerRoulette8k,
    actionType: 'wheel',
    badgeText: '🎁 FREE DAILY SPIN',
    bgGradient: 'from-purple-950/95 via-amber-950/90 to-slate-950/70',
    active: true,
    order: 1
  }
];

export const PromotionalSlider: React.FC<PromotionalSliderProps> = React.memo(({
  category,
  slides,
  title,
  onAction
}) => {
  // Filter active slides matching current category if provided, or all active slides
  const filtered = (slides || []).filter((s) => (!category || s.category === category) && s.active);
  const activeSlides = filtered.length > 0
    ? [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0))
    : (category ? DEFAULT_BANNER_SLIDES.filter((s) => s.category === category) : DEFAULT_BANNER_SLIDES);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<number>(1); // 1 = forward, -1 = backward
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SLIDE_DURATION = 5000; // 5 seconds per slide

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  }, [activeSlides.length]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  }, [activeSlides.length]);

  const goToSlide = (idx: number) => {
    try { soundFx.playClick(); } catch (_) {}
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  };

  // Ultra-lightweight slide timer: pure 5000ms interval (0 intermediate CPU ticks)
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    if (isHovered) return;

    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION);

    return () => clearInterval(timer);
  }, [activeSlides.length, isHovered, nextSlide, currentIndex]);

  if (activeSlides.length === 0) return null;

  const currentSlide = activeSlides[currentIndex % activeSlides.length];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { soundFx.playClick(); } catch (_) {}
    prevSlide();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    try { soundFx.playClick(); } catch (_) {}
    nextSlide();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    // Only swipe if horizontal drag is dominant
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX > 0) {
        // Swiped Left -> Next Slide
        try { soundFx.playClick(); } catch (_) {}
        nextSlide();
      } else {
        // Swiped Right -> Prev Slide
        try { soundFx.playClick(); } catch (_) {}
        prevSlide();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'crash': return 'Fly & Cash Out';
      case 'deposit': return 'Deposit & Claim';
      case 'supercar': return 'Play Super Car';
      case 'lottery': return 'Buy Lottery';
      case 'wheel': return 'Spin Lucky Wheel';
      case 'roulette': return 'Play Live Roulette';
      case 'andar_bahar': return 'Play Andar Bahar';
      case 'dragon_tiger': return 'Play Dragon Tiger';
      case 'withdrawal': return 'Withdraw Cash';
      default: return 'Claim Offer';
    }
  };

  // Animation variants for buttery-smooth sliding & scaling
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 120 : -120,
      opacity: 0,
      scale: 0.96
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 },
        scale: { duration: 0.4 }
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -120 : 120,
      opacity: 0,
      scale: 0.96,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 }
      }
    })
  };

  return (
    <div className="space-y-2.5 select-none">
      {/* Title & Live Counter Header */}
      {title && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-amber-400 tracking-wider uppercase flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{title}</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {currentIndex + 1} of {activeSlides.length}
            </span>
          </div>
        </div>
      )}

      {/* Main Luxury 8K Banner Slider Container with Rainbow Halo & Soft Shadow */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          try { soundFx.playClick(); } catch (_) {}
          onAction?.(currentSlide.actionType, currentSlide.targetUrl);
        }}
        className="relative w-full h-48 sm:h-56 md:h-64 rounded-3xl overflow-hidden cursor-pointer shadow-[0_12px_36px_rgba(0,0,0,0.6)] border border-amber-500/30 group transition-all duration-300 hover:border-amber-400 hover:shadow-[0_16px_48px_rgba(245,158,11,0.25)] bg-slate-950"
      >
        {/* Animated Slide Content via AnimatePresence */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentSlide.id || currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 w-full h-full"
          >
            {/* Background 8K Realistic Image with Smooth Scale Zoom */}
            <img
              src={currentSlide.imageUrl}
              alt={currentSlide.title}
              loading="eager"
              decoding="sync"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000 ease-out group-hover:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).src = bannerSupercar8k;
              }}
            />

            {/* Cinematic Gradient Overlays for Guaranteed High-Contrast Legibility */}
            <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.bgGradient || 'from-slate-950/95 via-slate-950/80 to-transparent'}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-black/40 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_65%)] pointer-events-none" />

            {/* Inner Content Layer */}
            <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between z-10 font-mono">
              
              {/* Top Row: Floating Neon Badges & Live Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {currentSlide.badgeText ? (
                    <div className="px-3 py-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[10px] sm:text-xs tracking-wider rounded-xl uppercase shadow-lg shadow-amber-500/30 flex items-center gap-1.5 border border-amber-200/90 animate-pulse">
                      <Zap className="w-3.5 h-3.5 fill-slate-950" />
                      <span>{currentSlide.badgeText}</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-slate-900/90 backdrop-blur-md text-amber-300 font-black text-[10px] rounded-xl border border-amber-500/40 shadow-md flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>SPECIAL VIP</span>
                    </div>
                  )}

                  <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-slate-300 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>8K REAL-TIME</span>
                  </div>
                </div>

                {/* Top Right Live Tag */}
                <div className="flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur-md border border-amber-500/30 rounded-xl text-[10px] text-amber-300 font-bold group-hover:border-amber-400 group-hover:text-amber-200 transition-colors shadow-md">
                  <Flame className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                  <span>BETGURU EXCLUSIVE</span>
                </div>
              </div>

              {/* Middle Row: Grand Typography with Glow & Subtitle */}
              <div className="space-y-1.5 max-w-xl pr-4">
                <h2 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide">
                  {currentSlide.title}
                </h2>
                {currentSlide.subtitle && (
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] opacity-95">
                    {currentSlide.subtitle}
                  </p>
                )}
              </div>

              {/* Bottom Row: High-Conversion Action Button & Dynamic Slider Indicators */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    try { soundFx.playClick(); } catch (_) {}
                    onAction?.(currentSlide.actionType, currentSlide.targetUrl);
                  }}
                  className="px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-amber-500/30 transition-all transform active:scale-95 flex items-center gap-2 border border-amber-200/90 group/btn"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{getActionLabel(currentSlide.actionType)}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                </button>

                {/* Progress Indicators & Interactive Dots */}
                {activeSlides.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-amber-500/20 shadow-md">
                    {activeSlides.map((_, idx) => {
                      const isActive = idx === currentIndex;
                      return (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            goToSlide(idx);
                          }}
                          className={`relative h-2 rounded-full transition-all duration-300 overflow-hidden ${
                            isActive ? 'w-8 bg-amber-950/80 border border-amber-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                          }`}
                          title={`Slide ${idx + 1}`}
                        >
                          {isActive && (
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full w-full"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        </AnimatePresence>

        {/* Previous Slide Arrow Button */}
        {activeSlides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-amber-500/30 text-amber-300 hover:text-white hover:border-amber-400 transition-all duration-200 opacity-0 group-hover:opacity-100 z-20 shadow-xl backdrop-blur-md"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Next Slide Arrow Button */}
            <button
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-amber-500/30 text-amber-300 hover:text-white hover:border-amber-400 transition-all duration-200 opacity-0 group-hover:opacity-100 z-20 shadow-xl backdrop-blur-md"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
