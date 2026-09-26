import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Volume2, VolumeX, Sparkles, HelpCircle, History,
  RotateCcw, Zap, CheckCircle2, ChevronRight, Crown,
  TrendingUp, ShieldCheck, Plus, AlertTriangle, Layers, Award,
  Flame, RefreshCw, Maximize2, Minimize2, Ticket, Wallet, Gift,
  Clock, X, ChevronDown, Check, Car, Info, Lock
} from 'lucide-react';
import {
  User,
  SuperCarColor,
  SuperCarDrawIssue,
  SuperCarConfig,
  PurchasedTicket,
  BonusBalanceRules,
  WalletTransaction
} from '../types';
import {
  SUPER_CARS,
  getSuperCarInfo,
  getCurrentSuperCarSchedule,
  formatCountdown,
  SuperCarSlotItem,
  getSlotFromTicket,
  getWinningCarForSlot
} from '../utils/supercar';
import { calculateSuperCarLiveBettingStats, SuperCarLivePoolData } from '../utils/supercarBettingEngine';
import { soundFx } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import { SuperCarResultsModal } from './SuperCarResultsModal';

interface SuperCarArenaGameProps {
  user: User;
  userBonusBalance?: number;
  bonusRules?: BonusBalanceRules;
  config: SuperCarConfig;
  currentIssue: SuperCarDrawIssue | null;
  userTickets: PurchasedTicket[];
  pastDraws: SuperCarDrawIssue[];
  livePools?: Record<string, SuperCarLivePoolData>;
  initialSelectedCar?: SuperCarColor;
  onConfirmBuyTicket: (
    carColor: SuperCarColor,
    quantity: number,
    totalCost: number,
    issueId?: string,
    slotNum?: number,
    walletType?: 'main' | 'bonus'
  ) => void;
  onDrawResolved?: (issueId: string, winningCar: SuperCarColor) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
}

export const SuperCarArenaGame: React.FC<SuperCarArenaGameProps> = ({
  user,
  userBonusBalance = 0,
  bonusRules,
  config,
  currentIssue,
  userTickets,
  pastDraws,
  livePools,
  initialSelectedCar = 'red',
  onConfirmBuyTicket,
  onDrawResolved,
  onClose,
  onOpenDeposit
}) => {
  const [selectedCar, setSelectedCar] = useState<SuperCarColor>(initialSelectedCar || 'red');
  const [quantity, setQuantity] = useState<number>(1);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getMuted?.() ?? false);
  const [isBuying, setIsBuying] = useState<boolean>(false);
  const [buySuccessMessage, setBuySuccessMessage] = useState<string | null>(null);
  const [restrictionWarning, setRestrictionWarning] = useState<string | null>(null);

  // Auto-dismiss restriction toast
  useEffect(() => {
    if (restrictionWarning) {
      const timer = setTimeout(() => setRestrictionWarning(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [restrictionWarning]);

  // Live Timer & Schedule
  const configRef = useRef(config);
  configRef.current = config;
  const [scheduleInfo, setScheduleInfo] = useState(() => getCurrentSuperCarSchedule(config));
  const [shufflingIndex, setShufflingIndex] = useState<number>(0);
  const [winningCarAnnounced, setWinningCarAnnounced] = useState<SuperCarColor | null>(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState<boolean>(false);
  const [lastResolvedIssueId, setLastResolvedIssueId] = useState<string>('');

  const carsList: SuperCarColor[] = ['red', 'black', 'yellow'];

  // Real vs Bonus Unit Pricing Calculation
  const realUnitPrice = config.carPrices?.[selectedCar] || config.ticketPrice || 100;
  const effectiveBonusPrice = config.bonusCarPrices?.[selectedCar] || config.bonusTicketPrice || bonusRules?.superCarBonusTicketPrice || realUnitPrice;

  // Flexible Wallet Selection: Main Cash (Real Balance) by default, or Bonus Wallet if desired/enabled
  const [walletType, setWalletType] = useState<'main' | 'bonus'>(() => {
    if (config.bonusOnly === true) return 'bonus';
    if ((user?.balance || 0) >= (config.carPrices?.[selectedCar] || config.ticketPrice || 100)) return 'main';
    if (userBonusBalance >= effectiveBonusPrice) return 'bonus';
    return 'main';
  });

  const effectiveWalletBalance = walletType === 'bonus' ? userBonusBalance : (user?.balance || 0);
  const currentUnitPrice = walletType === 'bonus' ? effectiveBonusPrice : realUnitPrice;
  const activeMultiplier = config.carMultipliers?.[selectedCar] || config.prizeMultiplier || 2.8;

  const totalCost = quantity * currentUnitPrice;
  const potentialWin = Math.round(totalCost * activeMultiplier);
  const hasEnoughBalance = effectiveWalletBalance >= totalCost;

  // Helper to determine the authoritative winning car via getWinningCarForSlot
  const getAdminWinningCar = (): SuperCarColor => {
    return getWinningCarForSlot(
      scheduleInfo.drawIndex,
      scheduleInfo.issueId,
      pastDraws,
      config,
      userTickets,
      livePools?.[scheduleInfo.issueId]
    );
  };

  // Synchronized 1000ms ticker for live countdown and draw resolution
  useEffect(() => {
    const timer = setInterval(() => {
      const cfg = configRef.current;
      const updatedSchedule = getCurrentSuperCarSchedule(cfg);
      setScheduleInfo(updatedSchedule);

      // Shuffling mode during final 30 seconds
      if (updatedSchedule.isShuffling) {
        setShufflingIndex((prev) => (prev + 1) % 3);
        if (updatedSchedule.timeRemainingMs <= 10000 && updatedSchedule.timeRemainingMs > 1000) {
          try {
            soundFx.playCountdownBeep();
          } catch (_) {}
        }
      }

      // Draw transition triggered
      if (updatedSchedule.timeRemainingMs <= 1000 && !showWinnerAnimation && updatedSchedule.issueId !== lastResolvedIssueId) {
        const winningCar = getAdminWinningCar();
        setWinningCarAnnounced(winningCar);
        setShowWinnerAnimation(true);
        setLastResolvedIssueId(updatedSchedule.issueId);

        try {
          soundFx.playWinFanfare();
          triggerConfetti();
        } catch (_) {}

        if (onDrawResolved) {
          onDrawResolved(updatedSchedule.issueId, winningCar);
        }

        setTimeout(() => {
          setShowWinnerAnimation(false);
        }, 12000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config, lastResolvedIssueId, showWinnerAnimation, onDrawResolved]);

  // Audio Toggle
  const handleToggleMute = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  // Buy Ticket Handler
  const handleBuy = () => {
    if (isDrawClosed) {
      alert('বেটিং সময় সমাপ্ত! ড্র সম্পন্ন হওয়ার ৩০ সেকেন্ড পূর্বে বেটিং বন্ধ থাকে। অনুগ্রহ করে পরবর্তী রাউন্ডের জন্য অপেক্ষা করুন।');
      return;
    }

    if (isCarRestricted(selectedCar)) {
      soundFx.playError();
      const opp = selectedCar === 'black' ? 'লাল (Red)' : 'কালো (Black)';
      const cur = selectedCar === 'black' ? 'কালো (Black)' : 'লাল (Red)';
      setRestrictionWarning(`⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে ${opp} গাড়িতে টিকিট কেটেছেন। ${cur} কেনা যাবে না (হলুদের সাথে কেনা যাবে)।`);
      return;
    }

    if (!hasEnoughBalance || isBuying) return;

    setIsBuying(true);
    soundFx.playClick();

    setTimeout(() => {
      onConfirmBuyTicket(
        selectedCar,
        quantity,
        totalCost,
        scheduleInfo.issueId,
        scheduleInfo.drawIndex,
        walletType
      );
      setIsBuying(false);
      setBuySuccessMessage(`✅ ${quantity}x ${selectedCar.toUpperCase()} Ticket(s) Purchased Successfully!`);
      triggerConfetti();

      setTimeout(() => {
        setBuySuccessMessage(null);
      }, 4000);
    }, 400);
  };

  // Active tickets for this specific round/issue
  const currentRoundTickets = useMemo(() => {
    return userTickets.filter((t) => {
      return (
        t.category === 'Three Super Car Draw' &&
        (
          t.drawId === scheduleInfo.issueId ||
          (t as any).issueId === scheduleInfo.issueId ||
          t.slotNum === scheduleInfo.drawIndex ||
          (t as any).slotNumber === scheduleInfo.drawIndex ||
          (t as any).slot === scheduleInfo.drawIndex ||
          t.status === 'active'
        )
      );
    });
  }, [userTickets, scheduleInfo.issueId, scheduleInfo.drawIndex]);

  // Check if tickets for Red or Black exist in active round
  const hasBoughtRedInActiveRound = useMemo(() => {
    return currentRoundTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'red';
    });
  }, [currentRoundTickets]);

  const hasBoughtBlackInActiveRound = useMemo(() => {
    return currentRoundTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'black';
    });
  }, [currentRoundTickets]);

  // Opposite betting rule: Red & Yellow allowed, Black & Yellow allowed, Red & Black prohibited
  const isCarRestricted = (car: SuperCarColor) => {
    if (car === 'black' && hasBoughtRedInActiveRound) return true;
    if (car === 'red' && hasBoughtBlackInActiveRound) return true;
    return false;
  };

  // Auto-switch selected car if current choice becomes restricted
  useEffect(() => {
    if (selectedCar === 'black' && hasBoughtRedInActiveRound) {
      setSelectedCar('yellow');
    } else if (selectedCar === 'red' && hasBoughtBlackInActiveRound) {
      setSelectedCar('yellow');
    }
  }, [hasBoughtRedInActiveRound, hasBoughtBlackInActiveRound, selectedCar]);

  // Recent 8 draw results for quick bead road
  const recentResults = useMemo(() => {
    return pastDraws.slice(0, 10);
  }, [pastDraws]);

  const isDrawClosed = !scheduleInfo.isOpen || scheduleInfo.timeRemainingMs <= 30000 || scheduleInfo.isBettingClosed;

  return (
    <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-[#020617] text-white flex flex-col overflow-hidden select-none font-sans">
      
      {/* Background Ambient Glow FX */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-rose-600/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/3 right-0 w-80 h-80 bg-yellow-500/10 blur-[130px] rounded-full" />
      </div>

      {/* COMPACT RESTRICTION WARNING TOAST */}
      {restrictionWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 max-w-md text-center">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{restrictionWarning}</span>
          <button onClick={() => setRestrictionWarning(null)} className="text-white/60 hover:text-white ml-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* TOP NAVIGATION / STATUS BAR */}
      <header className="shrink-0 h-14 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 text-xs font-mono font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">LOBBY</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-red-600 flex items-center justify-center shadow-md shadow-rose-500/20">
              <span className="text-sm">🏎️</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black font-mono tracking-wider text-white">
                  3 SUPER CAR LIVE
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-mono font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  LIVE
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block -mt-0.5">
                Slot #{String(scheduleInfo.drawIndex).padStart(2, '0')} • #{scheduleInfo.issueId}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header: Balances & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Main Balance Pill */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/90 border border-amber-500/40 shadow-inner">
            <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="text-left font-mono">
              <span className="text-[8px] text-slate-400 uppercase block font-bold leading-none">Main</span>
              <span className="text-xs sm:text-sm font-black text-amber-300 leading-tight">
                ₹{user.balance.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onOpenDeposit();
              }}
              className="ml-1 p-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Deposit Funds"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>

          {/* Bonus Balance Pill (if bonus exists or allowed) */}
          {userBonusBalance > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 font-mono">
              <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="text-left">
                <span className="text-[8px] text-purple-300 uppercase block font-bold leading-none">Bonus</span>
                <span className="text-xs font-black text-purple-200 leading-tight">
                  ₹{userBonusBalance.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          )}

          {/* Results Modal Button */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsResultsOpen(true);
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Draw History & Results"
          >
            <History className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Audio Mute Toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Help / Game Rules */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsHelpOpen(true);
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Rules & Payouts"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </header>

      {/* SUCCESS TOAST ALERT */}
      {buySuccessMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-slate-950 font-mono font-black text-xs rounded-xl shadow-2xl shadow-emerald-500/50 border border-emerald-300 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{buySuccessMessage}</span>
        </div>
      )}

      {/* MAIN ARENA SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
        
        {/* 1. CINEMATIC LIVE TRACK & LIVE COUNTDOWN STAGE */}
        <section className="relative rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-amber-500/30 overflow-hidden shadow-2xl p-4 sm:p-6">
          
          {/* Animated Track Neon Lines */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
            <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
          </div>

          {/* Stage Top Bar: Schedule & Live Timer */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black font-mono text-white flex items-center gap-2">
                  <span>3 SUPER CAR GRAND ARENA</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black">
                    2.8X PAYOUT
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Pick the winning supercar before timer ends. Result draws every 10 minutes!
                </p>
              </div>
            </div>

            {/* Glowing Live Countdown Badge */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-inner font-mono">
              <Clock className={`w-5 h-5 ${scheduleInfo.timeRemainingMs <= 30000 ? 'text-rose-500 animate-spin' : 'text-amber-400'}`} />
              <div className="text-right">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  {scheduleInfo.isShuffling ? 'DRAW IN PROGRESS' : 'NEXT DRAW IN'}
                </span>
                <span className={`text-base sm:text-lg font-black tracking-widest ${
                  scheduleInfo.timeRemainingMs <= 30000 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                }`}>
                  {scheduleInfo.isOpen ? formatCountdown(scheduleInfo.timeRemainingMs) : '08:00 AM'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. 3D SUPER CARS LIVE SHOWCASE (Interactive Selection & Live Shuffler) */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 my-4">
            {carsList.map((carKey, idx) => {
              const carInfo = getSuperCarInfo(carKey, config);
              const isSelected = selectedCar === carKey;
              const isShufflingActive = scheduleInfo.isShuffling && shufflingIndex === idx;
              const isAnnouncedWinner = winningCarAnnounced === carKey;
              const multiplier = config.carMultipliers?.[carKey] || config.prizeMultiplier || 2.8;
              const unitCost = walletType === 'bonus'
                ? (config.bonusCarPrices?.[carKey] || config.bonusTicketPrice || config.ticketPrice || 100)
                : (config.carPrices?.[carKey] || config.ticketPrice || 100);

              const isLocked = isCarRestricted(carKey);

              return (
                <div
                  key={carKey}
                  onClick={() => {
                    if (isDrawClosed) return;
                    if (isLocked) {
                      soundFx.playError();
                      const opp = carKey === 'black' ? 'লাল (Red)' : 'কালো (Black)';
                      const cur = carKey === 'black' ? 'কালো (Black)' : 'লাল (Red)';
                      setRestrictionWarning(`⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে ${opp} গাড়িতে বাজি ধরেছেন। ${cur} কেনা যাবে না (হলুদের সাথে কিনতে পারেন)।`);
                      return;
                    }
                    soundFx.playClick();
                    setSelectedCar(carKey);
                  }}
                  className={`group relative rounded-2xl sm:rounded-3xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between ${
                    isLocked
                      ? 'bg-slate-950/80 border-rose-500/40 opacity-70 cursor-not-allowed'
                      : isSelected
                      ? carKey === 'red'
                        ? 'bg-rose-950/80 border-rose-400 ring-4 ring-rose-500/50 shadow-2xl shadow-rose-900/60 scale-[1.02]'
                        : carKey === 'black'
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/50 shadow-2xl shadow-amber-950/80 scale-[1.02]'
                        : 'bg-yellow-950/80 border-yellow-400 ring-4 ring-yellow-400/50 shadow-2xl shadow-yellow-900/60 scale-[1.02]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100 hover:scale-[1.01]'
                  } ${isShufflingActive ? 'ring-4 ring-cyan-400 animate-pulse' : ''} ${
                    isAnnouncedWinner && showWinnerAnimation ? 'ring-8 ring-amber-400 animate-bounce z-20' : ''
                  }`}
                >
                  {/* Opposite Bet Lock Overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center p-3 text-center rounded-2xl sm:rounded-3xl border border-rose-500/60">
                      <div className="p-2.5 rounded-full bg-rose-500/20 text-rose-400 mb-1.5 ring-1 ring-rose-500/40">
                        <Lock className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black font-mono text-rose-300">বিপরীত বাজি লকড</span>
                      <span className="text-[10px] text-slate-300 font-mono mt-1 max-w-[160px] leading-tight">
                        {carKey === 'black' ? 'লালে টিকিট কেনা আছে (হলুদের সাথে কেনা যাবে)' : 'কালোতে টিকিট কেনা আছে (হলুদের সাথে কেনা যাবে)'}
                      </span>
                    </div>
                  )}
                  {/* Top Tags & Multipliers */}
                  <div className="p-3 flex items-center justify-between z-10">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black tracking-wider uppercase shadow-md ${
                      carKey === 'red'
                        ? 'bg-red-600 text-white'
                        : carKey === 'black'
                        ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                        : 'bg-amber-400 text-slate-950'
                    }`}>
                      {carInfo.badge}
                    </span>

                    <span className="px-2 py-0.5 rounded-lg bg-black/80 border border-emerald-500/40 text-emerald-400 font-mono font-black text-xs shadow-md">
                      ⚡ {multiplier}X WIN
                    </span>
                  </div>

                  {/* High-Definition 3D Car Visual */}
                  <div className="relative w-full h-36 sm:h-44 overflow-hidden my-1 bg-black/40">
                    <img
                      src={carInfo.image}
                      alt={carInfo.name}
                      loading="eager"
                      className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />

                    {/* Selected Badge */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg">
                        <CheckCircle2 className="w-5 h-5 stroke-[3]" />
                      </div>
                    )}

                    {/* Winner Glow Overlay */}
                    {isAnnouncedWinner && showWinnerAnimation && (
                      <div className="absolute inset-0 bg-amber-400/30 flex items-center justify-center animate-pulse">
                        <span className="px-4 py-2 bg-amber-400 text-slate-950 font-black font-mono text-sm rounded-xl shadow-2xl tracking-widest uppercase">
                          🏆 ROUND WINNER!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Car Details & Specifications */}
                  <div className="p-3 space-y-2 z-10 bg-slate-950/80 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black font-mono text-white">{carInfo.name}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">{carInfo.tagline}</p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[9px] text-slate-400 block uppercase">Price</span>
                        <span className="text-xs font-black text-amber-300">₹{unitCost}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-slate-300 pt-1">
                      <div className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">Top Speed:</span>
                        <span className="font-bold text-white">{carInfo.topSpeed}</span>
                      </div>
                      <div className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">0-100:</span>
                        <span className="font-bold text-emerald-400">{carInfo.acceleration}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Draw Outcomes Mini Bead Road */}
          <div className="relative z-10 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px] font-bold">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Recent Winners:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {recentResults.map((dr, index) => {
                const winCar = dr.winningCar || 'red';
                return (
                  <div
                    key={dr.id || index}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black uppercase shadow-md ${
                      winCar === 'red'
                        ? 'bg-rose-600 text-white'
                        : winCar === 'black'
                        ? 'bg-slate-800 text-amber-300 border border-amber-500/50'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                    title={`Issue #${dr.issueId}: ${winCar.toUpperCase()} WON`}
                  >
                    {winCar[0]}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. INTERACTIVE TICKET PURCHASE TERMINAL */}
        <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4 font-mono">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">TICKET PURCHASE TERMINAL</h3>
                <p className="text-[11px] text-slate-400">Configure ticket quantity & payment wallet</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Selected Car</span>
              <span className="text-xs sm:text-sm font-black text-amber-400 uppercase">
                {SUPER_CARS[selectedCar]?.name} ({activeMultiplier}x)
              </span>
            </div>
          </div>

          {/* Step 1: Payment Wallet (Main Cash or Bonus Wallet) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-400">
                <Wallet className="w-3.5 h-3.5" /> 1. Select Payment Wallet
              </span>
              <span className="text-xs font-black text-slate-300 font-mono">
                {walletType === 'main' ? `Main Cash: ₹${user.balance.toFixed(2)}` : `Bonus: ₹${userBonusBalance.toFixed(2)}`}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Main Cash Wallet */}
              <button
                type="button"
                onClick={() => setWalletType('main')}
                className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                  walletType === 'main'
                    ? 'bg-gradient-to-br from-amber-950/80 to-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${walletType === 'main' ? 'text-amber-300' : 'text-slate-400'}`}>
                    <Wallet className="w-3.5 h-3.5" /> Real Cash
                  </span>
                  {walletType === 'main' && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400 text-slate-950" />
                  )}
                </div>
                <div className={`text-sm sm:text-base font-black mt-1 ${walletType === 'main' ? 'text-amber-200' : 'text-slate-400'}`}>
                  ₹{user.balance.toFixed(2)}
                </div>
                <span className="text-[9px] text-amber-400/90 font-sans block mt-0.5">
                  Real Win • Winnings credit to Real Balance
                </span>
              </button>

              {/* Bonus Wallet */}
              <button
                type="button"
                onClick={() => setWalletType('bonus')}
                className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                  walletType === 'bonus'
                    ? 'bg-gradient-to-br from-purple-950/80 to-slate-900 border-purple-400 ring-2 ring-purple-400/40 shadow-lg shadow-purple-950/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${walletType === 'bonus' ? 'text-purple-300' : 'text-slate-400'}`}>
                    <Gift className="w-3.5 h-3.5" /> Bonus Wallet
                  </span>
                  {walletType === 'bonus' && (
                    <CheckCircle2 className="w-4 h-4 text-purple-400 fill-purple-400 text-slate-950" />
                  )}
                </div>
                <div className={`text-sm sm:text-base font-black mt-1 ${walletType === 'bonus' ? 'text-purple-200' : 'text-slate-400'}`}>
                  ₹{userBonusBalance.toFixed(2)}
                </div>
                <span className="text-[9px] text-purple-400/90 font-sans block mt-0.5">
                  Bonus Win • Winnings credit to Bonus
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Quantity Stepper & Quick Chips */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-400">
                <Zap className="w-3.5 h-3.5" /> 2. Select Ticket Quantity
              </span>
              <span className="text-amber-300">₹{currentUnitPrice} / ticket</span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setQuantity(Math.max(1, quantity - 1));
                  }}
                  className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  -
                </button>

                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(isNaN(val) ? 1 : Math.max(1, Math.min(500, val)));
                  }}
                  className="w-24 bg-slate-900 border border-amber-500/60 rounded-xl px-2 py-2 text-center font-mono font-black text-amber-300 text-lg focus:outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setQuantity(Math.min(500, quantity + 1));
                  }}
                  className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  +
                </button>
              </div>

              {/* Quick Multiplier Chips */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start flex-1 sm:pl-3 sm:border-l sm:border-slate-800">
                {[1, 5, 10, 25, 50, 100].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setQuantity(num);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                      quantity === num
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md scale-105'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Cost & Potential Payout Bar */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Cost</span>
              <span className="text-lg sm:text-xl font-black text-white">₹{totalCost.toLocaleString('en-IN')}</span>
            </div>

            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[9px] text-slate-400 block">Payment Source</span>
              <span className={`text-xs font-black ${walletType === 'bonus' ? 'text-purple-300' : 'text-emerald-400'}`}>
                {walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Real Cash'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Potential Win</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                ₹{potentialWin.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Insufficient Balance Alert */}
          {!hasEnoughBalance && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  অপর্যাপ্ত বোনাস ব্যালেন্স (প্রয়োজন ₹{totalCost}, আছে ₹{userBonusBalance.toFixed(2)})
                </span>
              </div>
            </div>
          )}

          {/* Big Action Button */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={!hasEnoughBalance || isBuying || isDrawClosed || isCarRestricted(selectedCar)}
            className={`w-full py-4 rounded-2xl font-black text-sm sm:text-base tracking-wider shadow-2xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              hasEnoughBalance && !isBuying && !isDrawClosed && !isCarRestricted(selectedCar)
                ? walletType === 'bonus'
                  ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 text-white shadow-purple-500/30 active:scale-98'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 shadow-amber-500/30 active:scale-98'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
          >
            <Ticket className="w-5 h-5 shrink-0" />
            <span>
              {isBuying
                ? 'CONFIRMING & ISSUING TICKET...'
                : isDrawClosed
                ? '⛔ বেটিং বন্ধ (ফলাফল গণনা চলছে...)'
                : isCarRestricted(selectedCar)
                ? `⚠️ বিপরীত বাজি নিষিদ্ধ (হলুদ গাড়ি নির্বাচন করুন)`
                : `BUY ${quantity}x ${selectedCar.toUpperCase()} TICKET(S) • ₹${totalCost.toLocaleString('en-IN')}`}
            </span>
          </button>
        </section>

        {/* 4. MY ACTIVE TICKETS IN THIS ROUND */}
        <section className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 font-mono space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs sm:text-sm font-black text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>MY ACTIVE TICKETS FOR THIS ROUND ({currentRoundTickets.length})</span>
            </h4>
            <span className="text-[10px] text-slate-400">Auto-Settled at Draw Time</span>
          </div>

          {currentRoundTickets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {currentRoundTickets.map((t) => {
                const tCar = (t.selectedCar || t.selectedNumbers?.[0] || 'red').toString().toLowerCase();
                const isWon = t.status === 'win';
                const isLoss = t.status === 'loss';
                const isActive = t.status === 'active';

                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                      isWon
                        ? 'bg-emerald-950/80 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                        : isLoss
                        ? 'bg-slate-950/60 border-slate-800 opacity-60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black uppercase ${
                        tCar === 'red'
                          ? 'bg-rose-600 text-white'
                          : tCar === 'black'
                          ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                          : 'bg-amber-400 text-slate-950'
                      }`}>
                        {tCar[0]}
                      </div>
                      <div>
                        <span className="text-white font-bold block">{tCar.toUpperCase()} CAR</span>
                        <span className="text-[9px] text-slate-400 block">{t.ticketNumber || t.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-amber-300 font-bold block">₹{t.price}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                        isWon
                          ? 'bg-emerald-500 text-slate-950'
                          : isLoss
                          ? 'bg-rose-950 text-rose-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {isWon ? `WON ₹${t.wonAmount || Math.round(t.price * activeMultiplier)}` : isLoss ? 'LOSS' : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs space-y-1">
              <Ticket className="w-6 h-6 mx-auto opacity-30 text-amber-400" />
              <p>No tickets purchased for this draw slot yet.</p>
              <p className="text-[10px] text-slate-600">Select a Super Car above and click Buy Ticket to join!</p>
            </div>
          )}
        </section>
      </div>

      {/* DRAW RESULTS MODAL */}
      {isResultsOpen && (
        <SuperCarResultsModal
          isOpen={isResultsOpen}
          onClose={() => setIsResultsOpen(false)}
          pastDraws={pastDraws}
          userTickets={userTickets}
          config={config}
          onBuyTicketClick={() => {
            setIsResultsOpen(false);
            setSelectedCar('red');
          }}
        />
      )}

      {/* GAME RULES MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> 3 SUPER CAR DRAW RULES
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                <strong className="text-amber-300">1. Draw Schedule:</strong> Draws run every 10 minutes between 08:00 AM and 10:00 PM Indian Standard Time.
              </p>
              <p>
                <strong className="text-amber-300">2. Payout Multipliers:</strong>
                <br />• Red V12 Turbo: {config.carMultipliers?.red || 2.0}x Payout
                <br />• Stealth V10: {config.carMultipliers?.black || 2.8}x Payout
                <br />• Yellow Turbo: {config.carMultipliers?.yellow || 3.5}x Payout
              </p>
              <p>
                <strong className="text-amber-300">3. Wallet Support:</strong> You can purchase tickets using your Real Cash balance or Bonus Wallet. Winnings are auto-credited instantly upon draw conclusion!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-lg"
            >
              GOT IT, LET'S PLAY!
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
