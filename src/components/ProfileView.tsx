import React, { useState, useRef } from 'react';
import { 
  User as UserIcon, 
  Wallet, 
  Copy, 
  Check, 
  Share2, 
  Plus, 
  ArrowUpRight, 
  ShieldCheck, 
  LogOut, 
  Crown, 
  Sparkles, 
  Gem, 
  Headphones, 
  MessageSquareText, 
  Settings, 
  Volume2, 
  VolumeX, 
  Music, 
  Vibrate, 
  Gift, 
  Shield, 
  Edit3, 
  Camera, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  XCircle,
  Zap,
  Trophy,
  Key,
  Lock,
  ShieldAlert,
  ChevronRight,
  ArrowRight,
  Building2,
  CreditCard,
  Flame,
  Users,
  Fingerprint
} from 'lucide-react';
import { User, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, UserSettings } from '../types';
import { soundFx } from '../utils/audio';
import { VIP_TIERS, getNextTierInfo, calculateVipLevel } from '../utils/vip';
import { generatePermanentUserCode, checkIsAdminEmail } from '../utils/databaseSync';
import { UserEditProfileModal } from './UserEditProfileModal';
import { TransactionPinModal, PinModalMode } from './TransactionPinModal';

import { getDynamicReferralLink } from '../utils/referralEngine';

interface ProfileViewProps {
  user: User;
  deposits?: DepositRequest[];
  withdrawals?: WithdrawalRequest[];
  tickets?: PurchasedTicket[];
  transactions?: WalletTransaction[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onLogout?: () => void;
  onClaimVipBonus?: (bonusAmount: number) => void;
  onOpenAdmin?: () => void;
  onUpdateSettings?: (newSettings: UserSettings) => void;
  onOpenSettings?: () => void;
  onOpenSupportChat?: () => void;
  onOpenReferral?: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  onLockSession?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onOpenDeposit,
  onOpenWithdraw,
  onLogout,
  onClaimVipBonus,
  onOpenAdmin,
  onUpdateSettings,
  onOpenSettings,
  onOpenSupportChat,
  onOpenReferral,
  onUpdateUser,
  onLockSession
}) => {
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [showVipModal, setShowVipModal] = useState<boolean>(false);
  const [showBonusInfoModal, setShowBonusInfoModal] = useState<boolean>(false);
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>('setup');

  // Keep local user state synchronized if parent passes updated user
  React.useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const hasTransactionPin = !!(currentUser.settings?.transactionPin || currentUser.transactionPin);

  const handleOpenPinModal = (mode: PinModalMode) => {
    soundFx.playClick();
    setPinModalMode(mode);
    setPinModalOpen(true);
  };

  const profileAdminTapCountRef = useRef(0);
  const lastProfileAdminTapTimeRef = useRef(0);

  const handleProfileSecretTap = () => {
    const now = Date.now();
    if (now - lastProfileAdminTapTimeRef.current < 800) {
      profileAdminTapCountRef.current += 1;
    } else {
      profileAdminTapCountRef.current = 1;
    }
    lastProfileAdminTapTimeRef.current = now;

    if (profileAdminTapCountRef.current >= 5) {
      profileAdminTapCountRef.current = 0;
      if ((currentUser.role === 'admin' || checkIsAdminEmail(currentUser.email)) && onOpenAdmin) {
        soundFx.playClick();
        onOpenAdmin();
      }
    }
  };

  const [settings, setSettings] = useState<UserSettings>({
    bgMusicEnabled: currentUser.settings?.bgMusicEnabled ?? true,
    soundEffectsEnabled: currentUser.settings?.soundEffectsEnabled ?? true,
    hapticEnabled: currentUser.settings?.hapticEnabled ?? true
  });

  const handleToggleSetting = (key: keyof UserSettings) => {
    const updated: UserSettings = {
      ...settings,
      [key]: !(settings[key] ?? true)
    };
    setSettings(updated);

    if (key === 'bgMusicEnabled') soundFx.setBgMusicEnabled(updated.bgMusicEnabled ?? true);
    if (key === 'soundEffectsEnabled') soundFx.setSoundEffectsEnabled(updated.soundEffectsEnabled ?? true);
    if (key === 'hapticEnabled') soundFx.setHapticEnabled(updated.hapticEnabled ?? true);

    soundFx.playClick();

    if (onUpdateSettings) {
      onUpdateSettings(updated);
    }
  };

  const isAdminUser = Boolean(currentUser.role === 'admin' || checkIsAdminEmail(currentUser.email));
  const vipPts = currentUser.vipPoints || (currentUser.totalSpent ? Math.floor(currentUser.totalSpent / 10) : 120);
  const currentLevel = calculateVipLevel(vipPts);
  const currentTierInfo = VIP_TIERS[currentLevel];
  const { nextTier, pointsNeeded, progressPercent } = getNextTierInfo(vipPts);

  const userShortCode = currentUser.userCode || generatePermanentUserCode(currentUser.email, undefined, currentUser.id);

  const handleCopyId = () => {
    navigator.clipboard.writeText(userShortCode);
    setCopiedId(true);
    soundFx.playClick();
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyReferral = () => {
    const link = getDynamicReferralLink(currentUser.referralCode || currentUser.id);
    navigator.clipboard.writeText(link);
    setCopiedRef(true);
    soundFx.playClick();
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleCopyReferralCode = () => {
    const code = currentUser.referralCode || (currentUser.id ? `BG${currentUser.id.slice(0, 6).toUpperCase()}` : 'BETGURU');
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    soundFx.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUserSaved = (updated: User) => {
    setCurrentUser(updated);
    if (onUpdateUser) {
      onUpdateUser(updated);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-28 font-mono">
      
      {/* ========================================================================= */}
      {/* 1. TOP PROFILE HERO CARD                                                  */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        
        {/* VIP Badge fixed in Top Right Corner */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-20 flex items-center gap-2">
          <button
            onClick={() => { soundFx.playClick(); setShowVipModal(true); }}
            className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-2xl flex items-center gap-1.5 font-mono text-xs font-black shadow-xl border backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              currentLevel === 'Diamond'
                ? 'bg-gradient-to-r from-cyan-950/90 via-indigo-950/90 to-fuchsia-950/90 text-cyan-200 border-cyan-300/80 shadow-cyan-500/30'
                : currentTierInfo.badgeBg
            }`}
            title="Tap to view VIP Club & Loyalty Rewards"
          >
            {currentLevel === 'Diamond' ? (
              <span className="text-sm leading-none" role="img" aria-label="Diamond">💎</span>
            ) : currentLevel === 'Platinum' ? (
              <Gem className="w-4 h-4 text-cyan-300 animate-pulse" />
            ) : (
              <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
            )}
            <span className="uppercase tracking-wider font-extrabold">{currentLevel} VIP</span>
          </button>
        </div>

        {/* Ambient Gold Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 pt-3 sm:pt-0">
          
          {/* Avatar & User Details */}
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-amber-400 shadow-xl shadow-amber-500/20 group-hover:scale-105 group-hover:border-amber-300 transition-all duration-300 cursor-pointer"
                onClick={() => {
                  soundFx.playClick();
                  setShowPhotoModal(true);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">{currentUser.name}</h2>

                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 font-mono uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  <span>VERIFIED</span>
                </span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono">
                <span 
                  onClick={handleProfileSecretTap}
                  className="text-slate-400 cursor-default select-none"
                  title="Player Account ID"
                >
                  Account ID: <strong className="text-amber-400 font-bold tracking-wider">#{userShortCode}</strong>
                </span>
                <button
                  onClick={handleCopyId}
                  className="p-1 text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-300 font-mono">
                {currentUser.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-amber-400" /> {currentUser.phone}</span>}
                {currentUser.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-amber-400" /> {currentUser.email}</span>}
                {currentUser.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" /> {currentUser.city}</span>}
              </div>

              {/* Settings Trigger */}
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onOpenSettings();
                    }}
                    className="px-3.5 py-1.5 bg-slate-900/95 hover:bg-slate-850 text-amber-300 border border-amber-500/40 hover:border-amber-300 font-black text-xs font-mono rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
                    title="Open Settings & Security (সেটিংস ও নিরাপত্তা)"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>সেটিংস (Settings)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Balance Summary in Hero */}
          <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex flex-col gap-2 w-full text-center md:text-right">
              <div className="bg-slate-900/90 p-2.5 px-4 rounded-xl border border-amber-500/30 flex items-center justify-between gap-4">
                <span className="text-[10px] sm:text-xs text-amber-400 font-mono font-extrabold uppercase flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  <span>MAIN WALLET</span>
                </span>
                <span className="font-black text-amber-300 font-mono text-base sm:text-lg">
                  ₹{currentUser.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div 
                onClick={() => { soundFx.playClick(); setShowBonusInfoModal(true); }}
                className="bg-slate-900/90 hover:bg-slate-800/90 p-2.5 px-4 rounded-xl border border-purple-500/30 flex items-center justify-between gap-4 cursor-pointer transition-all"
                title="Bonus Wallet info"
              >
                <span className="text-[10px] sm:text-xs text-purple-300 font-mono font-extrabold uppercase flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                  <span>BONUS WALLET</span>
                </span>
                <span className="font-black text-purple-300 font-mono text-base sm:text-lg">
                  ₹{(currentUser.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-xs font-mono rounded-xl shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>DEPOSIT</span>
              </button>

              <button
                onClick={() => { soundFx.playClick(); onOpenWithdraw(); }}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-xs font-mono rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>WITHDRAW</span>
              </button>
            </div>
          </div>

        </div>

        {/* Referral Program & Invite Earn Dedicated Section */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>রেফারেল ও ইনভাইট আর্ন (Refer & Earn)</span>
                  <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                    ₹100 বোনাস
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  আমন্ত্রিত বন্ধু ন্যূনতম ডিপোজিট করলেই আপনার একাউন্টে ইনস্ট্যান্ট ক্যাশ ক্রেডিট হবে
                </p>
              </div>
            </div>

            {onOpenReferral && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenReferral();
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>রেফারেল হাব ও ট্র্যাকার খুলুন</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {/* Unique Referral Code with 1-Click Copy */}
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 uppercase block font-bold">রেফারেল কোড</span>
                <span className="text-xs font-black text-amber-400 font-mono tracking-wider truncate block">
                  {currentUser.referralCode || (currentUser.id ? `BG${currentUser.id.slice(0, 6).toUpperCase()}` : 'BETGURU')}
                </span>
              </div>
              <button
                onClick={handleCopyReferralCode}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0 active:scale-95"
                title="রেফারেল কোড কপি করুন"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'কপি হয়েছে' : 'কোড কপি'}</span>
              </button>
            </div>

            {/* Dynamic Referral Link with 1-Click Copy */}
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-slate-400 uppercase block font-bold">রেফারেল লিংক</span>
                <span className="text-[10px] text-slate-300 font-mono truncate block">
                  {getDynamicReferralLink(currentUser.referralCode || currentUser.id)}
                </span>
              </div>
              <button
                onClick={handleCopyReferral}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shrink-0 active:scale-95"
                title="রেফারেল লিংক কপি করুন"
              >
                {copiedRef ? <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> : <Share2 className="w-3 h-3 text-amber-400" />}
                <span>{copiedRef ? 'কপাইড' : 'লিংক কপি'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Security & App Lock Button */}
      {onLockSession && (
        <div className="pt-1">
          <button
            onClick={() => {
              soundFx.playClick();
              onLockSession();
            }}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/40 hover:to-amber-900/50 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white flex items-center justify-between transition-all group cursor-pointer shadow-lg active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                  অ্যাপটি এখনই লক করুন (Lock Screen)
                </span>
                <span className="text-[10px] text-slate-400 block">
                  ৪-সংখ্যার পাসকোড ও বায়োমেট্রিক নিরাপত্তা পরীক্ষা করুন
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
              <Fingerprint className="w-4 h-4" />
              <span>LOCK</span>
            </div>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1.5 🛡️ DEDICATED ADMIN CONTROL PANEL CARD (VISIBLE FOR VERIFIED ADMINS)    */}
      {/* ========================================================================= */}
      {isAdminUser && onOpenAdmin && (
        <div className="pt-2">
          <div
            onClick={() => {
              soundFx.playClick();
              onOpenAdmin();
            }}
            role="button"
            tabIndex={0}
            aria-label="Open Admin Control Panel"
            className="group relative w-full overflow-hidden rounded-3xl p-[2.5px] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            {/* Glowing Golden Ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 opacity-90 blur-[1px] group-hover:opacity-100 transition-all duration-300 animate-pulse" />

            {/* Inner Card Body */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[22px] bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/80 px-6 py-5 shadow-2xl backdrop-blur-xl border border-amber-400/80">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-lg shadow-amber-500/40 group-hover:scale-105 transition-transform shrink-0">
                  <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-6 h-6 text-amber-400 stroke-[2.5]" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors">
                      অ্যাডমিন ড্যাশবোর্ড (ADMIN PANEL)
                    </h3>
                    <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      FULL ACCESS
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 mt-0.5 font-medium">
                    ডিপোজিট, উইথড্রয়াল, ইউজার ডাটাবেস ও গেম কন্ট্রোল
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 shrink-0">
                <ShieldCheck className="w-4 h-4 stroke-[3]" />
                <span>OPEN PANEL</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform stroke-[3]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 🔥 ULTRA HIGH-DEFINITION FIERY ANIMATED LOGOUT BUTTON                 */}
      {/* ========================================================================= */}
      {onLogout && (
        <div className="pt-2">
          <div
            onClick={() => {
              soundFx.playClick();
              onLogout();
            }}
            role="button"
            tabIndex={0}
            aria-label="Secure Logout Account"
            className="animate-fire-tremor group relative w-full overflow-hidden rounded-3xl p-[3.5px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            {/* 1. Dynamic Fiery Animated Glowing Border Ring (Flames of Fire) */}
            <div className="animate-fire-blaze absolute inset-0 rounded-3xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 opacity-90 blur-[1.5px] group-hover:opacity-100 group-hover:blur-[2.5px] transition-all duration-300" />

            {/* 2. Secondary Intense Fiery Outer Flare Particles Glow */}
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-rose-600 via-amber-500 to-red-600 opacity-45 blur-2xl group-hover:opacity-85 transition-opacity duration-300" />

            {/* 3. High-Definition Inner Card Body */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[21px] bg-gradient-to-r from-red-950/95 via-slate-950/95 to-orange-950/95 px-6 py-5 sm:py-6 shadow-2xl backdrop-blur-xl border border-red-500/50 group-hover:border-amber-400/90 transition-colors">
              
              {/* Glowing Fiery Icon Cluster */}
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="relative shrink-0">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-orange-500 to-amber-400 p-0.5 shadow-lg shadow-red-500/50 group-hover:rotate-6 transition-transform duration-300">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-orange-400">
                      <Flame className="w-7 h-7 text-amber-400 animate-pulse fill-orange-500/40 stroke-[2.5]" />
                    </div>
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-gradient-to-r from-red-500 to-orange-500 border-2 border-slate-950 text-[9px] items-center justify-center font-black text-slate-950">!</span>
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black font-mono text-white tracking-wide group-hover:text-amber-200 transition-colors drop-shadow-md flex items-center gap-1.5">
                      <LogOut className="w-5 h-5 text-red-400 inline stroke-[2.5]" />
                      <span>লগআউট করুন (SECURE LOGOUT)</span>
                    </h3>
                    <span className="bg-red-500/30 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-400/50 uppercase tracking-wider font-mono shadow-sm">
                      INSTANT EXIT
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300/90 font-mono mt-1 font-semibold group-hover:text-slate-100 transition-colors">
                    নিরাপদে আপনার বর্তমান বেটিং সেশন থেকে লগআউট করুন
                  </p>
                </div>
              </div>

              {/* Action Pill Badge */}
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-orange-500 text-white font-mono font-black text-xs shadow-xl shadow-red-600/50 border border-orange-300/70 group-hover:scale-105 group-hover:shadow-red-500/80 transition-all shrink-0">
                <LogOut className="w-4 h-4 stroke-[2.5]" />
                <span className="tracking-wide">LOGOUT NOW</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform stroke-[3]" />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODALS & POPUPS (PRESERVED & FULLY FUNCTIONAL)                         */}
      {/* ========================================================================= */}

      {/* Profile Edit Modal */}
      {showEditModal && (
        <UserEditProfileModal
          user={currentUser}
          onClose={() => setShowEditModal(false)}
          onUserUpdated={handleUserSaved}
        />
      )}

      {/* Profile Photo Enlarge Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center space-y-4">
            
            <button
              onClick={() => {
                soundFx.playClick();
                setShowPhotoModal(false);
              }}
              className="absolute top-4 left-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-base font-black text-amber-300 font-mono tracking-wide pt-2">
              PROFILE PHOTO PREVIEW
            </h3>

            <div className="relative p-1 rounded-3xl bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 shadow-2xl shadow-amber-500/30">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-[22px] object-cover shadow-inner"
              />
            </div>

            <div className="space-y-1 font-mono">
              <h4 className="text-xl font-extrabold text-white">{currentUser.name}</h4>
              <p className="text-xs text-amber-400/90 font-semibold">{currentUser.email}</p>
              <p className="text-[11px] text-slate-400">Account ID: <span className="text-amber-400 font-bold">#{userShortCode}</span></p>
            </div>

            <div className="w-full pt-2">
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowPhotoModal(false);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIP Club Modal */}
      {showVipModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { soundFx.playClick(); setShowVipModal(false); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg">
                {currentLevel === 'Diamond' ? (
                  <span className="text-2xl" role="img" aria-label="Diamond">💎</span>
                ) : (
                  <Crown className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white font-mono uppercase">VIP CLUB & LOYALTY REWARDS</h3>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    currentLevel === 'Diamond'
                      ? 'bg-gradient-to-r from-cyan-950 via-indigo-950 to-fuchsia-950 text-cyan-200 border-cyan-300'
                      : currentTierInfo.badgeBg
                  }`}>
                    {currentLevel} VIP
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">Earn 1 VIP Point for every ₹100 bet on Lottery & Roulette</p>
              </div>
            </div>

            {/* Weekly Tier Payout Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <span>Weekly Tier Bonus Payout</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    Admin Managed
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Current Tier Bonus: <strong className="text-emerald-400 font-bold">₹{currentTierInfo.weeklyBonusAmount.toLocaleString('en-IN')}</strong> / week
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300/90 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-inner">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Direct Admin Sync</span>
              </div>
            </div>

            {/* Tier Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">
                  VIP Points: <strong className="text-amber-400">{vipPts.toLocaleString()} PTS</strong>
                </span>
                {nextTier ? (
                  <span className="text-slate-400">
                    Next Tier: <strong className="text-amber-300">{nextTier.level}</strong> ({pointsNeeded.toLocaleString()} pts needed)
                  </span>
                ) : (
                  <span className="text-cyan-300 font-black flex items-center gap-1">
                    <span>💎</span>
                    <span>ULTIMATE ROYAL DIAMOND VIP STATUS REACHED</span>
                  </span>
                )}
              </div>

              <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* VIP Tier Benefits Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-2 font-mono">
              {[VIP_TIERS.Bronze, VIP_TIERS.Silver, VIP_TIERS.Gold, VIP_TIERS.Platinum, VIP_TIERS.Diamond].map((tier) => {
                const isCurrent = tier.level === currentLevel;
                const isDiamondTier = tier.level === 'Diamond';

                return (
                  <div
                    key={tier.level}
                    className={`p-3 rounded-2xl border transition-all relative overflow-hidden ${
                      isCurrent
                        ? isDiamondTier
                          ? 'bg-gradient-to-br from-cyan-950/80 via-indigo-950/80 to-fuchsia-950/80 border-cyan-300 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400'
                          : 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black flex items-center gap-1 ${tier.color}`}>
                        <span>{tier.icon}</span>
                        <span>{tier.level}</span>
                      </span>
                      {isCurrent && (
                        <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 space-y-1">
                      <div>Min: <strong className="text-slate-300">{tier.minPoints.toLocaleString()} pts</strong></div>
                      <div>Limit: <strong className="text-slate-200">₹{tier.dailyWithdrawalLimit.toLocaleString()}/d</strong></div>
                      <div>Weekly: <strong className="text-emerald-400 font-bold">₹{tier.weeklyBonusAmount.toLocaleString()}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { soundFx.playClick(); setShowVipModal(false); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              CLOSE VIP CLUB
            </button>
          </div>
        </div>
      )}

      {/* Bonus Wallet Information Modal */}
      {showBonusInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden text-white space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black font-mono text-purple-200">
                    BONUS WALLET INFO
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Real-time Balance & Super Car Rules
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowBonusInfoModal(false);
                }}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-950/80 to-slate-900 rounded-2xl border border-purple-500/30 text-center space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-300 tracking-wider block">
                Available Bonus Balance
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-purple-200 block">
                ₹{(currentUser.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-purple-300/80 font-mono">
                🎁 Usable for Three Super Car Draw Games!
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block">Super Car Tickets Purchase:</strong>
                  <span>You can buy Super Car Draw tickets directly using Bonus Wallet without depositing new money.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300 block">Winning Payouts:</strong>
                  <span>When you win with Bonus Tickets, your winnings are credited directly to your Bonus Wallet!</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowBonusInfoModal(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        user={currentUser}
        mode={pinModalMode}
        onSuccess={(newPin) => {
          if (newPin) {
            const updatedSettings: UserSettings = {
              ...settings,
              transactionPin: newPin,
              hasTransactionPin: true,
              pinUpdatedAt: new Date().toISOString()
            };
            setSettings(updatedSettings);
            if (onUpdateSettings) {
              onUpdateSettings(updatedSettings);
            }
            const updatedUser: User = {
              ...currentUser,
              transactionPin: newPin,
              settings: updatedSettings
            };
            setCurrentUser(updatedUser);
            if (onUpdateUser) {
              onUpdateUser(updatedUser);
            }
          }
        }}
      />

    </div>
  );
};
