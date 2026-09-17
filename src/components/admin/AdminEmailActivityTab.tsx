import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, RefreshCw, CheckCircle2, AlertCircle, 
  RotateCw, Eye, Filter, Sparkles, Clock, Check, X, ShieldAlert, 
  CreditCard, DollarSign, Key, Gift 
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { EmailActivityLog } from '../../types';
import { resendEmailActivity } from '../../utils/emailNotifier';
import { soundFx } from '../../utils/audio';

interface AdminEmailActivityTabProps {
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export const AdminEmailActivityTab: React.FC<AdminEmailActivityTabProps> = ({ onNotify }) => {
  const [logs, setLogs] = useState<EmailActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<{ subject: string; html: string; to: string } | null>(null);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'email_activity_logs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      const unsub = onSnapshot(q, (snap) => {
        const list: EmailActivityLog[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as EmailActivityLog);
        });
        setLogs(list);
        setLoading(false);
      }, (err) => {
        console.warn('Activity logs snapshot error:', err);
        setLoading(false);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Failed to listen to email_activity_logs:', e);
      setLoading(false);
    }
  }, []);

  const handleResend = async (log: EmailActivityLog) => {
    soundFx.playClick();
    setResendingId(log.id);

    try {
      const success = await resendEmailActivity(log);
      if (success) {
        soundFx.playWinFanfare();
        if (onNotify) {
          onNotify({
            type: 'success',
            text: `✓ সফলভাবে ইমেইল পুনরায় পাঠানো (Resend) সম্পন্ন হয়েছে: ${log.recipientEmail}`
          });
        }
      } else {
        if (onNotify) {
          onNotify({
            type: 'error',
            text: `ইমেইল পুনরায় পাঠানো ব্যর্থ হয়েছে। অনুগ্রহ করে সক্রিয় SMTP চেক করুন।`
          });
        }
      }
    } catch (err: any) {
      if (onNotify) onNotify({ type: 'error', text: 'Error resending: ' + err.message });
    } finally {
      setResendingId(null);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;
    return true;
  });

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'deposit':
        return { label: 'DEPOSIT', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: CreditCard };
      case 'withdrawal':
        return { label: 'WITHDRAWAL', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: DollarSign };
      case 'otp':
        return { label: 'OTP / SECURITY', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: Key };
      case 'bonus':
        return { label: 'BONUS', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: Gift };
      case 'security':
        return { label: 'SECURITY ALERT', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: ShieldAlert };
      default:
        return { label: 'SYSTEM MAIL', bg: 'bg-slate-800 text-slate-300 border-slate-700', icon: Mail };
    }
  };

  return (
    <div className="space-y-6 font-mono">
      
      {/* Top Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/30 rounded-3xl space-y-3 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base sm:text-lg font-black text-white">Auto-Email Dispatch & Resend Activity Stream</h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-bold">
                REAL-TIME FIRESTORE AUDIT
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
              Every automated notification (Deposit receipts, Withdrawal payouts, OTPs, Bonus claims) is tracked here. You can inspect content and perform one-click resend at any time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-2xl font-bold">
              Total Logged: <strong className="text-indigo-400">{logs.length}</strong>
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1 text-xs text-slate-400 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Category:</span>
          </div>

          {['all', 'deposit', 'withdrawal', 'otp', 'bonus', 'security'].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                soundFx.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block" />

          {['all', 'sent', 'resent', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => {
                soundFx.playClick();
                setSelectedStatus(st);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all uppercase ${
                selectedStatus === st
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / Cards */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>ইমেইল অ্যাক্টিভিটি স্ট্রিম লোড হচ্ছে...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
          <Mail className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">কোন ইমেইল অ্যাক্টিভিটি পাওয়া যায়নি</h4>
          <p className="text-xs text-slate-400">
            {selectedCategory !== 'all' 
              ? `বর্তমানে '${selectedCategory.toUpperCase()}' ক্যাটাগরির কোন ইমেইল লগ নেই।`
              : 'সিস্টেমে এখনও কোন স্বয়ংক্রিয় ইমেইল পাঠানো হয়নি।'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const badge = getCategoryBadge(log.category);
            const isResending = resendingId === log.id;

            return (
              <div 
                key={log.id}
                className="p-4 sm:p-5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-3xl transition-all space-y-3 shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-1 ${badge.bg}`}>
                      <badge.icon className="w-3 h-3" />
                      {badge.label}
                    </span>

                    <span className="text-xs font-bold text-white">
                      To: <strong className="text-amber-400">{log.recipientEmail}</strong>
                    </span>

                    {log.recipientName && (
                      <span className="text-[11px] text-slate-400">
                        ({log.recipientName})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      log.status === 'sent'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : log.status === 'resent'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {log.status === 'sent' ? '✓ SENT' : log.status === 'resent' ? '⚡ RESENT' : '✕ FAILED'}
                    </span>

                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Subject & Details */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-slate-200 font-bold">
                      {log.subject}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                      {log.templateId && (
                        <span>Template: <code className="text-amber-300">{log.templateId}</code></span>
                      )}
                      {log.fromSender && (
                        <span>Sender: <span className="text-slate-300">{log.fromSender}</span></span>
                      )}
                      {log.resendCount && log.resendCount > 0 ? (
                        <span className="text-purple-400 font-bold">Resent {log.resendCount} times</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setPreviewHtml({
                          subject: log.subject,
                          html: log.htmlBody || '',
                          to: log.recipientEmail
                        });
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Content</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResend(log)}
                      disabled={isResending}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-black rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isResending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="w-3.5 h-3.5" />
                      )}
                      <span>{isResending ? 'Sending...' : 'রিসেন্ড (Resend)'}</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* HTML PREVIEW MODAL                                                        */}
      {/* ========================================================================= */}
      {previewHtml && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn font-mono">
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white">{previewHtml.subject}</h3>
                <span className="text-[11px] text-amber-400">Recipient: {previewHtml.to}</span>
              </div>
              <button
                onClick={() => setPreviewHtml(null)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex justify-center items-start">
              <div 
                className="w-full max-w-xl shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml.html }}
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
