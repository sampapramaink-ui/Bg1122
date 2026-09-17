import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Flame, Disc, Clock, ShieldCheck, Ticket, Zap, Lock, AlertTriangle } from 'lucide-react';
import { SuperCarColor, SuperCarDrawIssue, SuperCarConfig, PurchasedTicket, BonusBalanceRules } from '../types';
import { SUPER_CARS, getSuperCarInfo, getCurrentSuperCarSchedule, formatCountdown } from '../utils/supercar';
import { SuperCarResultsModal } from './SuperCarResultsModal';
import { soundFx } from '../utils/audio';

interface SuperCarDrawSectionProps {
  userBalance: number;
  userBonusBalance?: number;
  bonusRules?: BonusBalanceRules;
  config: SuperCarConfig;
  currentIssue: SuperCarDrawIssue | null;
  userTickets: PurchasedTicket[];
  pastDraws: SuperCarDrawIssue[];
  onConfirmBuyTicket: (carColor: SuperCarColor, quantity: number, totalCost: number, issueId?: string, slotNum?: number, walletType?: 'main' | 'bonus') => void;
  onDrawResolved?: (issueId: string, winningCar: SuperCarColor) => void;
  onOpenFullArena?: (carColor?: SuperCarColor) => void;
  onOpenBuyTicket?: (carColor: SuperCarColor) => void;
}

export const SuperCarDrawSection: React.FC<SuperCarDrawSectionProps> = React.memo(({
  userBalance,
  userBonusBalance = 0,
  bonusRules,
  config,
  currentIssue,
  userTickets,
  pastDraws,
  onConfirmBuyTicket,
  onDrawResolved,
  onOpenFullArena,
  onOpenBuyTicket
}) => {
  const configRef = React.useRef(config);
  configRef.current = config;

  const currentIssueRef = React.useRef(currentIssue);
  currentIssueRef.current = currentIssue;

  const onDrawResolvedRef = React.useRef(onDrawResolved);
  onDrawResolvedRef.current = onDrawResolved;

  const pastDrawsRef = React.useRef(pastDraws);
  pastDrawsRef.current = pastDraws;

  const [scheduleInfo, setScheduleInfo] = useState(() => getCurrentSuperCarSchedule(config));
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [activeTabCar, setActiveTabCar] = useState<SuperCarColor>('red');
  const [shufflingIndex, setShufflingIndex] = useState<number>(0);
  const [winningCarAnnounced, setWinningCarAnnounced] = useState<SuperCarColor | null>(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState<boolean>(false);
  const [lastResolvedIssueId, setLastResolvedIssueId] = useState<string>('');
  const [tickCount, setTickCount] = useState<number>(0);
  const [restrictionToast, setRestrictionToast] = useState<string | null>(null);

  // Auto-dismiss restriction toast
  useEffect(() => {
    if (restrictionToast) {
      const timer = setTimeout(() => setRestrictionToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [restrictionToast]);

  const lastResolvedIssueIdRef = React.useRef(lastResolvedIssueId);
  lastResolvedIssueIdRef.current = lastResolvedIssueId;

  const carsList: SuperCarColor[] = ['red', 'black', 'yellow'];

  // Calculate current slot tickets for opposite betting check
  const currentSlotTickets = React.useMemo(() => {
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

  const hasBoughtRedInSlot = React.useMemo(() => {
    return currentSlotTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'red';
    });
  }, [currentSlotTickets]);

  const hasBoughtBlackInSlot = React.useMemo(() => {
    return currentSlotTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'black';
    });
  }, [currentSlotTickets]);

  const isCarRestricted = (car: SuperCarColor) => {
    if (car === 'black' && hasBoughtRedInSlot) return true;
    if (car === 'red' && hasBoughtBlackInSlot) return true;
    return false;
  };

  // Helper to determine the exact Admin Panel set winning car
  const getAdminWinningCar = (): SuperCarColor => {
    if (config?.resultMode === 'manual' && config?.manualWinner) {
      return config.manualWinner;
    }
    const manualSlotWinner = config?.manualSlotWinners?.[scheduleInfo.issueId] || config?.manualSlotWinners?.[scheduleInfo.drawIndex];
    if (manualSlotWinner) {
      return manualSlotWinner;
    }
    if (currentIssue?.winningCar) {
      return currentIssue.winningCar;
    }
    if (pastDraws && pastDraws.length > 0 && pastDraws[0].winningCar) {
      return pastDraws[0].winningCar;
    }
    // Fallback deterministic index per issue draw index
    const colors: SuperCarColor[] = ['red', 'black', 'yellow'];
    return colors[(scheduleInfo.drawIndex * 7) % 3];
  };

  // Robust check for enabled status: default to true if undefined, handle string "true"/"false" or boolean
  const isEnabled = config?.enabled === undefined
    ? true
    : (config.enabled === true || String(config.enabled).toLowerCase() === 'true');

  // Early return if game is disabled in config
  if (!config || !isEnabled) {
    return null;
  }

  const prevScheduleRef = React.useRef(scheduleInfo);

  // Synchronized ultra-smooth 1000ms ticker for live countdown and draw resolution
  useEffect(() => {
    const timer = setInterval(() => {
      const cfg = configRef.current;
      const updatedSchedule = getCurrentSuperCarSchedule(cfg);
      const prevSchedule = prevScheduleRef.current;
      
      setScheduleInfo(updatedSchedule);
      setTickCount((prev) => (prev + 1) % 100);

      // Handle draw completion when slot transitions or countdown finishes
      const isSlotChanged = prevSchedule && prevSchedule.issueId && prevSchedule.issueId !== updatedSchedule.issueId;
      const isTimeZero = updatedSchedule.isOpen && updatedSchedule.timeRemainingMs <= 0;

      if (isSlotChanged || isTimeZero) {
        const resolvedIssueId = isSlotChanged ? prevSchedule.issueId : updatedSchedule.issueId;
        const resolvedDrawIndex = isSlotChanged ? prevSchedule.drawIndex : updatedSchedule.drawIndex;

        let winner: SuperCarColor = 'red';
        if (cfg?.resultMode === 'manual' && cfg?.manualWinner) {
          winner = cfg.manualWinner;
        } else {
          const manualSlotWinner = cfg?.manualSlotWinners?.[resolvedIssueId] || cfg?.manualSlotWinners?.[resolvedDrawIndex];
          if (manualSlotWinner) {
            winner = manualSlotWinner;
          } else if (currentIssueRef.current?.winningCar) {
            winner = currentIssueRef.current.winningCar;
          } else if (pastDrawsRef.current && pastDrawsRef.current.length > 0 && pastDrawsRef.current[0].winningCar) {
            winner = pastDrawsRef.current[0].winningCar;
          } else {
            const colors: SuperCarColor[] = ['red', 'black', 'yellow'];
            winner = colors[(resolvedDrawIndex * 7) % 3];
          }
        }

        const winnerIdx = ['red', 'black', 'yellow'].indexOf(winner);
        if (winnerIdx !== -1) {
          setShufflingIndex(winnerIdx);
        }

        if (lastResolvedIssueIdRef.current !== resolvedIssueId) {
          setLastResolvedIssueId(resolvedIssueId);
          setWinningCarAnnounced(winner);
          setShowWinnerAnimation(true);

          // Play Loud Winning Sound System
          try {
            soundFx.playLoudWinSound();
          } catch (e) {
            console.warn('Loud win sound error:', e);
          }

          if (onDrawResolvedRef.current) {
            onDrawResolvedRef.current(resolvedIssueId, winner);
          }
        }
      }

      prevScheduleRef.current = updatedSchedule;
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // High-speed car shuffle animation interval when in final 30 seconds
  useEffect(() => {
    if (!scheduleInfo.isShuffling) return;

    const shuffleInterval = setInterval(() => {
      setShufflingIndex((prev) => {
        // Play engine rolling sound during shuffle
        try {
          soundFx.playCarRollingSound();
        } catch (_) {}
        return (prev + 1) % 3;
      });
    }, 180);

    return () => clearInterval(shuffleInterval);
  }, [scheduleInfo.isShuffling]);

  // Split countdown string (e.g., "03:13") into minutes and seconds
  const countdownFormatted = formatCountdown(scheduleInfo.timeRemainingMs);
  const [minsStr, secsStr] = countdownFormatted.split(':');
  const isTickEven = tickCount % 2 === 0;

  // Draw progress calculation
  const totalIntervalMs = (config.drawIntervalMinutes || 10) * 60 * 1000;
  const elapsedMs = Math.max(0, totalIntervalMs - scheduleInfo.timeRemainingMs);
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalIntervalMs) * 100));

  return (
    <div id="supercar-draw-section-root" className="relative rounded-3xl bg-slate-900/90 border border-amber-500/30 p-3.5 sm:p-6 shadow-2xl overflow-hidden space-y-4 sm:space-y-5">
      {/* Background Decorative Speed Lines & Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* RESTRICTION WARNING TOAST */}
      {restrictionToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 max-w-md text-center">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{restrictionToast}</span>
          <button onClick={() => setRestrictionToast(null)} className="text-white/60 hover:text-white ml-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5 sm:pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black font-mono tracking-tight text-white flex flex-wrap items-center gap-2">
                <span>THREE SUPER CAR DRAW</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase shrink-0">
                  LIVE 10M
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
                Operating Daily: 08:00 AM to 10:00 PM • One Draw Every 10 Minutes
              </p>
            </div>
          </div>
        </div>

        {/* Operating Status / Animated Digital Countdown Badge */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          {scheduleInfo.isOpen ? (
            <div className={`p-2 sm:p-2.5 rounded-2xl border flex flex-col gap-1.5 font-mono flex-1 sm:flex-initial shadow-xl transition-all duration-300 min-w-[200px] sm:min-w-[230px] ${
              scheduleInfo.isShuffling
                ? 'bg-gradient-to-br from-rose-950/90 to-slate-950 border-rose-500/80 shadow-rose-900/30'
                : 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border-amber-500/50 shadow-amber-950/40'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      scheduleInfo.isShuffling ? 'bg-rose-400' : 'bg-emerald-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      scheduleInfo.isShuffling ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}></span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-amber-300 font-black uppercase tracking-wider">
                    {scheduleInfo.isShuffling ? 'SHUFFLING NOW' : `Issue #${scheduleInfo.issueId}`}
                  </span>
                </div>

                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0">
                  LIVE TICK
                </span>
              </div>

              {/* Digital LED Clock Tiles */}
              <div className="flex items-center justify-center gap-1.5 py-0.5">
                <div className="flex items-baseline gap-0.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-amber-500/30 shadow-inner">
                  <span className="text-base sm:text-xl font-black text-amber-300 tracking-wider">
                    {minsStr}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold">m</span>
                </div>

                <span className={`text-base sm:text-xl font-black transition-all duration-150 ${
                  isTickEven ? 'text-amber-400 opacity-100 scale-125' : 'text-amber-600/40 opacity-40 scale-90'
                }`}>
                  :
                </span>

                <div className="flex items-baseline gap-0.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-amber-500/30 shadow-inner">
                  <span className="text-base sm:text-xl font-black text-amber-300 tracking-wider">
                    {secsStr}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold">s</span>
                </div>
              </div>

              {/* Live Speed Progress Bar */}
              <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
                <div
                  className={`h-full transition-all duration-500 ${
                    scheduleInfo.isShuffling
                      ? 'bg-gradient-to-r from-rose-500 to-amber-400 animate-pulse'
                      : 'bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-2xl bg-rose-950/50 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-center gap-2 flex-1 sm:flex-initial justify-center">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Closed • Opens at 08:00 AM</span>
            </div>
          )}

          <button
            onClick={() => {
              soundFx.playClick();
              setIsResultsOpen(true);
            }}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Results</span>
            <span className="inline sm:hidden text-[10px]">Results</span>
          </button>
        </div>
      </div>

      {/* SHUFFLE / RACE ANIMATION BANNER (Final 30 Seconds) */}
      {scheduleInfo.isShuffling && (
        <div className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950 via-slate-950 to-amber-950 border-2 border-amber-400 shadow-2xl space-y-2.5 sm:space-y-3 overflow-hidden text-center animate-pulse">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-amber-300 font-black font-mono text-[10px] sm:text-xs uppercase tracking-wider flex-wrap">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce shrink-0" />
            <span>30s SUPER CAR SHUFFLE IN PROGRESS - DRAWS CLOSING!</span>
            <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-mono font-black text-xs shadow-md">
              {formatCountdown(scheduleInfo.timeRemainingMs)}
            </span>
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce shrink-0" />
          </div>

          {/* Animated Supercar Racing Track Visual */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-w-md mx-auto">
            {carsList.map((carKey, idx) => {
              const car = getSuperCarInfo(carKey, config);
              const isActiveShuffleCar = shufflingIndex === idx;

              return (
                <div
                  key={carKey}
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-150 transform ${
                    isActiveShuffleCar
                      ? 'scale-105 bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/40 ring-2 ring-amber-400/50'
                      : 'scale-95 bg-slate-950 border-slate-800 opacity-60'
                  }`}
                >
                  <img
                    src={car.image}
                    alt={car.name}
                    className="w-full h-8 sm:h-10 object-cover rounded-lg border border-slate-700"
                  />
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300 mt-1 block truncate">
                    {car.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WINNING CAR CELEBRATION ANIMATION OVERLAY / BANNER */}
      {showWinnerAnimation && winningCarAnnounced && (
        <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-950 to-yellow-950 border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.5)] space-y-3 text-center animate-bounce-once font-mono">
          <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-widest">
            <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>🎉 DRAW COMPLETED - WINNING CAR RESULT 🎉</span>
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-slate-900/90 border border-amber-500/40 p-3 sm:p-4 rounded-xl">
            <div className="relative w-28 h-20 rounded-xl overflow-hidden border-2 border-amber-400 shadow-xl shrink-0 group">
              <img
                src={getSuperCarInfo(winningCarAnnounced, config).image}
                alt={winningCarAnnounced}
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
            </div>

            <div className="text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xs text-amber-400 font-black uppercase tracking-wider">
                  OFFICIAL WINNER
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
                  VERIFIED BY ADMIN
                </span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">
                {getSuperCarInfo(winningCarAnnounced, config).name}
              </h3>
              <p className="text-xs text-amber-300/90 font-bold">
                Payout Odds: <strong className="text-emerald-400 font-black">{config.prizeMultiplier || 2.8}x</strong> • Tag: {getSuperCarInfo(winningCarAnnounced, config).tagline}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setShowWinnerAnimation(false);
            }}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg"
          >
            DISMISS ANNOUNCEMENT
          </button>
        </div>
      )}



      {/* CAR SELECTOR TAB BAR FOR QUICK MOBILE & DESKTOP NAVIGATION */}
      <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-950/90 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTabCar('red');
          }}
          className={`flex-1 py-1.5 sm:py-2 px-2 rounded-xl text-[10px] sm:text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTabCar === 'red'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          <span>RED V12</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTabCar('black');
          }}
          className={`flex-1 py-1.5 sm:py-2 px-2 rounded-xl text-[10px] sm:text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTabCar === 'black'
              ? 'bg-slate-700 text-amber-300 border border-amber-500/40 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>STEALTH V10</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTabCar('yellow');
          }}
          className={`flex-1 py-1.5 sm:py-2 px-2 rounded-xl text-[10px] sm:text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTabCar === 'yellow'
              ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-yellow-300"></span>
          <span>YELLOW V8</span>
        </button>
      </div>

      {/* 3 SUPERCAR CARDS IN ONE SINGLE WIDTH ROW (Red, Black, Yellow side-by-side) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3.5">
        {carsList.map((carKey) => {
          const car = getSuperCarInfo(carKey, config);
          const ticketPrice = config.carPrices?.[carKey] || config.ticketPrice || 100;
          const prizeMultiplier = config.carMultipliers?.[carKey] || config.prizeMultiplier || 2.8;
          const isDrawClosed = !scheduleInfo.isOpen || scheduleInfo.isShuffling;
          const maxEstWin = Math.round(ticketPrice * prizeMultiplier);

          return (
            <div
              key={carKey}
              className={`group relative rounded-xl sm:rounded-2xl bg-slate-950/95 border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg ${
                carKey === 'red'
                  ? 'border-rose-500/40 hover:border-rose-500/90 shadow-rose-950/30'
                  : carKey === 'black'
                  ? 'border-amber-500/40 hover:border-amber-500/90 shadow-amber-950/30'
                  : 'border-yellow-500/40 hover:border-yellow-500/90 shadow-yellow-950/30'
              }`}
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 z-20 ${
                carKey === 'red' ? 'bg-gradient-to-r from-rose-600 to-red-400' :
                carKey === 'black' ? 'bg-gradient-to-r from-slate-600 to-amber-400' :
                'bg-gradient-to-r from-yellow-400 to-amber-300'
              }`}></div>

              {/* Card Banner Image (Ultra-Compact Height for 3-Col Layout) */}
              <div className="relative h-20 sm:h-32 overflow-hidden">
                <img
                  src={car.image}
                  alt={car.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>

                {/* Badge Tag */}
                <div className="absolute top-1 left-1 bg-slate-950/90 border border-amber-500/40 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-mono font-black text-amber-300 shadow-md flex items-center gap-0.5">
                  <Sparkles className="w-2 h-2 text-amber-400 shrink-0" />
                  <span className="truncate max-w-[50px] sm:max-w-none">{carKey.toUpperCase()}</span>
                </div>

                <div className="absolute top-1 right-1 bg-emerald-500/30 border border-emerald-500/60 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-mono font-black text-emerald-300 shadow-md">
                  {prizeMultiplier}x
                </div>

                {/* Car Title Overlay */}
                <div className="absolute bottom-1 left-1.5 right-1.5">
                  <h3 className="text-[11px] sm:text-sm font-black font-mono text-white tracking-tight leading-none drop-shadow truncate">
                    {car.name}
                  </h3>
                  <p className="hidden sm:block text-[9px] text-slate-300 font-mono mt-0.5 opacity-90 truncate">
                    {car.tagline}
                  </p>
                </div>
              </div>

              {/* Compact Card Content */}
              <div className="p-1.5 sm:p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                {/* Est. Win & Ticket Price Compact Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-mono text-center">
                  <div className="p-1 bg-slate-900/90 rounded-lg border border-amber-500/30">
                    <span className="text-[7px] sm:text-[8px] text-amber-400 block font-bold uppercase truncate">Est. Win</span>
                    <span className="text-[10px] sm:text-xs font-black text-amber-300">₹{maxEstWin}</span>
                  </div>

                  <div className="p-1 bg-slate-900/90 rounded-lg border border-slate-800">
                    <span className="text-[7px] sm:text-[8px] text-slate-400 block font-bold uppercase truncate">Ticket</span>
                    <span className="text-[10px] sm:text-xs font-black text-white">₹{ticketPrice}</span>
                  </div>
                </div>

                {/* Countdown Row */}
                <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-[8px] sm:text-[10px]">
                  <span className="text-slate-400 font-bold flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline">Draw</span>
                  </span>
                  <span className="font-black text-amber-300">
                    {scheduleInfo.isOpen ? formatCountdown(scheduleInfo.timeRemainingMs) : '08:00 AM'}
                  </span>
                </div>

                {/* Buy Button */}
                {(() => {
                  const isLocked = isCarRestricted(carKey);
                  return (
                    <button
                      onClick={() => {
                        if (isDrawClosed) return;
                        if (isLocked) {
                          soundFx.playError();
                          const opp = carKey === 'black' ? 'লাল (Red)' : 'কালো (Black)';
                          const cur = carKey === 'black' ? 'কালো (Black)' : 'লাল (Red)';
                          setRestrictionToast(`⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে ${opp} গাড়িতে বাজি ধরেছেন। ${cur} কেনা যাবে না (হলুদের সাথে কিনতে পারেন)।`);
                          return;
                        }
                        soundFx.playClick();
                        if (onOpenBuyTicket) {
                          onOpenBuyTicket(carKey);
                        } else if (onOpenFullArena) {
                          onOpenFullArena(carKey);
                        }
                      }}
                      disabled={isDrawClosed}
                      className={`w-full py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-black font-mono text-[9px] sm:text-xs tracking-wide shadow-md flex items-center justify-center gap-0.5 sm:gap-1 transition-all cursor-pointer ${
                        isDrawClosed
                          ? 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : isLocked
                          ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300 hover:bg-rose-900/80'
                          : carKey === 'red'
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 text-white shadow-rose-500/20 active:scale-95'
                          : carKey === 'black'
                          ? 'bg-gradient-to-r from-slate-700 via-amber-500 to-slate-800 text-white shadow-amber-500/20 active:scale-95'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-yellow-500/20 active:scale-95'
                      }`}
                    >
                      {isLocked ? <Lock className="w-3 h-3 shrink-0 text-rose-400" /> : <Ticket className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{isDrawClosed ? 'LOCKED' : isLocked ? 'বিপরীত বাজি লকড' : 'BUY TICKET'}</span>
                    </button>
                  );
                })()}

                {/* View Draw & Result Links */}
                <div className="grid grid-cols-2 gap-1 text-[8px] sm:text-[9px] font-mono font-bold text-center">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      if (onOpenFullArena) {
                        onOpenFullArena(carKey);
                      } else if (onOpenBuyTicket) {
                        onOpenBuyTicket(carKey);
                      }
                    }}
                    className="py-0.5 sm:py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer truncate"
                  >
                    Draw
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setIsResultsOpen(true);
                    }}
                    className="py-0.5 sm:py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer truncate"
                  >
                    Result
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results Modal */}
      {isResultsOpen && (
        <SuperCarResultsModal
          isOpen={isResultsOpen}
          onClose={() => setIsResultsOpen(false)}
          pastDraws={pastDraws}
          userTickets={userTickets}
          config={config}
          onBuyTicketClick={() => {
            setIsResultsOpen(false);
            if (onOpenBuyTicket) {
              onOpenBuyTicket('red');
            } else if (onOpenFullArena) {
              onOpenFullArena('red');
            }
          }}
        />
      )}
    </div>
  );
});
