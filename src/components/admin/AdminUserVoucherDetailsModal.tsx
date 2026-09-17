import React, { useState, useEffect } from 'react';
import { 
  X, 
  User as UserIcon, 
  Gift, 
  Wallet, 
  CreditCard, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Copy, 
  Check, 
  Phone, 
  Mail, 
  Award, 
  ExternalLink,
  History,
  TrendingUp,
  Tag
} from 'lucide-react';
import { PromoRedemption, User } from '../../types';
import { soundFx } from '../../utils/audio';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminUserVoucherDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemption: PromoRedemption | null;
  allRedemptions?: PromoRedemption[];
}

export const AdminUserVoucherDetailsModal: React.FC<AdminUserVoucherDetailsModalProps> = ({
  isOpen,
  onClose,
  redemption,
  allRedemptions = []
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(false);

  // Fetch full user profile from Firestore when opened
  useEffect(() => {
    if (!isOpen || !redemption) {
      setFullUser(null);
      return;
    }

    let isMounted = true;
    setLoadingUser(true);

    const fetchUserData = async () => {
      try {
        // 1. Try to fetch by userId directly
        if (redemption.userId) {
          const userDocRef = doc(db, 'users', redemption.userId);
          const snap = await getDoc(userDocRef);
          if (snap.exists() && isMounted) {
            setFullUser({ id: snap.id, ...snap.data() } as User);
            setLoadingUser(false);
            return;
          }
        }

        // 2. Try querying by userEmail if not found
        if (redemption.userEmail) {
          const q = query(collection(db, 'users'), where('email', '==', redemption.userEmail.toLowerCase().trim()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty && isMounted) {
            const firstDoc = querySnap.docs[0];
            setFullUser({ id: firstDoc.id, ...firstDoc.data() } as User);
            setLoadingUser(false);
            return;
          }
        }

        if (isMounted) {
          setLoadingUser(false);
        }
      } catch (err) {
        console.warn('Error fetching detailed user profile for voucher modal:', err);
        if (isMounted) setLoadingUser(false);
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, redemption]);

  if (!isOpen || !redemption) return null;

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    soundFx.playClick();
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Find all redemptions by this user across the platform
  const userRedemptions = allRedemptions.filter(
    (r) => 
      (r.userId && redemption.userId && r.userId === redemption.userId) ||
      (r.userEmail && redemption.userEmail && r.userEmail.toLowerCase() === redemption.userEmail.toLowerCase())
  );

  const totalBonusClaimed = userRedemptions.reduce((sum, r) => sum + (r.amountCredited || 0), 0);

  const userName = fullUser?.name || redemption.userName || 'Player';
  const userEmail = fullUser?.email || redemption.userEmail || 'N/A';
  const userPhone = fullUser?.phone || (redemption as any).userPhone || 'N/A';
  const userCode = fullUser?.userCode || redemption.userCode || 'N/A';
  const userId = fullUser?.id || redemption.userId || 'N/A';
  const vipLevel = fullUser?.vipLevel || 'Bronze';
  const avatarUrl = fullUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
  const mainBalance = fullUser?.balance !== undefined ? fullUser.balance : null;
  const bonusBalance = fullUser?.bonusBalance !== undefined ? fullUser.bonusBalance : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white font-mono flex items-center gap-2">
                <span>ইউজার ভাউচার বিবরণী</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 uppercase">
                  User Details
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ভাউচার ক্লেইমকারী ইউজারের সম্পূর্ণ একাউন্ট ও রিডেম্পশন প্রোফাইল
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin">
          
          {/* User Profile Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Avatar and Primary Identity */}
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase font-mono shadow-sm">
                    {vipLevel}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white font-mono">
                      {userName}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span>Player ID:</span>
                    <span className="text-amber-300 font-bold">#{userCode}</span>
                    <button
                      onClick={() => handleCopy(userCode, 'code')}
                      className="text-slate-500 hover:text-amber-400 transition-colors p-0.5"
                      title="Copy Player ID"
                    >
                      {copiedField === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{userEmail}</span>
                    <button
                      onClick={() => handleCopy(userEmail, 'email')}
                      className="text-slate-500 hover:text-amber-400 transition-colors p-0.5 shrink-0"
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {userPhone && userPhone !== 'N/A' && (
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{userPhone}</span>
                      <button
                        onClick={() => handleCopy(userPhone, 'phone')}
                        className="text-slate-500 hover:text-amber-400 transition-colors p-0.5 shrink-0"
                        title="Copy Phone"
                      >
                        {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet Balances Box */}
              <div className="flex items-center gap-2.5 sm:gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800 shrink-0">
                <div className="text-center px-2 sm:px-3">
                  <span className="text-[9px] text-amber-400 uppercase font-black tracking-wider block font-mono">
                    MAIN BALANCE
                  </span>
                  <span className="text-sm sm:text-base font-black text-amber-300 font-mono block">
                    {loadingUser ? '...' : mainBalance !== null ? `₹${mainBalance.toLocaleString('en-IN')}` : 'N/A'}
                  </span>
                </div>

                <div className="w-px h-8 bg-slate-800" />

                <div className="text-center px-2 sm:px-3">
                  <span className="text-[9px] text-purple-400 uppercase font-black tracking-wider block font-mono">
                    BONUS BALANCE
                  </span>
                  <span className="text-sm sm:text-base font-black text-purple-300 font-mono block">
                    {loadingUser ? '...' : bonusBalance !== null ? `₹${bonusBalance.toLocaleString('en-IN')}` : 'N/A'}
                  </span>
                </div>
              </div>

            </div>

            {/* UID Bar */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <div className="flex items-center gap-2 truncate">
                <span>UID:</span>
                <span className="text-slate-400 truncate">{userId}</span>
              </div>
              <button
                onClick={() => handleCopy(userId, 'uid')}
                className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors shrink-0 ml-2"
              >
                {copiedField === 'uid' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'uid' ? 'Copied' : 'Copy UID'}</span>
              </button>
            </div>
          </div>

          {/* Current Claimed Voucher Detail Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-900 border-2 border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider font-mono">
                  CLAIMED VOUCHER DETAILS (ক্লেইমকৃত ভাউচার)
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                redemption.targetWallet === 'main' ? 'bg-amber-400/20 text-amber-300' : 'bg-purple-500/20 text-purple-300'
              }`}>
                {redemption.targetWallet === 'main' ? 'Main Real Wallet' : 'Bonus Wallet'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">PROMO CODE</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-black text-sm sm:text-base text-amber-300 font-mono">
                    {redemption.code}
                  </span>
                  <button
                    onClick={() => handleCopy(redemption.code, 'promo_code')}
                    className="text-slate-500 hover:text-amber-400 p-0.5"
                    title="Copy promo code"
                  >
                    {copiedField === 'promo_code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">AMOUNT CREDITED</span>
                <span className="font-black text-sm sm:text-base text-emerald-400 font-mono mt-0.5 block">
                  +₹{redemption.amountCredited?.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">VOUCHER TYPE</span>
                <span className="font-bold text-xs text-white capitalize mt-1 block">
                  {redemption.type === 'deposit_bonus' ? 'Deposit Bonus' : 'Instant Reward'}
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">CLAIM DATE & TIME</span>
                <span className="font-bold text-[11px] text-slate-300 font-mono mt-1 block leading-tight">
                  {redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>

            </div>

            {/* Funds Origin Audit Box (ইউজারের ব্যালেন্সটি কোথা থেকে এলো) */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase block">ব্যালেন্স আসার উৎস (Origin of Funds):</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-cyan-300">
                    {(redemption as any).sourceOrigin || 'প্রোমো কোড সক্রিয়করণ (Promo Code Activation)'}
                  </span>
                  {(redemption as any).promoOrigin && (
                    <span className="text-[10px] text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Campaign: {(redemption as any).promoOrigin}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 uppercase block">টার্গেট ওয়ালেট</span>
                <span className={`font-bold ${redemption.targetWallet === 'main' ? 'text-amber-300' : 'text-purple-300'}`}>
                  {redemption.targetWallet === 'main' ? 'মেইন ব্যালেন্স' : 'বোনাস ব্যালেন্স (0s Instant)'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
              <span className="truncate">Reference ID: {redemption.id}</span>
              <button
                onClick={() => handleCopy(redemption.id, 'ref_id')}
                className="text-slate-400 hover:text-amber-300 transition-colors ml-2 shrink-0 flex items-center gap-1"
              >
                {copiedField === 'ref_id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'ref_id' ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
          </div>

          {/* User's Complete Redemption History across all Vouchers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white font-mono uppercase tracking-wider">
                  USER REDEMPTION HISTORY (ইউজারের সমস্ত ক্লেইম হিস্টোরি)
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Total Claimed:</span>
                <span className="text-emerald-400 font-bold">₹{totalBonusClaimed.toLocaleString('en-IN')}</span>
                <span className="text-slate-500">({userRedemptions.length} times)</span>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {userRedemptions.length === 0 ? (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500 font-mono">
                  কোনো অতীত রিডেম্পশন পাওয়া যায়নি।
                </div>
              ) : (
                userRedemptions.map((r, index) => (
                  <div
                    key={r.id || index}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-all ${
                      r.id === redemption.id
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-300">{r.code}</span>
                        {r.id === redemption.id && (
                          <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                            CURRENT
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {r.type === 'deposit_bonus' ? 'Deposit Promo' : 'Free Reward'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString('en-IN') : 'N/A'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-emerald-400 block">
                        +₹{r.amountCredited?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase">
                        {r.targetWallet === 'main' ? 'Main Wallet' : 'Bonus Wallet'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Audit Trail Verified by BETGURU Engine</span>
          </div>

          <button
            type="button"
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono transition-colors cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>

      </div>
    </div>
  );
};
