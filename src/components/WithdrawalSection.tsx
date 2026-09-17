import React, { useState } from 'react';
import { 
  Building2, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Crown, 
  Search, 
  ChevronDown, 
  Wallet, 
  ArrowLeft, 
  Info, 
  Copy, 
  Check, 
  Zap,
  Sparkles,
  Lock,
  Key,
  Clock
} from 'lucide-react';
import { User, LotteryDraw, WithdrawalRequest } from '../types';
import { VIP_TIERS } from '../utils/vip';
import { soundFx } from '../utils/audio';
import { ALL_INDIAN_BANKS, POPULAR_INDIAN_BANKS, CRYPTO_NETWORKS, CryptoNetworkOption, IndianBank } from '../data/indianBanks';
import { TransactionPinModal } from './TransactionPinModal';
import { WithdrawalWagerTrackerCard } from './WithdrawalWagerTrackerCard';
import { WithdrawalWagerBlockedModal } from './WithdrawalWagerBlockedModal';
import { calculateUserWagerStatus } from '../utils/wagerEngine';

export type WithdrawalMethod = 'IMPS' | 'CRYPTO';

interface WithdrawalSectionProps {
  user: User;
  draws?: LotteryDraw[];
  withdrawals?: WithdrawalRequest[];
  onBack?: () => void;
  onSubmitWithdrawal: (
    amount: number,
    fullName: string,
    accountNumber: string,
    ifscCode: string,
    upiId: string,
    method?: string,
    bankName?: string,
    cryptoNetwork?: string,
    cryptoAddress?: string
  ) => void;
}

export const WithdrawalSection: React.FC<WithdrawalSectionProps> = ({
  user,
  withdrawals = [],
  onBack,
  onSubmitWithdrawal
}) => {
  // Navigation Mode: New Withdrawal vs Withdrawal Status Tracker
  const [activeTab, setActiveTab] = useState<'new' | 'status'>('new');

  // Method selection: IMPS Transfer vs Crypto Transfer
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>('IMPS');
  
  // Common state
  const [amount, setAmount] = useState<string>('500');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showWagerBlockedModal, setShowWagerBlockedModal] = useState<boolean>(false);
  const [lastSubmittedData, setLastSubmittedData] = useState<any>(null);

  // Mandatory PIN state
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pendingWithdrawalPayload, setPendingWithdrawalPayload] = useState<any>(null);

  // IMPS Bank state
  const [fullName, setFullName] = useState<string>(user?.name || '');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('');
  const [selectedBankName, setSelectedBankName] = useState<string>('State Bank of India (SBI)');
  const [customBankName, setCustomBankName] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('SBIN');
  const [upiId, setUpiId] = useState<string>('');
  const [bankSearchTerm, setBankSearchTerm] = useState<string>('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState<boolean>(false);

  // Crypto state
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoNetworkOption>(CRYPTO_NETWORKS[0]);
  const [cryptoAddress, setCryptoAddress] = useState<string>('');
  const [cryptoRecipientName, setCryptoRecipientName] = useState<string>(user?.name || '');

  const vipTier = VIP_TIERS[user.vipLevel || 'Bronze'] || VIP_TIERS['Bronze'];

  // Filter Indian banks based on search
  const filteredBanks = ALL_INDIAN_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(bankSearchTerm.toLowerCase())
  );

  const handleSelectBank = (bank: IndianBank) => {
    soundFx.playClick();
    setSelectedBankName(bank.name);
    // Autofill IFSC prefix if IFSC is empty or matches previous default
    if (!ifscCode || ifscCode.length <= 4) {
      setIfscCode(bank.code);
    }
    setIsBankDropdownOpen(false);
    setBankSearchTerm('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt < 300) {
      setErrorMsg('নূন্যতম উইথড্রোল অ্যামাউন্ট ₹300 (Minimum withdrawal is ₹300).');
      return;
    }

    if (parsedAmt > vipTier.dailyWithdrawalLimit) {
      setErrorMsg(
        `উইথড্রোল লিমিট অতিক্রম করেছে! আপনার ${user.vipLevel || 'Bronze'} VIP দৈনিক উইথড্রোল লিমিট ₹${vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}।`
      );
      return;
    }

    if (parsedAmt > user.balance) {
      setErrorMsg(`অপর্যাপ্ত ওয়ালেট ব্যালেন্স। আপনার বর্তমান ব্যালেন্স: ₹${user.balance.toLocaleString('en-IN')}`);
      return;
    }

    // Enforce Wagering Requirements (Turnover)
    if (user) {
      const wagerStatus = calculateUserWagerStatus(user);
      if (!wagerStatus.isCompleted) {
        soundFx.playError();
        setShowWagerBlockedModal(true);
        setErrorMsg('উইথড্রয়াল ব্লকড: আপনার মেইন ব্যালেন্স/বোনাস উয়েজার রিকোয়ারমেন্ট এখনো পূরণ হয়নি।');
        return;
      }
    }

    if (selectedMethod === 'IMPS') {
      if (!fullName.trim() || fullName.trim().length < 3) {
        setErrorMsg('অনুগ্রহ করে সঠিক ব্যাংক অ্যাকাউন্ট হোল্ডারের পুরো নাম লিখুন।');
        return;
      }

      const activeBank = selectedBankName === 'Other Bank' ? customBankName.trim() : selectedBankName;
      if (!activeBank) {
        setErrorMsg('অনুগ্রহ করে আপনার ব্যাংক সিলেক্ট করুন।');
        return;
      }

      if (!accountNumber.trim() || accountNumber.trim().length < 8) {
        setErrorMsg('অনুগ্রহ করে সঠিক ব্যাংক অ্যাকাউন্ট নাম্বার দিন (কমপক্ষে ৮ সংখ্যা)।');
        return;
      }

      if (confirmAccountNumber && confirmAccountNumber.trim() !== accountNumber.trim()) {
        setErrorMsg('ব্যাংক অ্যাকাউন্ট নাম্বার এবং কনফার্ম অ্যাকাউন্ট নাম্বার মেলেনি।');
        return;
      }

      if (!ifscCode.trim() || ifscCode.trim().length < 6) {
        setErrorMsg('অনুগ্রহ করে সঠিক ব্যাংকের IFSC কোড দিন (যেমন: SBIN0001234)।');
        return;
      }

      const finalUpi = upiId.trim() || `${accountNumber.slice(-4)}@imps`;
      const record = {
        method: 'IMPS',
        amount: parsedAmt,
        fullName: fullName.trim(),
        bankName: activeBank,
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: finalUpi,
        date: new Date().toLocaleString('en-IN')
      };

      setPendingWithdrawalPayload({
        amount: parsedAmt,
        fullName: fullName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: finalUpi,
        method: 'IMPS',
        bankName: activeBank,
        record
      });
      soundFx.playClick();
      setIsPinModalOpen(true);

    } else {
      // Crypto Transfer Validation
      if (!cryptoAddress.trim() || cryptoAddress.trim().length < 15) {
        setErrorMsg(`অনুগ্রহ করে একটি সঠিক ${selectedCrypto.name} ওয়ালেট অ্যাড্রেস দিন।`);
        return;
      }

      const activeName = cryptoRecipientName.trim() || user?.name || 'Crypto Wallet User';
      const record = {
        method: 'CRYPTO',
        amount: parsedAmt,
        cryptoAmount: Number((parsedAmt / selectedCrypto.rateInr).toFixed(4)),
        cryptoNetwork: selectedCrypto.name,
        cryptoAddress: cryptoAddress.trim(),
        fullName: activeName,
        accountNumber: cryptoAddress.trim().slice(0, 10) + '...' + cryptoAddress.trim().slice(-6),
        ifscCode: selectedCrypto.symbol,
        upiId: `crypto:${selectedCrypto.symbol.toLowerCase()}`,
        date: new Date().toLocaleString('en-IN')
      };

      setPendingWithdrawalPayload({
        amount: parsedAmt,
        fullName: activeName,
        accountNumber: cryptoAddress.trim(),
        ifscCode: selectedCrypto.symbol,
        upiId: `crypto:${selectedCrypto.symbol.toLowerCase()}`,
        method: 'CRYPTO',
        bankName: selectedCrypto.name,
        cryptoNetwork: selectedCrypto.name,
        cryptoAddress: cryptoAddress.trim(),
        record
      });
      soundFx.playClick();
      setIsPinModalOpen(true);
    }
  };

  const handlePinSuccess = () => {
    if (!pendingWithdrawalPayload) return;

    soundFx.playCoin();
    setLastSubmittedData(pendingWithdrawalPayload.record);
    onSubmitWithdrawal(
      pendingWithdrawalPayload.amount,
      pendingWithdrawalPayload.fullName,
      pendingWithdrawalPayload.accountNumber,
      pendingWithdrawalPayload.ifscCode,
      pendingWithdrawalPayload.upiId,
      pendingWithdrawalPayload.method,
      pendingWithdrawalPayload.bankName,
      pendingWithdrawalPayload.cryptoNetwork,
      pendingWithdrawalPayload.cryptoAddress
    );
    setShowSuccess(true);
    setPendingWithdrawalPayload(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5 pb-28 font-sans">
      
      {/* Header with Balance & Back button */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-amber-950/40 border border-amber-500/30 p-4 sm:p-5 rounded-3xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={() => {
                soundFx.playClick();
                onBack();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
              title="Back to Profile"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white font-mono tracking-tight flex items-center gap-2">
              <span>WITHDRAWAL</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                INSTANT
              </span>
            </h1>
            <p className="text-[11px] text-amber-300/90 font-mono">
              IMPS Direct Bank Transfer & Crypto Payout
            </p>
          </div>
        </div>

        <div className="text-right bg-slate-950/80 px-3.5 py-2 rounded-2xl border border-amber-500/20">
          <span className="text-[10px] text-slate-400 block uppercase font-mono">Available Wallet</span>
          <span className="text-sm sm:text-base font-black text-amber-300 font-mono">
            ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Top Section Tabs: New Withdrawal Request vs Withdrawal Status Tracker */}
      <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-amber-500/20 gap-1.5">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTab('new');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'new'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>New Withdrawal (উইথড্র রিকোয়েস্ট)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setActiveTab('status');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'status'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Withdrawal Status ({withdrawals.length})</span>
          {withdrawals.some(w => w.status === 'pending') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          )}
        </button>
      </div>

      {activeTab === 'status' ? (
        /* ===================== WITHDRAWAL STATUS TRACKER VIEW ===================== */
        <div className="space-y-4 font-mono animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>My Withdrawal History & Live Status</span>
            </h3>
            <span className="text-xs text-slate-400">Total: {withdrawals.length}</span>
          </div>

          {withdrawals.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm text-slate-300 font-bold">এখনো কোনো উইথড্র রিকোয়েস্ট করা হয়নি</p>
              <p className="text-xs text-slate-500">আপনার সমস্ত উইথড্রয়ালের লাইভ স্ট্যাটাস এখানে ট্র্যাক করতে পারবেন।</p>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab('new');
                }}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
              >
                নতুন উইথড্র রিকোয়েস্ট করুন
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const isPending = w.status === 'pending';
                const isApproved = w.status === 'approved';
                const isRejected = w.status === 'rejected';

                return (
                  <div
                    key={w.id}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                      isApproved
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                        : isRejected
                        ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <div className="text-lg font-black text-white font-mono flex items-center gap-2">
                          <span>₹{w.amount?.toLocaleString('en-IN')}</span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                            {w.method === 'CRYPTO' ? 'Crypto Payout' : 'IMPS Bank'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {w.bankName || (w.method === 'CRYPTO' ? w.cryptoNetwork : 'Bank Transfer')}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isRejected
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isApproved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {isRejected && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                        {isPending && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                        {isApproved ? 'Approved & Paid' : isRejected ? 'Rejected' : 'Pending Verification'}
                      </span>
                    </div>

                    {/* Details row */}
                    <div className="text-xs bg-black/40 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-slate-300">
                      {w.method === 'CRYPTO' ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Network:</span>
                            <span className="font-bold text-white">{w.cryptoNetwork || 'USDT TRC20'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Address:</span>
                            <span className="font-bold text-emerald-400 truncate max-w-[200px]">{w.cryptoAddress || 'N/A'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account Holder:</span>
                            <span className="font-bold text-white">{w.fullName || user.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account / IFSC:</span>
                            <span className="font-bold text-amber-400">
                              {w.accountNumber ? `••••${w.accountNumber.slice(-4)}` : 'N/A'} / {w.ifscCode || 'N/A'}
                            </span>
                          </div>
                        </>
                      )}

                      {w.date && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Requested Date:</span>
                          <span className="text-slate-300">{w.date}</span>
                        </div>
                      )}

                      {w.rejectReason && (
                        <div className="flex justify-between text-rose-400 pt-1 border-t border-rose-500/20">
                          <span>Rejection Reason:</span>
                          <span className="font-bold">{w.rejectReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* TWO EXCLUSIVE PAYMENT OPTIONS: IMPS vs CRYPTO */}
      <div className="grid grid-cols-2 gap-3">
        {/* Option 1: IMPS Bank Transfer */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedMethod('IMPS');
            setErrorMsg('');
            setShowSuccess(false);
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
            selectedMethod === 'IMPS'
              ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 border-amber-400 shadow-xl shadow-amber-500/15 ring-2 ring-amber-500/50 scale-[1.02]'
              : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              selectedMethod === 'IMPS' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-amber-400'
            }`}>
              <Building2 className="w-5 h-5" />
            </div>
            {selectedMethod === 'IMPS' && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                <span>SELECTED</span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white font-mono tracking-tight flex items-center gap-1.5">
              <span>🇮🇳 IMPS Transfer</span>
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
              All Indian Banks (SBI, HDFC, ICICI, PNB & 30+ Banks)
            </p>
          </div>
        </button>

        {/* Option 2: Crypto Transfer */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setSelectedMethod('CRYPTO');
            setErrorMsg('');
            setShowSuccess(false);
          }}
          className={`p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
            selectedMethod === 'CRYPTO'
              ? 'bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 border-emerald-400 shadow-xl shadow-emerald-500/15 ring-2 ring-emerald-500/50 scale-[1.02]'
              : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              selectedMethod === 'CRYPTO' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-800 text-emerald-400'
            }`}>
              <Coins className="w-5 h-5" />
            </div>
            {selectedMethod === 'CRYPTO' && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>SELECTED</span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white font-mono tracking-tight flex items-center gap-1.5">
              <span>🪙 Crypto Transfer</span>
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
              USDT TRC20 / BEP20, Bitcoin (BTC), Ethereum (ETH)
            </p>
          </div>
        </button>
      </div>

      {/* MAIN FORM CONTAINER */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        
        {showSuccess && lastSubmittedData ? (
          <div className="p-6 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white font-mono mb-1">
              উইথড্রোল সফলভাবে জমা দেওয়া হয়েছে!
            </h3>
            <p className="text-emerald-300 font-medium text-xs leading-relaxed max-w-md bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 mb-4">
              আপনার <strong className="text-white">₹{lastSubmittedData.amount.toLocaleString('en-IN')}</strong> টাকার {lastSubmittedData.method === 'IMPS' ? 'IMPS ব্যাংক ট্রান্সফার' : 'ক্রিপ্টো পে-আউট'} রিকোয়েস্ট অ্যাডমিন প্যানেলে ভেরিফিকেশনের জন্য পাঠানো হয়েছে।
            </p>

            <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2.5 font-mono text-slate-300 mb-5 shadow-inner">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">উইথড্রোল মেথড:</span>
                <span className="font-bold text-amber-400">
                  {lastSubmittedData.method === 'IMPS' ? '🇮🇳 IMPS Direct Bank Payout' : '🪙 Crypto Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">উইথড্রোল অ্যামাউন্ট:</span>
                <span className="font-black text-white text-sm">₹{lastSubmittedData.amount.toLocaleString('en-IN')}</span>
              </div>

              {lastSubmittedData.method === 'IMPS' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">অ্যাকাউন্ট হোল্ডার:</span>
                    <span className="font-bold text-white">{lastSubmittedData.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ব্যাংক নাম:</span>
                    <span className="font-bold text-amber-300">{lastSubmittedData.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ব্যাংক অ্যাকাউন্ট:</span>
                    <span className="font-bold text-white">•••• {lastSubmittedData.accountNumber.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IFSC কোড:</span>
                    <span className="font-bold text-cyan-300 uppercase">{lastSubmittedData.ifscCode}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ক্রিপ্টো কারেন্সি / নেটওয়ার্ক:</span>
                    <span className="font-bold text-emerald-400">{lastSubmittedData.cryptoNetwork}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">আনুমানিক ক্রিপ্টো:</span>
                    <span className="font-bold text-emerald-300">~{lastSubmittedData.cryptoAmount} USDT</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 shrink-0">ওয়ালেট অ্যাড্রেস:</span>
                    <span className="font-bold text-cyan-300 text-[11px] truncate max-w-[200px]">{lastSubmittedData.cryptoAddress}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between border-t border-slate-800/80 pt-1.5 text-[11px]">
                <span className="text-slate-400">স্ট্যাটাস:</span>
                <span className="text-amber-400 font-black">PENDING VERIFICATION</span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setShowSuccess(false);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl shadow-lg transition-all cursor-pointer text-xs font-mono"
              >
                আরেকটি রিকোয়েস্ট দিন
              </button>
              {onBack && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onBack();
                  }}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all cursor-pointer text-xs font-mono"
                >
                  প্রোফাইলে ফিরুন
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-mono">
            
            {/* Withdrawal Wagering Progress Tracker */}
            <WithdrawalWagerTrackerCard
              status={calculateUserWagerStatus(user)}
            />

            {/* VIP Tier Info & Limits */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  পদ্ধতি: <strong className={selectedMethod === 'IMPS' ? 'text-amber-300' : 'text-emerald-300'}>
                    {selectedMethod === 'IMPS' ? 'IMPS Direct Bank Transfer' : 'Crypto Payout'}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 text-[10px] font-bold text-amber-300">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>{user.vipLevel || 'Bronze'} VIP (Max: ₹{vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')})</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* AMOUNT INPUT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Withdrawal Amount (উইথড্রোল অ্যামাউন্ট ₹)</span>
                </label>
                <span className="text-[10px] text-slate-400">নূন্যতম: ₹300</span>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-amber-400 text-lg">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  min="300"
                  max={user.balance}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl pl-8 pr-4 py-3 text-base sm:text-lg font-black text-amber-300 outline-none transition-all"
                />
              </div>

              {/* Quick Amount Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                {['300', '500', '1000', '2000', '5000', '10000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setAmount(amt);
                    }}
                    className={`flex-1 min-w-[50px] py-1.5 px-2 bg-slate-950 border rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      amount === amt
                        ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                        : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    ₹{Number(amt).toLocaleString('en-IN')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setAmount(Math.floor(user.balance).toString());
                  }}
                  className="py-1.5 px-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-[11px] font-black hover:bg-amber-500/30 transition-all cursor-pointer"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* CONDITIONAL FORM: IMPS vs CRYPTO */}
            {selectedMethod === 'IMPS' ? (
              <div className="space-y-3.5 pt-2 border-t border-slate-800">
                
                {/* 1. Account Holder Name */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    Account Holder Name (অ্যাকাউন্ট হোল্ডারের নাম) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="যেমন: Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white outline-none"
                    required
                  />
                </div>

                {/* 2. Indian Bank Selector (Searchable & Scrollable list) */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Select Bank (ইন্ডিয়ান ব্যাংক নির্বাচন করুন)</span> <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-amber-400">{ALL_INDIAN_BANKS.length}+ Banks</span>
                  </div>

                  {/* Selected Bank Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500/50 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white flex items-center justify-between cursor-pointer transition-all"
                  >
                    <span className="truncate text-amber-300 font-bold">{selectedBankName}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isBankDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Popular Bank Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {POPULAR_INDIAN_BANKS.slice(0, 5).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBank(b)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                          selectedBankName === b.name
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {b.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  {/* Dropdown Menu (Searchable & Scrollable) */}
                  {isBankDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-2.5 space-y-2 max-h-64 flex flex-col animate-in fade-in zoom-in-95">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bankSearchTerm}
                          onChange={(e) => setBankSearchTerm(e.target.value)}
                          placeholder="Search any Indian bank (SBI, HDFC, PNB...)"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                          autoFocus
                        />
                      </div>

                      {/* Scrollable list */}
                      <div className="overflow-y-auto max-h-48 space-y-1 pr-1">
                        {filteredBanks.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelectBank(b)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              selectedBankName === b.name
                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <span>{b.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{b.code}</span>
                          </button>
                        ))}
                        
                        {/* Custom / Other Bank Option */}
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedBankName('Other Bank');
                            setIsBankDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs text-amber-400 hover:bg-slate-800 font-bold border-t border-slate-800 mt-1 cursor-pointer"
                        >
                          + Other Indian Bank (অন্যান্য ব্যাংক)
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedBankName === 'Other Bank' && (
                    <input
                      type="text"
                      value={customBankName}
                      onChange={(e) => setCustomBankName(e.target.value)}
                      placeholder="Enter your Bank Name"
                      className="w-full mt-2 bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    />
                  )}
                </div>

                {/* 3. Account Number & Confirm Account Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Bank Account Number (অ্যাকাউন্ট নাম্বার) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 10023456789"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-white outline-none tracking-wider"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Confirm Account Number (কনফার্ম নাম্বার)
                    </label>
                    <input
                      type="text"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="Re-enter Account Number"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-white outline-none tracking-wider"
                    />
                  </div>
                </div>

                {/* 4. IFSC Code & UPI ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Bank IFSC Code (আইএফএসসি কোড) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-300 outline-none uppercase tracking-wider"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      UPI ID (ঐচ্ছিক / Optional UPI)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. rahul@oksbi"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-white outline-none"
                    />
                  </div>
                </div>

              </div>
            ) : (
              /* CRYPTO FORM */
              <div className="space-y-3.5 pt-2 border-t border-slate-800">
                
                {/* 1. Crypto Network Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Select Crypto Currency & Network (ক্রিপ্টো নেটওয়ার্ক)</span>
                    <span className="text-[10px] text-emerald-400">Instant Global Payout</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CRYPTO_NETWORKS.map((c) => {
                      const isSel = selectedCrypto.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedCrypto(c);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-emerald-500/20 border-emerald-400 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/50'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center font-black text-sm">
                              {c.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-white">{c.name}</span>
                                {c.tag && (
                                  <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black px-1.5 py-0.2 rounded font-mono">
                                    {c.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">{c.network}</p>
                            </div>
                          </div>
                          {isSel && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Estimated Crypto Value Box */}
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Estimated Payout:</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-300 font-mono">
                      ~{(parseFloat(amount || '0') / selectedCrypto.rateInr).toFixed(selectedCrypto.symbol === 'USDT' ? 2 : 5)} {selectedCrypto.symbol}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">Rate: 1 {selectedCrypto.symbol} ≈ ₹{selectedCrypto.rateInr.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 2. Crypto Wallet Address */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{selectedCrypto.name} Wallet Address (ওয়ালেট অ্যাড্রেস)</span> <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={cryptoAddress}
                    onChange={(e) => setCryptoAddress(e.target.value)}
                    placeholder={selectedCrypto.placeholder}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-white outline-none tracking-wider"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>অনুগ্রহ করে সঠিক {selectedCrypto.symbol} নেটওয়ার্ক অ্যাড্রেস প্রদান করুন। ভুল অ্যাড্রেস দিলে ফান্ড ফেরতযোগ্য নয়।</span>
                  </p>
                </div>

                {/* 3. Recipient Name / Remark (Optional) */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    Recipient Name / Remark (ঐচ্ছিক নাম)
                  </label>
                  <input
                    type="text"
                    value={cryptoRecipientName}
                    onChange={(e) => setCryptoRecipientName(e.target.value)}
                    placeholder="e.g. My Binance / TrustWallet USDT"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white outline-none"
                  />
                </div>

              </div>
            )}

            {/* CONFIRM WITHDRAWAL CTA */}
            <div className="pt-3">
              <button
                type="submit"
                className={`w-full py-4 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedMethod === 'IMPS'
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/25'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
                }`}
              >
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {selectedMethod === 'IMPS' 
                    ? `CONFIRM IMPS PAYOUT (₹${parseFloat(amount || '0').toLocaleString('en-IN')})` 
                    : `CONFIRM CRYPTO PAYOUT (₹${parseFloat(amount || '0').toLocaleString('en-IN')})`}
                </span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

          </form>
        )}
      </div>
      </>
      )}

      {/* Mandatory Transaction PIN Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingWithdrawalPayload(null);
        }}
        user={user}
        mode={user?.settings?.transactionPin || user?.transactionPin ? 'verify' : 'setup'}
        withdrawalAmount={pendingWithdrawalPayload?.amount}
        title="উইথড্র সিকিউরিটি পিন ভেরিফিকেশন"
        description="উইথড্রয়াল রিকোয়েস্ট নিশ্চিত করতে আপনার ৪-সংখ্যার ট্রানজ্যাকশন পিন দিন।"
        onSuccess={handlePinSuccess}
      />

      {/* Withdrawal Wagering Blocked Modal */}
      <WithdrawalWagerBlockedModal
        isOpen={showWagerBlockedModal}
        onClose={() => setShowWagerBlockedModal(false)}
        status={calculateUserWagerStatus(user)}
        requestedAmount={parseFloat(amount) || 0}
      />

    </div>
  );
};
