import React, { useState, useEffect } from 'react';
import { X, Trophy, Flame, Sparkles, CheckCircle2, Clock, Calendar, Search, Ticket, Zap } from 'lucide-react';
import { SuperCarDrawIssue, PurchasedTicket, SuperCarConfig, SuperCarColor } from '../types';
import { SUPER_CARS, getSuperCarInfo, getSuperCarDailySlots, formatCountdown, sortSuperCarSlotsSmart, SuperCarSlotItem } from '../utils/supercar';
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

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // 1-second interval to update live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Selected Date Object parsed safely in local timezone to avoid UTC shifting
  const [targetY, targetM, targetD] = (selectedDateStr || todayStr).split('-').map(Number);
  const targetDate = new Date(targetY, targetM - 1, targetD);

  // Get daily slots (84 slots: 08:00 AM to 10:00 PM every 10 mins)
  const rawDailySlots: SuperCarSlotItem[] = getSuperCarDailySlots(targetDate, pastDraws, config);

  // Filter slots by status & search term
  const filteredSlots = rawDailySlots.filter((slot) => {
    // Status Filter
    if (activeFilter === 'completed' && slot.status !== 'completed') return false;
    if (activeFilter === 'active' && slot.status !== 'active') return false;
    if (activeFilter === 'upcoming' && slot.status !== 'upcoming') return false;

    // Search Filter
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      const matchSlot = slot.slotLabel.toLowerCase().includes(query);
      const matchTime = slot.timeLabel.toLowerCase().includes(query);
      const matchIssue = slot.issueId.toLowerCase().includes(query);
      const matchWinner = slot.winningCar ? slot.winningCar.toLowerCase().includes(query) : false;
      const matchDateStr = selectedDateStr.includes(query) || targetDate.toLocaleDateString('en-US').includes(query) || targetDate.toLocaleDateString('en-GB').includes(query);
      return matchSlot || matchTime || matchIssue || matchWinner || matchDateStr;
    }

    return true;
  });

  // Smart sort: Active draw first, then completed draws newest to oldest, then upcoming
  const sortedSlots = sortSuperCarSlotsSmart(filteredSlots);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col h-[94vh] sm:h-[90vh] my-auto">
        
        {/* TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  🏎️ 3 Super Car VIP Draw Results
                </h2>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-sans">
                Live 84 Daily Slots • 08:00 AM to 10:00 PM • Real-Time 10-Min Results
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE MAIN BODY */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">

          {/* CALENDAR DATE SELECTOR CARD */}
          <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Find Results by Calendar Date</span>
                <span className="text-[10px] text-amber-400 font-bold">
                  Selected Date: {selectedDateStr}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleQuickDate('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDateStr === todayStr
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                Today
              </button>

              <button
                onClick={() => handleQuickDate('yesterday')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              >
                Yesterday
              </button>

              <div className="relative flex-1 min-w-[140px]">
                <input
                  type="date"
                  value={selectedDateStr}
                  onChange={(e) => {
                    soundFx.playClick();
                    setSelectedDateStr(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* FILTER TABS */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 text-center">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'completed', label: 'Completed' },
              { id: 'active', label: 'Active Now' },
              { id: 'upcoming', label: 'Upcoming' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  setActiveFilter(tab.id as any);
                }}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search slot, number or winner..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-2xl pl-9 pr-4 py-2.5 outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          {/* RESULTS SLOTS LIST */}
          <div className="space-y-3">
            {sortedSlots.length === 0 ? (
              <div className="p-8 bg-slate-950/80 rounded-2xl border border-slate-800 text-center space-y-2">
                <Clock className="w-8 h-8 text-amber-500/60 mx-auto animate-spin [animation-duration:6s]" />
                <p className="text-xs font-bold text-slate-400">No draw slots found matching your criteria.</p>
              </div>
            ) : (
              sortedSlots.map((slot, index) => {
                const isLatestResult = slot.status === 'completed' && (index === 0 || sortedSlots[index - 1]?.status === 'active');
                const winningCarInfo = slot.winningCar ? getSuperCarInfo(slot.winningCar, config) : null;
                const multiplier = config?.carMultipliers?.[slot.winningCar || 'black'] || config?.prizeMultiplier || 2.8;

                return (
                  <div
                    key={slot.issueId}
                    className={`rounded-3xl border overflow-hidden transition-all shadow-xl ${
                      slot.status === 'active'
                        ? 'bg-slate-950 border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/30'
                        : isLatestResult
                        ? 'bg-slate-950/90 border-amber-500/50'
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* SLOT CARD HEADER */}
                    <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                          {slot.slotLabel}
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {slot.timeLabel}
                        </span>
                      </div>

                      {/* BADGE STATUS */}
                      <div>
                        {slot.status === 'active' ? (
                          <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/20 animate-pulse">
                            <Sparkles className="w-3 h-3 fill-slate-950" />
                            <span>LIVE</span>
                          </span>
                        ) : isLatestResult ? (
                          <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                            <Sparkles className="w-3 h-3" />
                            <span>📌 LATEST RESULT</span>
                          </span>
                        ) : slot.status === 'completed' ? (
                          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full uppercase">
                            COMPLETED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full uppercase">
                            UPCOMING
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SLOT CARD BODY */}
                    <div className="p-3.5 space-y-3">

                      {/* STATE 1: ACTIVE LIVE DRAW IN PROGRESS */}
                      {slot.status === 'active' && (
                        <div className="p-4 bg-gradient-to-br from-amber-950/60 via-slate-950 to-slate-900 rounded-2xl border border-amber-500/40 text-center space-y-2 shadow-inner">
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                            <Flame className="w-5 h-5 fill-amber-400 animate-bounce" />
                          </div>

                          <h3 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                            ACTIVE LIVE DRAW IN PROGRESS
                          </h3>

                          <div className="text-base sm:text-lg font-black text-white flex items-center justify-center gap-1.5 font-mono">
                            <Clock className="w-4 h-4 text-amber-400 animate-spin [animation-duration:3s]" />
                            <span>{formatCountdown(slot.timeRemainingMs)} remaining</span>
                          </div>

                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, Math.max(0, (1 - slot.timeRemainingMs / (10 * 60 * 1000)) * 100))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* STATE 2: COMPLETED WINNER RESULT */}
                      {slot.status === 'completed' && winningCarInfo && (
                        <div className="flex items-center justify-between gap-3 p-2 bg-slate-900/80 rounded-2xl border border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="relative w-16 h-12 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                              <img src={winningCarInfo.image} alt={winningCarInfo.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                              <span className={`absolute bottom-0.5 left-0.5 text-[7px] font-black px-1 rounded uppercase ${
                                slot.winningCar === 'red' ? 'bg-rose-500 text-white' : slot.winningCar === 'black' ? 'bg-amber-500 text-slate-950' : 'bg-yellow-400 text-slate-950'
                              }`}>
                                {slot.winningCar}
                              </span>
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-white uppercase block tracking-wide">
                                {winningCarInfo.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Ticket: <strong className="text-amber-400">{slot.matchedDraw?.winnerTicket || `TCK-${100000 + slot.slotNum * 123}`}</strong>
                              </span>
                              <span className="text-[10px] text-emerald-400 font-bold block">
                                {slot.matchedDraw?.winnerName || `Winner (${slot.slotLabel})`} • {multiplier}x Payout
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-slate-400 block font-bold">EST. WIN</span>
                            <span className="text-sm sm:text-base font-black text-amber-300">
                              {slot.matchedDraw?.prizeText || `₹${(100 * multiplier).toLocaleString('en-IN')}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* STATE 2B: COMPLETED BUT NO WINNING CAR SET YET */}
                      {slot.status === 'completed' && !winningCarInfo && (
                        <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                          <span>Slot #{slot.slotNum} Completed</span>
                          <span className="text-amber-400 font-bold">Awaiting Result Publish</span>
                        </div>
                      )}

                      {/* STATE 3: UPCOMING DRAW */}
                      {slot.status === 'upcoming' && (
                        <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Starts at {slot.timeLabel}</span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Scheduled</span>
                        </div>
                      )}

                      {/* BUY TICKET BUTTON */}
                      <button
                        onClick={() => {
                          soundFx.playClick();
                          onClose();
                          if (onBuyTicketClick) onBuyTicketClick();
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-slate-950" />
                        <span>BUY TICKET</span>
                      </button>

                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 shrink-0 text-center">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            CLOSE RESULTS
          </button>
        </div>

      </div>
    </div>
  );
};
