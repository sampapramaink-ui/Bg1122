import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Trophy, Flame, Sparkles, CheckCircle2, Clock, Calendar, Search, Ticket, Zap,
  ArrowLeft, RefreshCw, ChevronRight, Award, ShieldCheck, Filter
} from 'lucide-react';
import { SuperCarDrawIssue, PurchasedTicket, SuperCarConfig, SuperCarColor } from '../types';
import {
  SUPER_CARS,
  getSuperCarInfo,
  getSuperCarDailySlots,
  formatCountdown,
  sortSuperCarSlotsSmart,
  SuperCarSlotItem,
  getSuperCarSlotsPerDay
} from '../utils/supercar';
import { soundFx } from '../utils/audio';

interface SuperCarResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastDraws: SuperCarDrawIssue[];
  userTickets: PurchasedTicket[];
  config?: SuperCarConfig;
  onBuyTicketClick?: () => void;
}

export const SuperCarResultsModal: React.FC<SuperCarResultsModalProps> = ({
  isOpen,
  onClose,
  pastDraws,
  userTickets,
  config,
  onBuyTicketClick
}) => {
  if (!isOpen) return null;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // 1-second interval to update live countdown timer and schedule state
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Parse selected date safely in local timezone
  const targetDate = useMemo(() => {
    const [targetY, targetM, targetD] = (selectedDateStr || todayStr).split('-').map(Number);
    return new Date(targetY, targetM - 1, targetD);
  }, [selectedDateStr, todayStr]);

  // Compute 144 daily slots (24/7 continuous every 10 minutes)
  const rawDailySlots: SuperCarSlotItem[] = useMemo(() => {
    return getSuperCarDailySlots(targetDate, pastDraws, config);
  }, [targetDate, pastDraws, config, nowTick]);

  // Total daily slots count (144)
  const totalSlotsCount = getSuperCarSlotsPerDay(config);

  // Filter slots by status & search term
  const filteredSlots = useMemo(() => {
    return rawDailySlots.filter((slot) => {
      // Status Filter
      if (activeFilter === 'completed' && slot.status !== 'completed') return false;
      if (activeFilter === 'active' && slot.status !== 'active') return false;
      if (activeFilter === 'upcoming' && slot.status !== 'upcoming') return false;

      // Search Filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchSlot = slot.slotLabel.toLowerCase().includes(query) || String(slot.slotNum).includes(query);
        const matchTime = slot.timeLabel.toLowerCase().includes(query);
        const matchIssue = slot.issueId.toLowerCase().includes(query);
        const matchWinner = slot.winningCar ? slot.winningCar.toLowerCase().includes(query) : false;
        const matchDateStr = selectedDateStr.includes(query) || targetDate.toLocaleDateString('en-US').includes(query);
        return matchSlot || matchTime || matchIssue || matchWinner || matchDateStr;
      }

      return true;
    });
  }, [rawDailySlots, activeFilter, searchTerm, selectedDateStr, targetDate]);

  // Smart sort: Active live slot first, then completed draws newest to oldest, then upcoming
  const sortedSlots = useMemo(() => {
    return sortSuperCarSlotsSmart(filteredSlots);
  }, [filteredSlots]);

  // Slot statistics
  const completedCount = useMemo(() => rawDailySlots.filter((s) => s.status === 'completed').length, [rawDailySlots]);
  const activeCount = useMemo(() => rawDailySlots.filter((s) => s.status === 'active').length, [rawDailySlots]);
  const upcomingCount = useMemo(() => rawDailySlots.filter((s) => s.status === 'upcoming').length, [rawDailySlots]);

  const handleQuickDate = (type: 'today' | 'yesterday') => {
    soundFx.playClick();
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDateStr(`${year}-${month}-${day}`);
  };

  const handleClose = () => {
    soundFx.playClick();
    onClose();
  };

  const handleBuy = () => {
    soundFx.playClick();
    onClose();
    if (onBuyTicketClick) onBuyTicketClick();
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-slate-950 flex flex-col overflow-hidden text-white font-mono selection:bg-amber-500 selection:text-slate-950 animate-fade-in">
      
      {/* =========================================================================
          1. 100% FULL-SCREEN VIP TOP HEADER
         ========================================================================= */}
      <header className="px-4 sm:px-8 py-3.5 sm:py-4 bg-slate-900/95 border-b border-amber-500/30 backdrop-blur-xl flex items-center justify-between gap-4 shrink-0 shadow-2xl z-20">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 border border-slate-700/80 hover:border-amber-400 text-slate-300 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
            title="Return to Game"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Arena</span>
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/30 shrink-0">
            <Trophy className="w-5 h-5 stroke-[2.5]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-lg font-black text-white tracking-tight truncate">
                3 SUPER CAR 24/7 VIP RESULTS ARCHIVE
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 fill-amber-400" />
                <span>144 Daily Slots</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-sans truncate">
              Continuous 10-Minute Cycles • Synchronized Live Risk Engine • 100% Provably Fair
            </p>
          </div>
        </div>

        {/* Right Header Stats & Quick Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[10px]">Today's Progress:</span>
            <span className="text-emerald-400 font-black">{completedCount}</span>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400 font-bold">{totalSlotsCount}</span>
          </div>

          <button
            type="button"
            onClick={handleBuy}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>PLAY NOW</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800 hover:bg-rose-600 hover:text-white border border-slate-700 text-slate-400 transition-all cursor-pointer shrink-0"
            title="Close Results"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. FULL-WIDTH CONTROLS & FILTER TOOLBAR
         ========================================================================= */}
      <div className="px-4 sm:px-8 py-3 bg-slate-950/90 border-b border-slate-800/90 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0 z-10">
        
        {/* Date Selector & Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickDate('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDateStr === todayStr
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('yesterday')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Yesterday
            </button>
          </div>

          <div className="relative flex items-center bg-slate-900 border border-amber-500/30 rounded-2xl px-3 py-1.5 focus-within:border-amber-400 transition-all">
            <Calendar className="w-3.5 h-3.5 text-amber-400 mr-2 shrink-0" />
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => {
                soundFx.playClick();
                setSelectedDateStr(e.target.value);
              }}
              className="bg-transparent text-amber-300 font-mono text-xs font-bold outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'all', label: `All (${totalSlotsCount})` },
            { id: 'completed', label: `Completed (${completedCount})` },
            { id: 'active', label: `Live Now (${activeCount})` },
            { id: 'upcoming', label: `Upcoming (${upcomingCount})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setActiveFilter(tab.id as any);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Real-time Search Box */}
        <div className="relative min-w-[200px] md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search slot #, time, or car..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-2xl pl-8 pr-3 py-2 outline-none transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* =========================================================================
          3. 100% FULL-WIDTH ULTRA-RESPONSIVE RESULTS GRID
         ========================================================================= */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 custom-scrollbar space-y-4">
        
        {sortedSlots.length === 0 ? (
          <div className="p-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-center space-y-3 max-w-lg mx-auto my-12">
            <Clock className="w-10 h-10 text-amber-500/60 mx-auto animate-spin [animation-duration:6s]" />
            <h3 className="text-base font-black text-white">No Slots Found</h3>
            <p className="text-xs text-slate-400">
              No draw slots match your filter or search query for {selectedDateStr}.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveFilter('all');
                setSearchTerm('');
              }}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 sm:gap-4">
            {sortedSlots.map((slot, index) => {
              const isCompleted = slot.status === 'completed';
              const isActive = slot.status === 'active';
              const isUpcoming = slot.status === 'upcoming';
              const winningCarInfo = slot.winningCar ? getSuperCarInfo(slot.winningCar, config) : null;
              const multiplier = config?.carMultipliers?.[slot.winningCar || 'black'] || config?.prizeMultiplier || 2.8;

              return (
                <div
                  key={slot.issueId}
                  className={`rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xl ${
                    isActive
                      ? 'bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-950 border-amber-400 ring-2 ring-amber-400/40 shadow-amber-500/20'
                      : isCompleted
                      ? 'bg-slate-900/90 border-slate-800/90 hover:border-amber-500/40 hover:bg-slate-900'
                      : 'bg-slate-950/70 border-slate-900 opacity-60 hover:opacity-100'
                  }`}
                >
                  {/* Card Header: Slot # & Status */}
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-400">
                        {slot.slotLabel}
                      </span>
                      <span className="text-[10px] text-slate-400">• {slot.timeLabel}</span>
                    </div>

                    <div>
                      {isActive ? (
                        <span className="text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-md">
                          <Sparkles className="w-2.5 h-2.5 fill-current" />
                          <span>LIVE</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
                          DONE
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full uppercase">
                          SOON
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-center">
                    
                    {/* CASE 1: ACTIVE LIVE SLOT IN PROGRESS */}
                    {isActive && (
                      <div className="text-center space-y-2 py-1">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                          <Flame className="w-5 h-5 fill-amber-400 animate-bounce" />
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-300 font-bold block uppercase tracking-wider">
                            Live Draw Ending In:
                          </span>
                          <span className="text-base sm:text-lg font-black text-white">
                            {formatCountdown(slot.timeRemainingMs)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, Math.max(0, (1 - slot.timeRemainingMs / (10 * 60 * 1000)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* CASE 2: COMPLETED WINNER RESULT */}
                    {isCompleted && winningCarInfo && (
                      <div className="space-y-2">
                        <div className="relative h-24 sm:h-28 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 group">
                          <img
                            src={winningCarInfo.image}
                            alt={winningCarInfo.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                          <span className={`absolute top-2 left-2 text-[8px] font-black px-2 py-0.5 rounded-full uppercase shadow-md ${
                            slot.winningCar === 'red'
                              ? 'bg-rose-600 text-white'
                              : slot.winningCar === 'black'
                              ? 'bg-slate-900 text-amber-300 border border-amber-500/50'
                              : 'bg-yellow-400 text-slate-950'
                          }`}>
                            {slot.winningCar} CAR
                          </span>
                          <span className="absolute bottom-2 left-2 text-xs font-black text-white uppercase drop-shadow-md">
                            {winningCarInfo.name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 text-[10px]">Multiplier:</span>
                          <span className="text-emerald-400 font-black">{multiplier}x Payout</span>
                        </div>
                      </div>
                    )}

                    {/* CASE 3: COMPLETED PENDING DECLARATION */}
                    {isCompleted && !winningCarInfo && (
                      <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-center space-y-1 my-auto">
                        <Clock className="w-5 h-5 text-amber-400 mx-auto animate-spin" />
                        <span className="text-[10px] text-amber-300 font-bold block">
                          Publishing Live Result...
                        </span>
                      </div>
                    )}

                    {/* CASE 4: UPCOMING SLOT */}
                    {isUpcoming && (
                      <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-900 text-center space-y-1 my-auto">
                        <Clock className="w-5 h-5 text-slate-600 mx-auto" />
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Draw starts at {slot.timeLabel}
                        </span>
                      </div>
                    )}

                  </div>

                  {/* Card Footer: Action Button */}
                  <div className="p-2.5 pt-0">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={handleBuy}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>BET ON THIS SLOT</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleBuy}
                        className="w-full py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <span>Enter Arena</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* =========================================================================
          4. FOOTER STATUS BAR
         ========================================================================= */}
      <footer className="px-4 sm:px-8 py-2.5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-300 text-[11px] font-bold">
            Live Risk Engine Active • 0-Second Instant Draw Synchronization
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Date: <strong className="text-amber-400">{selectedDateStr}</strong></span>
          <span>•</span>
          <span>Total: <strong className="text-white">{rawDailySlots.length} Slots (24/7)</strong></span>
        </div>
      </footer>

    </div>
  );
};
