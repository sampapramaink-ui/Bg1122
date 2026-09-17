import React, { useState } from 'react';
import { X, Ticket, Sparkles, Shuffle, CheckCircle2, AlertCircle, Wallet, Gift, Lock } from 'lucide-react';
import { LotteryDraw, BonusBalanceRules } from '../types';
import { soundFx } from '../utils/audio';

interface TicketBuyModalProps {
  draw: LotteryDraw | null;
  userBalance: number;
  userBonusBalance?: number;
  bonusRules?: BonusBalanceRules;
  onClose: () => void;
  onConfirmPurchase: (draw: LotteryDraw, tickets: number[][], totalPrice: number, walletType?: 'main' | 'bonus') => void;
}

export const TicketBuyModal: React.FC<TicketBuyModalProps> = ({
  draw,
  userBalance,
  userBonusBalance = 0,
  bonusRules,
  onClose,
  onConfirmPurchase
}) => {
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [selectedDigits, setSelectedDigits] = useState<number[]>([4, 8, 2, 9, 1, 0]);
  const [walletType, setWalletType] = useState<'main' | 'bonus'>('main');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!draw) return null;

  const isBonusAllowedForLottery = (bonusRules?.allowRegularLottery ?? false) && (bonusRules?.isBonusSystemActive ?? true);
  const effectiveBalance = walletType === 'bonus' ? userBonusBalance : userBalance;

  const digitLength = draw.category === '4D Express' ? 4 : 6;

  // Auto-generate random ticket
  const handleQuickPick = () => {
    soundFx.playClick();
    const newDigits = Array.from({ length: digitLength }, () => Math.floor(Math.random() * 10));
    setSelectedDigits(newDigits);
  };

  const handleDigitChange = (index: number, val: string) => {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) {
      const updated = [...selectedDigits];
      updated[index] = parsed;
      setSelectedDigits(updated);
    }
  };

  const totalPrice = draw.ticketPrice * ticketCount;

  const handleBuy = () => {
    setErrorMsg('');

    if (walletType === 'bonus' && !isBonusAllowedForLottery) {
      setErrorMsg('বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে। এই লটারির জন্য মূল ব্যালেন্স ব্যবহার করুন।');
      return;
    }

    if (totalPrice > effectiveBalance) {
      setErrorMsg(
        walletType === 'bonus'
          ? `Insufficient bonus balance (₹${userBonusBalance.toLocaleString('en-IN')}). Please select Main Wallet.`
          : `Insufficient wallet balance (₹${userBalance.toLocaleString('en-IN')}). Please deposit funds.`
      );
      return;
    }

    // Generate ticket number arrays
    const tickets: number[][] = [];
    for (let i = 0; i < ticketCount; i++) {
      if (i === 0) {
        tickets.push(selectedDigits.slice(0, digitLength));
      } else {
        tickets.push(Array.from({ length: digitLength }, () => Math.floor(Math.random() * 10)));
      }
    }

    soundFx.playCoin();
    onConfirmPurchase(draw, tickets, totalPrice, walletType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overscroll-none select-none animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900/98 border border-amber-500/35 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col justify-between max-h-[96vh] overscroll-none">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Ticket className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-white font-mono leading-tight">Buy Lottery Ticket</h2>
              <p className="text-[10px] text-amber-400/80 truncate max-w-[200px]">{draw.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-2.5">
          
          {/* Payment Wallet Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block font-mono">
              Payment Source
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setWalletType('main');
                }}
                className={`p-2.5 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                  walletType === 'main'
                    ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-400 font-bold uppercase">Main Cash</span>
                  {walletType === 'main' && <CheckCircle2 className="w-3 h-3 text-amber-400" />}
                </div>
                <div className="text-xs font-black text-white mt-0.5">₹{userBalance.toFixed(2)}</div>
              </button>

              <button
                type="button"
                disabled={!isBonusAllowedForLottery}
                onClick={() => {
                  if (isBonusAllowedForLottery) {
                    soundFx.playClick();
                    setWalletType('bonus');
                  }
                }}
                className={`p-2.5 rounded-xl border text-left font-mono transition-all ${
                  walletType === 'bonus'
                    ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/40 shadow-md'
                    : 'bg-slate-950 border-slate-800'
                } ${!isBonusAllowedForLottery ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-purple-300 font-bold uppercase flex items-center gap-1">
                    Bonus
                    {!isBonusAllowedForLottery && <Lock className="w-2.5 h-2.5" />}
                  </span>
                  {walletType === 'bonus' && <CheckCircle2 className="w-3 h-3 text-purple-400" />}
                </div>
                <div className="text-xs font-black text-purple-200 mt-0.5">₹{userBonusBalance.toFixed(2)}</div>
              </button>
            </div>

            {!isBonusAllowedForLottery && (
              <p className="text-[10px] text-amber-400/90 font-mono">
                🔒 বোনাস ব্যালেন্স শুধুমাত্র <strong>থ্রী সুপার কার ড্র</strong>-তে প্রযোজ্য।
              </p>
            )}
          </div>

          {/* Ticket Number Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Choose Lucky Numbers
              </label>
              <button
                type="button"
                onClick={handleQuickPick}
                className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Pick</span>
              </button>
            </div>

            {/* Digit Slots */}
            <div className="flex items-center justify-center gap-2 my-3">
              {Array.from({ length: digitLength }).map((_, idx) => (
                <input
                  key={idx}
                  type="number"
                  min="0"
                  max="9"
                  value={selectedDigits[idx] ?? 0}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  className="w-11 h-13 text-center text-xl font-black font-mono bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 text-amber-300 rounded-2xl shadow-inner outline-none transition-all"
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Click digits to change manually or use Quick Pick for random numbers.
            </p>
          </div>

          {/* Ticket Quantity Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
              Select Quantity (Type or Choose)
            </label>
            <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { soundFx.playClick(); setTicketCount(Math.max(1, ticketCount - 1)); }}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                -
              </button>
              <div className="flex items-center justify-center gap-1.5 flex-1">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={ticketCount || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTicketCount(isNaN(val) ? 1 : Math.max(1, val));
                  }}
                  className="w-20 bg-slate-900 border border-amber-500/50 rounded-xl px-2 py-1 text-center font-mono font-black text-amber-300 text-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <span className="text-xs font-mono font-bold text-slate-400">
                  {ticketCount === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { soundFx.playClick(); setTicketCount(ticketCount + 1); }}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                +
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {[1, 5, 10, 50, 80, 100].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => { soundFx.playClick(); setTicketCount(qty); }}
                  className={`py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-all cursor-pointer text-center ${
                    ticketCount === qty
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/30'
                  }`}
                >
                  {qty}x
                </button>
              ))}
            </div>
          </div>

          {/* Cost Summary Box */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Price per Ticket:</span>
              <span className="text-white font-bold">₹{draw.ticketPrice}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Selected Quantity:</span>
              <span className="text-white font-bold">{ticketCount}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
              <span className="font-sans font-bold text-slate-200">Total Payable:</span>
              <span className="font-extrabold text-amber-400 text-base">₹{totalPrice}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <Wallet className="w-3 h-3 text-amber-400" /> Available {walletType === 'bonus' ? 'Bonus' : 'Main'} Balance:
              </span>
              <span className="text-emerald-400 font-bold">₹{effectiveBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Confirm Purchase Button */}
          <button
            type="button"
            onClick={handleBuy}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>CONFIRM PURCHASE (₹{totalPrice})</span>
          </button>

        </div>

      </div>
    </div>
  );
};
