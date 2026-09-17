import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Flame, 
  Disc, 
  Ticket, 
  Gift, 
  X, 
  ChevronRight, 
  Wallet, 
  Sparkles, 
  Crown, 
  Dices, 
  ShieldCheck, 
  Headphones, 
  Settings, 
  LogOut, 
  ArrowUpRight,
  Zap,
  TrendingUp,
  Tag,
  History,
  ArrowDownLeft,
  Bell,
  MapPin,
  Users,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { User } from '../types';
import { soundFx } from '../utils/audio';
import { generatePermanentUserCode, checkIsAdminEmail } from '../utils/databaseSync';
import { PWAInstallButton } from './PWAInstallButton';
import { validatePromoCode, redeemInstantPromoCode } from '../utils/promoCodeService';
import { triggerConfetti } from '../utils/confetti';

interface UserSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSelectTab: (tab: 'home' | 'lottery' | 'withdrawal' | 'tickets' | 'history' | 'results' | 'lucky_wheel' | 'profile' | 'offers' | 'settings') => void;
  onOpenCasino: () => void;
  onOpenSuperCar?: () => void;
  onOpenOffers: () => void;
  onOpenPromoCode?: () => void;
  onOpenDeposit: () => void;
  onOpenSupportChat?: () => void;
  onOpenLuckyWheel?: () => void;
  onOpenAdmin?: () => void;
  onOpenPwaNotifications?: () => void;
  onOpenMapLocator?: () => void;
  onOpenReferral?: () => void;
  onLogout?: () => void;
  activeTicketsCount?: number;
  unreadSupportCount?: number;
  onBalanceUpdated?: (newBal: number, newBonusBal?: number) => void;
  onOpenDepositWithPromo?: (promoCode: string) => void;
}

export const UserSideMenu: React.FC<UserSideMenuProps> = ({
  isOpen,
  onClose,
  user,
  onSelectTab,
  onOpenCasino,
  onOpenSuperCar,
  onOpenOffers,
  onOpenPromoCode,
  onOpenDeposit,
  onOpenSupportChat,
  onOpenLuckyWheel,
  onOpenAdmin,
  onOpenPwaNotifications,
  onOpenMapLocator,
  onOpenReferral,
  onLogout,
  activeTicketsCount = 0,
  unreadSupportCount = 0,
  onBalanceUpdated,
  onOpenDepositWithPromo
}) => {
  const [inlineCode, setInlineCode] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [inlineSuccess, setInlineSuccess] = useState<{
    type: 'instant' | 'deposit';
    text: string;
    code?: string;
  } | null>(null);
  const [inlinePasted, setInlinePasted] = useState(false);

  if (!isOpen) return null;

  const handleInlinePaste = async () => {
    try {
      soundFx.playClick();
      const text = await navigator.clipboard.readText();
      if (text) {
        setInlineCode(text.trim().toUpperCase());
        setInlinePasted(true);
        setInlineError('');
        setTimeout(() => setInlinePasted(false), 1500);
      }
    } catch {
      // clipboard access fallback
    }
  };

  const handleInlineRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError('');
    setInlineSuccess(null);

    const cleanCode = inlineCode.trim().toUpperCase();
    if (!cleanCode) {
      setInlineError('অনুগ্রহ করে একটি প্রোমো কোড লিখুন');
      soundFx.playError();
      return;
    }

    setInlineLoading(true);
    soundFx.playClick();

    try {
      const val = await validatePromoCode(cleanCode, { id: user.id, email: user.email });
      if (!val.valid || !val.promo) {
        setInlineError(val.error || '❌ অবৈধ প্রোমো কোড! সঠিক কোড দিন।');
        soundFx.playError();
        setInlineLoading(false);
        return;
      }

      const promo = val.promo;

      // If deposit bonus promo code
      if (promo.type === 'deposit_bonus') {
        triggerConfetti({ particleCount: 50, spread: 60 });
        soundFx.playWin();
        const bonusStr = promo.bonusPercentage ? `+${promo.bonusPercentage}% Extra` : `+₹${promo.flatBonusAmount}`;
        setInlineSuccess({
          type: 'deposit',
          text: `🎁 ডিপোজিট কোড ভেরিফাইড! ডিপোজিটে পাবেন ${bonusStr} বোনাস!`,
          code: promo.code
        });
        setInlineLoading(false);
        return;
      }

      // If instant reward promo code
      const res = await redeemInstantPromoCode(cleanCode, user);
      if (res.success && res.promo) {
        triggerConfetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        soundFx.playWin();
        const walletLabel = res.targetWallet === 'main' ? 'মেইন ব্যালেন্সে (Withdrawable)' : 'বোনাস ব্যালেন্সে (Bonus)';
        setInlineSuccess({
          type: 'instant',
          text: `🎉 সফল হয়েছে! ₹${res.amountCredited?.toLocaleString('en-IN')} টাকা আপনার ${walletLabel} সরাসরি ক্রেডিট হয়েছে!`
        });

        if (onBalanceUpdated && res.newBalance !== undefined) {
          onBalanceUpdated(res.newBalance, res.newBonusBalance);
        }
        setInlineCode('');
      } else {
        setInlineError(res.error || 'প্রোমো কোড রিডিম করতে ব্যর্থ হয়েছে');
        soundFx.playError();
      }
    } catch (err: any) {
      setInlineError(err?.message || 'প্রোমো কোড যাচাই করতে সমস্যা হয়েছে');
      soundFx.playError();
    } finally {
      setInlineLoading(false);
    }
  };

  const handleNavigation = (action: () => void) => {
    soundFx.playClick();
    onClose();
    action();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-start animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xs sm:max-w-sm bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-r border-amber-500/30 h-full flex flex-col justify-between shadow-2xl font-mono animate-in slide-in-from-left duration-300 overflow-y-auto scrollbar-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP PROFILE HEADER SECTION */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md">
                BG
              </div>
              <span className="text-sm font-black text-white tracking-wider">BETGURU</span>
            </div>
            <button 
              onClick={() => { soundFx.playClick(); onClose(); }}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* USER CARD: User Name, Avatar, ID & VIP */}
          <div 
            onClick={() => handleNavigation(() => onSelectTab('profile'))}
            className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-950 hover:from-amber-950/30 hover:to-slate-900 rounded-2xl border border-amber-500/30 hover:border-amber-400/60 transition cursor-pointer group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                  alt={user.name} 
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md group-hover:scale-105 transition-transform"
                />
                <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full ring-2 ring-slate-950">
                  <Crown className="w-3 h-3" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors">
                    {user.name || 'Player'}
                  </h3>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    {user.vipLevel || 'Bronze'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                  ID: <span className="text-amber-300 font-bold">#{user.userCode || generatePermanentUserCode(user.email, undefined, user.id)}</span>
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1">
                  <span>Balance: ₹{(user.balance || 0).toLocaleString('en-IN')}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Balance & Deposit Action Strip */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-400 block font-sans">Main Wallet</span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                ₹{(user.balance || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <button
              onClick={() => handleNavigation(onOpenDeposit)}
              className="p-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer transition active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>+ DEPOSIT</span>
            </button>
          </div>
        </div>

        {/* PRIMARY MENU OPTIONS (In user requested exact sequence) */}
        <div className="p-4 space-y-2 flex-1">
          {/* Admin Control Panel Button for Authorized Admins */}
          {(user?.role === 'admin' || checkIsAdminEmail(user?.email)) && onOpenAdmin && (
            <button
              onClick={() => handleNavigation(onOpenAdmin)}
              className="w-full p-3 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-yellow-500/30 border-2 border-amber-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-lg shadow-amber-500/20 mb-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300">
                      ADMIN CONTROL PANEL
                    </span>
                    <span className="bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md">
                      HQ
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">অ্যাডমিন কন্ট্রোল প্যানেল (Approve Deposits & Withdrawals)</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>
          )}

          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-1 pb-1">
            EXPLORE & PLAY
          </p>

          {/* 1. Live Casino (লাইভ ক্যাসিনো) */}
          <button
            onClick={() => handleNavigation(onOpenCasino)}
            className="w-full p-3 bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 hover:from-red-950/80 hover:to-slate-800 border border-red-500/40 hover:border-red-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                <Disc className="w-5 h-5 animate-spin [animation-duration:8s]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white group-hover:text-red-300 transition-colors">
                    Live Casino
                  </span>
                  <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-md animate-pulse">
                    LIVE HD
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Dragon Tiger, Roulette, Andar Bahar, Aviator</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 2. 3 Super Car Live VIP Arena */}
          {onOpenSuperCar && (
            <button
              onClick={() => handleNavigation(onOpenSuperCar)}
              className="w-full p-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 hover:from-amber-950/80 hover:to-slate-800 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center text-lg shadow-md group-hover:scale-110 transition-transform shrink-0">
                  🏎️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                      3 Super Car Live Arena
                    </span>
                    <span className="bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md">
                      2.8X
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">100% Full-Screen Arena • 10M Live Draw</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>
          )}

          {/* 3. Ticket Gaming / Lottery (টিকিট গেমিং) */}
          <button
            onClick={() => handleNavigation(() => onSelectTab('lottery'))}
            className="w-full p-3 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 hover:from-amber-950/80 hover:to-slate-800 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                    Ticket Gaming & Lottery
                  </span>
                  <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md">
                    JACKPOT
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">3 Super Car Draw & Daily Gold Draws</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 3. Promotional Offers (অফার) */}
          <button
            onClick={() => handleNavigation(onOpenOffers)}
            className="w-full p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 hover:from-emerald-950/80 hover:to-slate-800 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                    Promotions & Offers
                  </span>
                  <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md animate-pulse">
                    🔥 HOT
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Deposit Bonuses, Cashbacks & Free Rewards</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 3.5. Promo Code System (প্রোমো কোড - ইন্টার ও ক্লেইম সেকশন) */}
          <div className="w-full p-3.5 bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl space-y-3 relative overflow-hidden shadow-lg shadow-amber-500/5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">🎟️ প্রোমো কোড</span>
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md animate-pulse">
                      লাইভ
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">কোড ইন্টার করে সরাসরি ক্লেইম করুন</p>
                </div>
              </div>
              {onOpenPromoCode && (
                <button
                  type="button"
                  onClick={() => handleNavigation(onOpenPromoCode)}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-0.5 cursor-pointer"
                  title="বিস্তারিত মডাল দেখুন"
                >
                  <span>মডাল ↗</span>
                </button>
              )}
            </div>

            {/* Inline Input & Action Form */}
            <form onSubmit={handleInlineRedeem} className="space-y-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inlineCode}
                  onChange={(e) => {
                    setInlineCode(e.target.value.toUpperCase());
                    if (inlineError) setInlineError('');
                  }}
                  placeholder="ইন্টার প্রোমো কোড (যেমন: BONUS100)"
                  className="w-full bg-black/70 border border-amber-500/40 focus:border-amber-400 text-white placeholder:text-slate-500 text-xs font-mono font-bold tracking-wider rounded-xl pl-3 pr-20 py-2 outline-none uppercase transition"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleInlinePaste}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1 border border-white/10"
                    title="ক্লিপবোর্ড থেকে পেস্ট করুন"
                  >
                    {inlinePasted ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{inlinePasted ? 'পেস্ট!' : 'পেস্ট'}</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={inlineLoading}
                className="w-full py-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition active:scale-98"
              >
                {inlineLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>যাচাই হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>রিডিম / ক্লেইম করুন</span>
                  </>
                )}
              </button>
            </form>

            {/* Inline Error Display */}
            {inlineError && (
              <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-start gap-1.5 text-rose-300 text-[11px] leading-tight animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                <span>{inlineError}</span>
              </div>
            )}

            {/* Inline Success Display */}
            {inlineSuccess && (
              <div className={`p-2.5 rounded-xl border space-y-2 animate-in fade-in zoom-in-95 ${
                inlineSuccess.type === 'instant' 
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200' 
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-200'
              }`}>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="text-[11px] font-bold leading-snug">
                    {inlineSuccess.text}
                  </div>
                </div>

                {inlineSuccess.type === 'deposit' && inlineSuccess.code && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenDepositWithPromo && inlineSuccess.code) {
                        onClose();
                        onOpenDepositWithPromo(inlineSuccess.code);
                      }
                    }}
                    className="w-full py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow-md cursor-pointer transition active:scale-95"
                  >
                    <span>ডিপোজিট করুন (+বোনাস সহ)</span>
                    <ArrowRight className="w-3 h-3 stroke-[3]" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. Referral Program & Invite Earn (রেফারেল ও ইনভাইট বোনাস) */}
          {onOpenReferral && (
            <button
              onClick={() => handleNavigation(onOpenReferral)}
              className="w-full p-3 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-slate-900 hover:from-amber-500/30 hover:to-slate-800 border border-amber-500/50 hover:border-amber-400 rounded-2xl flex items-center justify-between text-left transition group cursor-pointer shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform font-black shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300 group-hover:text-amber-200 transition-colors">
                      রেফারেল ও ইনভাইট আর্ন
                    </span>
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-md">
                      ₹100 বোনাস
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">লিংক বা কোড শেয়ার করে আনলিমিটেড ক্যাশ জিতুন</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>
          )}

          {/* Secondary Quick Navigation Items */}
          <div className="pt-2 space-y-1">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-1 pb-1">
              TRANSACTION HISTORY & ACTIVITY
            </p>

            {/* View Transactions (ভিউ ট্রানজেকশন - Live Games, Lottery & Super Car, Deposit & Withdrawal History) */}
            <button
              onClick={() => handleNavigation(() => onSelectTab('history'))}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 hover:from-amber-500/25 border border-amber-500/40 hover:border-amber-400 text-white flex items-center justify-between text-xs transition cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <History className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-amber-300 text-xs">View Transactions (ভিউ ট্রানজেকশন)</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase">
                      ALL
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                    Live Games • Lottery & Car • Deposit & Withdrawal
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>

            {/* My Purchased Tickets & Live Games Quick Link */}
            <button
              onClick={() => handleNavigation(() => onSelectTab('tickets'))}
              className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between text-xs transition cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Ticket className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                <div className="text-left">
                  <span className="font-bold block">My Tickets & Live Draws</span>
                  <span className="text-[9px] text-slate-400 block font-normal">Active tickets & round numbers</span>
                </div>
              </div>
              {activeTicketsCount > 0 ? (
                <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {activeTicketsCount}
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              )}
            </button>

            {/* Lucky Spin Wheel */}
            {onOpenLuckyWheel && (
              <button
                onClick={() => handleNavigation(onOpenLuckyWheel)}
                className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between text-xs transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Dices className="w-4 h-4 text-purple-400" />
                  <span>Lucky VIP Wheel</span>
                </div>
                <span className="text-[9px] text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800">
                  SPIN & WIN
                </span>
              </button>
            )}

            {/* Draw Winners & Results */}
            <button
              onClick={() => handleNavigation(() => onSelectTab('results'))}
              className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Draw Winners & Results</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>

            {/* Settings & Security (Transaction PIN / OTP) */}
            <button
              onClick={() => handleNavigation(() => onSelectTab('settings'))}
              className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between text-xs transition cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                <div className="text-left">
                  <span className="font-bold block">Settings & Security</span>
                  <span className="text-[9px] text-amber-300/80 block font-normal">উইথড্রয়াল ট্রানজ্যাকশন পিন ও ইমেইল OTP</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Official Outlet & Agent Map (Google Maps Platform) */}
            {onOpenMapLocator && (
              <button
                onClick={() => handleNavigation(onOpenMapLocator)}
                className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between text-xs transition cursor-pointer group border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <span className="font-bold block text-white flex items-center gap-1.5">
                      <span>আউটলেট ও এজেন্ট ম্যাপ</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black px-1.5 py-0.2 rounded border border-emerald-500/40">
                        MAPS
                      </span>
                    </span>
                    <span className="text-[9px] text-slate-400 block font-normal">
                      নিকটস্থ ক্যাশ কাউন্টার ও ক্লেইম লাউঞ্জ
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            )}

            {/* 24/7 Live Support */}
            {onOpenSupportChat && (
              <button
                onClick={() => handleNavigation(onOpenSupportChat)}
                className={`w-full p-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-between ${
                  unreadSupportCount > 0
                    ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/10 border-2 border-amber-400 text-white shadow-lg shadow-amber-500/20 animate-pulse'
                    : 'hover:bg-slate-900 text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Headphones className={`w-4 h-4 ${unreadSupportCount > 0 ? 'text-amber-400' : 'text-cyan-400'}`} />
                    {unreadSupportCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className={`block font-bold ${unreadSupportCount > 0 ? 'text-amber-300' : ''}`}>
                      24/7 Live Chat Support
                    </span>
                    {unreadSupportCount > 0 && (
                      <span className="text-[9px] text-amber-200 block font-normal">
                        লাইভ সাপোর্ট থেকে নতুন মেসেজ এসেছে
                      </span>
                    )}
                  </div>
                </div>
                {unreadSupportCount > 0 ? (
                  <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-md animate-bounce flex items-center gap-1">
                    <span>{unreadSupportCount} NEW</span>
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* BOTTOM UTILITY / LOGOUT BAR */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 space-y-2">
          {/* PWA Background Push Notification Action */}
          {onOpenPwaNotifications && (
            <button
              onClick={() => {
                soundFx.playClick();
                handleNavigation(onOpenPwaNotifications);
              }}
              className="w-full p-2.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-between bg-[#0e172e] hover:bg-[#152345] text-slate-200 hover:text-white border border-slate-700/70 hover:border-amber-500/50 shadow-sm group"
              title="PWA ব্যাকগ্রাউন্ড নোটিফিকেশন"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                  <Bell className="w-4 h-4 fill-slate-950 text-slate-950" />
                </div>
                <div className="text-left">
                  <span className="block font-black text-white text-[11px] sm:text-xs">
                    PWA ব্যাকগ্রাউন্ড নোটিফিকেশন
                  </span>
                  <span className="text-[9px] text-amber-400 font-bold block">
                    লক স্ক্রিন ও স্লিপ মোড অ্যালার্ট
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-bold">
                  ACTIVE
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )}

          {/* PWA Install App Action */}
          <PWAInstallButton variant="menu-item" className="w-full mb-2" />

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => handleNavigation(() => onSelectTab('settings'))}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {onLogout && (
              <button
                onClick={() => handleNavigation(onLogout)}
                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
