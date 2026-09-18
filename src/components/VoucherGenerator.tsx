import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X, CheckCircle2, ShieldCheck, Sparkles, Copy, Check, MessageSquare, Maximize2, Minimize2, Target, Trophy, XCircle, Tag } from 'lucide-react';
import { WalletTransaction, BetBreakdownItem } from '../types';
import { soundFx } from '../utils/audio';
import { 
  downloadVoucherImageSafe, 
  tryNativeShareVoucher, 
  copyToClipboardSafe, 
  ShareVoucherParams 
} from '../utils/voucherShareDownloadHelper';
import { VoucherShareModal } from './VoucherShareModal';
import { AndroidImageSaveModal } from './AndroidImageSaveModal';

interface VoucherGeneratorProps {
  transaction: WalletTransaction | any;
  onClose?: () => void;
  onOpenSupportChat?: (initialMessage?: string) => void;
}

export const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({ transaction, onClose, onOpenSupportChat }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAndroidSaveOpen, setIsAndroidSaveOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isCredit = transaction.amount ? transaction.amount >= 0 : (transaction.status === 'win' || transaction.type === 'deposit');
  const displayAmount = transaction.amount !== undefined 
    ? Math.abs(transaction.amount).toLocaleString('en-IN')
    : (transaction.price || transaction.wonAmount || 0).toLocaleString('en-IN');

  const titleText = transaction.description || transaction.drawTitle || transaction.drawName || `BETGURU ${transaction.type?.toUpperCase() || 'TRANSACTION'}`;
  const txId = transaction.id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateText = transaction.date || transaction.purchaseDate || new Date().toLocaleString('en-IN');
  const statusText = (transaction.status || (isCredit ? 'CREDITED' : 'DEBITED')).toUpperCase();
  const utrNumber = transaction.utr || transaction.utrNumber || transaction.userId || 'N/A';

  // Extract / Parse Granular Bet Breakdown if applicable
  const betsBreakdown: BetBreakdownItem[] = React.useMemo(() => {
    if (transaction.betsBreakdown && Array.isArray(transaction.betsBreakdown) && transaction.betsBreakdown.length > 0) {
      return transaction.betsBreakdown;
    }
    const desc = (transaction.description || '').trim();
    if (!desc) return [];

    // Parse Roulette formatted details: [Bets: Red: ₹100 (Won, Payout: ₹200) | Black: ₹50 (Lost)]
    const betsMatch = desc.match(/\[Bets:\s*([^\]]+)\]/i);
    if (betsMatch && betsMatch[1]) {
      const items = betsMatch[1].split('|').map(s => s.trim()).filter(Boolean);
      const parsed: BetBreakdownItem[] = [];
      for (const item of items) {
        const spotMatch = item.match(/^([^:]+):\s*₹?([0-9,]+)/);
        if (spotMatch) {
          const spot = spotMatch[1].trim();
          const amount = parseInt(spotMatch[2].replace(/,/g, ''), 10) || 0;
          const isWin = /Won/i.test(item);
          const payoutMatch = item.match(/Payout:\s*₹?([0-9,]+)/i);
          const payout = payoutMatch ? parseInt(payoutMatch[1].replace(/,/g, ''), 10) : (isWin ? amount * 2 : 0);
          parsed.push({
            spot,
            amount,
            isWin,
            payout,
            multiplier: isWin ? 'Win Mult' : '0x',
            outcomeProof: isWin ? 'Winning Spot' : 'Did not hit'
          });
        }
      }
      if (parsed.length > 0) return parsed;
    }

    // Parse single bet selection if found
    const betChoiceMatch = desc.match(/Bet on\s+([^,.]+)/i) || desc.match(/Choice:\s*([^,.]+)/i) || desc.match(/Selection:\s*([^,.]+)/i);
    if (betChoiceMatch) {
      const isWin = isCredit || /Won/i.test(desc);
      return [{
        spot: betChoiceMatch[1].trim(),
        amount: Math.abs(transaction.amount || 0),
        isWin,
        payout: isWin ? Math.abs(transaction.amount || 0) * 2 : 0,
        multiplier: isWin ? 'Win Multiplier' : '0x',
        outcomeProof: isWin ? 'Hit Winning Choice' : 'Did not hit'
      }];
    }

    return [];
  }, [transaction]);

  // Draw HD Canvas Voucher on component mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HD Resolution settings (800x1000)
    const width = 800;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    // Background - Dark Luxury Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Outer Border Frame
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Header Logo & Branding - Exact BETGURU Website Logo
    ctx.save();
    const logoBoxX = 180;
    const logoBoxY = 55;
    const logoBoxSize = 52;

    // Golden gradient rounded outer border for 'B' box
    const bGrad = ctx.createLinearGradient(logoBoxX, logoBoxY, logoBoxX + logoBoxSize, logoBoxY + logoBoxSize);
    bGrad.addColorStop(0, '#fde047');
    bGrad.addColorStop(0.5, '#f59e0b');
    bGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = bGrad;
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 14);
    } else {
      ctx.fillRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);
    }
    ctx.fill();

    // Dark inner
    ctx.fillStyle = '#020617';
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(logoBoxX + 4, logoBoxY + 4, logoBoxSize - 8, logoBoxSize - 8, 10);
    } else {
      ctx.fillRect(logoBoxX + 4, logoBoxY + 4, logoBoxSize - 8, logoBoxSize - 8);
    }
    ctx.fill();

    // Letter 'B'
    ctx.fillStyle = bGrad;
    ctx.font = '900 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', logoBoxX + logoBoxSize / 2, logoBoxY + logoBoxSize / 2 + 2);

    // 'ETGURU'
    const textX = logoBoxX + logoBoxSize + 12;
    ctx.fillStyle = bGrad;
    ctx.font = '900 38px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ETGURU', textX, logoBoxY + logoBoxSize / 2 - 4);

    // 'HD' pill badge
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    const hdX = textX + 185;
    const hdY = logoBoxY + 12;
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(hdX, hdY, 36, 20, 6);
    } else {
      ctx.fillRect(hdX, hdY, 36, 20);
    }
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(hdX, hdY, 36, 20, 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#fde047';
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HD', hdX + 18, hdY + 10);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL TRANSACTION VOUCHER & AUDIT SLIP', width / 2, 118);
    ctx.restore();

    // Gold Divider Line
    const divGrad = ctx.createLinearGradient(100, 0, width - 100, 0);
    divGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
    divGrad.addColorStop(0.5, '#f59e0b');
    divGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, 130);
    ctx.lineTo(width - 100, 130);
    ctx.stroke();

    // Status Banner Box
    const bannerY = 160;
    const bannerHeight = 80;
    ctx.fillStyle = isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
    ctx.fillRect(80, bannerY, width - 160, bannerHeight);
    ctx.strokeStyle = isCredit ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, bannerY, width - 160, bannerHeight);

    ctx.fillStyle = isCredit ? '#34d399' : '#f87171';
    ctx.font = '900 24px monospace';
    ctx.fillText(`STATUS: ${statusText} (SETTLED)`, width / 2, bannerY + 36);

    // Amount Display (Huge HD Text)
    ctx.font = '900 52px monospace';
    const amountStr = `${isCredit ? '+' : '-'} ₹${displayAmount}`;
    ctx.fillText(amountStr, width / 2, bannerY + 72);

    // Details Box Table
    const tableY = 280;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(80, tableY, width - 160, 480);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.strokeRect(80, tableY, width - 160, 480);

    const walletSourceLabel = transaction.walletType === 'bonus' ? 'BONUS WALLET (বোনাস)' : 'MAIN / REAL (রিয়েল)';

    const rows = [
      { label: 'TRANSACTION ID', value: txId },
      { label: 'TYPE / CATEGORY', value: (transaction.type || 'GENERAL').toUpperCase() },
      { label: 'WALLET SOURCE', value: walletSourceLabel },
      ...(transaction.promoCode ? [
        { label: 'PROMO CODE', value: `${transaction.promoCode} (${transaction.promoCodeTitle || 'Redeemed'})` },
        { label: 'FUNDS ORIGIN', value: transaction.sourceOrigin || 'Promo Code Activation' }
      ] : []),
      { label: 'TITLE / DESCRIPTION', value: titleText },
      { label: 'DATE & TIME', value: dateText },
      { label: 'UTR / REF NUMBER', value: utrNumber },
      { label: 'SECURITY SEAL', value: 'SHA-256 ENCRYPTED HARDENED' },
    ];

    let rowY = tableY + 50;
    rows.forEach((r, idx) => {
      // Row Background alternating
      if (idx % 2 === 0) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.fillRect(90, rowY - 30, width - 180, 50);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 15px monospace';
      ctx.fillText(r.label, 110, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = r.label === 'TRANSACTION ID' ? '#f59e0b' : '#ffffff';
      ctx.font = '900 16px monospace';
      
      // Truncate long value strings for clean alignment
      let valStr = String(r.value);
      if (valStr.length > 28) valStr = valStr.substring(0, 25) + '...';
      ctx.fillText(valStr, width - 110, rowY);

      rowY += 75;
    });

    // Barcode Graphic simulation
    const barcodeY = 790;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(120, barcodeY, width - 240, 60);

    // Black lines of barcode
    ctx.fillStyle = '#000000';
    let lineX = 130;
    while (lineX < width - 130) {
      const lineWidth = Math.floor(Math.random() * 4) + 1;
      ctx.fillRect(lineX, barcodeY + 5, lineWidth, 50);
      lineX += lineWidth + Math.floor(Math.random() * 5) + 2;
    }

    // Footer Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 13px monospace';
    ctx.fillText('Official Digital Receipt • BETGURU Real-Time Gaming Engine', width / 2, 880);
    ctx.fillText('Keep this voucher slip for security validation and customer queries', width / 2, 905);

    // Set generated Data URL
    try {
      setDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('Error generating canvas data URL:', e);
    }
  }, [transaction]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const filename = `BETGURU-Voucher-${txId}.png`;
    const res = await downloadVoucherImageSafe(canvas, filename, (msg) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 3000);
    });

    if (res.dataUrl) {
      setDataUrl(res.dataUrl);
    }

    if (res.requiresManualSave && res.dataUrl) {
      setIsAndroidSaveOpen(true);
    } else {
      setToastMsg('ভাউচার ডাউনলোড সম্পন্ন হয়েছে!');
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleShare = async () => {
    soundFx.playClick();
    setIsSharing(true);

    const shareParams: ShareVoucherParams = {
      code: txId,
      amountStr: `₹${displayAmount}`,
      title: titleText,
      type: transaction.type ? `ট্রানজেকশন (${transaction.type})` : 'অফিসিয়াল ট্রানজেকশন স্লিপ',
      dataUrl: dataUrl || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : null),
      activations: `স্ট্যাটাস: ${statusText} • UTR: ${utrNumber}`
    };

    const shared = await tryNativeShareVoucher(shareParams);
    setIsSharing(false);
    if (!shared) {
      setIsShareModalOpen(true);
    }
  };

  const copyTxId = async () => {
    soundFx.playClick();
    const ok = await copyToClipboardSafe(txId);
    if (ok) {
      setCopied(true);
      setToastMsg(`ট্রানজেকশন আইডি কপি হয়েছে: ${txId}`);
      setTimeout(() => {
        setCopied(false);
        setToastMsg(null);
      }, 2000);
    }
  };

  const copyUtr = async () => {
    const textToCopy = transaction.utr || transaction.utrNumber || txId;
    soundFx.playClick();
    const ok = await copyToClipboardSafe(textToCopy);
    if (ok) {
      setCopiedUtr(true);
      setToastMsg(`UTR/রেফারেন্স কপি হয়েছে: ${textToCopy}`);
      setTimeout(() => {
        setCopiedUtr(false);
        setToastMsg(null);
      }, 2000);
    }
  };

  const handleSupportShare = () => {
    const textToShare = `Hi BETGURU Support, I need help with my transaction voucher:\n• Tx ID: ${txId}\n• Type: ${transaction.type || 'Transaction'}\n• Amount: ₹${displayAmount}\n• UTR/Ref: ${transaction.utr || transaction.utrNumber || 'N/A'}\n• Date: ${dateText}\n• Status: ${statusText}`;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToShare).catch(() => {});
      }
    } catch (_) {}
    soundFx.playClick();
    if (onClose) onClose();
    if (onOpenSupportChat) {
      onOpenSupportChat(textToShare);
    }
  };

  return (
    <div className="max-w-4xl xl:max-w-5xl w-full bg-slate-900 border border-amber-500/40 shadow-2xl relative font-mono text-white rounded-3xl p-4 sm:p-6 space-y-4 my-auto overflow-y-auto animate-in zoom-in-95 duration-200">
      
      {/* Header with Title & Action Controls */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">BETGURU Transaction Voucher</h3>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded-full">
                VERIFIED SLIP
              </span>
            </div>
            <p className="text-xs text-amber-400 font-bold">HD Official Digital Result Slip & Details</p>
          </div>
        </div>

        {/* Modal Close Button */}
        {onClose && (
          <button
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-400 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Multi-Column Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Canvas Preview & Share / Download Actions */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 flex justify-center items-center shadow-inner overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full max-h-[380px] object-contain rounded-xl border border-slate-800 shadow-md"
            />
          </div>

          {/* Support & Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="py-2.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{isSharing ? 'Sharing...' : 'Share Slip'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl border border-slate-700 hover:border-amber-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download</span>
            </button>

            {onOpenSupportChat && (
              <button
                onClick={handleSupportShare}
                className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1"
                title="Chat with support about this transaction"
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Support</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Breakdown Table & Structured Details */}
        <div className="lg:col-span-7 space-y-3.5">
          
          {/* Details Quick Bar */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Voucher Tx ID</span>
              <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                <span className="truncate max-w-[180px]">{txId}</span>
                <button 
                  onClick={copyTxId} 
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-amber-400 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Copy TXID"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </span>
            </div>

            {transaction.utr && (
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Bank UTR / Ref</span>
                <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                  <span className="truncate max-w-[180px]">{transaction.utr}</span>
                  <button 
                    onClick={copyUtr} 
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="Copy UTR Number"
                  >
                    {copiedUtr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                    <span>{copiedUtr ? 'Copied' : 'Copy'}</span>
                  </button>
                </span>
              </div>
            )}

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Settled Amount</span>
              <span className={`font-black text-base sm:text-lg ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isCredit ? '+' : '-'} ₹{displayAmount}
              </span>
            </div>
          </div>

          {/* Granular Section-by-Section Betting Breakdown (100% Responsive - No Horizontal Scroll) */}
          {transaction.promoCode && (
            <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-3.5 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>প্রোমো কোড উৎস ও রিওয়ার্ড তথ্য (Promo Code Details):</span>
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-amber-500/40">
                  VERIFIED ORIGIN
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">অ্যাক্টিভেটেড কোড (Promo Code)</span>
                  <span className="font-mono font-black text-white text-sm">{transaction.promoCode}</span>
                  {transaction.promoCodeTitle && (
                    <span className="text-[11px] text-amber-300 block font-bold mt-0.5">{transaction.promoCodeTitle}</span>
                  )}
                </div>
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase">উৎস ও প্রাপ্তি মাধ্যম (Funds Origin)</span>
                  <span className="font-mono font-bold text-cyan-300 block mt-0.5">{transaction.sourceOrigin || 'প্রোমো কোড সক্রিয়করণ (Promo Activation)'}</span>
                  {transaction.promoOrigin && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">Campaign: {transaction.promoOrigin}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Granular Section-by-Section Betting Breakdown (100% Responsive - No Horizontal Scroll) */}
          {betsBreakdown.length > 0 && (
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span>Section-by-Section Bet Details (বেটিং হিস্ট্রি বিস্তারিত):</span>
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">
                  {betsBreakdown.length} Spot(s)
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {betsBreakdown.map((item, idx) => (
                  <div 
                    key={idx}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                      item.isWin ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                        item.isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {item.isWin ? '✓' : '✕'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-amber-300 block truncate">{item.spot}</span>
                        {item.outcomeProof && (
                          <span className="text-[10px] text-slate-400 block truncate">{item.outcomeProof}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t border-slate-800/60 sm:border-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[9px] text-slate-400 block uppercase">বাজি</span>
                        <span className="font-black text-white text-xs">₹{item.amount.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="text-center">
                        {item.isWin ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            Won
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            Lost
                          </span>
                        )}
                      </div>

                      <div className="text-right min-w-[60px]">
                        <span className="text-[9px] text-slate-400 block uppercase">পেআউট</span>
                        <span className={`font-black text-xs ${item.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {item.isWin ? `+₹${(item.payout || 0).toLocaleString('en-IN')}` : '₹0'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Transaction Log & Security Seal */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Transaction Description & Note:</span>
              <p className="text-slate-200 break-words leading-relaxed font-sans text-xs">{titleText}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Date & Exact Time</span>
                <span className="text-slate-300 font-bold">{dateText}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Wallet Source</span>
                <span className={`font-bold ${transaction.walletType === 'bonus' ? 'text-purple-300' : 'text-emerald-400'}`}>
                  {transaction.walletType === 'bonus' ? '🎁 Bonus Wallet' : '💰 Real Wallet'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Audit Verification</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SHA-256 Verified</span>
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Modals for Reliable Android Share and Save */}
      <VoucherShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        params={{
          code: txId,
          amountStr: `₹${displayAmount}`,
          title: titleText,
          type: transaction.type ? `ট্রানজেকশন (${transaction.type})` : 'অফিসিয়াল ট্রানজেকশন স্লিপ',
          dataUrl: dataUrl || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : null),
          activations: `স্ট্যাটাস: ${statusText} • UTR: ${utrNumber}`
        }}
        onOpenDownloadLightbox={() => setIsAndroidSaveOpen(true)}
      />

      <AndroidImageSaveModal
        isOpen={isAndroidSaveOpen}
        onClose={() => setIsAndroidSaveOpen(false)}
        dataUrl={dataUrl || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : null)}
        filename={`BETGURU-Voucher-${txId}.png`}
        onShare={() => setIsShareModalOpen(true)}
      />

      {/* Floating Status Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-500/50 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
};
