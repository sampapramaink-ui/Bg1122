import React, { useRef, useEffect, useState } from 'react';
import { Download, Copy, Check, Share2, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { PromoCode, PromoCodeType, PromoTargetWallet } from '../types';
import { soundFx } from '../utils/audio';
import { 
  downloadVoucherImageSafe, 
  tryNativeShareVoucher, 
  copyToClipboardSafe, 
  ShareVoucherParams 
} from '../utils/voucherShareDownloadHelper';
import { VoucherShareModal } from './VoucherShareModal';
import { AndroidImageSaveModal } from './AndroidImageSaveModal';

export interface PromoVoucherData {
  code: string;
  type: PromoCodeType;
  rewardAmount?: number;
  bonusPercentage?: number;
  flatBonusAmount?: number;
  minDepositAmount?: number;
  targetWallet?: PromoTargetWallet;
  maxUsesPerUser?: number;
  maxTotalUses?: number;
  title?: string;
}

interface PromoVoucherCardProps {
  data: PromoVoucherData | PromoCode;
  showDownloadButton?: boolean;
  className?: string;
  onDownloaded?: () => void;
}

/**
 * Draws an Ultra HD 2400x1350 Voucher Ticket onto a Canvas
 * Matching the exact design of the user's reference image:
 * - Scalloped / perforated ticket notches along left and right edges
 * - Deep carbon black card background
 * - Top Left: Bet Guru Logo & bold typography
 * - Top Right: BONUS CODE / DEPOSIT VOUCHER tag
 * - Center: Large Vibrant Emerald Capsule Pill with Promo Code
 * - Bottom Left: Amount / Bonus
 * - Bottom Middle: Activations (Single / Multiple Count)
 * - Bottom Right: Iridescent Holographic Security Seal
 */
export function drawPromoVoucherToCanvas(
  canvas: HTMLCanvasElement,
  data: PromoVoucherData | PromoCode
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 2400;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // 1. Drop shadow & background glow
  const glowGrad = ctx.createRadialGradient(width / 2, height / 2, 200, width / 2, height / 2, 900);
  glowGrad.addColorStop(0, 'rgba(0, 230, 118, 0.08)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Ticket Dimensions & Margins
  const marginX = 120;
  const marginY = 80;
  const cardW = width - marginX * 2;
  const cardH = height - marginY * 2;
  const cornerR = 48;
  const notchRadius = 38;
  const numNotches = 7;

  // 2. Draw Ticket Shape with Scalloped / Perforated Teeth on Left & Right
  ctx.save();
  ctx.beginPath();

  // Top edge (left to right)
  ctx.moveTo(marginX + cornerR, marginY);
  ctx.lineTo(marginX + cardW - cornerR, marginY);
  ctx.arcTo(marginX + cardW, marginY, marginX + cardW, marginY + cornerR, cornerR);

  // Right edge with semicircular notches inward
  const rightX = marginX + cardW;
  const stepY = (cardH - cornerR * 2) / (numNotches + 1);
  for (let i = 1; i <= numNotches; i++) {
    const ny = marginY + cornerR + i * stepY;
    ctx.lineTo(rightX, ny - notchRadius);
    // arc inward (to left)
    ctx.arc(rightX, ny, notchRadius, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.lineTo(rightX, marginY + cardH - cornerR);
  ctx.arcTo(rightX, marginY + cardH, rightX - cornerR, marginY + cardH, cornerR);

  // Bottom edge (right to left)
  ctx.lineTo(marginX + cornerR, marginY + cardH);
  ctx.arcTo(marginX, marginY + cardH, marginX, marginY + cardH - cornerR, cornerR);

  // Left edge with semicircular notches inward
  const leftX = marginX;
  for (let i = numNotches; i >= 1; i--) {
    const ny = marginY + cornerR + i * stepY;
    ctx.lineTo(leftX, ny + notchRadius);
    // arc inward (to right)
    ctx.arc(leftX, ny, notchRadius, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.lineTo(leftX, marginY + cornerR);
  ctx.arcTo(leftX, marginY, leftX + cornerR, marginY, cornerR);

  ctx.closePath();

  // Clip & Fill Ticket Background
  ctx.fillStyle = '#060709'; // Deep matte luxury carbon black
  ctx.fill();

  // Subtle border outline
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1e2430';
  ctx.stroke();
  ctx.restore();

  // 3. TOP LEFT: Exact BETGURU Website Logo
  const brandX = marginX + 130;
  const brandY = marginY + 125;
  const boxW = 110;
  const boxH = 110;
  const boxR = 28;

  ctx.save();
  // Outer golden gradient rounded box with soft glow
  ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
  ctx.shadowBlur = 24;

  const goldGrad = ctx.createLinearGradient(brandX, brandY - boxH / 2, brandX + boxW, brandY + boxH / 2);
  goldGrad.addColorStop(0, '#fde047');
  goldGrad.addColorStop(0.5, '#f59e0b');
  goldGrad.addColorStop(1, '#d97706');

  ctx.fillStyle = goldGrad;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(brandX, brandY - boxH / 2, boxW, boxH, boxR);
  } else {
    ctx.rect(brandX, brandY - boxH / 2, boxW, boxH);
  }
  ctx.fill();

  // Inner dark box
  const innerPad = 7;
  ctx.fillStyle = '#020617';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(brandX + innerPad, brandY - boxH / 2 + innerPad, boxW - innerPad * 2, boxH - innerPad * 2, boxR - 6);
  } else {
    ctx.rect(brandX + innerPad, brandY - boxH / 2 + innerPad, boxW - innerPad * 2, boxH - innerPad * 2);
  }
  ctx.fill();

  // Letter 'B' inside inner box with golden gradient & shadow
  const bGrad = ctx.createLinearGradient(brandX, brandY - 35, brandX, brandY + 35);
  bGrad.addColorStop(0, '#fef08a');
  bGrad.addColorStop(0.5, '#fbbf24');
  bGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = bGrad;
  ctx.font = '900 76px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', brandX + boxW / 2, brandY + 3);
  ctx.restore();

  // Next to box: 'ETGURU' + 'HD' badge
  const textStartX = brandX + boxW + 28;
  ctx.save();
  const etguruGrad = ctx.createLinearGradient(textStartX, brandY - 35, textStartX + 300, brandY);
  etguruGrad.addColorStop(0, '#fde047');
  etguruGrad.addColorStop(0.5, '#fbbf24');
  etguruGrad.addColorStop(1, '#f59e0b');

  ctx.fillStyle = etguruGrad;
  ctx.font = '900 64px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ETGURU', textStartX, brandY - 20);

  // 'HD' pill badge
  const etguruW = ctx.measureText('ETGURU').width;
  const hdX = textStartX + etguruW + 18;
  const hdY = brandY - 40;
  const hdW = 76;
  const hdH = 40;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 3;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(hdX, hdY, hdW, hdH, 8);
  } else {
    ctx.rect(hdX, hdY, hdW, hdH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HD', hdX + hdW / 2, hdY + hdH / 2 + 1);

  // Subtitle: Green pulsing beacon dot + 'ONLINE CASINO & LOTTERY'
  const subY = brandY + 36;
  ctx.fillStyle = '#10b981';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(textStartX + 10, subY, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#34d399';
  ctx.font = '800 24px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ONLINE CASINO & LOTTERY', textStartX + 28, subY);
  ctx.restore();

  // 4. TOP RIGHT: Badge / Category Tag (BONUS CODE / DEPOSIT VOUCHER)
  ctx.save();
  let tagText = 'BONUS CODE';
  if (data.type === 'deposit_bonus') {
    tagText = 'DEPOSIT VOUCHER';
  } else if (data.targetWallet === 'main') {
    tagText = 'CASH VOUCHER';
  }

  ctx.font = '800 38px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '8px';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, marginX + cardW - 140, brandY);
  ctx.restore();

  // 5. CENTER HERO CAPSULE: Neon Emerald Green Pill
  const pillW = cardW - 280;
  const pillH = 340;
  const pillX = marginX + (cardW - pillW) / 2;
  const pillY = marginY + 340;
  const pillRadius = 64;

  ctx.save();
  // Neon glow effect behind pill
  ctx.shadowColor = 'rgba(0, 230, 118, 0.45)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 12;

  // Pill Gradient (Vivid Neon Emerald)
  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
  pillGrad.addColorStop(0, '#00e676');
  pillGrad.addColorStop(0.5, '#00d664');
  pillGrad.addColorStop(1, '#00b050');

  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.restore();

  // Promo Code Text inside the Capsule Pill
  ctx.save();
  const rawCode = (data.code || 'PROMO-CODE').toUpperCase().trim();
  
  // Dynamically calculate font size so long codes never overflow
  let codeFontSize = 135;
  if (rawCode.length > 14) {
    codeFontSize = 95;
  } else if (rawCode.length > 10) {
    codeFontSize = 115;
  }

  ctx.font = `900 ${codeFontSize}px "Inter", "Segoe UI", "Arial Black", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';

  // Crisp text shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillText(rawCode, pillX + pillW / 2, pillY + pillH / 2 + 6);
  ctx.restore();

  // 6. BOTTOM SECTION: Amount | Activations | Hologram
  const bottomY = pillY + pillH + 160;

  // 6A. COLUMN 1: Amount / Bonus
  ctx.save();
  const col1X = pillX + 30;

  ctx.font = '600 32px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#8e9aa8';
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'left';
  
  const amountLabel = data.type === 'deposit_bonus' && data.bonusPercentage ? 'Bonus' : 'Amount';
  ctx.fillText(amountLabel, col1X, bottomY - 45);

  // Amount Value (e.g. "20 ₹" or "100 ₹" or "50%")
  let displayAmount = '0 ₹';
  if (data.type === 'deposit_bonus') {
    if (data.bonusPercentage) {
      displayAmount = `${data.bonusPercentage} %`;
    } else if (data.flatBonusAmount) {
      displayAmount = `${data.flatBonusAmount} ₹`;
    }
  } else {
    displayAmount = `${data.rewardAmount || 0} ₹`;
  }

  ctx.font = '900 68px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '2px';
  ctx.fillText(displayAmount, col1X, bottomY + 35);
  ctx.restore();

  // Vertical Separator Line
  ctx.save();
  const dividerX = col1X + 340;
  ctx.strokeStyle = '#222834';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dividerX, bottomY - 60);
  ctx.lineTo(dividerX, bottomY + 50);
  ctx.stroke();
  ctx.restore();

  // 6B. COLUMN 2: Activations (Single / Multiple Count)
  ctx.save();
  const col2X = dividerX + 70;

  ctx.font = '600 32px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#8e9aa8';
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'left';
  ctx.fillText('Activations', col2X, bottomY - 45);

  // Activations Value:
  // - If specific total uses set: e.g. "400"
  // - If single code: "Single (1x)"
  // - If unlimited: "Unlimited (∞)"
  let activationsText = 'Unlimited';
  const totalUses = Number(data.maxTotalUses || 0);
  const perUser = Number(data.maxUsesPerUser || 1);

  if (totalUses > 0) {
    activationsText = totalUses.toLocaleString('en-IN');
  } else if (perUser === 1) {
    activationsText = 'Single (1x)';
  } else if (perUser > 1) {
    activationsText = `${perUser}x / User`;
  } else {
    activationsText = 'Unlimited';
  }

  ctx.font = '900 68px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '2px';
  ctx.fillText(activationsText, col2X, bottomY + 35);
  ctx.restore();

  // 6C. COLUMN 3: Holographic Security Seal Pill (Bottom Right)
  const holoW = 220;
  const holoH = 110;
  const holoX = pillX + pillW - holoW;
  const holoY = bottomY - 45;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(holoX, holoY, holoW, holoH, holoH / 2);

  // Iridescent silver/rainbow holographic foil gradient
  const holoGrad = ctx.createLinearGradient(holoX, holoY, holoX + holoW, holoY + holoH);
  holoGrad.addColorStop(0, '#e2e8f0');
  holoGrad.addColorStop(0.2, '#fed7aa');
  holoGrad.addColorStop(0.4, '#fbcfe8');
  holoGrad.addColorStop(0.6, '#c7d2fe');
  holoGrad.addColorStop(0.8, '#bbf7d0');
  holoGrad.addColorStop(1, '#f1f5f9');
  ctx.fillStyle = holoGrad;
  ctx.fill();

  // Hologram sheen reflection
  const sheenGrad = ctx.createLinearGradient(holoX, holoY, holoX + holoW * 0.7, holoY + holoH);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
  ctx.fillStyle = sheenGrad;
  ctx.fill();

  // Embossed emblem inside hologram
  const emblemCenterX = holoX + holoH * 0.52;
  const emblemCenterY = holoY + holoH / 2;
  const emblemR = holoH * 0.32;

  // Star / Flower watermark inside hologram
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(emblemCenterX, emblemCenterY, emblemR, 0, Math.PI * 2);
  ctx.stroke();

  // 4-petal embossed cross
  ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
  ctx.beginPath();
  ctx.arc(emblemCenterX - 7, emblemCenterY - 7, 9, 0, Math.PI * 2);
  ctx.arc(emblemCenterX + 7, emblemCenterY - 7, 9, 0, Math.PI * 2);
  ctx.arc(emblemCenterX - 7, emblemCenterY + 7, 9, 0, Math.PI * 2);
  ctx.arc(emblemCenterX + 7, emblemCenterY + 7, 9, 0, Math.PI * 2);
  ctx.fill();

  // Second circle for 3D lens effect
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(holoX + holoW - holoH * 0.52, emblemCenterY, emblemR * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export const PromoVoucherCard: React.FC<PromoVoucherCardProps> = ({
  data,
  showDownloadButton = true,
  className = '',
  onDownloaded
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAndroidSaveOpen, setIsAndroidSaveOpen] = useState(false);
  const [currentDataUrl, setCurrentDataUrl] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Redraw canvas whenever promo data changes
  useEffect(() => {
    if (canvasRef.current) {
      drawPromoVoucherToCanvas(canvasRef.current, data);
      try {
        const url = canvasRef.current.toDataURL('image/png', 1.0);
        setCurrentDataUrl(url);
      } catch (_) {}
    }
  }, [
    data.code,
    data.type,
    data.rewardAmount,
    data.bonusPercentage,
    data.flatBonusAmount,
    data.minDepositAmount,
    data.targetWallet,
    data.maxUsesPerUser,
    data.maxTotalUses
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleDownloadPNG = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloading(true);

    try {
      // Ensure redrawn cleanly at full 2400x1350 resolution
      drawPromoVoucherToCanvas(canvas, data);

      const cleanCode = (data.code || 'PROMO').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
      const filename = `BETGURU-VOUCHER-${cleanCode}.png`;

      const res = await downloadVoucherImageSafe(canvas, filename, (msg) => {
        showToast(msg);
      });

      if (res.dataUrl) {
        setCurrentDataUrl(res.dataUrl);
      }

      // If on Android or WebView, also show the user-friendly Save / Long-press modal
      if (res.requiresManualSave && res.dataUrl) {
        setIsAndroidSaveOpen(true);
      } else {
        showToast('ভাউচার ডাউনলোড সম্পন্ন হয়েছে!');
      }

      setDownloading(false);
      if (onDownloaded && !res.requiresManualSave) {
        onDownloaded();
      }
    } catch (err) {
      console.error('Failed to download voucher PNG:', err);
      showToast('ডাউনলোড সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setDownloading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!data.code) return;
    soundFx.playClick();
    const ok = await copyToClipboardSafe(data.code.toUpperCase());
    if (ok) {
      setCopied(true);
      showToast(`ভাউচার কোড কপি হয়েছে: ${data.code.toUpperCase()}`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareImage = async () => {
    soundFx.playClick();
    const canvas = canvasRef.current;
    let dataUrl = currentDataUrl;
    if (canvas) {
      try {
        drawPromoVoucherToCanvas(canvas, data);
        dataUrl = canvas.toDataURL('image/png', 1.0);
        setCurrentDataUrl(dataUrl);
      } catch (_) {}
    }

    const shareParams: ShareVoucherParams = {
      code: rawCode,
      amountStr,
      title: data.title || (isDeposit ? 'ডিপোজিট বোনাস ভাউচার' : 'ক্যাশ রিওয়ার্ড ভাউচার'),
      type: tagText,
      dataUrl,
      activations: activationsStr
    };

    // Try native sharing without async delay to preserve browser user activation
    const shared = await tryNativeShareVoucher(shareParams);
    if (!shared) {
      // If native sharing is unsupported or unavailable, open our specialized share modal
      setIsShareModalOpen(true);
    }
  };

  // Determine display strings for DOM overlay
  const rawCode = (data.code || 'PROMO-CODE').toUpperCase().trim();
  const isDeposit = data.type === 'deposit_bonus';
  const tagText = isDeposit ? 'DEPOSIT VOUCHER' : (data.targetWallet === 'main' ? 'CASH VOUCHER' : 'BONUS CODE');
  
  let amountStr = '0 ₹';
  if (isDeposit) {
    if (data.bonusPercentage) amountStr = `${data.bonusPercentage}%`;
    else if (data.flatBonusAmount) amountStr = `${data.flatBonusAmount} ₹`;
  } else {
    amountStr = `${data.rewardAmount || 0} ₹`;
  }

  const totalUses = Number(data.maxTotalUses || 0);
  const perUser = Number(data.maxUsesPerUser || 1);
  let activationsStr = 'Unlimited';
  if (totalUses > 0) {
    activationsStr = totalUses.toLocaleString('en-IN');
  } else if (perUser === 1) {
    activationsStr = 'Single (1x)';
  } else if (perUser > 1) {
    activationsStr = `${perUser}x / User`;
  } else {
    activationsStr = 'Unlimited';
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Visual Rendered Card (Matching reference photo styling) */}
      <div className="relative w-full aspect-[16/9] max-w-2xl mx-auto rounded-3xl overflow-hidden bg-black p-4 sm:p-7 shadow-2xl border border-white/10 flex flex-col justify-between font-sans select-none group">
        
        {/* Scalloped ticket notches on left and right border (Visual CSS Representation) */}
        <div className="absolute left-0 top-0 bottom-0 w-3 flex flex-col justify-around pointer-events-none -translate-x-1.5 z-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-900 border-r border-white/10" />
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-3 flex flex-col justify-around pointer-events-none translate-x-1.5 z-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-900 border-l border-white/10" />
          ))}
        </div>

        {/* Top Header Row */}
        <div className="flex items-center justify-between z-10 pl-2 pr-2">
          {/* Brand Logo & Name (Exact BETGURU Website Header Logo) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[10px] sm:rounded-[14px] flex items-center justify-center relative overflow-hidden">
                <span className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-500 font-mono leading-none drop-shadow">
                  B
                </span>
                <div className="absolute inset-0 bg-amber-400/20 blur-xs pointer-events-none"></div>
              </div>
            </div>

            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm font-mono leading-none">
                  ETGURU
                </span>
                <span className="bg-amber-500/20 text-amber-400 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest font-mono">
                  HD
                </span>
              </div>
              <span className="text-[8px] sm:text-[10px] text-emerald-400 font-bold tracking-tight mt-0.5 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ONLINE CASINO &amp; LOTTERY
              </span>
            </div>
          </div>

          {/* Badge Tag */}
          <div className="text-right">
            <span className="text-[10px] sm:text-sm font-extrabold tracking-widest text-white/90 uppercase">
              {tagText}
            </span>
          </div>
        </div>

        {/* Center Neon Emerald Capsule Pill */}
        <div className="w-full my-auto px-2 sm:px-4 z-10">
          <div className="w-full py-3.5 sm:py-7 px-4 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/25 flex items-center justify-center border border-emerald-300/40 transform transition group-hover:scale-[1.01]">
            <span className="font-black text-lg sm:text-3xl md:text-4xl text-white tracking-widest uppercase font-mono drop-shadow-md break-all text-center">
              {rawCode}
            </span>
          </div>
        </div>

        {/* Bottom Details Row */}
        <div className="flex items-end justify-between z-10 pl-2 pr-2">
          {/* Amount & Activations */}
          <div className="flex items-center gap-4 sm:gap-8 text-left">
            <div>
              <span className="block text-[9px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isDeposit && data.bonusPercentage ? 'Bonus' : 'Amount'}
              </span>
              <span className="block font-black text-sm sm:text-2xl text-white tracking-tight">
                {amountStr}
              </span>
            </div>

            <div className="w-px h-7 sm:h-10 bg-white/15" />

            <div>
              <span className="block text-[9px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Activations
              </span>
              <span className="block font-black text-sm sm:text-2xl text-white tracking-tight">
                {activationsStr}
              </span>
            </div>
          </div>

          {/* Holographic Pill Security Seal (Right Side) */}
          <div className="relative">
            <div className="w-14 h-7 sm:w-24 sm:h-12 rounded-full bg-gradient-to-r from-slate-200 via-pink-200 via-amber-100 via-indigo-200 to-emerald-200 shadow-md flex items-center justify-between px-2 sm:px-3 border border-white/60 overflow-hidden">
              <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full border border-slate-600/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-600/40" />
              </div>
              <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border border-white/80" />
            </div>
          </div>
        </div>

      </div>

      {/* Hidden 2400x1350 High-Definition Canvas used for Lossless PNG Export */}
      <canvas 
        ref={canvasRef} 
        className="hidden" 
        width={2400} 
        height={1350} 
      />

      {/* Action Buttons: 1-Click HD PNG Download & Copy Code */}
      {showDownloadButton && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>অফিসিয়াল 4K আল্ট্রা এইচডি ভাউচার কার্ড (Lossless PNG)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
              title="কোড কপি করুন"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'কপি হয়েছে!' : 'কোড কপি'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareImage}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
              title="শেয়ার করুন"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>শেয়ার</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={downloading}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{downloading ? 'ডাউনলোড হচ্ছে...' : 'PNG ডাউনলোড (4K HD)'}</span>
            </button>
          </div>
        </div>
      )}
      {/* Modals for Reliable Android Share and Save */}
      <VoucherShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        params={{
          code: rawCode,
          amountStr,
          title: data.title || (isDeposit ? 'ডিপোজিট বোনাস ভাউচার' : 'ক্যাশ রিওয়ার্ড ভাউচার'),
          type: tagText,
          dataUrl: currentDataUrl,
          activations: activationsStr
        }}
        onOpenDownloadLightbox={() => setIsAndroidSaveOpen(true)}
      />

      <AndroidImageSaveModal
        isOpen={isAndroidSaveOpen}
        onClose={() => setIsAndroidSaveOpen(false)}
        dataUrl={currentDataUrl}
        filename={`BETGURU-VOUCHER-${rawCode}.png`}
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
