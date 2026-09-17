import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Send, 
  X, 
  Code, 
  User as UserIcon, 
  Globe, 
  Terminal, 
  Flame, 
  Bug, 
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { SystemErrorLog } from '../types';
import { 
  getSystemErrorLogs, 
  subscribeErrorLogs, 
  markErrorLogResolved, 
  deleteErrorLog, 
  clearAllErrorLogs, 
  simulateTestError, 
  copyErrorReportToClipboard,
  isIgnoredBenignError
} from '../utils/errorDiagnostics';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { soundFx } from '../utils/audio';

interface SystemErrorDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserDossier?: (userId: string) => void;
}

export const SystemErrorDiagnosticModal: React.FC<SystemErrorDiagnosticModalProps> = ({
  isOpen,
  onClose,
  onOpenUserDossier,
}) => {
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'unresolved' | 'critical' | 'error'>('all');
  const [activeDetailTab, setActiveDetailTab] = useState<'stack' | 'user' | 'raw'>('stack');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    // 1. Local in-memory logs
    const unsubLocal = subscribeErrorLogs((localLogs) => {
      setLogs((prev) => {
        const map = new Map<string, SystemErrorLog>();
        localLogs.forEach((l) => map.set(l.id, l));
        prev.forEach((p) => {
          if (!map.has(p.id)) map.set(p.id, p);
        });
        const combined = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        if (combined.length > 0 && !selectedLogId) {
          setSelectedLogId(combined[0].id);
        }
        return combined;
      });
    });

    // 2. Firestore remote logs from all user devices
    let unsubFirestore: (() => void) | undefined;
    try {
      const crashRef = collection(db, 'system_crash_logs');
      unsubFirestore = onSnapshot(
        crashRef,
        (snap) => {
          const remoteLogs: SystemErrorLog[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as SystemErrorLog;
            if (data && !isIgnoredBenignError(data.message, data.stack)) {
              remoteLogs.push(data);
            } else if (docSnap.id) {
              deleteDoc(doc(db, 'system_crash_logs', docSnap.id)).catch(() => {});
            }
          });
          setLogs((prev) => {
            const map = new Map<string, SystemErrorLog>();
            remoteLogs.forEach((l) => map.set(l.id, l));
            prev.forEach((p) => {
              if (!map.has(p.id)) map.set(p.id, p);
            });
            const combined = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            if (combined.length > 0 && !selectedLogId) {
              setSelectedLogId(combined[0].id);
            }
            return combined;
          });
        },
        (err) => {
          console.warn('SystemErrorDiagnosticModal Firestore listener warning:', err);
        }
      );
    } catch (e) {
      console.warn('SystemErrorDiagnosticModal Firestore setup warning:', e);
    }

    return () => {
      unsubLocal();
      if (unsubFirestore) unsubFirestore();
    };
  }, [selectedLogId]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterSeverity === 'unresolved') return !log.resolved;
    if (filterSeverity === 'critical') return log.severity === 'critical';
    if (filterSeverity === 'error') return log.severity === 'error';
    return true;
  });

  const selectedLog = logs.find((l) => l.id === selectedLogId) || logs[0] || null;
  const unresolvedCount = logs.filter((l) => !l.resolved).length;

  const handleCopy = async (log: SystemErrorLog) => {
    soundFx.playClick();
    const success = await copyErrorReportToClipboard(log);
    if (success) {
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSimulate = () => {
    soundFx.playClick();
    setIsSimulating(true);
    const newLog = simulateTestError('Manual Diagnostic Simulation (সিস্টেম এরর টেস্ট)');
    setSelectedLogId(newLog.id);
    setTimeout(() => setIsSimulating(false), 300);
  };

  return (
    <div className="fixed inset-0 z-[10070] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-5xl bg-slate-900 border-2 border-rose-500/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-rose-950/40 to-slate-950 border-b border-rose-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <Bug className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  সিস্টেম এরর ও ক্র্যাশ ডায়াগনস্টিক কনসোল
                </h3>
                {unresolvedCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-slate-950 font-black font-mono text-xs animate-bounce shadow-md">
                    {unresolvedCount} ACTIVE ERROR{unresolvedCount > 1 ? 'S' : ''}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold font-mono text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All Systems Stable
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Real-Time Runtime Diagnostics, Component Exceptions & Stack Trace Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="টেস্ট এরর তৈরি করে সিস্টেম কার্যকারিতা পরীক্ষা করুন"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>TEST ERROR (সিমুলেশন)</span>
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split View (List on Left, Detailed Stack & Controls on Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Column: Error Logs List */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 flex flex-col shrink-0">
            {/* Filter Tabs */}
            <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-1 text-[11px] font-mono">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setFilterSeverity('all')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    filterSeverity === 'all' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({logs.length})
                </button>
                <button
                  onClick={() => setFilterSeverity('unresolved')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    filterSeverity === 'unresolved' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Active ({unresolvedCount})
                </button>
              </div>

              {logs.length > 0 && (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    clearAllErrorLogs();
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="সব এরর লগ ক্লিয়ার করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Error Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400/50" />
                  <p className="text-xs font-mono">কোনো এরর নেই (No Active Errors)</p>
                  <p className="text-[10px]">সিস্টেম নির্বিঘ্নে চালু রয়েছে।</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <div
                      key={log.id}
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedLogId(log.id);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left space-y-1.5 ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-950/50'
                          : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-black font-mono uppercase ${
                            log.severity === 'critical'
                              ? 'bg-rose-500 text-slate-950'
                              : log.severity === 'error'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {log.name || 'Error'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug">
                        {log.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                        <span className="truncate max-w-[140px] text-amber-400/90">
                          👤 {log.userName || log.userId || 'Guest'}
                        </span>
                        <span>{log.resolved ? '✅ Resolved' : '🔴 Active'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Error Deep-Dive & Action Controls */}
          <div className="flex-1 bg-slate-900/90 flex flex-col overflow-y-auto">
            {selectedLog ? (
              <div className="p-4 sm:p-6 space-y-4">
                
                {/* 1. Header Banner of Selected Error */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-rose-500/30 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-rose-500 text-slate-950 font-black font-mono text-xs">
                        {selectedLog.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {selectedLog.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(selectedLog)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedId === selectedLog.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">কপি হয়েছে!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>কপি করুন</span>
                          </>
                        )}
                      </button>

                      {!selectedLog.resolved ? (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            markErrorLogResolved(selectedLog.id);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>সমাধান চিহ্নিত করুন</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-mono font-bold">
                          ✅ Resolved
                        </span>
                      )}

                      <button
                        onClick={() => {
                          soundFx.playClick();
                          deleteErrorLog(selectedLog.id);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="এই এররটি মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-rose-300 whitespace-pre-wrap leading-relaxed">
                    {selectedLog.message}
                  </h4>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-900">
                    <span>⏱️ সময়: {new Date(selectedLog.createdAt).toLocaleString('en-IN')}</span>
                    <span>🌐 সোর্স: {selectedLog.source}</span>
                    <span>⚠️ লেভেল: {selectedLog.severity.toUpperCase()}</span>
                  </div>
                </div>

                {/* 2. Detail Tab Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveDetailTab('stack')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeDetailTab === 'stack'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Stack Trace (কোড ও ফাইল লাইন)</span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('user')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeDetailTab === 'user'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>User & Environment (ইউজার তথ্য)</span>
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('raw')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeDetailTab === 'raw'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Raw Diagnostic JSON</span>
                  </button>
                </div>

                {/* 3. Detail Views */}
                {activeDetailTab === 'stack' && (
                  <div className="space-y-3">
                    <div className="bg-slate-950 rounded-2xl p-3 sm:p-4 border border-slate-800 font-mono text-xs text-rose-200/90 overflow-x-auto max-h-72">
                      <pre className="whitespace-pre leading-relaxed font-mono select-text">
                        {selectedLog.stack || selectedLog.message || 'No JavaScript call stack available.'}
                      </pre>
                    </div>

                    {selectedLog.componentStack && (
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          React Component Stack:
                        </span>
                        <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 font-mono text-xs text-amber-300/80 overflow-x-auto max-h-48">
                          <pre className="whitespace-pre leading-relaxed font-mono select-text">
                            {selectedLog.componentStack}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeDetailTab === 'user' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <div className="text-amber-400 font-bold flex items-center justify-between">
                        <span>👤 Affected Player / User</span>
                        {selectedLog.userId && selectedLog.userId !== 'anonymous' && onOpenUserDossier && (
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              onOpenUserDossier(selectedLog.userId!);
                            }}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black cursor-pointer"
                          >
                            Open Dossier
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 text-slate-300">
                        <div><span className="text-slate-500">Name:</span> {selectedLog.userName || 'N/A'}</div>
                        <div><span className="text-slate-500">Email:</span> {selectedLog.userEmail || 'N/A'}</div>
                        <div><span className="text-slate-500">Phone:</span> {selectedLog.userPhone || 'N/A'}</div>
                        <div className="truncate"><span className="text-slate-500">UID:</span> {selectedLog.userId || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <div className="text-sky-400 font-bold flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Client Device & Page Info</span>
                      </div>
                      <div className="space-y-1 text-slate-300">
                        <div className="truncate"><span className="text-slate-500">URL:</span> {selectedLog.url}</div>
                        <div className="text-[10px] text-slate-400 break-words leading-relaxed pt-1">
                          <span className="text-slate-500 block">User-Agent:</span>
                          {selectedLog.userAgent}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'raw' && (
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-purple-300 overflow-x-auto max-h-72 select-text">
                    <pre className="whitespace-pre">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                )}

                {/* 4. Bottom Quick Action Bar */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    💡 এই তথ্য সরাসরি ডেভেলপারের সাথে শেয়ার করতে <b>কপি করুন</b> বাটন ব্যবহার করুন।
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        window.location.reload();
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>পেজ রিফ্রেশ করুন</span>
                    </button>
                    <button
                      onClick={() => handleCopy(selectedLog)}
                      className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold font-mono shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>সম্পূর্ণ এরর লগ কপি করুন</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 my-auto space-y-2">
                <ShieldAlert className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-mono">কোনো এরর সিলেক্ট করা হয়নি</p>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
};
