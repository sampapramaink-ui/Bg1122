import React, { useState } from 'react';
import { Download, Sparkles, AlertCircle, RefreshCw, X, ShieldCheck, CheckCircle2, ChevronRight, ExternalLink, Smartphone } from 'lucide-react';
import { AppUpdateConfig } from '../types';
import { getNativeAppVersion, clearNativeAppCache } from '../utils/appUpdateService';
import { soundFx } from '../utils/audio';

interface AppUpdateModalProps {
  isOpen: boolean;
  config: AppUpdateConfig;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  config,
  onClose
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isCacheClearing, setIsCacheClearing] = useState(false);

  if (!isOpen) return null;

  const currentVersion = getNativeAppVersion();
  const isForce = Boolean(config.forceUpdate);
  const rawChangelog = config.changelog || '• নতুন লাইভ ক্যাসিনো ও সুপার কার গেমস\n• ফাস্ট উইথড্রয়াল ও ডিপোজিট গেটওয়ে\n• পারফরমেন্স উন্নতি ও বাগ ফিক্স';

  // Format changelog lines cleanly
  const changelogItems = rawChangelog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[•\-\*]\s*/, ''));

  const handleStartDownload = () => {
    soundFx.playClick();
    setIsDownloading(true);
    setDownloadProgress(10);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            setDownloadProgress(100);
            // Trigger actual download or open link
            if (config.apkUrl) {
              const link = document.createElement('a');
              link.href = config.apkUrl;
              link.download = `betguru-v${config.versionName || '2.0'}.apk`;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }, 400);
          return 95;
        }
        return prev + Math.floor(Math.random() * 15 + 10);
      });
    }, 180);
  };

  const handleClearCache = async () => {
    setIsCacheClearing(true);
    await clearNativeAppCache();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className={`relative w-full max-w-lg bg-slate-900 border rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden transition-all transform duration-300 scale-100 ${
          isForce ? 'border-amber-500/50 ring-2 ring-amber-500/20' : 'border-emerald-500/40 ring-1 ring-emerald-500/20'
        }`}
      >
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button (only when NOT forced) */}
        {!isForce && (
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-full transition-colors z-10"
            title="পরে আপডেট করুন (Later)"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon & Badges */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-emerald-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                🚀 New Update Available
              </span>
              {isForce ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> জরুরি আপডেট
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">
                  Recommended
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              <span>BETGURU v{config.versionName || '2.0'}</span>
              <span className="text-xs text-slate-400 font-mono">(Build #{config.versionCode || 2})</span>
            </h2>
          </div>
        </div>

        {/* Version Transition Box */}
        <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 mb-5">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">Current App:</div>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
              v{currentVersion}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400" />
          <div className="flex items-center gap-2">
            <div className="text-xs text-emerald-400 font-medium">New Version:</div>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold">
              v{config.versionName || '2.0'}
            </span>
          </div>
        </div>

        {/* Changelog Section */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 mb-6 space-y-2.5 max-h-48 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>নতুন আপডেটে যা যা নতুন আছে (What's New):</span>
          </div>
          <ul className="space-y-2 text-sm text-slate-200">
            {changelogItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Download Progress (if active) */}
        {isDownloading && (
          <div className="mb-5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                APK প্যাকেজ তৈরি হচ্ছে...
              </span>
              <span className="font-mono font-bold text-emerald-400">{downloadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-200 rounded-full"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleStartDownload}
            disabled={isDownloading}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:opacity-95 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
          >
            <Download className="w-5 h-5 text-slate-950" />
            <span>{isDownloading ? 'ডাউনলোড প্রক্রিয়া শুরু হচ্ছে...' : '📥 এখনই নতুন APK ডাউনলোড করুন (Download APK)'}</span>
          </button>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleClearCache}
              disabled={isCacheClearing}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 border border-slate-700/60 transition-all flex items-center justify-center gap-1.5"
              title="ক্যাশ মেমোরি ক্লিয়ার করে নতুন কোড লোড করুন"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCacheClearing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              <span>{isCacheClearing ? 'ক্লিয়ারিং...' : '🧹 ক্যাশ ক্লিয়ার ও রিলোড'}</span>
            </button>

            {!isForce && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onClose();
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 transition-all"
              >
                পরে করব (Later)
              </button>
            )}
          </div>
        </div>

        {/* Footer Security Note */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Official BETGURU Signed Package • 100% Virus & Malware Free</span>
        </div>
      </div>
    </div>
  );
};
