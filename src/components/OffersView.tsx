import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Clock, 
  Sparkles, 
  Flame, 
  Zap, 
  Copy, 
  Check, 
  ArrowRight, 
  Crown, 
  Percent, 
  Coins, 
  ShieldCheck, 
  Tag, 
  ChevronRight, 
  ArrowLeft,
  Timer,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { PromotionalOffer } from '../types';
import { soundFx } from '../utils/audio';

interface OffersViewProps {
  offers: PromotionalOffer[];
  onClaimOffer?: (offer: PromotionalOffer) => void;
  onOpenDeposit: () => void;
  onOpenPromoCode?: () => void;
  onOpenCasino: () => void;
  onOpenSuperCar: () => void;
  onOpenLottery: () => void;
  onOpenWheel: () => void;
  onBack?: () => void;
}

export const OffersView: React.FC<OffersViewProps> = ({
  offers,
  onClaimOffer,
  onOpenDeposit,
  onOpenPromoCode,
  onOpenCasino,
  onOpenSuperCar,
  onOpenLottery,
  onOpenWheel,
  onBack
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Real-time ticking clock for precision live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = (code: string) => {
    soundFx.playClick();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleAction = (offer: PromotionalOffer) => {
    soundFx.playClick();
    if (onClaimOffer) {
      onClaimOffer(offer);
    }
    
    switch (offer.actionType) {
      case 'deposit':
        onOpenDeposit();
        break;
      case 'casino':
      case 'dragon_tiger':
      case 'roulette':
      case 'andar_bahar':
      case 'crash':
        onOpenCasino();
        break;
      case 'supercar':
        onOpenSuperCar();
        break;
      case 'lottery':
        onOpenLottery();
        break;
      case 'wheel':
        onOpenWheel();
        break;
      default:
        if (offer.targetUrl) {
          window.open(offer.targetUrl, '_blank');
        } else {
          onOpenDeposit();
        }
    }
  };

  // Helper to calculate countdown time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const target = new Date(expiresAt).getTime();
    const diff = target - now;

    if (isNaN(target) || diff <= 0) {
      return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, text: 'Expired' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');

    let text = `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
    if (days > 0) {
      text = `${days}d ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
    }

    return { expired: false, days, hours, minutes, seconds, text };
  };

  // Filter valid and non-expired offers
  const activeOffers = (offers || []).filter((offer) => {
    if (!offer.active) return false;
    const remaining = getTimeRemaining(offer.expiresAt);
    return !remaining.expired;
  });

  const filteredOffers = activeOffers.filter((offer) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'deposit' && offer.actionType === 'deposit') return true;
    if (selectedFilter === 'casino' && ['casino', 'dragon_tiger', 'roulette', 'andar_bahar', 'crash'].includes(offer.actionType)) return true;
    if (selectedFilter === 'lottery' && ['lottery', 'supercar'].includes(offer.actionType)) return true;
    if (selectedFilter === 'wheel' && offer.actionType === 'wheel') return true;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-5 pb-28 font-sans">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-slate-950 to-slate-900 border border-amber-500/40 p-4 sm:p-6 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onBack();
                }}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0 animate-bounce">
              <Gift className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight flex items-center gap-2">
                  <span>SPECIAL OFFERS & PROMOTIONS</span>
                </h1>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {activeOffers.length} ACTIVE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-300/90 font-medium mt-0.5">
                লিমিটেড টাইম এক্সক্লুসিভ ডিপোজিট বোনাস, ক্যাশব্যাক ও ফ্রি স্পিন অফার
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenPromoCode && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenPromoCode();
                }}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0"
              >
                <Tag className="w-4 h-4" />
                <span>🎟️ প্রোমো কোড রিডিম</span>
              </button>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 px-3.5 py-2 rounded-2xl">
              <Clock className="w-4 h-4 text-amber-400 animate-spin [animation-duration:10s]" />
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 block uppercase">Real-Time Countdown</span>
                <span className="text-xs font-bold text-amber-300">Auto Expire System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-amber-500/20 font-mono text-xs">
          {[
            { id: 'all', label: 'All Offers (সমস্ত অফার)', count: activeOffers.length },
            { id: 'deposit', label: 'Deposit Bonus (ডিপোজিট বোনাস)' },
            { id: 'casino', label: 'Live Casino (ক্যাসিনো ক্যাশব্যাক)' },
            { id: 'lottery', label: 'Lottery & SuperCar (লটারি ড্র)' },
            { id: 'wheel', label: 'Lucky Wheel (লাকি হুইল)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundFx.playClick();
                setSelectedFilter(tab.id);
              }}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer text-[11px] sm:text-xs flex items-center gap-1.5 ${
                selectedFilter === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 shadow-md font-black scale-[1.02]'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                  selectedFilter === tab.id ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Offers Cards Grid */}
      {filteredOffers.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-10 text-center space-y-3 font-mono">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">বর্তমানে কোনো অফার অ্যাক্টিভ নেই</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            অ্যাডমিন প্যানেল থেকে খুব শীঘ্রই নতুন ধামাকা অফার ও লিমিটেড টাইম বোনাস পাবলিশ করা হবে। সাথে থাকুন!
          </p>
          <button
            onClick={onOpenDeposit}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            ওয়ালেট ডিপোজিট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredOffers.map((offer) => {
            const timeRemaining = getTimeRemaining(offer.expiresAt);
            const isCopied = copiedCode === offer.bonusCode;

            return (
              <div
                key={offer.id}
                className="group bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-amber-500/10 transition-all duration-300 flex flex-col justify-between relative font-mono"
              >
                {/* Top Image Banner with Overlays & Countdown Ticker */}
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-950">
                  <img
                    src={offer.imageUrl}
                    alt={offer.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  
                  {/* Subtle Gradient Overlays */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${offer.bgGradient || 'from-slate-950 via-slate-950/40 to-transparent'}`} />

                  {/* Top Badges: Offer Tag & Featured Badge */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                    <div className="flex items-center gap-1.5">
                      {offer.badgeText && (
                        <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg border border-yellow-300 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-3 h-3" />
                          <span>{offer.badgeText}</span>
                        </span>
                      )}
                      {offer.isFeatured && (
                        <span className="bg-rose-600 text-white text-[9px] font-black px-2 py-1 rounded-xl shadow-md uppercase tracking-wider">
                          HOT
                        </span>
                      )}
                    </div>

                    {/* LIVE COUNTDOWN PILL */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-amber-400/60 px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1.5 text-amber-300 text-[11px] font-bold font-mono">
                      <Timer className="w-3.5 h-3.5 text-amber-400 animate-spin [animation-duration:8s]" />
                      <span>{timeRemaining.text}</span>
                    </div>
                  </div>

                  {/* Bottom Image Overlay: Title & Subtitle */}
                  <div className="absolute bottom-3 left-3 right-3 z-10">
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight drop-shadow-md leading-snug">
                      {offer.title}
                    </h2>
                    {offer.subtitle && (
                      <p className="text-[11px] text-amber-300 font-medium drop-shadow truncate mt-0.5">
                        {offer.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Offer Details Body */}
                <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {offer.description}
                  </p>

                  {/* Bonus Specs / Code Box */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80">
                    {offer.bonusCode && (
                      <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Promo Code</span>
                          <span className="text-xs font-black text-amber-300 tracking-wider font-mono">
                            {offer.bonusCode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(offer.bonusCode!)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                          title="Copy Code"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Remaining Time</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          {timeRemaining.text}
                        </span>
                      </div>
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleAction(offer)}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:scale-[1.01]"
                  >
                    <span>{offer.actionButtonText || 'CLAIM OFFER NOW'}</span>
                    <ArrowRight className="w-4 h-4 stroke-[3] group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Terms & Info Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-400 font-mono">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-white block">অফার ও বোনাস সংক্রান্ত সাধারণ নিয়মাবলী:</span>
          <p className="leading-relaxed text-[11px]">
            সমস্ত অফার নির্ধারিত কাউন্টডাউন শেষ হওয়ার সাথে সাথেই অটোমেটিকভাবে নিষ্ক্রিয় হয়ে যাবে। প্রমো কোড ব্যবহারের পূর্বে ডিপোজিট পেজে কোডটি সাবমিট করুন। যেকোনো জিজ্ঞাসায় আমাদের ২৪/৭ লাইভ সাপোর্টে যোগাযোগ করতে পারেন।
          </p>
        </div>
      </div>

    </div>
  );
};
