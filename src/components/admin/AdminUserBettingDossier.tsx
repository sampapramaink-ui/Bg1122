import React, { useState, useMemo } from 'react';
import { 
  X, User as UserIcon, Wallet, Gamepad2, Ticket, Receipt, TrendingUp,
  Download, Trash2, Calendar, MapPin, Eye, RefreshCw, AlertTriangle, 
  Check, Copy, ShieldAlert, Sparkles, Filter, ChevronRight, Ban, Edit3
} from 'lucide-react';
import { 
  User, WalletTransaction, PurchasedTicket, DepositRequest, WithdrawalRequest 
} from '../../types';
import { soundFx } from '../../utils/audio';
import { db } from '../../firebase';
import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { generatePermanentUserCode } from '../../utils/databaseSync';

// Sub-components
import { AdminLiveBetsView } from './dossier/AdminLiveBetsView';
import { AdminTicketsView } from './dossier/AdminTicketsView';
import { AdminWalletLedgerView } from './dossier/AdminWalletLedgerView';
import { AdminBankingView } from './dossier/AdminBankingView';
import { AdminAnalyticsView } from './dossier/AdminAnalyticsView';
import { AdminUserGeoTrackingModal } from './AdminUserGeoTrackingModal';

interface AdminUserBettingDossierProps {
  user: User;
  allTransactions: WalletTransaction[];
  allTickets: PurchasedTicket[];
  allDeposits: DepositRequest[];
  allWithdrawals: WithdrawalRequest[];
  onClose: () => void;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (userId: string) => void;
  onUserDeleted?: (userId: string) => void;
  onRecordDeleted?: (collection: string, id: string) => void;
  onOpenWipeModal?: (u?: any) => void;
  onUserUpdated?: (user: User) => void;
}

export const AdminUserBettingDossier: React.FC<AdminUserBettingDossierProps> = ({
  user,
  allTransactions = [],
  allTickets = [],
  allDeposits = [],
  allWithdrawals = [],
  onClose,
  onEditUser,
  onDeleteUser,
  onUserDeleted,
  onRecordDeleted,
  onOpenWipeModal,
  onUserUpdated
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'live_bets' | 'tickets' | 'transactions' | 'banking' | 'analytics'>('live_bets');

  // Date filters
  const [dateFilterPreset, setDateFilterPreset] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // UI Modals & Actions
  const [showGeoModal, setShowGeoModal] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deletedRecordIds, setDeletedRecordIds] = useState<Set<string>>(new Set());
  const [isDeletingRecord, setIsDeletingRecord] = useState<string | null>(null);
  const [isWipingAll, setIsWipingAll] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Targets for matching user records
  const userTarget = useMemo(() => ({
    id: user.id,
    email: user.email ? user.email.toLowerCase().trim() : '',
    phone: user.phone ? user.phone.replace(/[^0-9]/g, '') : '',
    code: user.userCode || generatePermanentUserCode(user.email, undefined, user.id)
  }), [user]);

  const isUserMatch = (recordUserId?: string, recordEmail?: string, recordPhone?: string) => {
    if (recordUserId && recordUserId === userTarget.id) return true;
    if (recordEmail && userTarget.email && recordEmail.toLowerCase().trim() === userTarget.email) return true;
    if (recordPhone && userTarget.phone) {
      const cleanPhone = recordPhone.replace(/[^0-9]/g, '');
      if (cleanPhone && (cleanPhone.includes(userTarget.phone) || userTarget.phone.includes(cleanPhone))) return true;
    }
    return false;
  };

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    soundFx.playClick();
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Date parsing helper
  const parseItemDate = (dateVal?: string | number): Date | null => {
    if (!dateVal) return null;
    if (typeof dateVal === 'number') return new Date(dateVal);
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed;
    const cleanStr = String(dateVal).replace(/ at /gi, ' ').replace(/,/g, '');
    const fallbackParsed = new Date(cleanStr);
    return isNaN(fallbackParsed.getTime()) ? null : fallbackParsed;
  };

  const formatExactDateTime = (dateVal?: string | number) => {
    const parsed = parseItemDate(dateVal);
    if (!parsed) return typeof dateVal === 'string' ? dateVal : 'N/A';
    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Date Filtering Limits
  const { filterStartMs, filterEndMs } = useMemo(() => {
    const now = new Date();
    let start: number | null = null;
    let end: number | null = null;

    if (dateFilterPreset === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      start = s.getTime();
      end = now.getTime();
    } else if (dateFilterPreset === 'yesterday') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      start = s.getTime();
      end = e.getTime();
    } else if (dateFilterPreset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const s = new Date(now.setDate(diff));
      s.setHours(0, 0, 0, 0);
      start = s.getTime();
      end = Date.now();
    } else if (dateFilterPreset === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      start = s.getTime();
      end = Date.now();
    } else if (dateFilterPreset === 'custom') {
      if (customStartDate) {
        const s = new Date(customStartDate);
        s.setHours(0, 0, 0, 0);
        start = s.getTime();
      }
      if (customEndDate) {
        const e = new Date(customEndDate);
        e.setHours(23, 59, 59, 999);
        end = e.getTime();
      }
    }

    return { filterStartMs: start, filterEndMs: end };
  }, [dateFilterPreset, customStartDate, customEndDate]);

  const isWithinDateFilter = (dateVal?: string | number) => {
    if (filterStartMs === null && filterEndMs === null) return true;
    const parsed = parseItemDate(dateVal);
    if (!parsed) return true;
    const time = parsed.getTime();
    if (filterStartMs !== null && time < filterStartMs) return false;
    if (filterEndMs !== null && time > filterEndMs) return false;
    return true;
  };

  // High-level Financial Metrics
  const metrics = useMemo(() => {
    let totalWager = 0;
    let totalWon = 0;
    let betCount = 0;
    let winCount = 0;
    let lossCount = 0;
    let pendingCount = 0;

    allTransactions.forEach((tx) => {
      if (deletedRecordIds.has(tx.id)) return;
      if (!isUserMatch(tx.userId, tx.userEmail)) return;
      if (!isWithinDateFilter(tx.createdAt || tx.date)) return;

      const type = (tx.type || '').toLowerCase();
      if (type.includes('bet') || type.includes('roulette') || type.includes('andar') || type.includes('dragon') || type.includes('crash')) {
        betCount++;
        totalWager += Math.abs(tx.amount || 0);
        if (type.includes('win')) {
          winCount++;
          totalWon += Math.abs(tx.amount || 0);
        } else {
          lossCount++;
        }
      }
    });

    allTickets.forEach((t) => {
      if (deletedRecordIds.has(t.id)) return;
      if (!isUserMatch(t.userId)) return;
      if (!isWithinDateFilter(t.purchaseDate || (t as any).date || (t as any).createdAt)) return;

      betCount++;
      totalWager += (t.price || 50);
      if (t.status === 'win') {
        winCount++;
        totalWon += (t.wonAmount || 0);
      } else if (t.status === 'loss') {
        lossCount++;
      } else {
        pendingCount++;
      }
    });

    const userDeposits = allDeposits.filter(
      (d) => !deletedRecordIds.has(d.id) && isUserMatch(d.userId, undefined, d.userPhone) && isWithinDateFilter(d.date)
    );
    const userWithdrawals = allWithdrawals.filter(
      (w) => !deletedRecordIds.has(w.id) && isUserMatch(w.userId, undefined, (w as any).userPhone) && isWithinDateFilter(w.date)
    );

    const totalDeposits = userDeposits.filter((d) => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0);
    const totalWithdrawals = userWithdrawals.filter((w) => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0);
    const houseProfit = totalWager - totalWon;

    return {
      totalWager,
      totalWon,
      houseProfit,
      betCount,
      winCount,
      lossCount,
      pendingCount,
      totalDeposits,
      totalWithdrawals,
      depositsCount: userDeposits.length,
      withdrawalsCount: userWithdrawals.length
    };
  }, [allTransactions, allTickets, allDeposits, allWithdrawals, deletedRecordIds, filterStartMs, filterEndMs]);

  // Single Record Deletion Handler
  const handleDeleteSingleRecord = async (item: { id: string; collection: string; title: string }) => {
    const isConfirm = window.confirm(`Are you sure you want to permanently delete this ${item.title} record (ID: ${item.id})?`);
    if (!isConfirm) return;

    try {
      setIsDeletingRecord(item.id);
      soundFx.playClick();
      setDeletedRecordIds((prev) => new Set([...prev, item.id]));

      try {
        const colRef = doc(db, item.collection, item.id);
        await deleteDoc(colRef);
      } catch (err) {
        console.warn('Firestore direct delete skipped or offline:', err);
      }

      if (onRecordDeleted) {
        onRecordDeleted(item.collection, item.id);
      }

      setActionSuccessMsg(`Successfully deleted ${item.title} (#${item.id})`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to delete item record:', err);
      alert('Failed to delete record from database.');
    } finally {
      setIsDeletingRecord(null);
    }
  };

  // Wipe All Records for this user
  const handleWipeAllUserRecords = async () => {
    const isConfirmed = window.confirm(
      `⚠️ WARNING: WIPE ALL BETS & TRANSACTIONS\n\nAre you sure you want to permanently clear all live casino bets, tickets, and transactions for ${user.name}? This cannot be undone!`
    );
    if (!isConfirmed) return;

    try {
      setIsWipingAll(true);
      soundFx.playClick();

      const userTxIds = allTransactions.filter((tx) => isUserMatch(tx.userId, tx.userEmail)).map((tx) => tx.id);
      const userTicketIds = allTickets.filter((t) => isUserMatch(t.userId)).map((t) => t.id);

      const allWiped = [...userTxIds, ...userTicketIds];
      setDeletedRecordIds((prev) => new Set([...prev, ...allWiped]));

      try {
        const batch = writeBatch(db);
        userTxIds.forEach((id) => batch.delete(doc(db, 'transactions', id)));
        userTicketIds.forEach((id) => batch.delete(doc(db, 'tickets', id)));
        await batch.commit();
      } catch (err) {
        console.warn('Batch delete error or partial execution:', err);
      }

      setActionSuccessMsg(`Successfully wiped ${allWiped.length} records for ${user.name}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to wipe records:', err);
      alert('Failed to wipe records.');
    } finally {
      setIsWipingAll(false);
    }
  };

  // Export Comprehensive Audit CSV
  const handleExportCSV = () => {
    soundFx.playClick();
    const rows = [
      ['USER DOSSIER AUDIT EXPORT'],
      ['Name', user.name],
      ['Email', user.email],
      ['Phone', user.phone || 'N/A'],
      ['User Code', userTarget.code],
      ['Total Balance', `INR ${user.balance || 0}`],
      ['Real Balance', `INR ${(user as any).mainBalance ?? user.balance ?? 0}`],
      ['Bonus Balance', `INR ${user.bonusBalance || 0}`],
      ['Total Wagered', `INR ${metrics.totalWager}`],
      ['Total Won', `INR ${metrics.totalWon}`],
      ['House PnL', `INR ${metrics.houseProfit}`],
      [],
      ['COLLECTION', 'RECORD ID', 'TYPE', 'DESCRIPTION', 'AMOUNT', 'DATE'],
    ];

    allTransactions.forEach((tx) => {
      if (deletedRecordIds.has(tx.id) || !isUserMatch(tx.userId, tx.userEmail)) return;
      rows.push(['transactions', tx.id, tx.type, `"${(tx.description || '').replace(/"/g, '""')}"`, String(tx.amount || 0), tx.date || '']);
    });

    allTickets.forEach((t) => {
      if (deletedRecordIds.has(t.id) || !isUserMatch(t.userId)) return;
      rows.push(['tickets', t.id, t.category || 'Lottery', `"${(t.drawTitle || '').replace(/"/g, '""')}"`, String(t.price || 0), t.purchaseDate || '']);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dossier_${user.name.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl flex flex-col w-full h-full overflow-y-auto overflow-x-hidden animate-in fade-in duration-200">
      
      {/* 1. TOP NAV HEADER (100% full-width, non-sticky, with quick close cross button) */}
      <header className="w-full p-3 sm:p-5 bg-slate-950 border-b border-slate-800/80 shadow-2xl relative">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4 pr-10 sm:pr-0">
          
          {/* User Avatar & Core Profile Info */}
          <div className="flex items-center gap-3 min-w-0 max-w-full">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow-lg shadow-amber-500/20 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[200px] sm:max-w-none">{user.name}</h2>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono px-2 py-0.5 rounded-full font-bold">
                  #{userTarget.code}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {user.role === 'admin' ? '👑 Admin' : '👤 Player'}
                </span>
                {((user as any).isSuspended || (user as any).isBanned) && (
                  <span className="text-[10px] bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                    ⛔ BANNED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
                <span className="truncate max-w-[180px] sm:max-w-none">{user.email}</span>
                <span>•</span>
                <span className="text-amber-300 font-bold">{user.phone || 'No Phone'}</span>
                <span>•</span>
                <span className="text-indigo-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.city || user.geoInfo?.city || 'Verified Player'}</span>
                </span>
              </p>
            </div>
          </div>

          {/* Real-time Balances Strip & Action Bar */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl font-mono text-xs shadow-inner flex-1 sm:flex-initial justify-between sm:justify-start">
              <div className="px-2">
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Total Balance</span>
                <span className="text-sm font-black text-amber-400">₹{(user.balance || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-l border-slate-800 pl-2">
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Real (মেইন)</span>
                <span className="text-xs font-black text-emerald-400">₹{((user as any).mainBalance ?? user.balance ?? 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-l border-slate-800 pl-2 pr-1">
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Bonus (বোনাস)</span>
                <span className="text-xs font-black text-purple-400">₹{(user.bonusBalance || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { soundFx.playClick(); setShowGeoModal(true); }}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition cursor-pointer"
                title="Real-time Live GPS Tracker"
              >
                <MapPin className="w-4 h-4 text-indigo-400" />
              </button>

              <button
                onClick={handleExportCSV}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-xl transition cursor-pointer"
                title="Export CSV Audit"
              >
                <Download className="w-4 h-4 text-amber-400" />
              </button>

              {onEditUser && (
                <button
                  onClick={() => { soundFx.playClick(); onEditUser(user); }}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl transition cursor-pointer"
                  title="Edit user profile"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                </button>
              )}

              {(onDeleteUser || onUserDeleted) && (
                <button
                  onClick={() => {
                    const isConfirm = window.confirm(`Delete entire user account for ${user.name}? This will remove the account completely!`);
                    if (isConfirm) {
                      if (onUserDeleted) onUserDeleted(user.id);
                      else if (onDeleteUser) onDeleteUser(user.id);
                    }
                  }}
                  className="p-2 bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-800 hover:border-rose-800 rounded-xl transition cursor-pointer"
                  title="Delete User Account"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              )}

              {/* Header Close Cross Button */}
              <button
                onClick={() => { soundFx.playClick(); onClose(); }}
                className="p-2 bg-rose-950/40 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                title="Close Dossier (প্রস্থান)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Absolute top-right close cross button for instant mobile reachability */}
        <button
          onClick={() => { soundFx.playClick(); onClose(); }}
          className="lg:hidden absolute top-3 right-3 p-2 bg-slate-900/90 hover:bg-rose-900 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition cursor-pointer shadow-lg"
          title="Close (বন্ধ করুন)"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Success banner if action taken */}
      {actionSuccessMsg && (
        <div className="w-full bg-emerald-950/90 border-b border-emerald-800/80 px-4 py-2 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" /> {actionSuccessMsg}
          </span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. SUB-HEADER TOOLBAR: TAB NAVIGATION + DATE PRESETS */}
      <div className="w-full bg-slate-900/95 border-b border-slate-800 p-3 sm:p-4">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full font-mono scrollbar-none">
          {[
            { id: 'live_bets', label: '🎰 Live Casino Bets (লাইভ গেম)', icon: Gamepad2, count: metrics.betCount },
            { id: 'tickets', label: '🏎️ 3 Super Car & Lottery (টিকিট)', icon: Ticket, count: allTickets.filter(t => isUserMatch(t.userId)).length },
            { id: 'transactions', label: '💳 Wallet Ledger (ট্রানজেকশন)', icon: Receipt, count: allTransactions.filter(tx => isUserMatch(tx.userId, tx.userEmail)).length },
            { id: 'banking', label: '💰 Banking (ডিপোজিট/উইথড্রল)', icon: Wallet, count: metrics.depositsCount + metrics.withdrawalsCount },
            { id: 'analytics', label: '📊 PnL & Margin Analytics', icon: TrendingUp },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab(t.id as any);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-slate-950 text-amber-300' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Date Filter Presets Bar */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'Week' },
              { id: 'this_month', label: 'Month' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  soundFx.playClick();
                  setDateFilterPreset(p.id as any);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  dateFilterPreset === p.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {dateFilterPreset === 'custom' && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-700 outline-none"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-700 outline-none"
              />
            </div>
          )}
        </div>
        </div>
      </div>

      {/* 3. MAIN TAB CONTENT (Natural scrolling full view) */}
      <main className="w-full flex-1 p-3 sm:p-6 bg-slate-900/40">
        <div className="w-full max-w-7xl mx-auto space-y-4">
          
          {/* TAB 1: 1:1 EXACT LIVE CASINO BETS VIEW */}
          {activeTab === 'live_bets' && (
            <AdminLiveBetsView
              transactions={allTransactions}
              deletedRecordIds={deletedRecordIds}
              isUserMatch={isUserMatch}
              isWithinDateFilter={isWithinDateFilter}
              onDeleteRecord={handleDeleteSingleRecord}
              isDeletingRecord={isDeletingRecord}
            />
          )}

          {/* TAB 2: 1:1 EXACT 3 SUPER CAR & LOTTERY TICKETS VIEW */}
          {activeTab === 'tickets' && (
            <AdminTicketsView
              tickets={allTickets}
              deletedRecordIds={deletedRecordIds}
              isUserMatch={isUserMatch}
              isWithinDateFilter={isWithinDateFilter}
              onDeleteRecord={handleDeleteSingleRecord}
              isDeletingRecord={isDeletingRecord}
            />
          )}

          {/* TAB 3: 1:1 EXACT WALLET LEDGER & DIGITAL TRANSACTION SLIPS */}
          {activeTab === 'transactions' && (
            <AdminWalletLedgerView
              transactions={allTransactions}
              deletedRecordIds={deletedRecordIds}
              isUserMatch={isUserMatch}
              isWithinDateFilter={isWithinDateFilter}
              onDeleteRecord={handleDeleteSingleRecord}
              isDeletingRecord={isDeletingRecord}
            />
          )}

          {/* TAB 4: BANKING DEPOSITS & WITHDRAWALS */}
          {activeTab === 'banking' && (
            <AdminBankingView
              deposits={allDeposits}
              withdrawals={allWithdrawals}
              deletedRecordIds={deletedRecordIds}
              isUserMatch={isUserMatch}
              isWithinDateFilter={isWithinDateFilter}
              onDeleteRecord={handleDeleteSingleRecord}
              isDeletingRecord={isDeletingRecord}
              formatExactDateTime={formatExactDateTime}
            />
          )}

          {/* TAB 5: PnL & MARGIN ANALYTICS */}
          {activeTab === 'analytics' && (
            <AdminAnalyticsView
              user={user}
              metrics={metrics}
            />
          )}

        </div>
      </main>

      {/* 4. NATURAL SCROLLING FOOTER (Scrolls together with the entire dossier page) */}
      <footer className="w-full p-4 sm:p-6 bg-slate-950 border-t border-slate-800 font-mono text-xs mt-auto">
        <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Showing real-time ledger for <strong className="text-white">{user.name}</strong> ({user.email}) | ID: <span className="text-amber-300 font-bold">#{userTarget.code}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            <button
              onClick={handleWipeAllUserRecords}
              disabled={isWipingAll}
              className="px-4 py-2 bg-slate-900 hover:bg-rose-950 text-rose-300 border border-rose-900 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Trash2 className={`w-4 h-4 ${isWipingAll ? 'animate-spin' : ''}`} />
              <span>Wipe Records (ডেটা মুছুন)</span>
            </button>

            <button
              onClick={() => { soundFx.playClick(); onClose(); }}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>Close Dossier (প্রস্থান)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Real-time Geo Tracking Modal */}
      {showGeoModal && (
        <AdminUserGeoTrackingModal
          user={user}
          onClose={() => setShowGeoModal(false)}
        />
      )}

    </div>
  );
};
