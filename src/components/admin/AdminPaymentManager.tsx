import React, { useState, useEffect } from 'react';
import { 
  QrCode, Upload, CheckCircle2, AlertCircle, Save, Loader2, RefreshCw, 
  Copy, ShieldCheck, DollarSign, FileText, Download, Coins, Layers, ArrowUpRight 
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { PaymentConfig } from '../../types';
import { soundFx } from '../../utils/audio';
import { downloadQrCode } from '../../utils/depositSecurity';

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  upiId: 'betguru.pay@ybl',
  qrCodeUrl: '',
  accountName: 'BETGURU OFFICIAL ENTERPRISES',
  minDeposit: 100,
  maxDeposit: 100000,
  instructions: '1. Scan QR code or copy UPI ID.\n2. Complete payment in PhonePe, GPay, Paytm or BHIM.\n3. Enter the 12-digit UTR/Reference number.\n4. Upload payment screenshot proof and submit.',
  cryptoEnabled: true,
  minCryptoDeposit: 10,
  maxCryptoDeposit: 10000,
  usdtToInrRate: 92,
  usdtTrc20Address: 'TYDzsYUEpvnYmQk4zGbpA8Z2kQ5z3qfL2b',
  usdtTrc20QrUrl: '',
  usdtBep20Address: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
  usdtBep20QrUrl: '',
  usdtErc20Address: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
  usdtErc20QrUrl: '',
  btcAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  btcQrUrl: '',
  ethAddress: '0x71C8364f3B8543104B2f22bB862719B53A041d8e',
  ethQrUrl: '',
  cryptoInstructions: '1. Select desired Crypto network (e.g. USDT TRC20).\n2. Copy wallet address or scan QR code.\n3. Transfer exact amount from Binance, Bybit, TrustWallet, etc.\n4. Enter Transaction Hash (TXID) & upload proof.',
  updatedAt: new Date().toISOString()
};

export const AdminPaymentManager: React.FC = () => {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [activeTab, setActiveTab] = useState<'fiat' | 'crypto'>('fiat');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to real-time payment config from Firestore
  useEffect(() => {
    const docRef = doc(db, 'payment_config', 'main');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig({ ...DEFAULT_PAYMENT_CONFIG, ...snapshot.data() });
        } else {
          setDoc(docRef, DEFAULT_PAYMENT_CONFIG).catch((err) =>
            console.warn('Error initializing payment config:', err)
          );
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Payment config snapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save payment configuration to Firestore
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const updatedData: PaymentConfig = {
        ...config,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'payment_config', 'main'), updatedData, { merge: true });
      soundFx.playCoin();
      setStatusMessage({
        type: 'success',
        text: 'All Payment Gateway & Crypto Settings saved and synchronized to players in real time!'
      });
    } catch (err: any) {
      console.error('Error saving payment config:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to save payment settings: ${err.message || 'Unknown error'}`
      });
    } finally {
      setSaving(false);
    }
  };

  // Canvas Image Compression Helper for QR Codes
  const compressImage = (file: File, maxWidth = 600, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  // Generic QR Code Image Upload Handler
  const handleQrUpload = async (fieldKey: keyof PaymentConfig, file: File) => {
    setUploadingField(fieldKey as string);
    setStatusMessage(null);

    try {
      const compressedDataUrl = await compressImage(file, 600, 0.8);
      setConfig((prev) => ({ ...prev, [fieldKey]: compressedDataUrl }));

      // Automatically save to Firestore
      await setDoc(
        doc(db, 'payment_config', 'main'),
        {
          [fieldKey]: compressedDataUrl,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      soundFx.playWinFanfare();
      setStatusMessage({
        type: 'success',
        text: `QR Code updated instantly in real time!`
      });
    } catch (err: any) {
      console.error('QR upload failed:', err);
      setStatusMessage({ type: 'error', text: 'Failed to upload QR code image.' });
    } finally {
      setUploadingField(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <span>Loading Real-time Payment Gateway Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-950 rounded-3xl border border-amber-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Payment & Gateway Settings</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full uppercase">
                REALTIME INSTANT SYNC
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure Indian UPI IDs, QR Codes, Minimum/Maximum limits, and Crypto wallet addresses (USDT TRC20/BEP20, BTC, ETH).
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSaveConfig()}
          disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>

      {/* Gateway Tabs: Fiat (UPI) vs Crypto Currency */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => {
            soundFx.playClick();
            setActiveTab('fiat');
          }}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'fiat'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>🇮🇳</span>
          <span>Indian UPI Gateway & Min Deposit</span>
        </button>

        <button
          onClick={() => {
            soundFx.playClick();
            setActiveTab('crypto');
          }}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'crypto'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Crypto Wallets (USDT TRC20, BEP20, BTC, ETH)</span>
        </button>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ======================= TAB 1: FIAT / UPI GATEWAY SETTINGS ======================= */}
      {activeTab === 'fiat' && (
        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2 spans): Fiat Details */}
          <div className="lg:col-span-2 space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>UPI & Fiat Deposit Settings</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* UPI ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Primary UPI ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={config.upiId}
                  onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
                  placeholder="e.g. betguru.pay@ybl"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-500">Visible on player deposit screen with 1-click copy.</p>
              </div>

              {/* Account / Beneficiary Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Account / Beneficiary Name
                </label>
                <input
                  type="text"
                  value={config.accountName}
                  onChange={(e) => setConfig({ ...config, accountName: e.target.value })}
                  placeholder="e.g. BETGURU OFFICIAL ENTERPRISES"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-500">Displayed next to UPI ID for user verification.</p>
              </div>

              {/* Minimum Deposit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Minimum Deposit (₹ INR) <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.minDeposit}
                  onChange={(e) => setConfig({ ...config, minDeposit: Number(e.target.value) || 100 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-emerald-400 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-500">Auto-refreshes player deposit modal in real time.</p>
              </div>

              {/* Maximum Deposit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Maximum Deposit (₹ INR)
                </label>
                <input
                  type="number"
                  min="100"
                  value={config.maxDeposit}
                  onChange={(e) => setConfig({ ...config, maxDeposit: Number(e.target.value) || 100000 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-amber-300 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
              </div>
            </div>

            {/* Deposit Instructions Textarea */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>UPI Deposit Instructions for Players</span>
              </label>
              <textarea
                rows={3}
                value={config.instructions}
                onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                placeholder="Step 1: Copy UPI ID..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-slate-200 font-mono text-xs rounded-xl p-3 outline-none leading-relaxed transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save UPI & Minimum Deposit Settings</span>
              </button>
            </div>
          </div>

          {/* Right Column: UPI QR Code Upload & Preview */}
          <div className="space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              <span>UPI QR Code & Scanner</span>
            </h3>

            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-48 h-48 bg-white p-3 rounded-2xl border-2 border-amber-500/40 shadow-2xl overflow-hidden flex items-center justify-center">
                {config.qrCodeUrl ? (
                  <img src={config.qrCodeUrl} alt="UPI Payment QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-950 p-3 rounded-xl flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                      <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-amber-400 text-center">
                      UPLOAD QR CODE
                    </div>
                    <div className="flex justify-between">
                      <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                      <div className="w-4 h-4 bg-emerald-400"></div>
                    </div>
                  </div>
                )}

                {uploadingField === 'qrCodeUrl' && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-amber-400 font-bold text-xs gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>

              {/* Upload & Download Buttons */}
              <div className="w-full grid grid-cols-2 gap-2">
                <label className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleQrUpload('qrCodeUrl', file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => downloadQrCode(config.qrCodeUrl || '', 'upi-payment-qr.png')}
                  disabled={!config.qrCodeUrl}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>

              {/* Or URL */}
              <div className="w-full space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">
                  Or QR Image URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.qrCodeUrl.startsWith('data:') ? '' : config.qrCodeUrl}
                    placeholder="https://..."
                    onChange={(e) => setConfig({ ...config, qrCodeUrl: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveConfig()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Information Card */}
              <div className="w-full p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between text-slate-300 font-bold">
                  <span>Active UPI ID:</span>
                  <span className="text-amber-400">{config.upiId}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold">
                  <span>Min Deposit:</span>
                  <span className="text-emerald-400">₹{config.minDeposit}</span>
                </div>
              </div>
            </div>
          </div>

        </form>
      )}

      {/* ======================= TAB 2: CRYPTO GATEWAY SETTINGS ======================= */}
      {activeTab === 'crypto' && (
        <div className="space-y-6">
          
          {/* Top Crypto General Settings Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                <span>Crypto General Settings & Conversion Rate</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                <span>Enable Crypto Deposit:</span>
                <input
                  type="checkbox"
                  checked={config.cryptoEnabled !== false}
                  onChange={(e) => setConfig({ ...config, cryptoEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                />
              </label>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {/* USDT to INR Rate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  1 USDT = ₹ INR Exchange Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={config.usdtToInrRate || 92}
                    onChange={(e) => setConfig({ ...config, usdtToInrRate: Number(e.target.value) || 92 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-white font-mono font-bold text-sm rounded-xl pl-8 pr-3 py-2.5 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Auto-converts player crypto amount to wallet INR.</p>
              </div>

              {/* Min Crypto Deposit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Minimum Crypto Deposit (USDT/Equivalent)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.minCryptoDeposit || 10}
                  onChange={(e) => setConfig({ ...config, minCryptoDeposit: Number(e.target.value) || 10 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-emerald-400 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none"
                />
                <p className="text-[10px] text-slate-500">e.g. 10 USDT (≈ ₹{(config.minCryptoDeposit || 10) * (config.usdtToInrRate || 92)})</p>
              </div>

              {/* Max Crypto Deposit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Maximum Crypto Deposit (USDT)
                </label>
                <input
                  type="number"
                  min="10"
                  value={config.maxCryptoDeposit || 10000}
                  onChange={(e) => setConfig({ ...config, maxCryptoDeposit: Number(e.target.value) || 10000 })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-amber-400 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>
            </div>

            {/* Crypto Instructions */}
            <div className="space-y-1.5 pt-4">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Crypto Deposit Guide Instructions for Players</span>
              </label>
              <textarea
                rows={2}
                value={config.cryptoInstructions}
                onChange={(e) => setConfig({ ...config, cryptoInstructions: e.target.value })}
                placeholder="Enter instructions for crypto transfer..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-slate-200 font-mono text-xs rounded-xl p-3 outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Individual Crypto Network Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. USDT (TRC20) */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="font-black text-sm text-emerald-400 flex items-center gap-1.5">
                  <span>USDT (TRC20)</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                    RECOMMENDED
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Tron (TRC20) Wallet Address:
                </label>
                <input
                  type="text"
                  value={config.usdtTrc20Address || ''}
                  onChange={(e) => setConfig({ ...config, usdtTrc20Address: e.target.value })}
                  placeholder="TYDzsYUEpvnYmQk4zGbpA8Z2kQ5z3qfL2b"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                  {config.usdtTrc20QrUrl ? (
                    <img src={config.usdtTrc20QrUrl} alt="TRC20 QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold text-center">No QR Code</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <label className="py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload('usdtTrc20QrUrl', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(config.usdtTrc20QrUrl || '', 'usdt-trc20-qr.png')}
                    disabled={!config.usdtTrc20QrUrl}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. USDT (BEP20) */}
            <div className="bg-slate-900 border border-yellow-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="font-black text-sm text-yellow-400 flex items-center gap-1.5">
                  <span>USDT (BEP20)</span>
                  <span className="text-[9px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.2 rounded font-mono">
                    BNB CHAIN
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  BNB Smart Chain (BEP20) Wallet:
                </label>
                <input
                  type="text"
                  value={config.usdtBep20Address || ''}
                  onChange={(e) => setConfig({ ...config, usdtBep20Address: e.target.value })}
                  placeholder="0x..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-yellow-400 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                  {config.usdtBep20QrUrl ? (
                    <img src={config.usdtBep20QrUrl} alt="BEP20 QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold text-center">No QR Code</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <label className="py-1.5 px-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload('usdtBep20QrUrl', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(config.usdtBep20QrUrl || '', 'usdt-bep20-qr.png')}
                    disabled={!config.usdtBep20QrUrl}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-yellow-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Bitcoin (BTC) */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="font-black text-sm text-amber-400 flex items-center gap-1.5">
                  <span>Bitcoin (BTC)</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                    MAINNET
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Bitcoin (BTC) Wallet Address:
                </label>
                <input
                  type="text"
                  value={config.btcAddress || ''}
                  onChange={(e) => setConfig({ ...config, btcAddress: e.target.value })}
                  placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                  {config.btcQrUrl ? (
                    <img src={config.btcQrUrl} alt="BTC QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold text-center">No QR Code</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <label className="py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload('btcQrUrl', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(config.btcQrUrl || '', 'btc-payment-qr.png')}
                    disabled={!config.btcQrUrl}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Ethereum (ETH) */}
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="font-black text-sm text-indigo-400 flex items-center gap-1.5">
                  <span>Ethereum (ETH)</span>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono">
                    ERC20
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  Ethereum (ETH / ERC20) Address:
                </label>
                <input
                  type="text"
                  value={config.ethAddress || ''}
                  onChange={(e) => setConfig({ ...config, ethAddress: e.target.value })}
                  placeholder="0x..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-400 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                  {config.ethQrUrl ? (
                    <img src={config.ethQrUrl} alt="ETH QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold text-center">No QR Code</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <label className="py-1.5 px-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload('ethQrUrl', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(config.ethQrUrl || '', 'eth-payment-qr.png')}
                    disabled={!config.ethQrUrl}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. USDT (ERC20) */}
            <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="font-black text-sm text-blue-400 flex items-center gap-1.5">
                  <span>USDT (ERC20)</span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                    ETH NETWORK
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase block">
                  USDT (ERC20) Wallet Address:
                </label>
                <input
                  type="text"
                  value={config.usdtErc20Address || ''}
                  onChange={(e) => setConfig({ ...config, usdtErc20Address: e.target.value })}
                  placeholder="0x..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-400 text-xs font-mono text-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                  {config.usdtErc20QrUrl ? (
                    <img src={config.usdtErc20QrUrl} alt="USDT ERC20 QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold text-center">No QR Code</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  <label className="py-1.5 px-2 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrUpload('usdtErc20QrUrl', file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadQrCode(config.usdtErc20QrUrl || '', 'usdt-erc20-qr.png')}
                    disabled={!config.usdtErc20QrUrl}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig()}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save & Publish All Crypto Settings</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
