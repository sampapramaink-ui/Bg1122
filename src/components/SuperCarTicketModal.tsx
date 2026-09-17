import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Ticket, Wallet, Gift, Zap, Sparkles, Clock, Lock } from 'lucide-react';
import { SuperCarColor, SuperCarDrawIssue, BonusBalanceRules, PurchasedTicket } from '../types';
import { SUPER_CARS, getSuperCarInfo, getCurrentSuperCarSchedule, formatCountdown } from '../utils/supercar';
import { soundFx } from '../utils/audio';

interface SuperCarTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCarColor: SuperCarColor;
  currentIssue: SuperCarDrawIssue | null;
  userBalance: number;
  userBonusBalance?: number;
  bonusRules?: BonusBalanceRules;
  ticketPrice: number;
  bonusTicketPrice?: number;
  carPrices?: Partial<Record<SuperCarColor, number>>;
  bonusCarPrices?: Partial<Record<SuperCarColor, number>>;
  carMultipliers?: Partial<Record<SuperCarColor, number>>;
  allowBonusPurchase?: boolean;
  prizeMultiplier: number;
  slotDurationMinutes?: number;
  userTickets?: PurchasedTicket[];
  onConfirmBuy: (carColor: SuperCarColor, quantity: number, totalCost: number, walletType: 'main' | 'bonus') => void;
}

export const SuperCarTicketModal: React.FC<SuperCarTicketModalProps> = ({
  isOpen,
  onClose,
  selectedCarColor: initialCar,
  currentIssue,
  userBalance,
  userBonusBalance = 0,
  bonusRules,
  ticketPrice,
  bonusTicketPrice,
  carPrices,
  bonusCarPrices,
  carMultipliers,
  allowBonusPurchase = true,
  prizeMultiplier,
  slotDurationMinutes = 10,
  userTickets = [],
  onConfirmBuy
}) => {
  const [selectedCar, setSelectedCar] = useState<SuperCarColor>(initialCar || 'black');
  const [quantity, setQuantity] = useState<number>(1);
  // Three Super Car Draw is strictly playable ONLY with Bonus Balance
  const walletType = 'bonus';
  const [isBuying, setIsBuying] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [restrictionWarning, setRestrictionWarning] = useState<string | null>(null);

  // Live schedule & 30s betting closure check
  const liveSchedule = getCurrentSuperCarSchedule();
  const isBettingClosed = liveSchedule.isBettingClosed;

  // Auto-dismiss restriction toast
  useEffect(() => {
    if (restrictionWarning) {
      const timer = setTimeout(() => setRestrictionWarning(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [restrictionWarning]);

  // Check existing tickets for the current round to enforce opposite betting rule
  const currentSlotTickets = useMemo(() => {
    return userTickets.filter((t) => {
      return (
        t.category === 'Three Super Car Draw' &&
        (
          (liveSchedule.issueId && (t.drawId === liveSchedule.issueId || t.issueId === liveSchedule.issueId)) ||
          (liveSchedule.drawIndex && (t.slotNumber === liveSchedule.drawIndex || t.slotNum === liveSchedule.drawIndex || (t as any).slot === liveSchedule.drawIndex))
        )
      );
    });
  }, [userTickets, liveSchedule.issueId, liveSchedule.drawIndex]);

  const hasBoughtRed = useMemo(() => {
    return currentSlotTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'red';
    });
  }, [currentSlotTickets]);

  const hasBoughtBlack = useMemo(() => {
    return currentSlotTickets.some((t) => {
      const c = (t.selectedCar || t.selectedNumbers?.[0] || '').toString().toLowerCase();
      return c === 'black';
    });
  }, [currentSlotTickets]);

  // Update selected car when initialCar changes or enforce non-restricted car
  useEffect(() => {
    if (hasBoughtRed && selectedCar === 'black') {
      setSelectedCar('yellow');
    } else if (hasBoughtBlack && selectedCar === 'red') {
      setSelectedCar('yellow');
    } else if (initialCar) {
      if (initialCar === 'black' && hasBoughtRed) {
        setSelectedCar('yellow');
      } else if (initialCar === 'red' && hasBoughtBlack) {
        setSelectedCar('yellow');
      } else {
        setSelectedCar(initialCar);
      }
    }
  }, [initialCar, hasBoughtRed, hasBoughtBlack]);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const effectiveWalletBalance = userBonusBalance;

  // Unit Pricing Calculation (Bonus Balance Only)
  const realUnitPrice = carPrices?.[selectedCar] || ticketPrice || 100;
  const effectiveBonusPrice = bonusCarPrices?.[selectedCar] || bonusTicketPrice || bonusRules?.superCarBonusTicketPrice || realUnitPrice;
  const currentUnitPrice = effectiveBonusPrice;
  const activeMultiplier = carMultipliers?.[selectedCar] || prizeMultiplier || 2.8;

  const totalCost = quantity * currentUnitPrice;
  const potentialWin = Math.round(totalCost * activeMultiplier);
  const hasEnoughBalance = effectiveWalletBalance >= totalCost;

  const handleBuy = () => {
    if (isBettingClosed) {
      alert('বেটিং সময় সমাপ্ত! ড্র সম্পন্ন হওয়ার ৩০ সেকেন্ড পূর্বে বেটিং বন্ধ থাকে। অনুগ্রহ করে পরবর্তী রাউন্ডের জন্য অপেক্ষা করুন।');
      return;
    }

    if (selectedCar === 'black' && hasBoughtRed) {
      soundFx.playError();
      setRestrictionWarning('⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে লাল (Red) গাড়িতে টিকিট কেটেছেন। একই রাউন্ডে লাল ও কালো একসাথে কেনা যাবে না (হলুদের সাথে কেনা যাবে)।');
      return;
    }
    if (selectedCar === 'red' && hasBoughtBlack) {
      soundFx.playError();
      setRestrictionWarning('⚠️ বিপরীত বাজি নিষিদ্ধ: আপনি ইতিমধ্যে কালো (Black) গাড়িতে টিকিট কেটেছেন। একই রাউন্ডে কালো ও লাল একসাথে কেনা যাবে না (হলুদের সাথে কেনা যাবে)।');
      return;
    }

    if (!hasEnoughBalance || isBuying) return;

    setIsBuying(true);
    soundFx.playClick();
    setTimeout(() => {
      onConfirmBuy(selectedCar, quantity, totalCost, 'bonus');
      setIsBuying(false);
      onClose();
    }, 350);
  };

  const selectedCarInfo = SUPER_CARS[selectedCar] || SUPER_CARS.black;

  return (
    <div className="fixed inset-0 z-[100000] w-full h-[100dvh] bg-gradient-to-b from-[#070b14] via-[#0c101c] to-[#050811] text-white flex flex-col overflow-hidden select-none animate-fade-in">
      
      {/* Background Ambience Subtle Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-60 bg-amber-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-80 h-60 bg-purple-600/10 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-0 w-80 h-60 bg-rose-600/10 blur-3xl rounded-full" />
      </div>

      {/* RESTRICTION WARNING TOAST */}
      {restrictionWarning && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100020] px-4 py-2.5 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 max-w-md text-center">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{restrictionWarning}</span>
          <button onClick={() => setRestrictionWarning(null)} className="text-white/60 hover:text-white ml-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 1. Dedicated Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-amber-500/30 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-bold font-mono">Back</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black font-mono tracking-wider text-white uppercase leading-none flex items-center gap-1.5">
                <span>🏎️</span>
                <span>BUY SUPER CAR TICKET</span>
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-mono font-bold text-amber-300">
                LIVE 10M
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5">
              {currentIssue?.issueId ? `Issue #${currentIssue.issueId} • ` : ''}{slotDurationMinutes}-Min Live Draw
            </p>
          </div>
        </div>

        {/* Live User Balance Pill Display */}
        <div className="flex items-center gap-1.5 sm:gap-2 font-mono">
          {/* Main Balance Pill */}
          <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-amber-500/40 text-right">
            <span className="text-[8px] text-amber-400 block font-bold uppercase leading-none">Main Cash</span>
            <span className="text-xs sm:text-sm font-black text-amber-300 leading-tight">₹{userBalance.toLocaleString('en-IN')}</span>
          </div>

          {/* Bonus Balance Pill */}
          {userBonusBalance > 0 && (
            <div className="hidden xs:block px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-right">
              <span className="text-[8px] text-purple-300 block font-bold uppercase leading-none">Bonus</span>
              <span className="text-xs sm:text-sm font-black text-purple-200 leading-tight">₹{userBonusBalance.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Full-Screen Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-3.5 space-y-3.5 max-w-lg mx-auto w-full">

        {/* 30-Second Cutoff Live Warning */}
        {isBettingClosed && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs font-mono flex items-center gap-2.5 shadow-lg animate-pulse">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-black text-rose-300 text-xs sm:text-sm">⛔ বেটিং বন্ধ (BETTING CLOSED - T-30s)</div>
              <div className="text-[10px] sm:text-[11px] text-rose-200/90 mt-0.5">ড্র হতে ৩০ সেকেন্ড বাকি থাকায় বেটিং লক করা হয়েছে। ফলাফল গণনা চলছে...</div>
            </div>
          </div>
        )}

        {/* SECTION 1: PAYMENT WALLET (BONUS WALLET EXCLUSIVE) */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
            <div className="flex items-center gap-1.5 text-purple-400">
              <span className="w-4 h-4 rounded-full bg-purple-400/20 text-purple-300 text-[10px] flex items-center justify-center font-mono font-black">1</span>
              <span>PAYMENT WALLET (BONUS ONLY)</span>
            </div>
            <span className="text-[10px] text-purple-300/80 font-normal">Super Car Exclusive</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* BONUS WALLET (ACTIVE & EXCLUSIVE) */}
            <div
              className="p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative bg-gradient-to-br from-purple-950/90 to-slate-950 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-950/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-purple-400 bg-purple-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-black font-mono text-purple-300 uppercase">
                    BONUS WALLET
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  ACTIVE
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-white mt-1.5 truncate">
                ₹{userBonusBalance.toFixed(2)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-purple-400 font-sans flex items-center gap-1 mt-0.5 truncate">
                <span>🎁</span>
                <span>Winnings credited to Bonus</span>
              </div>
            </div>

            {/* MAIN WALLET (LOCKED/DISABLED) */}
            <div
              className="p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative bg-[#0f1422]/60 border-slate-800 opacity-50 cursor-not-allowed"
              title="Super Car can only be played with Bonus Balance"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center" />
                  <span className="text-[11px] sm:text-xs font-black font-mono text-slate-400 uppercase">
                    MAIN CASH
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                  LOCKED
                </span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-slate-400 mt-1.5 truncate">
                ₹{userBalance.toFixed(2)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-amber-500/80 font-sans flex items-center gap-1 mt-0.5 truncate">
                <span>🔒</span>
                <span>সুপার কারে গ্রহণযোগ্য নয়</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: CHOOSE WINNING SUPER CAR */}
        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 text-[10px] flex items-center justify-center font-mono font-black">2</span>
              <span>CHOOSE WINNING SUPER CAR</span>
            </div>
          </div>

          {/* 3 Car thumbnails selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['red', 'black', 'yellow'] as SuperCarColor[]).map((carKey) => {
              const info = SUPER_CARS[carKey];
              const isSelected = selectedCar === carKey;
              const carOdds = carMultipliers?.[carKey] || prizeMultiplier || 2.8;
              const isLocked = (carKey === 'black' && hasBoughtRed) || (carKey === 'red' && hasBoughtBlack);

              return (
                <button
                  key={carKey}
                  type="button"
                  onClick={() => {
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
                  className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                    isLocked
                      ? 'bg-rose-950/30 border-rose-500/40 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? carKey === 'red'
                        ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/50'
                        : carKey === 'black'
                        ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-950/50'
                        : 'bg-yellow-950/60 border-yellow-400 ring-2 ring-yellow-400/60 shadow-lg shadow-yellow-950/50'
                      : 'bg-[#0f1422] border-slate-800/90 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-full h-14 sm:h-16 rounded-xl overflow-hidden bg-black/60 border border-slate-800 relative">
                    <img src={info.image} alt={info.name} className="w-full h-full object-cover" />
                    <span className="absolute top-1 right-1 bg-emerald-500/80 text-slate-950 px-1 py-0.2 rounded font-mono font-black text-[8px]">
                      {carOdds}x
                    </span>
                    {isLocked && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-0.5 text-rose-300 font-mono text-[8px] font-black z-10">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>নিষিদ্ধ</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs font-black font-mono text-white truncate max-w-full">
                    {info.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Car Detail Wide Card */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0f1422] to-slate-900 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-12 rounded-xl overflow-hidden bg-black border border-slate-700 shrink-0">
                <img
                  src={selectedCarInfo.image}
                  alt={selectedCarInfo.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-black font-mono text-white truncate">
                  {selectedCarInfo.name}
                </div>
                <div className="text-[10px] sm:text-[11px] text-amber-300/80 truncate">
                  {selectedCarInfo.tagline}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[9px] text-slate-400 font-mono uppercase">Payout Odds</div>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">{activeMultiplier}x</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-black rounded">
                  WIN
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SELECT TICKET QUANTITY */}
        <section className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 text-[10px] flex items-center justify-center font-mono font-black">3</span>
              <span>SELECT TICKET QUANTITY</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className="text-slate-300 text-xs">₹{currentUnitPrice} / ticket</span>
              {walletType === 'bonus' && (
                <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white text-[8px] font-black">BONUS</span>
              )}
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-2 bg-[#0f1422] p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setQuantity(Math.max(1, quantity - 1));
              }}
              className="w-12 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-2xl flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              -
            </button>

            <div className="flex items-center justify-center gap-2 flex-1 font-mono">
              <input
                type="number"
                min="1"
                max="500"
                value={quantity || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQuantity(isNaN(val) ? 1 : Math.max(1, Math.min(500, val)));
                }}
                className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1 text-center font-mono font-black text-white text-base sm:text-lg focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs sm:text-sm font-bold text-slate-400">
                {quantity === 1 ? 'Ticket' : 'Tickets'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setQuantity(Math.min(500, quantity + 1));
              }}
              className="w-12 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-2xl flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              +
            </button>
          </div>

          {/* Fast Multiplier pills: 1x, 5x, 10x, 50x, 80x, 100x */}
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 5, 10, 50, 80, 100].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setQuantity(num);
                }}
                className={`py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold border transition-all cursor-pointer ${
                  quantity === num
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md'
                    : 'bg-[#0f1422] text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {num}x
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 4: SUMMARY SETTLEMENT PANEL */}
        <section className="p-3 sm:p-4 rounded-2xl bg-[#0f1422] border border-slate-800 font-mono text-xs space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span>Payment Wallet:</span>
            <span className={`font-bold flex items-center gap-1 ${walletType === 'bonus' ? 'text-purple-300' : 'text-amber-400'}`}>
              {walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Main Wallet'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Total Cost:</span>
            <span className="text-white font-black text-sm">₹{totalCost.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Potential Win (Est.):</span>
            <span className="text-emerald-400 font-black text-sm">₹{potentialWin.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span>{walletType === 'bonus' ? 'Available Bonus Balance:' : 'Available Main Balance:'}</span>
            <span className={`font-black ${walletType === 'bonus' ? 'text-purple-300' : 'text-amber-400'}`}>
              ₹{effectiveWalletBalance.toFixed(2)}
            </span>
          </div>
        </section>

        {/* Bonus Wallet Policy Notice */}
        {walletType === 'bonus' && (
          <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-[10px] sm:text-xs text-amber-300 font-mono flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-amber-200">বোনাস ওয়ালেট পলিসি:</strong> টিকিট উইন হলে জেতা টাকা (₹{potentialWin.toLocaleString('en-IN')}) সরাসরি আপনার বোনাস ওয়ালেটে যোগ হবে।
            </span>
          </div>
        )}

        {/* Balance Insufficient Warning */}
        {!hasEnoughBalance && (
          <div className="p-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              {walletType === 'bonus'
                ? `অপর্যাপ্ত বোনাস ব্যালেন্স (আছে ₹${userBonusBalance.toFixed(2)})`
                : `অপর্যাপ্ত মেইন ব্যালেন্স (আছে ₹${userBalance.toFixed(2)})`}
            </span>
          </div>
        )}

      </main>

      {/* 3. Dedicated Bottom Confirmation Bar */}
      <footer className="sticky bottom-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 sm:px-6 py-3 space-y-1.5 shrink-0 shadow-2xl max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={handleBuy}
          disabled={!hasEnoughBalance || isBuying || isBettingClosed}
          className={`w-full py-3.5 sm:py-4 rounded-2xl font-black font-mono text-xs sm:text-sm tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            hasEnoughBalance && !isBuying && !isBettingClosed
              ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 text-white shadow-purple-500/30 active:scale-98'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
          }`}
        >
          <Ticket className="w-5 h-5 shrink-0" />
          <span>
            {isBettingClosed
              ? '⛔ বেটিং বন্ধ (ফলাফল গণনা চলছে...)'
              : isBuying
              ? 'CONFIRMING TICKET...'
              : `CONFIRM & PAY ₹${totalCost.toLocaleString('en-IN')} (BONUS WALLET)`}
          </span>
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-mono text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>100% Transparent Firebase Live Super Car Draw</span>
        </div>
      </footer>

    </div>
  );
};

