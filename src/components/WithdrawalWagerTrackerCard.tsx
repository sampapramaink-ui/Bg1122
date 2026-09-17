import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Coins, 
  Zap, 
  HelpCircle, 
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { UserWagerStatus } from '../utils/wagerEngine';

interface WithdrawalWagerTrackerCardProps {
  status: UserWagerStatus;
  compact?: boolean;
  onExploreGames?: () => void;
}

export const WithdrawalWagerTrackerCard: React.FC<WithdrawalWagerTrackerCardProps> = ({
  status,
  compact = false,
  onExploreGames
}) => {
  if (!status.enabled && !status.isExempt) return null;

  return (
    <div 
      className={`rounded-2xl border transition-all duration-300 font-mono ${
        status.isCompleted
          ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-emerald-900/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
          : 'bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-rose-950/30 border-amber-500/50 shadow-lg shadow-amber-950/30'
      } ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {status.isCompleted ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white uppercase tracking-wider font-sans">
                উইথড্রয়াল উয়েজার স্ট্যাটাস (Wager Status)
              </span>
              {status.isExempt && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full">
                  VIP EXEMPT
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              {status.isCompleted
                ? 'আপনার প্রয়োজনীয় উয়েজার সম্পূর্ণ হয়েছে। উইথড্র উন্মুক্ত!'
                : 'উইথড্রয়াল করার পূর্বে নির্ধারিত উয়েজার সম্পূর্ণ করতে হবে।'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-xs sm:text-sm font-black font-mono ${
            status.isCompleted ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {status.progressPercentage}%
          </span>
          <span className="text-[9px] text-slate-400 block font-sans">
            {status.isCompleted ? 'সম্পন্ন' : 'অগ্রগতি'}
          </span>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="w-full bg-slate-950/80 rounded-full h-2.5 p-0.5 border border-slate-800 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status.isCompleted
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-rose-500'
          }`}
          style={{ width: `${Math.max(4, status.progressPercentage)}%` }}
        />
      </div>

      {/* Main Balance & Bonus Balance Breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs mb-3">
        {/* Main Balance Wager Box */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-sans">
            <span>মেইন উয়েজার</span>
            <span className={status.mainRemaining <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {status.mainRemaining <= 0 ? '✓ সম্পন্ন' : 'বাকি আছে'}
            </span>
          </div>
          <div className="text-sm font-black text-white font-mono">
            ₹{status.mainCompleted.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">/ ₹{status.mainRequired.toLocaleString('en-IN')}</span>
          </div>
          {status.mainRemaining > 0 && (
            <div className="text-[10px] text-rose-400 font-sans mt-0.5">
              আরও বাজি প্রয়োজন: <strong className="font-mono">₹{status.mainRemaining.toLocaleString('en-IN')}</strong>
            </div>
          )}
        </div>

        {/* Bonus Balance Wager Box */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-sans">
            <span>বোনাস উয়েজার</span>
            <span className={status.bonusRemaining <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {status.bonusRemaining <= 0 ? '✓ সম্পন্ন' : 'বাকি আছে'}
            </span>
          </div>
          <div className="text-sm font-black text-white font-mono">
            ₹{status.bonusCompleted.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">/ ₹{status.bonusRequired.toLocaleString('en-IN')}</span>
          </div>
          {status.bonusRemaining > 0 && (
            <div className="text-[10px] text-rose-400 font-sans mt-0.5">
              আরও বাজি প্রয়োজন: <strong className="font-mono">₹{status.bonusRemaining.toLocaleString('en-IN')}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Warning Notice if incomplete */}
      {!status.isCompleted && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-sans">
          <div className="flex items-center gap-1.5 flex-1">
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              উইথড্র করতে মোট আরও <strong className="font-mono text-amber-200">₹{status.totalRemaining.toLocaleString('en-IN')}</strong> পরিমাণের বাজি ধরা বাকি।
            </span>
          </div>
          {onExploreGames && (
            <button
              onClick={onExploreGames}
              type="button"
              className="shrink-0 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
            >
              <span>বাজি ধরুন</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
