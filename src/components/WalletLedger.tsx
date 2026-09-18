import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, ArrowDownLeft, ArrowUpRight, Gift, ShieldAlert,
  Search, Filter, CheckCircle2, Clock, AlertCircle, Copy, Check, ChevronRight,
  TrendingUp, TrendingDown, ArrowUpDown, Sparkles, Share2, Download, ShieldCheck,
  MessageSquare, Tag
} from 'lucide-react';
import { WalletTransaction } from '../types';
import { soundFx } from '../utils/audio';
import { sortChronologicalNewestFirst } from '../utils/supercar';
import { VoucherGenerator } from './VoucherGenerator';
import { PaginationBar } from './PaginationBar';
import { downloadVoucherImageSafe } from '../utils/voucherShareDownloadHelper';

// Strictly classify purely financial transactions
export const isPureFinancialTx = (tx: WalletTransaction): boolean => {
  if (!tx || !tx.type) return false;
  const type = (tx.type || '').toLowerCase();
  
  // Explicitly reject any live game or ticket types
  if (
    type.includes('bet') ||
    type.includes('crash') ||
    type.includes('aviator') ||
    type.includes('roulette') ||
    type.includes('dragon_tiger') ||
    type.includes('andar_bahar') ||
    type.includes('ticket') ||
    type === 'loss' ||
    type === 'win' ||
    type === 'win_payout'
  ) {
    return false;
  }

  // Explicitly accept financial types
  if (
    type === 'deposit' ||
    type === 'withdrawal' ||
    type === 'wheel_bonus' ||
    type === 'admin_bonus' ||
    type === 'vip_bonus' ||
    type === 'admin_deduction' ||
    type === 'referral_bonus' ||
    type === 'registration_bonus' ||
    type === 'promo_code_claim' ||
    type === 'promo_deposit_bonus'
  ) {
    return true;
  }

  // Non-game bonus/rewards fallback
  const desc = (tx.description || '').toLowerCase();
  if (
    (desc.includes('bonus') || desc.includes('reward') || desc.includes('voucher') || desc.includes('referral') || desc.includes('cashback')) &&
    !desc.includes('round') &&
    !desc.includes('game') &&
    !desc.includes('bet') &&
    !desc.includes('ticket') &&
    !desc.includes('draw') &&
    !desc.includes('super car') &&
    !desc.includes('aviator') &&
    !desc.includes('roulette') &&
    !desc.includes('dragon') &&
    !desc.includes('andar')
  ) {
    return true;
  }

  return false;
};

interface WalletLedgerProps {
  transactions: WalletTransaction[];
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onOpenSupportChat?: (initialMessage?: string) => void;
}

export const WalletLedger: React.FC<WalletLedgerProps> = ({
  transactions = [],
  onOpenDeposit,
  onOpenWithdraw,
  onOpenSupportChat
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'deposit' | 'withdrawal' | 'bonus'>('deposit');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundFx.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Dedicated purely financial transactions collection
  const pureFinancialTxList = useMemo(() => {
    return (transactions || []).filter(isPureFinancialTx);
  }, [transactions]);

  // Filtered sub-lists
  const depositTransactions = useMemo(() => {
    return pureFinancialTxList.filter((t) => t.type === 'deposit');
  }, [pureFinancialTxList]);

  const withdrawalTransactions = useMemo(() => {
    return pureFinancialTxList.filter((t) => t.type === 'withdrawal');
  }, [pureFinancialTxList]);

  const bonusTransactions = useMemo(() => {
    return pureFinancialTxList.filter((t) => t.type !== 'deposit' && t.type !== 'withdrawal');
  }, [pureFinancialTxList]);

  const depositCount = depositTransactions.length;
  const withdrawalCount = withdrawalTransactions.length;
  const bonusCount = bonusTransactions.length;

  // Calculate Ledger Statistics for Deposit, Withdrawal and Bonus
  const totalDepositAmount = useMemo(() => {
    return depositTransactions
      .filter((tx) => (tx.status === 'completed' || (tx.status as string) === 'approved' || (tx.status as string) === 'success' || (tx.status as string) === 'successful'))
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  }, [depositTransactions]);

  const totalWithdrawalAmount = useMemo(() => {
    return withdrawalTransactions
      .filter((tx) => (tx.status === 'completed' || (tx.status as string) === 'approved' || tx.status === 'pending' || (tx.status as string) === 'success' || (tx.status as string) === 'successful'))
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  }, [withdrawalTransactions]);

  const totalBonusAmount = useMemo(() => {
    return bonusTransactions
      .filter((tx) => tx.status !== 'rejected' && tx.status !== 'failed' && (tx.amount || 0) > 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  }, [bonusTransactions]);

  // Filter & Search Logic
  const filteredTransactions = useMemo(() => {
    let list: WalletTransaction[] = [];
    if (typeFilter === 'deposit') {
      list = depositTransactions;
    } else if (typeFilter === 'withdrawal') {
      list = withdrawalTransactions;
    } else if (typeFilter === 'bonus') {
      list = bonusTransactions;
    } else {
      list = pureFinancialTxList;
    }

    if (statusFilter !== 'all') {
      const sf = statusFilter.toLowerCase();
      list = list.filter((tx) => {
        const txStatus = (tx.status || 'completed').toLowerCase();
        if (sf === 'completed') {
          return txStatus === 'completed' || txStatus === 'approved' || txStatus === 'success' || txStatus === 'successful';
        } else if (sf === 'pending') {
          return txStatus === 'pending';
        } else if (sf === 'rejected') {
          return txStatus === 'rejected' || txStatus === 'failed';
        }
        return txStatus === sf;
      });
    }

    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase().trim();
      list = list.filter((tx) => {
        const matchesId = tx.id.toLowerCase().includes(query);
        const matchesDesc = (tx.description || '').toLowerCase().includes(query);
        const matchesUtr = tx.utr ? tx.utr.toLowerCase().includes(query) : false;
        const matchesPromo = tx.promoCode ? tx.promoCode.toLowerCase().includes(query) : false;
        const matchesPromoTitle = tx.promoCodeTitle ? tx.promoCodeTitle.toLowerCase().includes(query) : false;
        return matchesId || matchesDesc || matchesUtr || matchesPromo || matchesPromoTitle;
      });
    }

    const sorted = sortOrder === 'oldest' 
      ? [...sortChronologicalNewestFirst(list)].reverse() 
      : sortChronologicalNewestFirst(list);

    return sorted;
  }, [typeFilter, depositTransactions, withdrawalTransactions, bonusTransactions, pureFinancialTxList, statusFilter, searchTerm, sortOrder]);

  // Helper functions for classification
  const isLossTx = (tx: WalletTransaction) => {
    if (tx.status === 'rejected' || tx.status === 'failed') return false;
    if (tx.type === 'admin_deduction') return true;
    if (tx.amount < 0 && tx.type !== 'withdrawal') return true;
    return false;
  };

  const isWinTx = (tx: WalletTransaction) => {
    if (tx.status === 'rejected' || tx.status === 'failed' || tx.status === 'pending') return false;
    if (tx.type === 'deposit' && ((tx.status as string) === 'approved' || tx.status === 'completed' || (tx.status as string) === 'success')) return true;
    if (tx.type === 'wheel_bonus' || tx.type === 'admin_bonus' || tx.type === 'vip_bonus' || tx.type === 'referral_bonus' || tx.type === 'registration_bonus') return true;
    if (tx.amount > 0 && !isLossTx(tx)) return true;
    return false;
  };

  // High-Definition Voucher Slip Canvas PNG Export & Share Generator
  const handleShareVoucherPNG = (tx: WalletTransaction) => {
    soundFx.playCoin();
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Luxury Slate Mesh Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 780);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 780);

    // Outer Gold Border Frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 568, 748);

    // Inner Subtle Gold Line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(22, 22, 556, 736);

    // B Logo Box
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(260, 40, 80, 50, 12);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.font = '900 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('B', 300, 76);

    // Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 24px monospace';
    ctx.fillText('ETGURU HD', 300, 122);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px monospace';
    ctx.fillText('OFFICIAL CASINO & LOTTERY TRANSACTION VOUCHER SLIP', 300, 142);

    // Divider Line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 160);
    ctx.lineTo(560, 160);
    ctx.stroke();

    // Voucher Card Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(40, 180, 520, 480);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.strokeRect(40, 180, 520, 480);

    // Status Banner Box
    const isCredit = tx.amount >= 0 || tx.type === 'deposit';
    ctx.fillStyle = isCredit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)';
    ctx.fillRect(60, 205, 480, 50);
    ctx.strokeStyle = isCredit ? '#10b981' : '#64748b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 205, 480, 50);

    ctx.fillStyle = isCredit ? '#34d399' : '#cbd5e1';
    ctx.font = '900 18px monospace';
    ctx.fillText(isCredit ? 'STATUS: CREDITED (SETTLED)' : 'STATUS: DEBITED (SETTLED)', 300, 236);

    // Amount Display
    ctx.fillStyle = isCredit ? '#34d399' : '#f87171';
    ctx.font = '900 36px monospace';
    const amountText = isCredit ? `+₹${Math.abs(tx.amount).toLocaleString('en-IN')}` : `-₹${Math.abs(tx.amount).toLocaleString('en-IN')}`;
    ctx.fillText(amountText, 300, 305);

    // Details Table
    ctx.textAlign = 'left';
    ctx.font = '600 13px monospace';

    const items = [
      ['Voucher ID', `#BG-SLIP-${tx.id}`],
      ['Transaction Type', (tx.type || '').toString().toUpperCase().replace(/_/g, ' ')],
      ['Date & Time', tx.date],
      ...(tx.promoCode ? [['Promo Code Origin', `${tx.promoCode} (${tx.promoCodeTitle || 'Bonus Claim'})`]] : []),
      ['Bank UTR / Ref', tx.utr || (tx.promoCode ? `PROMO: ${tx.promoCode}` : 'N/A (System Voucher)')],
      ['Security Audit', '100% SECURE & VERIFIED']
    ];

    let startY = 360;
    items.forEach(([label, val]) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(label, 70, startY);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(val, 260, startY);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(70, startY + 10);
      ctx.lineTo(530, startY + 10);
      ctx.stroke();

      startY += 40;
    });

    // Notes
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Description:', 70, startY);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 11px monospace';
    ctx.fillText((tx.description || '').substring(0, 55), 70, startY + 20);

    // Footer Watermark & Security Seal
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 12px monospace';
    ctx.fillText('VERIFIED & GUARANTEED BY B ETGURU SECURITY ENGINE', 300, 700);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 10px monospace';
    ctx.fillText(`GENERATED ON ${new Date().toLocaleString('en-IN')} • OFFICIAL DIGITAL VOUCHER`, 300, 725);

    // Safe Download & Export
    const filename = `BETGURU_Voucher_${tx.id}.png`;
    downloadVoucherImageSafe(canvas, filename);
  };

  // Helper for Transaction Type Display
  const getTypeBadge = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'deposit':
        return {
          label: 'Deposit Request (ডিপোজিট)',
          icon: <ArrowDownLeft className="w-4 h-4 text-emerald-400" />,
          bgColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          sign: '+'
        };
      case 'withdrawal':
        return {
          label: 'Bank Withdrawal (উইথড্রয়াল)',
          icon: <ArrowUpRight className="w-4 h-4 text-rose-400" />,
          bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          sign: '-'
        };
      case 'wheel_bonus':
        return {
          label: 'Wheel Bonus Credit (হুইল বোনাস)',
          icon: <Gift className="w-4 h-4 text-purple-400" />,
          bgColor: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
          sign: '+'
        };
      case 'vip_bonus':
        return {
          label: 'VIP Level Bonus (ভিআইপি বোনাস)',
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          sign: '+'
        };
      case 'admin_bonus':
      case 'referral_bonus':
      case 'registration_bonus':
        return {
          label: 'System Bonus Reward (বোনাস রিওয়ার্ড)',
          icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
          bgColor: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          sign: '+'
        };
      case 'promo_code_claim':
        return {
          label: 'Promo Code Bonus (প্রোমো কোড বোনাস)',
          icon: <Tag className="w-4 h-4 text-amber-400" />,
          bgColor: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
          sign: '+'
        };
      case 'promo_deposit_bonus':
        return {
          label: 'Promo Deposit Reward (ডিপোজিট বোনাস)',
          icon: <Gift className="w-4 h-4 text-emerald-400" />,
          bgColor: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
          sign: '+'
        };
      case 'admin_deduction':
        return {
          label: 'System Wallet Deduction',
          icon: <TrendingDown className="w-4 h-4 text-rose-400" />,
          bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          sign: '-'
        };
      default:
        return {
          label: 'Wallet Credit',
          icon: <Gift className="w-4 h-4 text-amber-400" />,
          bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          sign: '+'
        };
    }
  };

  // Helper for Outcome Signal Badge with Red/Green Signal Indicators and Zoom Animation
  const getOutcomeBadge = (tx: WalletTransaction) => {
    const statusLower = (tx.status || 'completed').toLowerCase();

    if (statusLower === 'rejected' || statusLower === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-zoom-red shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>REJECTED</span>
        </span>
      );
    }

    if (statusLower === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg">
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          <span>PENDING</span>
        </span>
      );
    }

    if (tx.type === 'deposit') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 animate-zoom-green shadow-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>APPROVED</span>
        </span>
      );
    }

    if (tx.type === 'withdrawal') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 animate-zoom-green shadow-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>SUCCESSFUL</span>
        </span>
      );
    }

    if (isWinTx(tx)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>CREDITED</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shadow-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          <span>DEBITED</span>
        </span>
      );
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Wallet Ledger Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Total Deposits */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-mono font-semibold uppercase tracking-wider">Total Deposits</span>
            <div className="text-xl font-black text-emerald-400 font-mono">
              +₹{totalDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {depositCount} deposit records
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-mono font-semibold uppercase tracking-wider">Total Withdrawals</span>
            <div className="text-xl font-black text-rose-400 font-mono">
              -₹{totalWithdrawalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {withdrawalCount} payout requests
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Total Bonus & Rewards */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-mono font-semibold uppercase tracking-wider">Bonus & Rewards</span>
            <div className="text-xl font-black text-amber-300 font-mono">
              +₹{totalBonusAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {bonusCount} bonus credits
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Gift className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Ledger Filter Bar - Horizontal Tabs (Deposits, Withdrawals, Bonus & Rewards) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono text-xs">
          <button
            onClick={() => { soundFx.playClick(); setTypeFilter('deposit'); }}
            className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'deposit'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                : 'bg-slate-900 text-emerald-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Deposits (ডিপোজিট)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              typeFilter === 'deposit' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {depositCount}
            </span>
          </button>

          <button
            onClick={() => { soundFx.playClick(); setTypeFilter('withdrawal'); }}
            className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'withdrawal'
                ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-lg shadow-rose-500/20 scale-[1.02]'
                : 'bg-slate-900 text-rose-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdrawals (উইথড্রয়াল)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              typeFilter === 'withdrawal' ? 'bg-slate-950 text-rose-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {withdrawalCount}
            </span>
          </button>

          <button
            onClick={() => { soundFx.playClick(); setTypeFilter('bonus'); }}
            className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'bonus'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]'
                : 'bg-slate-900 text-amber-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Bonus & Rewards (বোনাস ও রিওয়ার্ড)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              typeFilter === 'bonus' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {bonusCount}
            </span>
          </button>
        </div>

        {/* Search & Status Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by TXN ID, UTR, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { soundFx.playClick(); setStatusFilter(e.target.value); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed / Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Transactions Chronological List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
            <ShieldAlert className="w-10 h-10 text-slate-500 mx-auto" />
            <div className="text-sm font-mono font-bold text-slate-300">No ledger transactions found</div>
            <p className="text-xs text-slate-400">Try adjusting your search terms or filter selections.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((tx, idx) => {
                const badgeInfo = getTypeBadge(tx.type);
                const isPositive = isWinTx(tx);

                return (
                  <div
                    key={`${tx.id || 'tx'}_${idx}`}
                    onClick={() => { soundFx.playClick(); setSelectedTx(tx); }}
                    className="group p-4 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-amber-500/5"
                  >
                    
                    {/* Left Section: Icon & Info */}
                    <div className="flex items-center gap-3">
                      
                      {/* Category Type Icon Container */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${badgeInfo.bgColor}`}>
                        {badgeInfo.icon}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-black text-amber-400 tracking-wide">{tx.id}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeInfo.bgColor}`}>
                            {badgeInfo.label}
                          </span>
                          {/* Wallet Type Indicator Badge */}
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            tx.walletType === 'bonus'
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          }`}>
                            {tx.walletType === 'bonus' ? '🎁 Bonus Balance (বোনাস)' : '💰 Real Balance (রিয়েল)'}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-white font-mono line-clamp-1">{tx.description}</p>
                        
                        {/* Promo Code Origin & Details Highlight */}
                        {tx.promoCode && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-black">
                              <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>প্রোমো কোড: <strong className="text-white underline decoration-amber-400/60">{tx.promoCode}</strong></span>
                            </span>
                            {tx.promoCodeTitle && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({tx.promoCodeTitle})
                              </span>
                            )}
                            {tx.sourceOrigin && (
                              <span className="text-[10px] text-cyan-400/90 font-mono bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                                উৎস: {tx.sourceOrigin}
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                          <span>{tx.date}</span>
                          {tx.utr && <span className="text-slate-400">UTR: <strong className="text-amber-300/80">{tx.utr}</strong></span>}
                        </div>

                        {/* Copy UTR/TXID & Support Action Bar */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const textToCopy = tx.utr ? tx.utr : tx.id;
                              handleCopy(textToCopy, `${tx.id}_copy`);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer shadow-sm active:scale-95 ${
                              copiedId === `${tx.id}_copy`
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                : 'bg-slate-950 hover:bg-slate-800 border-slate-700/80 hover:border-amber-500/40 text-amber-300'
                            }`}
                            title={tx.utr ? `Copy UTR/TXID: ${tx.utr}` : `Copy Transaction ID: ${tx.id}`}
                          >
                            {copiedId === `${tx.id}_copy` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="font-bold">Copied {tx.utr ? 'UTR' : 'TXID'}!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-amber-400" />
                                <span>{tx.utr ? `Copy UTR: ${tx.utr.length > 12 ? tx.utr.substring(0, 10) + '…' : tx.utr}` : `Copy TXID`}</span>
                              </>
                            )}
                          </button>

                          {onOpenSupportChat && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const textToShare = `Hi BETGURU Support, I need assistance with my transaction:\n• Type: ${badgeInfo.label}\n• Amount: ₹${Math.abs(tx.amount)}\n• UTR/Ref: ${tx.utr || 'N/A'}\n• TXID: ${tx.id}\n• Date: ${tx.date}\n• Status: ${tx.status || 'Pending'}`;
                                navigator.clipboard.writeText(textToShare);
                                soundFx.playClick();
                                onOpenSupportChat(textToShare);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-400 text-[11px] font-mono text-blue-300 transition-all cursor-pointer shadow-sm active:scale-95"
                              title="Copy transaction details & open Live Support Chat"
                            >
                              <MessageSquare className="w-3 h-3 text-blue-400" />
                              <span>Support</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Right Section: Amount & Signal Zoom Animation Badge */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80 shrink-0">
                      
                      <div className="text-left sm:text-right">
                        <div className={`text-base font-black font-mono tracking-tight ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {isPositive ? `+₹${Math.abs(tx.amount).toLocaleString('en-IN')}` : `-₹${Math.abs(tx.amount).toLocaleString('en-IN')}`}
                        </div>
                        <div className="mt-1">{getOutcomeBadge(tx)}</div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all hidden sm:block" />

                    </div>

                  </div>
                );
              })}
            </div>

            <PaginationBar
              currentPage={currentPage}
              totalPages={Math.ceil(filteredTransactions.length / pageSize) || 1}
              pageSize={pageSize}
              totalItems={filteredTransactions.length}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              label="transactions"
            />
          </>
        )}
      </div>

      {/* Transaction Detail & Shareable Voucher Slip Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <VoucherGenerator
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onOpenSupportChat={onOpenSupportChat}
          />
        </div>
      )}

    </div>
  );
};

