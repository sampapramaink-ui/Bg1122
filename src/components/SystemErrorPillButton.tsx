import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bug, AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { SystemErrorLog } from '../types';
import { subscribeErrorLogs } from '../utils/errorDiagnostics';
import { soundFx } from '../utils/audio';
import { SystemErrorDiagnosticModal } from './SystemErrorDiagnosticModal';

interface SystemErrorPillButtonProps {
  onOpenUserDossier?: (userId: string) => void;
}

export const SystemErrorPillButton: React.FC<SystemErrorPillButtonProps> = ({
  onOpenUserDossier,
}) => {
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissedBanner, setIsDismissedBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeErrorLogs((updatedLogs) => {
      setLogs(updatedLogs);
      // Auto-reopen banner if a new error comes in
      const unres = updatedLogs.filter((l) => !l.resolved);
      if (unres.length > 0) {
        setIsDismissedBanner(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const unresolvedLogs = logs.filter((l) => !l.resolved);
  const hasErrors = unresolvedLogs.length > 0;
  const latestError = unresolvedLogs[0] || null;

  return (
    <>
      {/* Floating Diagnostics Button & Urgent Alert Banner */}
      <div className="fixed bottom-20 left-3 sm:bottom-24 sm:left-6 z-[10020] flex flex-col items-start gap-2 select-none">
        <AnimatePresence>
          {/* 1. Urgent Error Alert Bar when error occurs */}
          {hasErrors && !isDismissedBanner && latestError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="max-w-xs sm:max-w-sm bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-2 border-rose-500 rounded-2xl p-3 shadow-2xl shadow-rose-950/80 backdrop-blur-xl flex items-start justify-between gap-2.5 animate-bounce-once"
            >
              <div
                onClick={() => {
                  soundFx.playClick();
                  setIsModalOpen(true);
                }}
                className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-slate-950 flex items-center justify-center font-black shrink-0 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-black uppercase text-rose-400 tracking-wider">
                      সিস্টেম এরর ডিটেক্টেড!
                    </span>
                    <span className="px-1.5 py-0.2 bg-rose-500 text-slate-950 text-[9px] font-black rounded-full font-mono">
                      {unresolvedLogs.length}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate mt-0.5">
                    {latestError.name}: {latestError.message}
                  </p>
                  <p className="text-[10px] text-amber-300 font-mono mt-0.5 underline">
                    👉 সমস্যাটি দেখতে এখানে ক্লিক করুন
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playClick();
                  setIsDismissedBanner(true);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="ব্যানার মিনিমাইজ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Floating Diagnostic Pill Button (Always accessible) */}
        <button
          onClick={() => {
            soundFx.playClick();
            setIsModalOpen(true);
          }}
          className={`group flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-md shadow-2xl transition-all cursor-pointer ${
            hasErrors
              ? 'bg-rose-950/90 hover:bg-rose-900 border-rose-500 text-rose-300 shadow-rose-950/50 animate-pulse'
              : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-400'
          }`}
          title="সিস্টেম ডায়াগনস্টিক ও এরর লগ কনসোল খুলুন"
        >
          <div
            className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-mono font-black ${
              hasErrors
                ? 'bg-rose-500 text-slate-950'
                : 'bg-slate-800 group-hover:bg-amber-500/20 text-slate-300 group-hover:text-amber-400'
            }`}
          >
            {hasErrors ? (
              <span>{unresolvedLogs.length}</span>
            ) : (
              <Bug className="w-3.5 h-3.5" />
            )}
          </div>

          <span className="text-xs font-mono font-bold whitespace-nowrap">
            {hasErrors ? '🚨 এরর রিপোর্ট দেখুন' : '🛠️ System Diagnostic'}
          </span>
        </button>
      </div>

      {/* Diagnostics Deep-Dive Modal */}
      <SystemErrorDiagnosticModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOpenUserDossier={onOpenUserDossier}
      />
    </>
  );
};
