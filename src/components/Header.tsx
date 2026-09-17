import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Plus, Bell } from 'lucide-react';
import { User } from '../types';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  balance: number;
  unreadNotificationsCount: number;
  onOpenDeposit: () => void;
  onOpenNotifications: () => void;
  onOpenProfile?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  user?: User;
  onOpenAdmin?: () => void;
  onOpenReferral?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  balance,
  unreadNotificationsCount,
  onOpenDeposit,
  onOpenNotifications,
  onOpenProfile,
  user
}) => {
  const [isFlashingGreen, setIsFlashingGreen] = useState(false);
  const prevBalanceRef = useRef(balance);

  // Trigger subtle green flashing animation whenever balance increases
  useEffect(() => {
    if (balance > prevBalanceRef.current) {
      setIsFlashingGreen(true);
      const timer = setTimeout(() => setIsFlashingGreen(false), 2000);
      return () => clearTimeout(timer);
    }
    prevBalanceRef.current = balance;
  }, [balance]);

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-amber-500/30 shadow-2xl shadow-black/80 transition-all gpu-accelerate">
      {/* Clean 100% Width Layout Container */}
      <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        
        {/* Left Side: BETGURU Logo Only */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-2 cursor-pointer group hover:opacity-95 transition-all"
            title="BETGURU HD"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform animate-vibrate">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <span className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-500 font-mono leading-none drop-shadow">
                  B
                </span>
                <div className="absolute inset-0 bg-amber-400/20 blur-xs"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg sm:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm font-mono leading-none">
                  ETGURU
                </span>
                <span className="bg-amber-500/20 text-amber-400 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest hidden xs:inline-block font-mono">
                  HD
                </span>
              </div>
              <span className="text-[9px] text-emerald-400 font-bold tracking-tight -mt-0.5 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Wallet Balance + Deposit Option + Notification Bell Icon Only */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Integrated Wallet Badge (Balance Display + Deposit Option Button) */}
          <div 
            onClick={onOpenDeposit}
            className={`flex items-center bg-slate-900/90 border rounded-2xl p-1 sm:p-1.5 cursor-pointer shadow-lg transition-all group ${
              isFlashingGreen
                ? 'border-emerald-400 bg-emerald-950/40 shadow-emerald-500/50 ring-2 ring-emerald-400/60 animate-pulse'
                : 'border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center gap-2 px-2 py-0.5">
              <div className={`w-6 h-6 rounded-xl flex items-center justify-center transition-colors ${
                isFlashingGreen 
                  ? 'bg-emerald-500 text-slate-950 font-bold animate-bounce' 
                  : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950'
              }`}>
                <Wallet className="w-3.5 h-3.5" />
              </div>

              <div className="flex flex-col text-left">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold leading-none">WALLET</span>
                <span className={`text-xs sm:text-sm font-black font-mono tracking-tight leading-tight transition-colors ${
                  isFlashingGreen ? 'text-emerald-300 scale-105' : 'text-amber-300'
                }`}>
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Deposit Option Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                soundFx.playClick();
                onOpenDeposit();
              }}
              className="ml-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl golden-shadow-btn flex items-center gap-1 transition-all active:scale-95 shrink-0 relative overflow-hidden cursor-pointer"
              title="Add Money / Deposit"
            >
              <div className="relative flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 stroke-[3] animate-pulse" />
                <span className="absolute -inset-1 rounded-full bg-emerald-400/50 animate-ping pointer-events-none"></span>
              </div>
              <span className="hidden xs:inline font-mono font-black">DEPOSIT</span>
            </button>
          </div>

          {/* Notification Bell Icon */}
          <button
            onClick={() => {
              soundFx.playClick();
              onOpenNotifications();
            }}
            className="relative p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 hover:bg-slate-800 transition-all active:scale-90 shadow-md cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-md">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
});
