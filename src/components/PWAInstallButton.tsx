import React, { useState } from 'react';
import { Download, Share, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'menu-item' | 'pill';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA on the home screen, hide cleanly
  if (isInstalled) {
    if (variant === 'menu-item') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/30 rounded-lg border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>BETGURU App Installed</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      const success = await install();
      setInstalling(false);
      if (success && onInstalled) {
        onInstalled();
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // General fallback guide
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {/* Variant: Header Compact Icon Button */}
      {variant === 'header' && (
        <button
          id="pwa-install-header-btn"
          onClick={handleInstallClick}
          disabled={installing}
          className={`relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 transition-all shadow-md shadow-black/40 ${className}`}
          title="Install BETGURU PWA App to Home Screen"
        >
          <div className="relative">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 group-hover:scale-110 transition-transform animate-bounce" />
          </div>
          <span className="text-[11px] sm:text-xs font-black tracking-wide font-mono hidden xs:inline uppercase">
            {installing ? 'Installing...' : 'App'}
          </span>
          <span className="flex h-1.5 w-1.5 absolute -top-0.5 -right-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
          </span>
        </button>
      )}

      {/* Variant: Pill Button */}
      {variant === 'pill' && (
        <button
          id="pwa-install-pill-btn"
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 transition ${className}`}
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{installing ? 'Installing...' : 'Install App'}</span>
        </button>
      )}

      {/* Variant: Menu Item */}
      {variant === 'menu-item' && (
        <button
          id="pwa-install-menu-btn"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-transparent border border-amber-500/30 hover:border-amber-400/60 transition group text-left ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                Install BETGURU App
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-bold">
                  PWA
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                0 Sec Latency &amp; Instant Background Push Alerts
              </div>
            </div>
          </div>
          <span className="text-xs font-black text-amber-400 font-mono">INSTALL</span>
        </button>
      )}

      {/* Variant: Full Banner */}
      {variant === 'banner' && (
        <div
          id="pwa-install-banner"
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 p-4 shadow-xl ${className}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <span className="font-black text-2xl text-amber-400 font-mono">B</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 font-mono tracking-wide flex items-center gap-1.5">
                  BETGURU PWA APP
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                    OFFICIAL
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Install on your device for instant 0-sec deposit, withdrawal &amp; chat alerts
                </p>
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-xs font-black tracking-wide shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 transition font-mono"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{installing ? 'INSTALLING...' : 'INSTALL NOW'}</span>
            </button>
          </div>
        </div>
      )}

      {/* iOS / General Safari Install Guidance Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 p-6 shadow-2xl relative text-slate-200">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-300 font-mono">INSTALL BETGURU</h3>
                <p className="text-xs text-slate-400">Add to Home Screen (iOS &amp; Safari)</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  Tap the <strong className="text-amber-300 flex items-center gap-1 inline-flex">Share <Share className="w-3.5 h-3.5" /></strong> button at the bottom of Safari toolbar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  Scroll down and tap <strong className="text-amber-300">"Add to Home Screen"</strong> (হোম স্ক্রিনে যোগ করুন).
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  Tap <strong className="text-amber-300">Add</strong> at the top right. BETGURU icon will appear on your device!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs tracking-wider uppercase font-mono shadow-lg hover:brightness-110"
            >
              GOT IT (বুঝেছি)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
