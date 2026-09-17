import React from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { LIVE_WINNERS_FEED } from '../data/mockData';

export const LiveWinnersTicker: React.FC = React.memo(() => {
  return (
    <div className="w-full bg-slate-950/80 border-y border-amber-500/20 py-2.5 px-4 overflow-hidden shadow-inner flex items-center gap-3 gpu-accelerate">
      <div className="flex items-center gap-1.5 shrink-0 bg-amber-500/10 text-amber-400 font-extrabold text-[11px] px-2.5 py-1 rounded-full border border-amber-500/30 uppercase tracking-widest">
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        <span>LIVE WINNERS</span>
      </div>

      <div className="relative overflow-hidden w-full">
        <div className="flex gap-6 animate-marquee whitespace-nowrap text-xs font-mono">
          {LIVE_WINNERS_FEED.concat(LIVE_WINNERS_FEED).map((w, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 shrink-0">
              <span className="font-bold text-white">{w.name}</span>
              <span className="text-slate-400">won</span>
              <span className="font-black text-emerald-400 font-mono">₹{w.amount.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-amber-400/80">in {w.drawName}</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
