import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles, X, Flame, CheckCircle2, ArrowRight } from 'lucide-react';
import { SuperCarColor, SuperCarConfig } from '../types';
import { getSuperCarInfo } from '../utils/supercar';
import { soundFx } from '../utils/audio';

export interface SuperCarWinToastData {
  id: string;
  winningCar: SuperCarColor;
  amountWon: number;
  issueId?: string;
  ticketCount?: number;
}

interface SuperCarWinToastProps {
  toast: SuperCarWinToastData | null;
  config?: SuperCarConfig;
  onClose: () => void;
  onViewTickets?: () => void;
}

export const SuperCarWinToast: React.FC<SuperCarWinToastProps> = ({
  toast,
  config,
  onClose,
  onViewTickets
}) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      setProgress(100);

      // Play victory sound fanfare
      try {
        soundFx.playWinFanfare();
      } catch (e) {
        console.warn('Audio play notice:', e);
      }

      // Auto dismiss timer (8 seconds)
      const DURATION = 8000;
      const intervalTime = 50;
      const step = (intervalTime / DURATION) * 100;

      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev <= step) {
            clearInterval(progressInterval);
            return 0;
          }
          return prev - step;
        });
      }, intervalTime);

      const dismissTimer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // allow fade out animation
      }, DURATION);

      return () => {
        clearInterval(progressInterval);
        clearTimeout(dismissTimer);
      };
    } else {
      setVisible(false);
    }
  }, [toast]);

  if (!toast || !visible) return null;

  const carInfo = getSuperCarInfo(toast.winningCar, config);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[94%] max-w-lg transition-all duration-300 transform animate-bounce-once">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950/95 border-2 border-amber-400 p-4 sm:p-5 shadow-[0_0_50px_rgba(245,158,11,0.5)] backdrop-blur-xl">

        {/* Ambient Glowing Background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Ribbon */}
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 rounded-xl shadow-lg shadow-amber-500/30 animate-pulse">
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest font-mono">
                  SUPERCAR DRAW WINNER
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  VERIFIED
                </span>
              </div>
              <h4 className="text-xs font-black text-white font-mono flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 inline" />
                CONGRATULATIONS! YOU WON!
              </h4>
            </div>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 200);
            }}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer"
            aria-label="Close Toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex items-center gap-3.5">
          {/* Winning Car Image Preview */}
          <div className="relative w-24 h-20 sm:w-28 sm:h-22 rounded-2xl overflow-hidden border-2 border-amber-400/80 shrink-0 shadow-xl group">
            <img
              src={carInfo.image}
              alt={carInfo.name}
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-1 left-1 bg-slate-950/90 text-amber-300 font-mono font-black text-[9px] px-1.5 py-0.5 rounded border border-amber-500/40">
              {carInfo.badge}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-xs font-bold text-slate-300 font-mono truncate">
              Winning Car: <span className="text-amber-300 font-extrabold">{carInfo.name}</span>
            </div>

            {toast.issueId && (
              <div className="text-[10px] text-slate-400 font-mono">
                Draw Issue: <span className="text-slate-200">{toast.issueId}</span>
              </div>
            )}

            {/* Won Amount Badge */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <div className="bg-gradient-to-r from-emerald-500/20 via-emerald-600/10 to-transparent border border-emerald-500/50 px-3 py-1.5 rounded-2xl flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                <span className="text-xs font-mono font-bold text-emerald-300">Payout:</span>
                <span className="text-base sm:text-lg font-mono font-black text-emerald-400 tracking-tight">
                  +₹{toast.amountWon.toLocaleString('en-IN')}
                </span>
              </div>

              {onViewTickets && (
                <button
                  onClick={() => {
                    setVisible(false);
                    onClose();
                    onViewTickets();
                  }}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md shrink-0"
                >
                  <span>Tickets</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mt-3.5 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 h-full transition-all duration-75 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

      </div>
    </div>
  );
};
