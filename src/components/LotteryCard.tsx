import React, { useState, useEffect } from 'react';
import { Trophy, Ticket, Sparkles, Clock, ArrowRight, Award, Eye } from 'lucide-react';
import { LotteryDraw } from '../types';
import { soundFx } from '../utils/audio';

interface LotteryCardProps {
  draw: LotteryDraw;
  onBuyTicket: (draw: LotteryDraw) => void;
  onViewResults?: (drawId?: string) => void;
  compact?: boolean;
}

export const LotteryCard: React.FC<LotteryCardProps> = React.memo(({
  draw,
  onBuyTicket,
  onViewResults,
  compact = true
}) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });
  const [isOpen, setIsOpen] = useState<boolean>(true);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, draw.endTime - now);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
      setIsOpen(diff > 0 && draw.status !== 'completed');
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [draw.endTime, draw.status]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="relative group bg-slate-950/95 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3.5 shadow-lg shadow-black/60 transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between overflow-hidden">
      
      {/* Top Banner Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${draw.bannerGradient || 'from-amber-500 via-yellow-400 to-amber-600'}`}></div>

      <div>
        {/* Top Header Row: Category Badge + Live Status */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 truncate max-w-[65%]">
            <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span className="truncate">{draw.badgeText || draw.category}</span>
          </span>

          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            isOpen
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
              : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
          }`}>
            {isOpen ? '● OPEN' : 'CLOSED'}
          </span>
        </div>

        {/* Lottery Title */}
        <h3 className="text-xs sm:text-sm font-black text-white font-mono tracking-tight group-hover:text-amber-400 transition-colors line-clamp-1 leading-snug">
          {draw.title}
        </h3>

        {/* Period & Countdown Timer */}
        <div className="text-[10px] text-slate-400 font-mono my-2 flex items-center justify-between bg-slate-900/90 px-2 py-1.5 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 font-medium">#{draw.id.slice(-6).toUpperCase()}</span>
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}</span>
          </div>
        </div>

        {/* 1st Prize Highlight Card */}
        <div className="p-2 sm:p-2.5 bg-slate-900/95 rounded-xl border border-amber-500/20 mb-2.5 flex items-center justify-between">
          <div>
            <span className="text-[8px] sm:text-[9px] uppercase font-bold text-amber-400/80 tracking-wider block font-mono">
              1ST PRIZE
            </span>
            <span className="text-sm sm:text-base md:text-lg font-black text-amber-300 font-mono tracking-tight">
              ₹{draw.firstPrize.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow shrink-0">
            <Trophy className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Footer: Ticket Price & Play Button */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 uppercase font-medium">TICKET</span>
          <span className="text-xs sm:text-sm font-black text-amber-400 font-mono">₹{draw.ticketPrice}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onBuyTicket(draw);
          }}
          disabled={!isOpen}
          className={`px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-[11px] sm:text-xs rounded-full shadow-md shadow-amber-500/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 ${
            !isOpen ? 'opacity-50 cursor-not-allowed grayscale' : ''
          }`}
        >
          <Ticket className="w-3 h-3" />
          <span>PLAY</span>
          <ArrowRight className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>

    </div>
  );
});
