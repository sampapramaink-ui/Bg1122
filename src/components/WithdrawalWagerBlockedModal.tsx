import React from 'react';
import { 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Gamepad2, 
  Lock, 
  Coins, 
  Flame, 
  CheckCircle2, 
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { UserWagerStatus } from '../utils/wagerEngine';
import { soundFx } from '../utils/audio';

interface WithdrawalWagerBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UserWagerStatus;
  requestedAmount?: number;
  onPlayGames?: () => void;
}

export const WithdrawalWagerBlockedModal: React.FC<WithdrawalWagerBlockedModalProps> = ({
  isOpen,
  onClose,
  status,
  requestedAmount = 0,
  onPlayGames
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-amber-950/50 relative overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/20 animate-bounce">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2 font-sans">
            উইথড্রয়াল রিকোয়েস্ট ব্লকড • WAGER INCOMPLETE
          </span>

          <h3 className="text-lg sm:text-xl font-black text-white font-sans">
            উয়েজার সম্পূর্ণ না হওয়া পর্যন্ত উইথড্র সম্ভব নয়!
          </h3>

          <p className="text-xs text-slate-300 font-sans mt-1.5 max-w-md">
            আপনার মেইন ব্যালেন্স অথবা বোনাস ব্যালেন্সের প্রয়োজনীয় উয়েজার (Turnover Requirement) এখনো বাকি রয়েছে।
          </p>
        </div>

        {/* Summary Card with details */}
        <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs font-sans">
            <span className="text-slate-400">উইথড্রয়াল অ্যামাউন্ট রিকোয়েস্ট:</span>
            <span className="font-black text-rose-400 font-mono text-sm">
              ₹{requestedAmount > 0 ? requestedAmount.toLocaleString('en-IN') : 'N/A'}
            </span>
          </div>

          {/* Main Balance Wager details */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1 font-sans">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                মেইন ব্যালেন্স উয়েজার:
              </span>
              <span className={status.mainRemaining <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {status.mainRemaining <= 0 ? '✓ সম্পূর্ণ' : `বাকি: ₹${status.mainRemaining.toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>প্রয়োজনীয়: ₹{status.mainRequired.toLocaleString('en-IN')}</span>
              <span>বাজি ধরেছেন: ₹{status.mainCompleted.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Bonus Balance Wager details */}
          {status.bonusRequired > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1 font-sans">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-purple-400" />
                  বোনাস ব্যালেন্স উয়েজার:
                </span>
                <span className={status.bonusRemaining <= 0 ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
                  {status.bonusRemaining <= 0 ? '✓ সম্পূর্ণ' : `বাকি: ₹${status.bonusRemaining.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>প্রয়োজনীয়: ₹{status.bonusRequired.toLocaleString('en-IN')}</span>
                <span>বাজি ধরেছেন: ₹{status.bonusCompleted.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {/* Total Remaining to Wager Banner */}
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center">
            <span className="text-[11px] text-amber-300 uppercase block font-sans font-bold">
              উইথড্র করতে আরও মোট বাজি ধরতে হবে
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-0.5">
              ₹{status.totalRemaining.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400 block font-sans mt-1">
              (Aviator, Dragon Tiger, Roulette, Andar Bahar বা লটারিতে বাজি ধরলে উয়েজার স্বয়ংক্রিয়ভাবে পূর্ণ হবে)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer text-center font-sans"
          >
            বুঝেছি, বন্ধ করুন
          </button>

          {onPlayGames && (
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
                onPlayGames();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 font-sans"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>গেম খেলুন ও উয়েজার সম্পন্ন করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
