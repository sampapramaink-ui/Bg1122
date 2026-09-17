import React, { useState, useEffect } from 'react';
import { X, Dices, Trophy, Sparkles, Gift, Lock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { WheelSector, WheelConfig } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface LuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimReward: (rewardAmount: number, targetWallet?: 'bonus' | 'main') => void;
  userSpinCredits?: number;
  userSpinTargetWallet?: 'bonus' | 'main';
  onOpenDeposit?: () => void;
}

const DEFAULT_WHEEL_SECTORS: WheelSector[] = [
  { id: '1', label: '₹50', amount: 50, color: '#D4AF37' },
  { id: '2', label: '₹100', amount: 100, color: '#059669' },
  { id: '3', label: '₹250', amount: 250, color: '#2563EB' },
  { id: '4', label: '₹500', amount: 500, color: '#7C3AED' },
  { id: '5', label: '₹1,000', amount: 1000, color: '#DB2777' },
  { id: '6', label: '₹2,500', amount: 2500, color: '#EA580C' },
  { id: '7', label: '₹100', amount: 100, color: '#059669' },
  { id: '8', label: '₹5,000', amount: 5000, color: '#EAB308' }
];

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({
  isOpen,
  onClose,
  onClaimReward,
  userSpinCredits = 0,
  userSpinTargetWallet,
  onOpenDeposit
}) => {
  const [sectors, setSectors] = useState<WheelSector[]>(DEFAULT_WHEEL_SECTORS);
  const [minDepositReq, setMinDepositReq] = useState<number>(1000);
  const [globalDefaultTargetWallet, setGlobalDefaultTargetWallet] = useState<'bonus' | 'main'>('bonus');
  const [spinning, setSpinning] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [wonReward, setWonReward] = useState<number | null>(null);

  // Real-time listener for Firestore Wheel Configuration
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, 'wheel_config', 'default'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as WheelConfig;
        if (data.sectors && data.sectors.length > 0) {
          setSectors(data.sectors);
        }
        if (typeof data.minDepositAmount === 'number') {
          setMinDepositReq(data.minDepositAmount);
        }
        if (data.defaultTargetWallet === 'main' || data.defaultTargetWallet === 'bonus') {
          setGlobalDefaultTargetWallet(data.defaultTargetWallet);
        }
      }
    }, (err) => console.warn('Wheel listener err:', err));

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const canSpin = userSpinCredits > 0;
  const finalTargetWallet: 'bonus' | 'main' = userSpinTargetWallet || globalDefaultTargetWallet || 'bonus';

  const handleSpin = () => {
    if (spinning || !canSpin) return;

    logAnalyticsEvent('game_start', { gameType: 'lucky_wheel' });
    soundFx.playClick();
    setSpinning(true);
    setWonReward(null);

    // Random sector index from live config
    const winningIdx = Math.floor(Math.random() * sectors.length);
    const reward = sectors[winningIdx].amount;

    // Calculate degrees
    const sectorDeg = 360 / sectors.length;
    const extraDegrees = 360 * 5 + (360 - winningIdx * sectorDeg - sectorDeg / 2);
    const newRotation = rotation + extraDegrees;

    setRotation(newRotation);

    const tickInterval = setInterval(() => {
      soundFx.playSpinTick();
    }, 150);

    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setWonReward(reward);
      soundFx.playWinFanfare();
      onClaimReward(reward, finalTargetWallet);
    }, 4500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Dices className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-mono flex items-center gap-1.5">
                <span>VIP Lucky Spin Wheel</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-amber-400/80">Deposit ₹{minDepositReq.toLocaleString('en-IN')}+ to Earn Spin Credits!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-5 flex flex-col items-center">
          
          {/* Spin Credits Counter Badge & Target Wallet Info */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className={`px-4 py-1.5 rounded-full text-xs font-mono font-black border flex items-center gap-2 ${
              canSpin
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {canSpin ? <Sparkles className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400/70" />}
              <span>Available Spin Credits: <strong className="text-amber-400 text-sm font-bold">{userSpinCredits}</strong></span>
            </div>

            <div className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800/80 border border-slate-700 text-slate-300 flex items-center gap-1.5">
              <span>Payout Target:</span>
              <span className={finalTargetWallet === 'main' ? 'text-emerald-400 font-black' : 'text-purple-400 font-black'}>
                {finalTargetWallet === 'main' ? '💵 Main Wallet' : '🎁 Bonus Wallet'}
              </span>
            </div>
          </div>

          {/* Wheel Graphic Container */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            
            {/* Pointer / Needle */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-amber-400 drop-shadow-[0_4px_8px_rgba(245,158,11,0.8)]"></div>

            {/* Rotating SVG Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-transform ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? '4.5s' : '0s'
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full rounded-full overflow-hidden">
                {sectors.map((sector, i) => {
                  const angle = 360 / sectors.length;
                  const startAngle = i * angle;
                  const endAngle = (i + 1) * angle;

                  const x1 = 50 + 50 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                  const y1 = 50 + 50 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                  const x2 = 50 + 50 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                  const y2 = 50 + 50 * Math.sin((Math.PI * (endAngle - 90)) / 180);

                  const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                  return (
                    <g key={sector.id || i}>
                      <path d={pathData} fill={sector.color} opacity="0.9" stroke="#0f172a" strokeWidth="0.5" />
                      <text
                        x="50"
                        y="18"
                        fill="#ffffff"
                        fontSize="6"
                        fontWeight="900"
                        textAnchor="middle"
                        transform={`rotate(${startAngle + angle / 2}, 50, 50)`}
                      >
                        {sector.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center Cap Button */}
            <div className="absolute w-14 h-14 rounded-full bg-slate-950 border-2 border-amber-400 shadow-xl flex items-center justify-center z-10">
              <Gift className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>

          </div>

          {/* Reward Banner if Won */}
          {wonReward !== null && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl animate-bounce">
              <h4 className="text-base font-black text-white font-mono flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                CONGRATS! YOU WON ₹{wonReward}!
              </h4>
              <p className="text-[10px] text-emerald-300">
                {finalTargetWallet === 'main'
                  ? 'Added to your Main Wallet (Real Cash Balance) instantly.'
                  : 'Added to your Bonus Wallet balance instantly.'}
              </p>
            </div>
          )}

          {/* Condition Notice when Locked */}
          {!canSpin && wonReward === null && (
            <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl text-left space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Spin Credit Required to Unlock</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • Deposit <strong>₹{minDepositReq.toLocaleString('en-IN')} or more</strong> to unlock <strong>1 Spin Credit</strong> per ₹1,000!
                <br />
                • Each qualifying deposit gives you 1 attempt to spin.
                <br />
                • Or receive bonus spins directly from the Admin.
              </p>
            </div>
          )}

          {/* Spin Trigger Button OR Unlock Deposit Button */}
          {canSpin ? (
            <button
              onClick={handleSpin}
              disabled={spinning}
              className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer font-mono"
            >
              <Sparkles className="w-4 h-4" />
              <span>{spinning ? 'SPINNING THE WHEEL...' : 'SPIN NOW (1 CREDIT)'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                if (onOpenDeposit) onOpenDeposit();
              }}
              className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer font-mono"
            >
              <span>DEPOSIT ₹{minDepositReq.toLocaleString('en-IN')}+ TO UNLOCK SPIN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </div>
  );
};
