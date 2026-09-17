import React, { useState } from 'react';
import { 
  X, AlertTriangle, ShieldAlert, Trash2, Ban, UserCheck, RefreshCw, CheckCircle2, AlertCircle, Info, Lock
} from 'lucide-react';
import { User, BannedUserRecord } from '../../types';
import { 
  setUserBlockStatus, 
  permanentlyDeleteUserAndAllRecords, 
  blockAndDeleteUserPermanently,
  unbanUserAndRestore 
} from '../../utils/userDataManager';
import { soundFx } from '../../utils/audio';

interface AdminUserBlockDeleteModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserDeleted?: (deletedUser: User) => void;
  onUserUpdated?: (updatedUser: User) => void;
  onBanUpdated?: () => void;
}

export const AdminUserBlockDeleteModal: React.FC<AdminUserBlockDeleteModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserDeleted,
  onUserUpdated,
  onBanUpdated
}) => {
  if (!isOpen || !user) return null;

  const isCurrentlyBlocked = user.status === 'suspended' || user.status === 'blocked' || user.isBlocked === true;
  
  // Action choice: 'block' | 'unblock' | 'delete' | 'block_and_delete'
  const [selectedAction, setSelectedAction] = useState<'block' | 'unblock' | 'delete' | 'block_and_delete'>(
    isCurrentlyBlocked ? 'unblock' : 'block'
  );
  
  const [reason, setReason] = useState<string>('Violation of platform terms & security review');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const REASON_PRESETS = [
    'Violation of fair-play terms & security review',
    'Suspicious deposit/withdrawal activity',
    'Multiple duplicate accounts detected',
    'Payment gateway dispute / Chargeback risk',
    'Location / VPN anomaly detected',
    'Player requested account suspension'
  ];

  const handleExecuteAction = async () => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    soundFx.playClick();

    try {
      if (selectedAction === 'unblock') {
        // UNBLOCK & RESTORE
        await setUserBlockStatus(user, false, '', 'Admin');
        const updated: User = {
          ...user,
          status: 'active',
          isBlocked: false,
          blockReason: '',
          blockedAt: undefined
        };
        if (onUserUpdated) onUserUpdated(updated);
        if (onBanUpdated) onBanUpdated();
        soundFx.playCoin();
        setSuccessMsg(`✅ ${user.name} (${user.email}) has been successfully UNBLOCKED & RESTORED!`);
        setTimeout(() => {
          onClose();
        }, 1500);

      } else if (selectedAction === 'block') {
        // BLOCK ONLY (Suspended login, keep data)
        const finalReason = reason.trim() || 'Blocked by administrator';
        await setUserBlockStatus(user, true, finalReason, 'Admin');
        const updated: User = {
          ...user,
          status: 'suspended',
          isBlocked: true,
          blockReason: finalReason,
          blockedAt: new Date().toISOString()
        };
        if (onUserUpdated) onUserUpdated(updated);
        if (onBanUpdated) onBanUpdated();
        soundFx.playCoin();
        setSuccessMsg(`🚫 ${user.name} (${user.email}) has been BLOCKED. User cannot log in.`);
        setTimeout(() => {
          onClose();
        }, 1500);

      } else if (selectedAction === 'delete') {
        // PERMANENT DELETE ONLY (Wipe all data, no permanent blacklist)
        const result = await permanentlyDeleteUserAndAllRecords(user, true);
        if (onUserDeleted) onUserDeleted(user);
        if (onBanUpdated) onBanUpdated();
        soundFx.playCoin();
        setSuccessMsg(`🗑️ Account & ${result.recordsWiped} records permanently deleted!`);
        setTimeout(() => {
          onClose();
        }, 1500);

      } else if (selectedAction === 'block_and_delete') {
        // BLOCK & PERMANENT DELETE (Blacklist email + Wipe 100% data)
        const finalReason = reason.trim() || 'Permanent block and complete data wipe by administrator';
        const result = await blockAndDeleteUserPermanently(user, finalReason, 'Admin');
        if (onUserDeleted) onUserDeleted(user);
        if (onBanUpdated) onBanUpdated();
        soundFx.playCoin();
        setSuccessMsg(`⛔ User permanently BLOCKED & DELETED! ${result.recordsWiped} records wiped and email blacklisted.`);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      console.error('Error executing user block/delete action:', err);
      setErrorMsg(`❌ Action Failed: ${err?.message || 'Database error occurred'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden font-mono flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              selectedAction === 'block_and_delete' || selectedAction === 'delete'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : selectedAction === 'block'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              {selectedAction === 'block_and_delete' ? (
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              ) : selectedAction === 'delete' ? (
                <Trash2 className="w-6 h-6" />
              ) : selectedAction === 'block' ? (
                <Ban className="w-6 h-6" />
              ) : (
                <UserCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>USER SECURITY & ACCOUNT MANAGEMENT</span>
              </h3>
              <p className="text-xs text-slate-400">
                Manage login status, blacklisting & permanent data deletion
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Target User Info Summary */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3.5">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={user.name}
              className="w-12 h-12 rounded-xl object-cover border border-amber-400/50 shrink-0"
            />
            <div className="space-y-1 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white truncate">{user.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  isCurrentlyBlocked 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isCurrentlyBlocked ? 'CURRENTLY BLOCKED' : 'ACTIVE'}
                </span>
              </div>
              <div className="text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                <span className="text-amber-300">Email: {user.email || 'N/A'}</span>
                <span>Phone: {user.phone || 'N/A'}</span>
                <span>Balance: ₹{(user.balance || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Action Choice Radio Grid */}
          <div className="space-y-2">
            <label className="text-slate-300 font-bold uppercase tracking-wider block text-[11px]">
              Select Security Action (অ্যাকশন নির্বাচন করুন):
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Unblock (if blocked) or Block */}
              {isCurrentlyBlocked ? (
                <button
                  type="button"
                  onClick={() => { soundFx.playClick(); setSelectedAction('unblock'); }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedAction === 'unblock'
                      ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white flex items-center gap-2">
                      <span>♻️ UNBLOCK & RESTORE (আনব্লক ও পুনরায় চালু)</span>
                      {selectedAction === 'unblock' && <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black">SELECTED</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Removes account suspension. The player can immediately log in again with their current password and balance.
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { soundFx.playClick(); setSelectedAction('block'); }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedAction === 'block'
                      ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/40 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white flex items-center gap-2">
                      <span>🚫 BLOCK LOGIN (লগইন ব্লক / স্থগিত করুন)</span>
                      {selectedAction === 'block' && <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black">SELECTED</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Suspends player login immediately. User records & balances are preserved. Admin can unblock anytime.
                    </p>
                  </div>
                </button>
              )}

              {/* Option 2: Permanent Delete (Clean wipe, no ban) */}
              <button
                type="button"
                onClick={() => { soundFx.playClick(); setSelectedAction('delete'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedAction === 'delete'
                    ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40 text-rose-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-2">
                    <span>🗑️ PERMANENT DELETE (সম্পূর্ণ ডাটা মুছে ফেলুন)</span>
                    {selectedAction === 'delete' && <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black">SELECTED</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Wipes all transactions, tickets, deposits, withdrawals and removes account. Email is not blacklisted (can re-register fresh account).
                  </p>
                </div>
              </button>

              {/* Option 3: Block & Permanent Delete (Blacklist + Full wipe) */}
              <button
                type="button"
                onClick={() => { soundFx.playClick(); setSelectedAction('block_and_delete'); }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedAction === 'block_and_delete'
                    ? 'bg-red-950 border-red-500 ring-2 ring-red-500/50 text-red-200 shadow-lg shadow-red-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-xl bg-red-600/30 text-red-400 border border-red-500/50 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-red-300 flex items-center gap-2">
                    <span>⛔ BLOCK & PERMANENT DELETE (ব্লক, ব্যান ও চিরতরে মুছে ফেলুন)</span>
                    {selectedAction === 'block_and_delete' && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black">CRITICAL</span>}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    <strong className="text-red-400">Complete Lockout:</strong> Wipes all history so user can never view old data AND permanently blacklists this Email/Phone in Firestore so they can <strong className="text-white">NEVER register or log in again</strong> with this info (unless Admin unblocks them).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Reason Input (Shown for Block, Delete, and Block & Delete) */}
          {selectedAction !== 'unblock' && (
            <div className="space-y-2">
              <label className="text-slate-300 font-bold uppercase tracking-wider block text-[11px]">
                Reason / Note (কারণ উল্লেখ করুন):
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter specific violation or admin note..."
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 outline-none focus:border-amber-500/50 text-xs font-mono"
              />

              {/* Reason Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setReason(preset);
                    }}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition cursor-pointer ${
                      reason === preset
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-2xl text-rose-200 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteAction}
            disabled={isProcessing}
            className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              selectedAction === 'block_and_delete'
                ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-red-950/50'
                : selectedAction === 'delete'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                : selectedAction === 'block'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>PROCESSING...</span>
              </>
            ) : selectedAction === 'block_and_delete' ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>CONFIRM BLOCK & PERMANENT DELETE</span>
              </>
            ) : selectedAction === 'delete' ? (
              <>
                <Trash2 className="w-4 h-4" />
                <span>CONFIRM PERMANENT DELETE</span>
              </>
            ) : selectedAction === 'block' ? (
              <>
                <Ban className="w-4 h-4" />
                <span>CONFIRM BLOCK USER</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>CONFIRM UNBLOCK USER</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
