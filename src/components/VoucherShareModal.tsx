import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Download, 
  Smartphone, 
  ExternalLink,
  MessageCircle,
  Send,
  MessageSquare,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { ShareVoucherParams, formatVoucherShareText, copyToClipboardSafe } from '../utils/voucherShareDownloadHelper';
import { soundFx } from '../utils/audio';

interface VoucherShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: ShareVoucherParams;
  onOpenDownloadLightbox?: () => void;
}

export const VoucherShareModal: React.FC<VoucherShareModalProps> = ({
  isOpen,
  onClose,
  params,
  onOpenDownloadLightbox
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const rawCode = (params.code || 'PROMO').toUpperCase();
  const shareText = formatVoucherShareText(params);
  const encodedText = encodeURIComponent(shareText);
  const siteUrl = params.linkUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://betguru.app');

  const handleCopyCode = async () => {
    soundFx.playClick();
    const ok = await copyToClipboardSafe(rawCode);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyFullText = async () => {
    soundFx.playClick();
    const ok = await copyToClipboardSafe(shareText);
    if (ok) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  const handleWhatsApp = () => {
    soundFx.playClick();
    const url = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleTelegram = () => {
    soundFx.playClick();
    const url = `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleSms = () => {
    soundFx.playClick();
    window.open(`sms:?body=${encodedText}`, '_self');
  };

  const handleNativeShareAgain = async () => {
    soundFx.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `BETGURU Voucher - ${rawCode}`,
          text: shareText,
          url: siteUrl
        });
        onClose();
      } catch (_) {}
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-28 bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>ভাউচার কোড শেয়ার করুন</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                  OFFICIAL
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                বন্ধুদের সাথে শেয়ার করে বোনাস ও রিওয়ার্ড উপভোগ করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlighted Code Box */}
        <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 flex items-center justify-between gap-2 shadow-inner">
          <div className="truncate">
            <span className="text-[10px] text-amber-400 font-mono block uppercase">VOUCHER CODE</span>
            <span className="font-mono font-black text-base sm:text-lg text-white tracking-widest truncate block">
              {rawCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 shadow"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'কপি হয়েছে' : 'কোড কপি'}</span>
          </button>
        </div>

        {/* 1-Click Social Share Grid */}
        <div className="space-y-2">
          <span className="text-[11px] text-slate-400 font-semibold block px-1">
            সরাসরি শেয়ার করুন (1-Click Share):
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="p-3 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 flex items-center gap-2.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 fill-slate-950" />
              </div>
              <div className="text-left leading-tight">
                <span className="font-bold text-xs block text-white">WhatsApp</span>
                <span className="text-[10px] text-emerald-400">হোয়াটসঅ্যাপ চ্যাট</span>
              </div>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={handleTelegram}
              className="p-3 rounded-2xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/40 text-sky-300 hover:text-sky-200 flex items-center gap-2.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-slate-950 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 -rotate-45" />
              </div>
              <div className="text-left leading-tight">
                <span className="font-bold text-xs block text-white">Telegram</span>
                <span className="text-[10px] text-sky-400">টেলিগ্রাম চ্যানেল/চ্যাট</span>
              </div>
            </button>

            {/* SMS */}
            <button
              type="button"
              onClick={handleSms}
              className="p-3 rounded-2xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 flex items-center gap-2.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500 text-slate-950 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="text-left leading-tight">
                <span className="font-bold text-xs block text-white">SMS / মেসেজ</span>
                <span className="text-[10px] text-indigo-400">মোবাইল ইনবক্স</span>
              </div>
            </button>

            {/* Native Android Share */}
            <button
              type="button"
              onClick={handleNativeShareAgain}
              className="p-3 rounded-2xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 hover:text-amber-200 flex items-center gap-2.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-left leading-tight">
                <span className="font-bold text-xs block text-white">More Apps</span>
                <span className="text-[10px] text-amber-400">অন্যান্য অ্যাপসমূহ</span>
              </div>
            </button>
          </div>
        </div>

        {/* Copy Full Details & Image Actions */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={handleCopyFullText}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-white/10"
          >
            {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
            <span>{copiedText ? 'সম্পূর্ণ ভাউচার মেসেজ কপি হয়েছে!' : 'সম্পূর্ণ ভাউচার মেসেজ কপি করুন'}</span>
          </button>

          {onOpenDownloadLightbox && params.dataUrl && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDownloadLightbox();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>ভাউচার ফটো ডাউনলোড ও অ্যান্ড্রয়েড সেভ অপশন</span>
            </button>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>BETGURU অফিসিয়াল সিকিউর ভাউচার সিস্টেম</span>
        </div>
      </div>
    </div>
  );
};
