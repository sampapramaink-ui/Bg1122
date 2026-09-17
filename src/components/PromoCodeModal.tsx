import React, { useState } from 'react';
import { 
  Tag, 
  X, 
  Sparkles, 
  Clipboard, 
  Check, 
  AlertCircle, 
  Wallet, 
  Gift, 
  ArrowRight, 
  Percent, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { User, PromoCode, PromoTargetWallet } from '../types';
import { redeemInstantPromoCode, validatePromoCode } from '../utils/promoCodeService';
import { soundFx } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';

interface PromoCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onBalanceUpdated?: (newBal: number, newBonusBal?: number) => void;
  onOpenDepositWithPromo?: (promoCode: string) => void;
}

export const PromoCodeModal: React.FC<PromoCodeModalProps> = ({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
  onOpenDepositWithPromo
}) => {
  const [code, setCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [pasted, setPasted] = useState<boolean>(false);

  // Success result state
  const [successData, setSuccessData] = useState<{
    type: 'instant' | 'deposit';
    amountCredited?: number;
    targetWallet?: PromoTargetWallet;
    promo: PromoCode;
  } | null>(null);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      soundFx.playClick();
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text.trim().toUpperCase());
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      // ignore
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessData(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('অনুগ্রহ করে একটি প্রোমো কোড লিখুন (Please enter a promo code)');
      soundFx.playError();
      return;
    }

    setSubmitting(true);
    soundFx.playClick();

    try {
      // First validate code to see if it's instant or deposit
      const val = await validatePromoCode(cleanCode, { id: user.id, email: user.email });
      if (!val.valid || !val.promo) {
        setErrorMsg(val.error || '❌ অবৈধ প্রোমো কোড! অনুগ্রহ করে সঠিক কোড দিন।');
        soundFx.playError();
        setSubmitting(false);
        return;
      }

      const promo = val.promo;

      // If it is a deposit bonus promo code
      if (promo.type === 'deposit_bonus') {
        triggerConfetti({ particleCount: 50, spread: 60 });
        soundFx.playWin();
        setSuccessData({
          type: 'deposit',
          promo
        });
        setSubmitting(false);
        return;
      }

      // If it is an instant reward code, redeem directly!
      const res = await redeemInstantPromoCode(cleanCode, user);
      if (res.success && res.promo) {
        triggerConfetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        soundFx.playWin();
        setSuccessData({
          type: 'instant',
          amountCredited: res.amountCredited,
          targetWallet: res.targetWallet,
          promo: res.promo
        });

        // Notify parent to update balance state immediately
        if (onBalanceUpdated && res.newBalance !== undefined) {
          onBalanceUpdated(res.newBalance, res.newBonusBalance);
        }
      } else {
        setErrorMsg(res.error || 'প্রোমো কোড রিডিম করতে ব্যর্থ হয়েছে।');
        soundFx.playError();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'প্রোমো কোড যাচাই করতে সমস্যা হয়েছে।');
      soundFx.playError();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositNow = () => {
    soundFx.playClick();
    if (successData?.promo && onOpenDepositWithPromo) {
      onOpenDepositWithPromo(successData.promo.code);
      onClose();
    }
  };

  const handleReset = () => {
    setCode('');
    setSuccessData(null);
    setErrorMsg('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-500/10 space-y-5 relative overflow-hidden text-slate-100 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5 relative z-10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30">
            <Tag className="w-7 h-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase">
            🎟️ রিডিম প্রোমো কোড
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            এডমিন থেকে প্রাপ্ত প্রোমো কোড এন্টার করে সরাসরি নগদ ব্যালেন্স বা ডিপোজিট বোনাস ক্লেইম করুন
          </p>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="space-y-4 py-2 animate-in zoom-in-95 duration-200">
            <div className={`p-5 rounded-3xl border text-center space-y-3 relative overflow-hidden ${
              successData.type === 'instant'
                ? 'bg-gradient-to-b from-amber-500/20 to-yellow-600/10 border-amber-400/60 shadow-xl'
                : 'bg-gradient-to-b from-emerald-500/20 to-teal-600/10 border-emerald-400/60 shadow-xl'
            }`}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 flex items-center justify-center">
                <CheckCircle2 className={`w-7 h-7 ${successData.type === 'instant' ? 'text-amber-400' : 'text-emerald-400'}`} />
              </div>

              {successData.type === 'instant' ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-widest block">
                      🎉 অভিনন্দন! রিওয়ার্ড সফল
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-white font-mono block">
                      +₹{successData.amountCredited?.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-300 block">
                      টাকা আপনার <span className="font-bold text-amber-300">
                        {successData.targetWallet === 'main' ? 'মেইন ব্যালেন্সে (Withdrawable)' : 'বোনাস ব্যালেন্সে (Bonus)'}
                      </span> সফলভাবে যোগ হয়েছে!
                    </span>
                  </div>

                  <div className="p-3 bg-black/40 rounded-2xl border border-white/10 text-left space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">কোড:</span>
                      <span className="font-black text-white font-mono">{successData.promo.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">অফার:</span>
                      <span className="font-bold text-amber-300">{successData.promo.title}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest block">
                      🎁 ডিপোজিট প্রোমো কোড ভেরিফাইড!
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-white font-mono block">
                      {successData.promo.bonusPercentage ? `+${successData.promo.bonusPercentage}% Extra` : `+₹${successData.promo.flatBonusAmount}`}
                    </span>
                    <p className="text-xs text-slate-300">
                      এই কোডটি ব্যবহার করে ডিপোজিট করলে অতিরিক্ত বোনাস সরাসরি আপনার ওয়ালেটে ক্রেডিট হয়ে যাবে।
                    </p>
                  </div>

                  {successData.promo.minDepositAmount ? (
                    <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">
                      সর্বনিম্ন ডিপোজিট: ₹{successData.promo.minDepositAmount.toLocaleString('en-IN')}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleDepositNow}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <span>ডিপোজিটে কোড ব্যবহার করুন</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              অন্য প্রোমো কোড ক্লেইম করুন
            </button>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>প্রোমো কোড এন্টার করুন (Enter Code)</span>
                <span className="text-[10px] text-amber-400 font-normal">অটো ক্যাপিটাল</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME100, BONUS50"
                  className="w-full bg-slate-950/90 border-2 border-slate-800 focus:border-amber-400 text-white font-mono text-base sm:text-lg font-black tracking-widest rounded-2xl pl-4 pr-24 py-3.5 outline-none transition-all"
                  autoFocus
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                    title="Paste from clipboard"
                  >
                    {pasted ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                    <span>{pasted ? 'পেস্টিং' : 'পেস্ট'}</span>
                  </button>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-start gap-2 text-rose-300 text-xs animate-in shake duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>যাচাই হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
                  <span>রিডিম ও ক্লেইম করুন (REDEEM NOW)</span>
                </>
              )}
            </button>

            {/* Micro FAQ / Perks */}
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>১০০% ফায়ারবেস সিকিউর</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ইনস্ট্যান্ট ওয়ালেট ক্রেডিট</span>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
