import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Ban, 
  UserCheck, 
  RefreshCw, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Gamepad2, 
  Car, 
  Ticket, 
  Receipt, 
  Bell, 
  RotateCcw,
  Sparkles,
  User as UserIcon,
  DollarSign
} from 'lucide-react';
import { User } from '../../types';
import { soundFx } from '../../utils/audio';
import { 
  getUserDataSummary, 
  UserDataSummary, 
  wipeAllUserData, 
  clearUserDeposits, 
  clearUserWithdrawals, 
  clearUserGameBets, 
  clearUserThreeSuperCarBets, 
  clearUserLotteryTickets, 
  clearUserLedgerTransactions, 
  clearUserNotifications,
  setUserBlockStatus,
  permanentlyDeleteUserAndAllRecords 
} from '../../utils/userDataManager';

interface AdminUserDataWipeModalProps {
  user: User;
  isOpen?: boolean;
  onClose: () => void;
  onUserUpdated?: (updatedUser: Partial<User>) => void;
  onUserDeleted?: (userId: string) => void;
}

export const AdminUserDataWipeModal: React.FC<AdminUserDataWipeModalProps> = ({
  user,
  isOpen = true,
  onClose,
  onUserUpdated,
  onUserDeleted
}) => {
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<UserDataSummary | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Block state
  const isCurrentlyBlocked = user.status === 'suspended' || user.status === 'blocked' || user.isBlocked === true;
  const [blockReason, setBlockReason] = useState(user.blockReason || 'Terms of service violation & security compliance review');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  // Confirmation states
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [confirmGranularAction, setConfirmGranularAction] = useState<string | null>(null);

  // Reload Summary data for user
  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const res = await getUserDataSummary(user);
      setSummary(res);
    } catch (e) {
      console.error('Error loading user data summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadSummary();
      setBlockReason(user.blockReason || 'Terms of service violation & security compliance review');
      setConfirmWipeAll(false);
      setConfirmPermanentDelete(false);
      setConfirmGranularAction(null);
    }
  }, [isOpen, user.id]);

  if (!isOpen) return null;

  // Execute an action with loading state & feedback
  const handleExecute = async (
    actionKey: string,
    actionFn: () => Promise<any>,
    successMessage: string
  ) => {
    try {
      setActiveAction(actionKey);
      setFeedbackMsg(null);
      soundFx.playClick();
      
      const res = await actionFn();
      soundFx.playCoin();
      
      setFeedbackMsg({
        type: 'success',
        text: typeof res === 'number' ? `${successMessage} (${res} records removed)` : successMessage
      });

      // Refresh stats
      await loadSummary();

      if (onUserUpdated) {
        onUserUpdated(user);
      }
    } catch (err: any) {
      console.error(`Error executing ${actionKey}:`, err);
      soundFx.playLoss();
      setFeedbackMsg({
        type: 'error',
        text: `Operation failed: ${err?.message || 'Unknown database error'}`
      });
    } finally {
      setActiveAction(null);
      setConfirmWipeAll(false);
      setConfirmPermanentDelete(false);
      setConfirmGranularAction(null);
    }
  };

  // 1. Wipe All User Data
  const handleWipeAll = () => {
    handleExecute(
      'wipe_all',
      async () => {
        const res = await wipeAllUserData(user, { resetBalances: true });
        if (onUserUpdated) {
          onUserUpdated({ balance: 0, bonusBalance: 0, totalWon: 0, totalSpent: 0 });
        }
        return res.totalDeleted;
      },
      `✅ All data & transaction history successfully wiped for ${user.name}!`
    );
  };

  // 2. Toggle Block User
  const handleToggleBlock = async () => {
    const nextBlockState = !isCurrentlyBlocked;
    try {
      setActiveAction('toggle_block');
      soundFx.playClick();

      await setUserBlockStatus(user, nextBlockState, blockReason);
      
      soundFx.playCoin();
      setFeedbackMsg({
        type: 'success',
        text: nextBlockState 
          ? `🚫 User ${user.name} has been BLOCKED. They cannot login or place bets.`
          : `✅ User ${user.name} has been UNBLOCKED and reactivated.`
      });

      if (onUserUpdated) {
        onUserUpdated({ 
          status: nextBlockState ? 'suspended' : 'active',
          isBlocked: nextBlockState,
          blockReason: nextBlockState ? blockReason : ''
        });
      }
      setShowBlockConfirm(false);
    } catch (err: any) {
      soundFx.playLoss();
      setFeedbackMsg({
        type: 'error',
        text: `Failed to update block status: ${err?.message || 'Database error'}`
      });
    } finally {
      setActiveAction(null);
    }
  };

  // 3. Permanent User Deletion
  const handlePermanentDelete = () => {
    handleExecute(
      'permanent_delete',
      async () => {
        await permanentlyDeleteUserAndAllRecords(user, true);
        if (onUserDeleted) {
          onUserDeleted(user.id);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
        return 1;
      },
      `💀 User ${user.name} permanently deleted from Firebase!`
    );
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-sans select-none overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  User Data Wipe & Account Control Hub
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage {user.name} ({user.email || user.id})
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          
          {/* User Profile Card & Live Status Banner */}
          <div className="p-3.5 sm:p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={user.name}
                className="w-11 h-11 rounded-2xl object-cover border border-amber-500/40 shadow"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-sm">{user.name}</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                    isCurrentlyBlocked
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  }`}>
                    {isCurrentlyBlocked ? 'BLOCKED / SUSPENDED' : 'ACTIVE USER'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  <span className="text-amber-300">{user.email || 'No Email'}</span> | Phone: {user.phone || 'N/A'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">Main Balance</span>
                <span className="text-sm font-black text-amber-400 font-mono">₹{user.balance.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">Bonus</span>
                <span className="text-sm font-black text-purple-400 font-mono">₹{(user.bonusBalance || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {feedbackMsg && (
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 animate-in fade-in text-xs font-bold ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}>
              {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Section 1: Live Records Breakdown Summary */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>User Data Footprint (Firestore Collections)</span>
              </span>

              <button
                onClick={() => {
                  soundFx.playClick();
                  loadSummary();
                }}
                disabled={loadingSummary}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono font-bold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                <span>Refresh Counts</span>
              </button>
            </div>

            {loadingSummary ? (
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center text-slate-400 font-mono animate-pulse">
                Scanning Firestore transactions, bets, deposits & tickets...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400"><ArrowDownCircle className="w-3 h-3" /> Deposits</span>
                    <span className="font-black text-white">{summary?.depositsCount || 0}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-300">
                    ₹{(summary?.depositsTotal || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="flex items-center gap-1 text-rose-400"><ArrowUpCircle className="w-3 h-3" /> Withdrawals</span>
                    <span className="font-black text-white">{summary?.withdrawalsCount || 0}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-rose-300">
                    ₹{(summary?.withdrawalsTotal || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="flex items-center gap-1 text-yellow-400"><Gamepad2 className="w-3 h-3" /> Game Bets</span>
                    <span className="font-black text-white">{summary?.gameBetsCount || 0}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-yellow-300">
                    ₹{(summary?.gameBetsTotal || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="flex items-center gap-1 text-purple-400"><Ticket className="w-3 h-3" /> Tickets</span>
                    <span className="font-black text-white">{(summary?.lotteryTicketsCount || 0) + (summary?.superCarBetsCount || 0)}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-purple-300">
                    ₹{((summary?.lotteryTicketsTotal || 0) + (summary?.superCarBetsTotal || 0)).toLocaleString('en-IN')}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Section 2: ONE-CLICK MASTER WIPE */}
          <div className="p-4 bg-gradient-to-br from-rose-950/40 via-slate-950 to-rose-950/30 rounded-2xl border-2 border-rose-600/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-mono uppercase">Master 1-Click Data & Transaction Wipe (এক ক্লিকে সমস্ত মুছুন)</span>
              </div>
              <span className="text-[10px] text-rose-400 font-mono font-semibold">Total: {summary?.totalRecords || 0} Records</span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Deletes <strong>all deposits, withdrawals, live bets, Super Car bets, lottery tickets, ledger records, and notifications</strong> associated with this user, and resets their balance to ₹0.
            </p>

            {!confirmWipeAll ? (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setConfirmWipeAll(true);
                }}
                disabled={activeAction !== null}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 font-mono uppercase"
              >
                <Trash2 className="w-4 h-4" />
                <span>{activeAction === 'wipe_all' ? 'Wiping All Records in Firebase...' : '⚡ Wipe All User Data & Transaction History (১ ক্লিকে সমস্ত মুছুন)'}</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-950/80 rounded-xl border border-rose-500 space-y-2 animate-in fade-in">
                <div className="text-xs font-bold text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>আপনি কি নিশ্চিত যে {user.name}-এর সমস্ত ট্রানজেকশন মুছে ব্যালেন্স ₹0 করতে চান?</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setConfirmWipeAll(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWipeAll}
                    disabled={activeAction !== null}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{activeAction === 'wipe_all' ? 'Wiping...' : '⚡ YES, WIPE ALL NOW'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: GRANULAR DELETION BUTTONS (পার্ট পার্ট ভাবে মুছে ফেলা) */}
          <div className="space-y-2.5">
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Granular History Deletion Options (পার্ট পার্ট ভাবে মুছুন)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              
              {/* Delete Deposits */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Deposits Only</span>
                  <span className="text-[10px] text-slate-400">
                    {summary?.depositsCount || 0} requests (₹{(summary?.depositsTotal || 0).toLocaleString('en-IN')})
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_deposits', () => clearUserDeposits(user), 'Deposit history cleared');
                  }}
                  disabled={activeAction !== null || (summary?.depositsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-rose-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_deposits' ? 'Clearing...' : 'Clear Deposits'}
                </button>
              </div>

              {/* Delete Withdrawals */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Withdrawals Only</span>
                  <span className="text-[10px] text-slate-400">
                    {summary?.withdrawalsCount || 0} requests (₹{(summary?.withdrawalsTotal || 0).toLocaleString('en-IN')})
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_withdrawals', () => clearUserWithdrawals(user), 'Withdrawal history cleared');
                  }}
                  disabled={activeAction !== null || (summary?.withdrawalsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-rose-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_withdrawals' ? 'Clearing...' : 'Clear Withdrawals'}
                </button>
              </div>

              {/* Delete Game Bets (Aviator / Live Roulette / Casino) */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Game & Live Bets</span>
                  <span className="text-[10px] text-slate-400">
                    Aviator, Roulette, Casino ({summary?.gameBetsCount || 0} bets)
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_game_bets', () => clearUserGameBets(user), 'Game bets history cleared');
                  }}
                  disabled={activeAction !== null || (summary?.gameBetsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-yellow-950 hover:text-yellow-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-yellow-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_game_bets' ? 'Clearing...' : 'Clear Game Bets'}
                </button>
              </div>

              {/* Delete Three Super Car Bets */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Three Super Car</span>
                  <span className="text-[10px] text-slate-400">
                    Super Car Draw ({summary?.superCarBetsCount || 0} tickets)
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_supercar', () => clearUserThreeSuperCarBets(user), 'Super Car bets cleared');
                  }}
                  disabled={activeAction !== null || (summary?.superCarBetsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-amber-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_supercar' ? 'Clearing...' : 'Clear Super Car'}
                </button>
              </div>

              {/* Delete Lottery Tickets */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Lottery Purchased</span>
                  <span className="text-[10px] text-slate-400">
                    Lottery Tickets ({summary?.lotteryTicketsCount || 0} tickets)
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_lottery', () => clearUserLotteryTickets(user), 'Lottery tickets cleared');
                  }}
                  disabled={activeAction !== null || (summary?.lotteryTicketsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-purple-950 hover:text-purple-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-purple-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_lottery' ? 'Clearing...' : 'Clear Lottery'}
                </button>
              </div>

              {/* Delete Wallet Ledger / Adjustments */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">Wallet Ledger</span>
                  <span className="text-[10px] text-slate-400">
                    Audit adjustments ({summary?.ledgerTxsCount || 0} records)
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleExecute('clear_ledger', () => clearUserLedgerTransactions(user), 'Wallet ledger cleared');
                  }}
                  disabled={activeAction !== null || (summary?.ledgerTxsCount || 0) === 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-950 hover:text-indigo-300 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 hover:border-indigo-600 transition-all cursor-pointer disabled:opacity-40"
                >
                  {activeAction === 'clear_ledger' ? 'Clearing...' : 'Clear Ledger'}
                </button>
              </div>

            </div>
          </div>

          {/* Section 4: BLOCK / UNBLOCK & PERMANENT DELETION */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Account Restriction & Permanent Delete</span>
              </span>
            </div>

            {/* Block / Unblock Control */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-white block text-xs">
                    {isCurrentlyBlocked ? 'User is Currently Blocked' : 'Block User from Logging In & Betting'}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {isCurrentlyBlocked 
                      ? 'This user sees "Your account was blocked, please contact customer care" and cannot access their account.'
                      : 'Instantly revokes account access. When they try to login, they will be blocked and directed to support.'
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (isCurrentlyBlocked) {
                      handleToggleBlock();
                    } else {
                      setShowBlockConfirm(true);
                    }
                  }}
                  disabled={activeAction !== null}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black font-mono flex items-center gap-1.5 border cursor-pointer transition-all ${
                    isCurrentlyBlocked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-lg shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40 shadow-lg shadow-rose-600/20'
                  }`}
                >
                  {isCurrentlyBlocked ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  <span>{isCurrentlyBlocked ? 'Unblock User' : 'Block User'}</span>
                </button>
              </div>

              {/* Block Reason Form when confirming block */}
              {showBlockConfirm && !isCurrentlyBlocked && (
                <div className="p-3 bg-slate-950 rounded-xl border border-rose-600/40 space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-bold text-rose-300 block font-mono">
                    Block Reason (Displayed to support audit & logs):
                  </label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Enter reason for blocking user..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowBlockConfirm(false)}
                      className="px-3 py-1 text-slate-400 hover:text-white text-[11px] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleToggleBlock}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] rounded-lg cursor-pointer"
                    >
                      Confirm Block User
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Permanent User Deletion Button */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-rose-400 block text-xs">Permanently Delete User Profile</span>
                <span className="text-[10px] text-slate-400">
                  Completely wipes the user document and all linked sub-data from Firebase Firestore.
                </span>
              </div>

              {!confirmPermanentDelete ? (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setConfirmPermanentDelete(true);
                  }}
                  disabled={activeAction !== null}
                  className="px-3.5 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-xl text-xs font-black font-mono flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Permanent Delete</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmPermanentDelete(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePermanentDelete}
                    disabled={activeAction !== null}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{activeAction === 'permanent_delete' ? 'Deleting...' : 'Confirm Delete'}</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            UID: <span className="text-slate-200">{user.id}</span>
          </span>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
};
