import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Check, 
  Copy, 
  Gift, 
  Clock, 
  Users, 
  Percent, 
  DollarSign, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Search, 
  TrendingUp, 
  Wallet, 
  ShieldCheck, 
  Flame, 
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
  Pencil,
  Ticket,
  Image as ImageIcon,
  User as UserIcon,
  History
} from 'lucide-react';
import { PromoCode, PromoRedemption, PromoCodeType, PromoTargetWallet, User } from '../../types';
import { 
  subscribePromoCodes, 
  subscribePromoRedemptions, 
  createOrUpdatePromoCode, 
  deletePromoCode, 
  togglePromoCodeStatus,
  seedDefaultPromoCodes 
} from '../../utils/promoCodeService';
import { soundFx } from '../../utils/audio';
import { PromoVoucherCard } from '../PromoVoucherCard';
import { PromoVoucherModal } from '../PromoVoucherModal';
import { AdminUserVoucherDetailsModal } from './AdminUserVoucherDetailsModal';

interface AdminPromoCodeManagerProps {
  currentUser?: User;
}

export const AdminPromoCodeManager: React.FC<AdminPromoCodeManagerProps> = ({ currentUser }) => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [redemptions, setRedemptions] = useState<PromoRedemption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'instant_reward' | 'deposit_bonus' | 'active'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [selectedCodeForRedemptions, setSelectedCodeForRedemptions] = useState<PromoCode | null>(null);
  const [viewingVoucherPromo, setViewingVoucherPromo] = useState<PromoCode | null>(null);
  const [selectedRedemptionForUserDetails, setSelectedRedemptionForUserDetails] = useState<PromoRedemption | null>(null);
  const [isAllRedemptionsModalOpen, setIsAllRedemptionsModalOpen] = useState<boolean>(false);
  const [allRedemptionsSearch, setAllRedemptionsSearch] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState<{
    code: string;
    title: string;
    description: string;
    type: PromoCodeType;
    rewardAmount: number;
    bonusPercentage: number;
    flatBonusAmount: number;
    minDepositAmount: number;
    maxBonusLimit: number;
    targetWallet: PromoTargetWallet;
    maxUsesPerUser: number;
    maxTotalUses: number;
    expiresAt: string;
    isActive: boolean;
  }>({
    code: '',
    title: '',
    description: '',
    type: 'instant_reward',
    rewardAmount: 100,
    bonusPercentage: 50,
    flatBonusAmount: 0,
    minDepositAmount: 500,
    maxBonusLimit: 2000,
    targetWallet: 'bonus',
    maxUsesPerUser: 1,
    maxTotalUses: 0,
    expiresAt: '',
    isActive: true
  });

  // Subscribe to real-time Promo Codes & Redemptions
  useEffect(() => {
    const unsubCodes = subscribePromoCodes((list) => {
      setPromoCodes(list);
      setLoading(false);
    });

    const unsubRedemptions = subscribePromoRedemptions((list) => {
      setRedemptions(list);
    });

    return () => {
      unsubCodes();
      unsubRedemptions();
    };
  }, []);

  const handleCopy = (code: string) => {
    soundFx.playClick();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleActive = async (promo: PromoCode) => {
    soundFx.playClick();
    await togglePromoCodeStatus(promo.id, !promo.isActive);
  };

  const handleDelete = async (promoId: string) => {
    soundFx.playClick();
    await deletePromoCode(promoId);
    setDeleteConfirmId(null);
  };

  const handleOpenCreateModal = () => {
    soundFx.playClick();
    setEditingPromoId(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      type: 'instant_reward',
      rewardAmount: 100,
      bonusPercentage: 50,
      flatBonusAmount: 0,
      minDepositAmount: 500,
      maxBonusLimit: 2000,
      targetWallet: 'bonus',
      maxUsesPerUser: 1,
      maxTotalUses: 0,
      expiresAt: '',
      isActive: true
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (promo: PromoCode) => {
    soundFx.playClick();
    setEditingPromoId(promo.id);
    setFormData({
      code: promo.code,
      title: promo.title,
      description: promo.description || '',
      type: promo.type,
      rewardAmount: promo.rewardAmount || 100,
      bonusPercentage: promo.bonusPercentage || 50,
      flatBonusAmount: promo.flatBonusAmount || 0,
      minDepositAmount: promo.minDepositAmount || 500,
      maxBonusLimit: promo.maxBonusLimit || 0,
      targetWallet: promo.targetWallet || 'bonus',
      maxUsesPerUser: promo.maxUsesPerUser || 1,
      maxTotalUses: promo.maxTotalUses || 0,
      expiresAt: promo.expiresAt ? promo.expiresAt.split('T')[0] : '',
      isActive: promo.isActive ?? true
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    setFormError('');

    const cleanCode = formData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setFormError('অনুগ্রহ করে একটি বৈধ প্রোমো কোড লিখুন (letters/numbers only)');
      return;
    }

    if (!formData.title.trim()) {
      setFormError('অনুগ্রহ করে প্রোমো কোডের শিরোনাম লিখুন');
      return;
    }

    if (formData.type === 'instant_reward' && (!formData.rewardAmount || formData.rewardAmount <= 0)) {
      setFormError('সরাসরি রিওয়ার্ড অ্যামাউন্ট ০ এর বেশি হতে হবে');
      return;
    }

    if (formData.type === 'deposit_bonus' && (!formData.bonusPercentage || formData.bonusPercentage <= 0) && (!formData.flatBonusAmount || formData.flatBonusAmount <= 0)) {
      setFormError('ডিপোজিট বোনাস শতাংশ (%) অথবা ফিক্সড এমাউন্ট প্রদান করুন');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await createOrUpdatePromoCode({
        id: editingPromoId || undefined,
        code: cleanCode,
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        rewardAmount: formData.type === 'instant_reward' ? Number(formData.rewardAmount) : undefined,
        bonusPercentage: formData.type === 'deposit_bonus' ? Number(formData.bonusPercentage) : undefined,
        flatBonusAmount: formData.type === 'deposit_bonus' && formData.flatBonusAmount > 0 ? Number(formData.flatBonusAmount) : undefined,
        minDepositAmount: formData.type === 'deposit_bonus' ? Number(formData.minDepositAmount) : undefined,
        maxBonusLimit: formData.type === 'deposit_bonus' && formData.maxBonusLimit > 0 ? Number(formData.maxBonusLimit) : undefined,
        targetWallet: formData.targetWallet,
        maxUsesPerUser: Number(formData.maxUsesPerUser) || 1,
        maxTotalUses: Number(formData.maxTotalUses) || 0,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : '',
        isActive: formData.isActive,
        createdBy: currentUser?.name || currentUser?.email || 'Admin'
      });

      if (res.success) {
        soundFx.playWin();
        setIsCreateModalOpen(false);
        setEditingPromoId(null);
      } else {
        setFormError(res.error || 'প্রোমো কোড সেভ করা যায়নি');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error creating promo code');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filtered list
  const filteredPromoCodes = useMemo(() => {
    return promoCodes.filter((p) => {
      const matchesSearch = 
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterType === 'active') return p.isActive;
      if (filterType === 'instant_reward') return p.type === 'instant_reward';
      if (filterType === 'deposit_bonus') return p.type === 'deposit_bonus';
      return true;
    });
  }, [promoCodes, searchTerm, filterType]);

  // Aggregate stats
  const totalCodes = promoCodes.length;
  const activeCodes = promoCodes.filter((p) => p.isActive).length;
  const totalRedemptionsCount = redemptions.length;
  const totalRedeemedAmount = useMemo(() => {
    return redemptions.reduce((acc, r) => acc + (r.amountCredited || 0), 0);
  }, [redemptions]);

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto font-mono text-slate-100">
      
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-amber-500/30 p-4 sm:p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Tag className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>🎟️ PROMO CODE CONTROLLER</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase">
                  100% Firebase
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                প্রোমো কোড তৈরি, পরিচালনা, ডিলিট এবং ইউজারদের ওয়ালেটে ইনস্ট্যান্ট বা ডিপোজিট বোনাস প্রদান করুন
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          {promoCodes.length === 0 && !loading && (
            <button
              type="button"
              onClick={async () => {
                soundFx.playClick();
                await seedDefaultPromoCodes();
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>স্টার্টার কোড লোড করুন</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsAllRedemptionsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            title="ইউজারদের সমস্ত ভাউচার ক্লেইম হিস্টোরি ও প্রোফাইল বিবরণী দেখুন"
          >
            <Users className="w-4 h-4 text-purple-400" />
            <span>ইউজার ক্লেইম হিস্টোরি ({totalRedemptionsCount})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>নতুন প্রোমো কোড তৈরি করুন</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">মোট প্রোমো কোড</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{totalCodes}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">সক্রিয় কোড (Active)</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{activeCodes}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => {
            soundFx.playClick();
            setIsAllRedemptionsModalOpen(true);
          }}
          className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 shadow-md flex items-center justify-between cursor-pointer transition-all group"
          title="ক্লিক করে সম্পূর্ণ ইউজার ভাউচার হিস্টোরি ও ডিটেলস দেখুন"
        >
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs text-slate-400 group-hover:text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>মোট রিডিম সংখ্যা</span>
              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded">View ➔</span>
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-400 font-mono">{totalRedemptionsCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">মোট প্রদত্ত বোনাস/ক্যাশ</span>
            <span className="text-xl sm:text-2xl font-black text-yellow-400 font-mono">₹{totalRedeemedAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="কোড বা শিরোনাম দিয়ে খুঁজুন..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'সকল কোড' },
            { id: 'active', label: 'সক্রিয় (Active)' },
            { id: 'instant_reward', label: '⚡ সরাসরি রিওয়ার্ড' },
            { id: 'deposit_bonus', label: '💰 ডিপোজিট বোনাস' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setFilterType(tab.id as any);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Promo Codes List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <span className="text-xs">লোড হচ্ছে...</span>
        </div>
      ) : filteredPromoCodes.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 space-y-3">
          <Tag className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">কোনো প্রোমো কোড পাওয়া যায়নি</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            প্রোমো কোড তৈরি করতে ওপরের &quot;নতুন প্রোমো কোড তৈরি করুন&quot; বাটনে ক্লিক করুন অথবা ডিফল্ট স্টার্টার কোড লোড করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPromoCodes.map((promo) => {
            const isInstant = promo.type === 'instant_reward';
            const isMainWallet = promo.targetWallet === 'main';
            const isExpired = promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now();

            return (
              <div 
                key={promo.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  !promo.isActive || isExpired
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                    : isMainWallet
                    ? 'bg-gradient-to-b from-amber-950/20 via-slate-900 to-slate-950 border-amber-500/30 hover:border-amber-400/60 shadow-lg'
                    : 'bg-gradient-to-b from-purple-950/20 via-slate-900 to-slate-950 border-purple-500/30 hover:border-purple-400/60 shadow-lg'
                }`}
              >
                {/* Top Badge Row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Type Badge */}
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      isInstant 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {isInstant ? <Sparkles className="w-3 h-3 text-amber-400" /> : <Percent className="w-3 h-3 text-emerald-400" />}
                      <span>{isInstant ? 'Direct Cash' : 'Deposit Bonus'}</span>
                    </span>

                    {/* Target Wallet Badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      isMainWallet 
                        ? 'bg-amber-400 text-slate-950 font-black' 
                        : 'bg-purple-500 text-white font-bold'
                    }`}>
                      <Wallet className="w-2.5 h-2.5" />
                      <span>{isMainWallet ? 'Main Wallet' : 'Bonus Wallet'}</span>
                    </span>
                  </div>

                  {/* Active / Inactive Status Indicator */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(promo)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                      isExpired
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : promo.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isExpired ? 'Expired' : promo.isActive ? 'Active ●' : 'Inactive ○'}
                  </button>
                </div>

                {/* Promo Code Box */}
                <div className="my-2 p-3 bg-black/50 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Tag className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-mono text-base sm:text-lg font-black tracking-widest text-white truncate">
                      {promo.code}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(promo.code)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition cursor-pointer shrink-0"
                    title="Copy Code"
                  >
                    {copiedCode === promo.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Title and details */}
                <div className="space-y-1.5 mb-4">
                  <h3 className="text-xs sm:text-sm font-bold text-white leading-snug">{promo.title}</h3>
                  {promo.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2">{promo.description}</p>
                  )}

                  {/* Reward specs */}
                  <div className="pt-2 text-xs text-slate-300 space-y-1">
                    {isInstant ? (
                      <div className="flex justify-between py-1 border-t border-slate-800/80">
                        <span className="text-slate-400">রিওয়ার্ড অ্যামাউন্ট:</span>
                        <span className="font-black text-amber-300">₹{promo.rewardAmount?.toLocaleString('en-IN')}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between py-1 border-t border-slate-800/80">
                          <span className="text-slate-400">ডিপোজিট বোনাস:</span>
                          <span className="font-black text-emerald-400">
                            {promo.bonusPercentage ? `+${promo.bonusPercentage}% Extra` : `+₹${promo.flatBonusAmount}`}
                          </span>
                        </div>
                        {promo.minDepositAmount ? (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">সর্বনিম্ন ডিপোজিট:</span>
                            <span className="font-bold text-white">₹{promo.minDepositAmount?.toLocaleString('en-IN')}</span>
                          </div>
                        ) : null}
                        {promo.maxBonusLimit ? (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">সর্বোচ্চ বোনাস ক্যাপ:</span>
                            <span className="font-bold text-amber-300">₹{promo.maxBonusLimit?.toLocaleString('en-IN')}</span>
                          </div>
                        ) : null}
                      </>
                    )}

                    {/* Limits */}
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-slate-400">ইউজার লিমিট:</span>
                      <span className="font-bold text-white">{promo.maxUsesPerUser || 1} বার / ইউজার</span>
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">মোট ব্যবহার:</span>
                      <span className="font-bold text-amber-400 font-mono">
                        {promo.usedCount || 0} {promo.maxTotalUses ? `/ ${promo.maxTotalUses} বার` : 'বার (আনলিমিটেড)'}
                      </span>
                    </div>

                    {promo.expiresAt && (
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>মেয়াদ শেষ:</span>
                        <span className="text-rose-300">{new Date(promo.expiresAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedCodeForRedemptions(promo);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>ইউজার তালিকা ({redemptions.filter(r => r.codeId === promo.id).length})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setViewingVoucherPromo(promo);
                      }}
                      className="p-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="ফটো ভাউচার টিকিট দেখুন ও ডাউনলোড করুন (View & Download 4K Voucher)"
                    >
                      <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">ভাউচার</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(promo)}
                      className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer"
                      title="Edit Promo Code (প্রোমো কোড এডিট করুন)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {deleteConfirmId === promo.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(promo.id)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          নিশ্চিত
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setDeleteConfirmId(promo.id);
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                        title="Delete Promo Code (প্রোমো কোড মুছুন)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PROMO CODE MODAL */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl my-auto flex flex-col max-h-[94vh] overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
                  <Tag className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {editingPromoId ? 'প্রোমো কোড এডিট করুন (Edit Promo Code)' : 'নতুন প্রোমো কোড তৈরি করুন (Create Promo Code)'}
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    নিচে তথ্য দিন — সাথে সাথে ৪K ফটো ভাউচার তৈরি হবে এবং ডাউনলোড করা যাবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitForm} id="promoCodeForm" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-700">
              
              {/* REAL-TIME LIVE 4K VOUCHER CARD PREVIEW */}
              <div className="p-3 sm:p-4 bg-slate-950/80 rounded-2xl border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-3.5 h-3.5" />
                    লাইভ ফটো ভাউচার প্রিভিউ (Live 4K Voucher Preview)
                  </span>
                  <span className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-sans">
                    স্বয়ংক্রিয়ভাবে রেন্ডার হচ্ছে
                  </span>
                </div>
                <PromoVoucherCard 
                  data={formData} 
                  showDownloadButton={true} 
                />
              </div>
              
              {/* Code Name & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">
                    প্রোমো কোড (Code Name) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME100"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-black tracking-widest text-sm rounded-xl px-3 py-2 outline-none uppercase"
                  />
                  <span className="text-[10px] text-slate-500">ইউজাররা এই কোডটি এন্টার করবে</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">
                    শিরোনাম (Title) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. 50% Extra Deposit Boost"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">বর্ণনা / অফার নোট (Description)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. ক্লেইম করলেই বোনাস ওয়ালেটে ইনস্ট্যান্ট ১০০ টাকা ক্রেডিট"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* Promo Type Selector */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">প্রোমো কোডের ধরন (Promo Type)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'instant_reward' })}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      formData.type === 'instant_reward'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-xs">⚡ সরাসরি রিওয়ার্ড (Instant)</span>
                      <span className="text-[10px] text-slate-400 block">কোড দিয়ে সাবমিট করলেই নির্দিষ্ট নগদ টাকা ওয়ালেটে ক্রেডিট</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'deposit_bonus' })}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      formData.type === 'deposit_bonus'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Percent className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-xs">💰 ডিপোজিট বোনাস (% Extra)</span>
                      <span className="text-[10px] text-slate-400 block">ডিপোজিট করার সময় কোড দিলে অতিরিক্ত % বোনাস যোগ হবে</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dynamic inputs based on Type */}
              {formData.type === 'instant_reward' ? (
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-amber-500/20 space-y-3">
                  <div className="space-y-1">
                    <label className="text-amber-400 font-bold block">
                      সরাসরি রিওয়ার্ড অ্যামাউন্ট (₹ Reward Amount) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-amber-400">₹</span>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.rewardAmount}
                        onChange={(e) => setFormData({ ...formData, rewardAmount: Number(e.target.value) })}
                        placeholder="100"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 text-white font-black text-sm rounded-xl pl-8 pr-3 py-2 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-emerald-500/20 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-emerald-400 font-bold block">বোনাস পার্সেন্টেজ (% Extra)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={formData.bonusPercentage}
                          onChange={(e) => setFormData({ ...formData, bonusPercentage: Number(e.target.value) })}
                          placeholder="50"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-400 text-white font-black text-sm rounded-xl pl-3 pr-7 py-2 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-emerald-400">%</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-emerald-400 font-bold block">সর্বনিম্ন ডিপোজিট (Min Deposit ₹)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-emerald-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.minDepositAmount}
                          onChange={(e) => setFormData({ ...formData, minDepositAmount: Number(e.target.value) })}
                          placeholder="500"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-400 text-white font-black text-sm rounded-xl pl-8 pr-3 py-2 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">সর্বোচ্চ বোনাস লিমিট ক্যাপ (Max Bonus Cap ₹ - Optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxBonusLimit}
                        onChange={(e) => setFormData({ ...formData, maxBonusLimit: Number(e.target.value) })}
                        placeholder="2000 (0 for no cap)"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-400 text-white text-xs rounded-xl pl-8 pr-3 py-2 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target Wallet Selection (Main vs Bonus Balance) */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">
                  কোন ওয়ালেটে ক্রেডিট হবে? (Target Wallet Destination)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, targetWallet: 'bonus' })}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      formData.targetWallet === 'bonus'
                        ? 'bg-purple-500/20 border-purple-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Gift className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <span className="font-black text-xs block">বোনাস ব্যালেন্স (Bonus)</span>
                      <span className="text-[9px] text-slate-400">Bonus Wallet Credit</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, targetWallet: 'main' })}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      formData.targetWallet === 'main'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-black text-xs block">মেইন ব্যালেন্স (Main)</span>
                      <span className="text-[9px] text-slate-400">Direct Cash (Withdrawable)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">প্রতি ইউজার কতবার পাবে? (Per-User Limit)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.maxUsesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxUsesPerUser: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">ডিফল্ট ১ বার (1 time per user)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">মোট গ্লোবাল ব্যবহার কোটা (Total Global Uses)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxTotalUses}
                    onChange={(e) => setFormData({ ...formData, maxTotalUses: Number(e.target.value) })}
                    placeholder="0 = Unlimited"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">০ দিলে কোনো সীমা থাকবে না</span>
                </div>
              </div>

              {/* Expiration Date & Active Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">মেয়াদ শেষের তারিখ (Expiry Date - Optional)</label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2 outline-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-white">কোডটি সরাসরি চালু রাখুন</span>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

            </form>

            {/* Sticky Footer - Always Visible & 100% Accessible */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20">
              <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
                প্রোমো কোড সংরক্ষণ করলে তা সাথে সাথে কার্যকর হবে
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  form="promoCodeForm"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition active:scale-95"
                >
                  {formSubmitting 
                    ? 'সেভ হচ্ছে...' 
                    : editingPromoId 
                      ? 'পরিবর্তন সেভ করুন (Save Changes)' 
                      : 'প্রোমো কোড সেভ ও লাইভ করুন (Save & Publish)'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* REDEMPTIONS HISTORY MODAL */}
      {selectedCodeForRedemptions && (() => {
        const codeRedemptions = redemptions.filter(r => r.codeId === selectedCodeForRedemptions.id);
        return (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200"
            onClick={() => setSelectedCodeForRedemptions(null)}
          >
            <div 
              className="w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <span>🎟️ কোড রিডিম হিস্টোরি:</span>
                    <span className="text-amber-400 font-mono tracking-wider">{selectedCodeForRedemptions.code}</span>
                  </h2>
                  <p className="text-xs text-slate-400">{selectedCodeForRedemptions.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCodeForRedemptions(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-[11px] text-amber-300 font-mono flex items-center justify-between">
                <span>💡 ইউজারের উপর ক্লিক করলে তার সম্পূর্ণ প্রোফাইল ও ব্যালেন্স বিবরণী চলে আসবে</span>
                <span className="text-[10px] text-slate-400">({codeRedemptions.length} claims)</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {codeRedemptions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    এখনো কোনো ইউজার এই কোডটি রিডিম করেননি।
                  </div>
                ) : (
                  codeRedemptions.map((red) => (
                    <div 
                      key={red.id}
                      onClick={() => {
                        soundFx.playClick();
                        setSelectedRedemptionForUserDetails(red);
                      }}
                      className="p-3 bg-slate-950 hover:bg-slate-900 rounded-2xl border border-slate-800 hover:border-amber-500/60 flex items-center justify-between gap-3 text-xs cursor-pointer group transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
                      title="ইউজারের উপর ক্লিক করে সম্পূর্ণ তথ্য ও হিস্টোরি দেখুন"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2 group-hover:text-amber-300 transition-colors">
                            <span>{red.userName || 'Player'}</span>
                            {red.userCode && <span className="text-[10px] text-amber-400 font-mono">#{red.userCode}</span>}
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded group-hover:bg-amber-400/20 group-hover:text-amber-300 font-mono">
                              View Profile ➔
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            <span>{red.userEmail || 'No email'}</span> • <span>{new Date(red.redeemedAt).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-400 font-mono block">
                          +₹{red.amountCredited?.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          red.targetWallet === 'main' ? 'bg-amber-400/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {red.targetWallet === 'main' ? 'Main Wallet' : 'Bonus Wallet'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ALL VOUCHER REDEMPTIONS & USER AUDIT MODAL */}
      {isAllRedemptionsModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsAllRedemptionsModalOpen(false)}
        >
          <div 
            className="w-full max-w-3xl bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>🎟️ সমস্ত ভাউচার ক্লেইম ও ইউজার হিস্টোরি</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                      {redemptions.length} Total Claims
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    যেকোনো ইউজারের উপর ক্লিক করলে তার একাউন্ট প্রোফাইল, লাইভ ব্যালেন্স ও সমস্ত তথ্য দেখা যাবে
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAllRedemptionsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user name, email, promo code, amount..."
                value={allRedemptionsSearch}
                onChange={(e) => setAllRedemptionsSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {(() => {
                const query = allRedemptionsSearch.toLowerCase().trim();
                const filtered = redemptions.filter((r) => {
                  if (!query) return true;
                  const nameMatch = (r.userName || '').toLowerCase().includes(query);
                  const emailMatch = (r.userEmail || '').toLowerCase().includes(query);
                  const codeMatch = (r.code || '').toLowerCase().includes(query);
                  const idMatch = (r.userId || '').toLowerCase().includes(query);
                  const amtMatch = String(r.amountCredited || '').includes(query);
                  return nameMatch || emailMatch || codeMatch || idMatch || amtMatch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 text-xs font-mono">
                      কোনো ইউজার ভাউচার ক্লেইম রেকর্ড পাওয়া যায়নি।
                    </div>
                  );
                }

                return filtered.map((red) => (
                  <div
                    key={red.id}
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedRedemptionForUserDetails(red);
                    }}
                    className="p-3 bg-slate-950 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-purple-500/50 flex items-center justify-between gap-3 text-xs cursor-pointer group transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
                    title="ইউজারের উপর ক্লিক করে সম্পূর্ণ তথ্য ও প্রোফাইল দেখুন"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2 group-hover:text-purple-300 transition-colors">
                          <span>{red.userName || 'Player'}</span>
                          {red.userCode && <span className="text-[10px] text-amber-400">#{red.userCode}</span>}
                          <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                            {red.code}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>{red.userEmail || 'No email'}</span>
                          <span>•</span>
                          <span>{new Date(red.redeemedAt).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-emerald-400 font-mono block">
                        +₹{red.amountCredited?.toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        red.targetWallet === 'main' ? 'bg-amber-400/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {red.targetWallet === 'main' ? 'Main Wallet' : 'Bonus Wallet'}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>💡 প্রতিটি ইউজারের নামের উপর ক্লিক করে লাইভ ব্যালেন্স ও ক্লেইম হিস্টোরি দেখা যাবে।</span>
              <button
                type="button"
                onClick={() => setIsAllRedemptionsModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4K ULTRA HD PHOTO VOUCHER MODAL */}
      <PromoVoucherModal
        isOpen={!!viewingVoucherPromo}
        onClose={() => setViewingVoucherPromo(null)}
        promo={viewingVoucherPromo}
      />

      {/* USER VOUCHER & PROFILE DETAILS MODAL */}
      <AdminUserVoucherDetailsModal
        isOpen={!!selectedRedemptionForUserDetails}
        onClose={() => setSelectedRedemptionForUserDetails(null)}
        redemption={selectedRedemptionForUserDetails}
        allRedemptions={redemptions}
      />

    </div>
  );
};
