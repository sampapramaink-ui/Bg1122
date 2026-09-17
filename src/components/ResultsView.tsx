import React, { useState, useEffect } from 'react';
import { Award, Search, Trophy, Sparkles, Calendar, ArrowUpRight, Zap, ShieldCheck, Clock, Flame, Filter, RefreshCw } from 'lucide-react';
import { LotteryDraw, LotteryDrawResult, SuperCarDrawIssue, SuperCarConfig } from '../types';
import { getSuperCarInfo, getSuperCarDailySlots, formatCountdown, sortSuperCarSlotsSmart, SuperCarSlotItem } from '../utils/supercar';
import { soundFx } from '../utils/audio';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { INITIAL_DRAW_RESULTS } from '../data/mockData';

interface ResultsViewProps {
  draws: LotteryDraw[];
  onOpenBuyTicket: (draw: LotteryDraw) => void;
  supercarPastDraws?: SuperCarDrawIssue[];
  supercarConfig?: SuperCarConfig;
  lotteryResults?: LotteryDrawResult[];
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  draws,
  onOpenBuyTicket,
  supercarPastDraws = [],
  supercarConfig,
  lotteryResults: initialLotteryResults
}) => {
  const [activeTab, setActiveTab] = useState<'lottery' | 'supercar'>('lottery');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slotFilter, setSlotFilter] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [liveLotteryResults, setLiveLotteryResults] = useState<LotteryDrawResult[]>(initialLotteryResults || INITIAL_DRAW_RESULTS);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore listener for lottery draw results
  useEffect(() => {
    const qResults = query(collection(db, 'draw_results'), limit(100));
    const unsub = onSnapshot(qResults, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDrawResult));
        list.sort((a, b) => {
          const tA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.date || 0).getTime();
          const tB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.date || 0).getTime();
          return tB - tA;
        });
        setLiveLotteryResults(list);
      } else if (initialLotteryResults && initialLotteryResults.length > 0) {
        setLiveLotteryResults(initialLotteryResults);
      }
    }, (err) => console.warn('ResultsView draw_results snapshot notice:', err));

    return () => unsub();
  }, [initialLotteryResults]);

  // SuperCar Slot Computations
  const [y, m, d] = selectedDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const dailySlots: SuperCarSlotItem[] = getSuperCarDailySlots(targetDate, supercarPastDraws, supercarConfig);

  const filteredSlots = dailySlots.filter((slot) => {
    if (slotFilter === 'completed' && slot.status !== 'completed') return false;
    if (slotFilter === 'active' && slot.status !== 'active') return false;
    if (slotFilter === 'upcoming' && slot.status !== 'upcoming') return false;

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchDateStr = selectedDateStr.includes(q) || targetDate.toLocaleDateString('en-US').includes(q) || targetDate.toLocaleDateString('en-GB').includes(q);
      return (
        slot.slotLabel.toLowerCase().includes(q) ||
        slot.timeLabel.toLowerCase().includes(q) ||
        slot.issueId.toLowerCase().includes(q) ||
        (slot.winningCar && slot.winningCar.toLowerCase().includes(q)) ||
        matchDateStr
      );
    }
    return true;
  });

  const sortedSlots = sortSuperCarSlotsSmart(filteredSlots);

  // Filtered Lottery Results
  const filteredLottery = liveLotteryResults.filter((res) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q ||
      res.title.toLowerCase().includes(q) ||
      res.id.toLowerCase().includes(q) ||
      (res.drawId && res.drawId.toLowerCase().includes(q)) ||
      (res.winningNumbers || []).join('').includes(q);

    const matchesCategory = selectedCategory === 'all' || 
      (res.category && res.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (res.title && res.title.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24 font-mono">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 p-5 sm:p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-slate-950">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-slate-950 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              REAL-TIME ARCHIVE
            </span>
            <span className="text-xs font-bold text-slate-900">• BETGURU RESULTS</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">Official Results & Winning Numbers</h1>
          <p className="text-xs font-semibold text-slate-900/80">
            Provably fair lottery draw records, winning numbers, and payout audit logs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-950/40 p-1.5 rounded-2xl border border-black/20 self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('lottery');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lottery'
                ? 'bg-slate-950 text-amber-400 shadow-md border border-amber-400/40'
                : 'text-slate-900 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>4 LOTTERIES</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('supercar');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'supercar'
                ? 'bg-slate-950 text-amber-400 shadow-md border border-amber-400/40'
                : 'text-slate-900 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>SUPER CAR</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-amber-500/20 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'lottery' ? "Search draw name, ID or digits (e.g. 482910)..." : "Search Issue ID or Car..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white placeholder-slate-500 focus:border-amber-400 outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filters for Lottery Tab */}
        {activeTab === 'lottery' && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {['all', 'Bumper', 'Speed 1m', 'Daily Mega', '4D Express'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  soundFx.playClick();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 border border-amber-400'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All Lotteries' : cat}
              </button>
            ))}
          </div>
        )}

        {/* Date & Status Filters for SuperCar Tab */}
        {activeTab === 'supercar' && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 text-xs text-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              {(['all', 'completed', 'active', 'upcoming'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    soundFx.playClick();
                    setSlotFilter(mode);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                    slotFilter === mode
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: 4 OFFICIAL LOTTERY RESULTS */}
      {activeTab === 'lottery' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLottery.map((res) => {
              const matchedDraw = draws.find(d => d.id === res.drawId || d.title.toLowerCase() === res.title.toLowerCase()) || draws[0];

              return (
                <div
                  key={res.id || res.drawId}
                  className="bg-slate-900/95 border border-amber-500/30 hover:border-amber-400 rounded-3xl p-5 shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Ambient Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div>
                    {/* Top Row: Draw ID & Date */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {res.category || 'Official Draw'}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        {res.date}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-black text-white font-mono tracking-tight mb-3">
                      {res.title}
                    </h3>

                    {/* Winning Numbers Presentation (Super Car High Contrast) */}
                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Winning Number</span>
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {res.declaredBy || 'Fair RNG Draw'}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-2 py-1">
                        {(res.winningNumbers || []).map((digit, idx) => (
                          <span
                            key={idx}
                            className="w-9 h-11 bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-600 text-slate-950 font-black font-mono text-xl rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 border border-yellow-200"
                          >
                            {digit}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Prize Matrix */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 text-[11px] mb-3">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block">1st Prize Jackpot</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          ₹{res.firstPrize.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase block">Total Winners</span>
                        <span className="text-sm font-black text-amber-300 font-mono">
                          {res.totalWinners || 36} Players Won
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Play Next Round CTA */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Next round is live now!
                    </span>
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        if (matchedDraw) onOpenBuyTicket(matchedDraw);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Play This Draw</span>
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLottery.length === 0 && (
            <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400 text-xs font-mono font-bold">
              No lottery results match your search criteria.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: THREE SUPER CAR RESULTS */}
      {activeTab === 'supercar' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {sortedSlots.map((slot) => {
              const carInfo = slot.winningCar ? getSuperCarInfo(slot.winningCar, supercarConfig) : null;

              return (
                <div
                  key={slot.issueId}
                  className={`relative p-4 rounded-3xl border transition-all ${
                    slot.status === 'completed'
                      ? 'bg-slate-900/90 border-slate-800'
                      : slot.status === 'active'
                      ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/30'
                      : 'bg-slate-950/60 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-white">{slot.slotLabel}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      slot.status === 'completed' ? 'bg-slate-800 text-slate-300' :
                      slot.status === 'active' ? 'bg-amber-500 text-slate-950 animate-pulse font-black' :
                      'bg-slate-900 text-slate-500'
                    }`}>
                      {slot.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 mb-3">{slot.issueId} • {slot.timeLabel}</div>

                  {slot.status === 'completed' && carInfo && (
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
                      <img
                        src={carInfo.image}
                        alt={carInfo.name}
                        className="w-12 h-12 object-contain rounded-xl bg-slate-900 p-1"
                      />
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-bold">Winning Supercar</span>
                        <span className="text-xs font-black text-amber-300">{carInfo.name}</span>
                        <span className="text-[10px] text-emerald-400 block font-bold">2.8x Payout</span>
                      </div>
                    </div>
                  )}

                  {slot.status === 'active' && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-center space-y-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Draw in Progress</span>
                      <div className="text-sm font-black text-white animate-pulse">
                        {formatCountdown(slot.timeRemainingMs)}
                      </div>
                    </div>
                  )}

                  {slot.status === 'upcoming' && (
                    <div className="p-3 bg-slate-950 rounded-2xl text-center text-slate-500 text-[11px]">
                      Opens at {slot.timeLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
