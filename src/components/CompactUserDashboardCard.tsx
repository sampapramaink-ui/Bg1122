import React from 'react';
import { Wallet, Plus, ArrowUpRight, Disc, Dices, Ticket, Trophy, Sparkles, ShieldCheck } from 'lucide-react';
import { User, PurchasedTicket } from '../types';
import { soundFx } from '../utils/audio';

interface CompactUserDashboardCardProps {
  user: User;
  activeTicketsCount: number;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenRoulette: () => void;
  onOpenLuckyWheel: () => void;
  onOpenMyTickets: () => void;
  onOpenResults: () => void;
}

export const CompactUserDashboardCard: React.FC<CompactUserDashboardCardProps> = ({
  user,
  activeTicketsCount,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenRoulette,
  onOpenLuckyWheel,
  onOpenMyTickets,
  onOpenResults
}) => {
  return (
    <div className="relative rounded-2xl sm:rounded-3xl bg-slate-900/95 border border-amber-500/30 p-3 sm:p-5 shadow-2xl backdrop-blur-md overflow-hidden font-sans space-y-3 sm:space-y-4">
      {/* Background HD Ambient Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* COMPACT TOP HERO BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-amber-300 text-[10px] font-mono font-black tracking-wide">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>INDIA'S #1 HD CASINO & LOTTERY</span>
          </div>
          <span className="hidden md:inline-block text-[11px] text-slate-400 font-mono">
            Verified 100% Transparent Live Payouts
          </span>
        </div>

        {/* 3 Quick Step Micro Badges */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black flex items-center justify-center">1</span>
            <span className="text-slate-300 font-bold">Deposit</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black flex items-center justify-center">2</span>
            <span className="text-slate-300 font-bold">Play</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black flex items-center justify-center">3</span>
            <span className="text-emerald-300 font-bold">Withdraw</span>
          </div>
        </div>
      </div>

      {/* COMBINED 3 COMPACT USER SECTIONS GRID */}
      {/* Mobile: Compact 3-Row/Col Layout | Tablet/Desktop: 3 Equal Columns Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5">
        
        {/* SECTION 1: WALLET & CASH OUT */}
        <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl sm:rounded-2xl hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2.5 group">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Wallet Balance</span>
                <span className="text-sm sm:text-base font-black text-amber-300 font-mono tracking-tight">
                  ₹{Number(user.balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono font-bold shrink-0">
              Instant UPI
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs font-mono rounded-lg shadow-md shadow-amber-500/20 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Deposit</span>
            </button>

            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenWithdraw(); }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs font-mono rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: CASINO & DAILY SPIN */}
        <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl sm:rounded-2xl hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2.5 group">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Disc className="w-4 h-4 animate-spin [animation-duration:10s]" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Casino & Spin</span>
                <span className="text-xs sm:text-sm font-bold text-white font-mono flex items-center gap-1">
                  <span>Roulette & Wheel</span>
                </span>
              </div>
            </div>
            <div className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono font-bold shrink-0">
              Live Games
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenRoulette(); }}
              className="px-2 py-1.5 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-mono rounded-lg shadow-md flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5 text-amber-300" />
              <span>Roulette</span>
            </button>

            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenLuckyWheel(); }}
              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs font-mono rounded-lg border border-emerald-500/30 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Daily Spin</span>
            </button>
          </div>
        </div>

        {/* SECTION 3: MY TICKETS & RESULTS */}
        <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl sm:rounded-2xl hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2.5 group">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">Active Tickets</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                  {activeTicketsCount} Active {activeTicketsCount === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </div>
            </div>
            <div className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono font-bold shrink-0">
              Live Draws
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenMyTickets(); }}
              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs font-mono rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              <span>My Tickets</span>
            </button>

            <button
              type="button"
              onClick={() => { soundFx.playClick(); onOpenResults(); }}
              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs font-mono rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Results</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
