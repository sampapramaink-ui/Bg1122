import React, { useState } from 'react';
import { Flame, Sparkles, Trophy, Award, Ticket, ArrowRight, Clock } from 'lucide-react';
import { LotteryDraw, LotteryDrawResult } from '../types';
import { LotteryCard } from './LotteryCard';
import { soundFx } from '../utils/audio';

interface LotterySectionProps {
  draws: LotteryDraw[];
  onBuyTicket: (draw: LotteryDraw) => void;
  onViewResults?: (drawId?: string) => void;
  results?: LotteryDrawResult[];
}

export const LotterySection: React.FC<LotterySectionProps> = React.memo(({
  draws,
  onBuyTicket,
  onViewResults,
  results = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Bumper', 'Speed 1m', 'Daily Mega', '4D Express'];

  const filteredDraws = selectedCategory === 'All'
    ? draws
    : draws.filter(d => d.category === selectedCategory || d.badgeText?.includes(selectedCategory));

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 font-sans">
      
      {/* Dedicated Enclosed Lottery Container Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-5 shadow-2xl space-y-4">
        
        {/* Section Header: Icon, Title, Live Badge, Subtitle & Filter Pills */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold shadow-md shrink-0">
              <Flame className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Lottery
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  {draws.length} Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                Select a lottery card below to pick numbers and enter draw
              </p>
            </div>
          </div>

          {/* Category Filter Pills & Results Button */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  soundFx.playClick();
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}

            {onViewResults && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onViewResults();
                }}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-400 font-bold text-xs rounded-full shadow transition-all flex items-center gap-1 shrink-0 ml-auto md:ml-2 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Results</span>
              </button>
            )}
          </div>

        </div>

        {/* 2-Column Divided Sub-Section Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4">
          {filteredDraws.map((draw) => (
            <LotteryCard
              key={draw.id}
              draw={draw}
              onBuyTicket={onBuyTicket}
              onViewResults={onViewResults}
              compact={true}
            />
          ))}
        </div>

        {filteredDraws.length === 0 && (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs font-bold">
            No lotteries currently active under this category. Please check back shortly.
          </div>
        )}

      </div>

    </div>
  );
});
