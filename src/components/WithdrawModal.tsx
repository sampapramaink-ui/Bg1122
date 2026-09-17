import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Building2, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  Wallet, 
  Crown, 
  Coins, 
  Search, 
  ChevronDown,
  Sparkles,
  Info
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { VIP_TIERS } from '../utils/vip';
import { logAnalyticsEvent } from '../utils/analytics';
import { ALL_INDIAN_BANKS, POPULAR_INDIAN_BANKS, CRYPTO_NETWORKS, CryptoNetworkOption, IndianBank } from '../data/indianBanks';
import { User } from '../types';
import { TransactionPinModal } from './TransactionPinModal';
import { WithdrawalWagerTrackerCard } from './WithdrawalWagerTrackerCard';
import { WithdrawalWagerBlockedModal } from './WithdrawalWagerBlockedModal';
import { calculateUserWagerStatus } from '../utils/wagerEngine';

export type WithdrawalMethod = 'IMPS' | 'CRYPTO';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  user?: User | null;
  userVipLevel?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'VIP Platinum' | 'Diamond';
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

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  user,
  userVipLevel = 'Bronze',
  onSubmitWithdrawal
}) => {
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>('IMPS');
  const [amount, setAmount] = useState<string>('500');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showWagerBlockedModal, setShowWagerBlockedModal] = useState<boolean>(false);
  
  // Mandatory PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pendingWithdrawalPayload, setPendingWithdrawalPayload] = useState<any>(null);

  // IMPS Bank state
  const [fullName, setFullName] = useState<string>('');
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
  const [cryptoRecipientName, setCryptoRecipientName] = useState<string>('');

  const vipTier = VIP_TIERS[userVipLevel] || VIP_TIERS['Bronze'];

  if (!isOpen) return null;

  const filteredBanks = ALL_INDIAN_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
      b.code.toLowerCase().includes(bankSearchTerm.toLowerCase())
  );

  const handleSelectBank = (bank: IndianBank) => {
    soundFx.playClick();
    setSelectedBankName(bank.name);
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
        `উইথড্রোল লিমিট অতিক্রম করেছে! আপনার ${userVipLevel} VIP দৈনিক উইথড্রোল লিমিট ₹${vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}।`
      );
      return;
    }

    if (parsedAmt > userBalance) {
      setErrorMsg(`অপর্যাপ্ত ব্যালেন্স। বর্তমান ওয়ালেট ব্যালেন্স: ₹${userBalance.toLocaleString('en-IN')}`);
      return;
    }

    // Enforce Wagering Requirements (Turnover)
    if (user) {
      const wagerStatus = calculateUserWagerStatus(user);
      if (!wagerStatus.isCompleted) {
        soundFx.playError();
        setShowWagerBlockedModal(true);
        setErrorMsg('উইথড্রয়াল ব্লকড: আপনার মেইন ব্যালেন্স/বোনাস উয়েজার রিকোয়ারমেন্ট এখনো বাকি আছে।');
        return;
      }
    }

    if (selectedMethod === 'IMPS') {
      if (!fullName.trim() || fullName.trim().length < 3) {
        setErrorMsg('অনুগ্রহ করে অ্যাকাউন্ট হোল্ডারের পুরো নাম লিখুন।');
        return;
      }

      const activeBank = selectedBankName === 'Other Bank' ? customBankName.trim() : selectedBankName;
      if (!activeBank) {
        setErrorMsg('অনুগ্রহ করে আপনার ব্যাংক নির্বাচন করুন।');
        return;
      }

      if (!accountNumber.trim() || accountNumber.trim().length < 8) {
        setErrorMsg('অনুগ্রহ করে সঠিক ব্যাংক অ্যাকাউন্ট নাম্বার দিন।');
        return;
      }

      if (confirmAccountNumber && confirmAccountNumber.trim() !== accountNumber.trim()) {
        setErrorMsg('ব্যাংক অ্যাকাউন্ট নাম্বার এবং কনফার্ম অ্যাকাউন্ট নাম্বার মেলেনি।');
        return;
      }

      if (!ifscCode.trim() || ifscCode.trim().length < 6) {
        setErrorMsg('অনুগ্রহ করে ব্যাংকের সঠিক IFSC কোড দিন (যেমন: SBIN0001234)।');
        return;
      }

      const finalUpi = upiId.trim() || `${accountNumber.slice(-4)}@imps`;

      setPendingWithdrawalPayload({
        amount: parsedAmt,
        fullName: fullName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: finalUpi,
        method: 'IMPS',
        bankName: activeBank,
        analyticsPayload: {
          amount: parsedAmt,
          method: 'IMPS',
          fullName: fullName.trim(),
          bankName: activeBank,
          accountNumberEnd: accountNumber.slice(-4)
        }
      });
      soundFx.playClick();
      setIsPinModalOpen(true);

    } else {
      if (!cryptoAddress.trim() || cryptoAddress.trim().length < 15) {
        setErrorMsg(`অনুগ্রহ করে একটি সঠিক ${selectedCrypto.name} ওয়ালেট অ্যাড্রেস দিন।`);
        return;
      }

      const activeName = cryptoRecipientName.trim() || 'Crypto User';
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
        analyticsPayload: {
          amount: parsedAmt,
          method: 'CRYPTO',
          cryptoNetwork: selectedCrypto.name,
          cryptoAddressEnd: cryptoAddress.slice(-4)
        }
      });
      soundFx.playClick();
      setIsPinModalOpen(true);
    }
  };

  const handlePinSuccess = () => {
    if (!pendingWithdrawalPayload) return;

    soundFx.playCoin();
    if (pendingWithdrawalPayload.analyticsPayload) {
      logAnalyticsEvent('withdrawal_submission', pendingWithdrawalPayload.analyticsPayload);
    }

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

  const handleFinish = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto font-mono">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">Request Payout</h2>
              <p className="text-[10px] sm:text-[11px] text-amber-300">IMPS Direct Bank & Crypto Transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Popup */}
        {showSuccess ? (
          <div className="p-6 sm:p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">উইথড্রোল রিকোয়েস্ট সফল!</h3>
            <p className="text-emerald-300 font-medium text-xs leading-relaxed max-w-md bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 mb-5">
              আপনার <strong className="text-white">₹{parseFloat(amount).toLocaleString('en-IN')}</strong> টাকার {selectedMethod === 'IMPS' ? 'IMPS ব্যাংক ট্রান্সফার' : 'ক্রিপ্টো পে-আউট'} রিকোয়েস্ট অ্যাডমিন প্যানেলে পাঠানো হয়েছে।
            </p>

            <button
              onClick={handleFinish}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black rounded-xl shadow-lg transition-all cursor-pointer text-xs"
            >
              সম্পন্ন করুন
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            
            {/* Balance & VIP Header Box */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Available Balance</span>
                <span className="text-base font-black text-amber-300">
                  ₹{userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 text-[10px] font-bold text-amber-300">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{userVipLevel} VIP (Max ₹{vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')})</span>
              </div>
            </div>

            {/* Withdrawal Wagering Progress Tracker */}
            {user && (
              <WithdrawalWagerTrackerCard
                status={calculateUserWagerStatus(user)}
              />
            )}

            {/* TWO OPTIONS SWITCH: IMPS vs CRYPTO */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedMethod('IMPS');
                  setErrorMsg('');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMethod === 'IMPS'
                    ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-white">🇮🇳 IMPS Bank</span>
                  {selectedMethod === 'IMPS' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-400">All Indian Banks</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedMethod('CRYPTO');
                  setErrorMsg('');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMethod === 'CRYPTO'
                    ? 'bg-emerald-500/15 border-emerald-400 shadow-md ring-1 ring-emerald-400/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-white">🪙 Crypto Payout</span>
                  {selectedMethod === 'CRYPTO' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[10px] text-slate-400">USDT, BTC, ETH</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">
                  Withdrawal Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-amber-400 text-base">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="500"
                    min="300"
                    max={userBalance}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-8 pr-4 py-2.5 text-base font-black text-amber-300 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  {['300', '500', '1000', '5000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className="flex-1 py-1 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      +₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(Math.floor(userBalance).toString())}
                    className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* IMPS SPECIFIC FIELDS */}
              {selectedMethod === 'IMPS' ? (
                <div className="space-y-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Account Holder Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none"
                      required
                    />
                  </div>

                  {/* Bank Dropdown */}
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Select Bank <span className="text-rose-400">*</span></span>
                      <span className="text-[10px] text-amber-400">{ALL_INDIAN_BANKS.length}+ Banks</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-bold text-white flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate text-amber-300">{selectedBankName}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isBankDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBankDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-2 space-y-1.5 max-h-52 flex flex-col">
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={bankSearchTerm}
                            onChange={(e) => setBankSearchTerm(e.target.value)}
                            placeholder="Search bank..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-2 py-1 text-xs text-white outline-none"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto max-h-36 space-y-0.5">
                          {filteredBanks.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectBank(b)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                selectedBankName === b.name
                                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                                  : 'hover:bg-slate-800 text-slate-300'
                              }`}
                            >
                              <span>{b.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{b.code}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBankName('Other Bank');
                              setIsBankDropdownOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-amber-400 hover:bg-slate-800 font-bold border-t border-slate-800 mt-1 cursor-pointer"
                          >
                            + Other Indian Bank
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
                        className="w-full mt-2 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">
                        Account Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 10023456789"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">
                        IFSC Code <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SBIN0001234"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 outline-none uppercase"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* CRYPTO SPECIFIC FIELDS */
                <div className="space-y-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Select Crypto Network
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CRYPTO_NETWORKS.slice(0, 4).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCrypto(c)}
                          className={`p-2 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                            selectedCrypto.id === c.id
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="text-xs font-bold">{c.name}</span>
                          {selectedCrypto.id === c.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      {selectedCrypto.name} Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={cryptoAddress}
                      onChange={(e) => setCryptoAddress(e.target.value)}
                      placeholder={selectedCrypto.placeholder}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedMethod === 'IMPS'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>CONFIRM WITHDRAWAL</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </form>
          </div>
        )}
      </div>

      {/* Mandatory PIN Verification Modal */}
      <TransactionPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingWithdrawalPayload(null);
        }}
        user={user || null}
        mode={user?.settings?.transactionPin || user?.transactionPin ? 'verify' : 'setup'}
        withdrawalAmount={pendingWithdrawalPayload?.amount}
        title="উইথড্র সিকিউরিটি পিন ভেরিফিকেশন"
        description="উইথড্রয়াল নিশ্চিত করার জন্য আপনার ৪-সংখ্যার ট্রানজ্যাকশন পিন দিন।"
        onSuccess={handlePinSuccess}
      />

      {/* Withdrawal Wagering Blocked Modal */}
      {user && (
        <WithdrawalWagerBlockedModal
          isOpen={showWagerBlockedModal}
          onClose={() => setShowWagerBlockedModal(false)}
          status={calculateUserWagerStatus(user)}
          requestedAmount={parseFloat(amount) || 0}
        />
      )}
    </div>
  );
};
