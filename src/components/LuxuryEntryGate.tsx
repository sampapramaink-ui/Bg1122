import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Zap, ArrowRight, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { captureAndSyncUserLocation } from '../utils/geolocation';
import { User } from '../types';

interface LuxuryEntryGateProps {
  user: User | null;
  onEnterSuccess: () => void;
}

export const LuxuryEntryGate: React.FC<LuxuryEntryGateProps> = ({ user, onEnterSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAllowAndEnter = () => {
    if (isProcessing || isExiting) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      soundFx.playClick();
    } catch (_) {}

    const proceedWithEntry = async () => {
      try {
        if (user && user.id && user.id !== 'anonymous') {
          await captureAndSyncUserLocation(user, 'login');
        }
      } catch (_) {}

      try {
        soundFx.playWinFanfare();
      } catch (_) {}

      setIsExiting(true);

      setTimeout(() => {
        try {
          sessionStorage.setItem('betguru_session_entered', 'true');
        } catch (_) {}
        onEnterSuccess();
      }, 450);
    };

    // Check if Geolocation API is available in browser
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proceedWithEntry();
        }
      }, 4000);

      navigator.geolocation.getCurrentPosition(
        async () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            await proceedWithEntry();
          }
        },
        async (error) => {
          // If permission is denied or dismissed in sandbox/iframe or browser, proceed gracefully with IP-based tracking fallback!
          console.warn('Geolocation notice in entry gate:', error?.message);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            await proceedWithEntry();
          }
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
      );
    } else {
      proceedWithEntry();
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-[#020617] select-none transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.25) 0%, transparent 55%),
          radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.18) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(217, 119, 6, 0.2) 0%, transparent 50%),
          linear-gradient(180deg, #030712 0%, #020617 50%, #0b0f19 100%)
        `
      }}
    >
      {/* Background Animated Floating Ambient Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-500/15 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main Luxury Glass Card */}
      <div className="relative w-full max-w-sm bg-slate-900/95 backdrop-blur-2xl border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.35)] text-center space-y-6 animate-in zoom-in-95 duration-500">
        
        {/* Animated VIP Luxury Crest Emblem */}
        <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          {/* Rotating Outer Glow Rings */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/70 animate-spin" style={{ animationDuration: '12s' }} />
          <div className="absolute -inset-2 rounded-full border border-yellow-500/50 animate-ping opacity-30" style={{ animationDuration: '2.5s' }} />
          
          {/* Glowing Inner Shield */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-yellow-700 p-0.5 shadow-2xl shadow-amber-500/60 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/25 to-transparent" />
              <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.9)]" />
            </div>
          </div>
        </div>

        {/* Brand Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>VIP LIVE PLATFORM</span>
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-100 tracking-wider uppercase drop-shadow-md">
            BETGURU
          </h1>
        </div>

        {/* Error / Denial Warning Alert Box */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-medium space-y-1 animate-in shake duration-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <div className="flex items-center justify-center gap-1.5 text-rose-400 font-bold">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-bounce" />
              <span>প্রবেশ নিষিদ্ধ</span>
            </div>
            <p className="leading-snug text-[11px] text-rose-100">{errorMessage}</p>
          </div>
        )}

        {/* ONLY Animated ALLOW & ENTER Button (No Deny/Disallow Button) */}
        <div className="pt-2">
          <button
            onClick={handleAllowAndEnter}
            disabled={isProcessing || isExiting}
            className="group relative w-full py-4 px-6 rounded-2xl font-black text-slate-950 text-base sm:text-lg tracking-wider uppercase bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-yellow-300 hover:to-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.8)] hover:shadow-[0_0_50px_rgba(245,158,11,1)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden border-2 border-yellow-100/80 animate-pulse"
          >
            {/* Shimmer Light Reflection Sweep Animation */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

            <div className="relative flex items-center justify-center gap-2.5 drop-shadow-sm">
              <Zap className="w-5 h-5 text-slate-950 animate-bounce fill-slate-950" />
              <span>{isProcessing ? 'VERIFYING...' : 'ALLOW & ENTER'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* Discreet Fair Play Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <Lock className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Real-Time Encrypted Access</span>
        </div>

      </div>
    </div>
  );
};
