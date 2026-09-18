import React, { useState } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  Sparkles, 
  Share2, 
  Smartphone, 
  CheckCircle2, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface AndroidImageSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataUrl: string | null;
  filename?: string;
  onShare?: () => void;
}

export const AndroidImageSaveModal: React.FC<AndroidImageSaveModalProps> = ({
  isOpen,
  onClose,
  dataUrl,
  filename = 'BETGURU-VOUCHER.png',
  onShare
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !dataUrl) return null;

  const handleManualDownload = () => {
    soundFx.playWin();
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 200);

      // Check Android bridge if present
      const win = window as any;
      if (win.AndroidBridge) {
        if (typeof win.AndroidBridge.saveImage === 'function') {
          win.AndroidBridge.saveImage(dataUrl, filename);
        } else if (typeof win.AndroidBridge.downloadFile === 'function') {
          win.AndroidBridge.downloadFile(dataUrl, filename);
        }
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      console.warn('Manual download error:', e);
    }
  };

  const handleOpenFullImage = () => {
    soundFx.playClick();
    try {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>${filename}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin:0;background:#050811;display:flex;align-items:center;justify-content:center;min-height:100vh;">
              <img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.8);" />
            </body>
          </html>
        `);
      }
    } catch (_) {}
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>ভাউচার ফটো সেভ করুন</span>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                  4K PNG
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                অ্যান্ড্রয়েড ফোন ও মোবাইল গ্যালারির জন্য অপ্টিমাইজড
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

        {/* Android Native Long-Press Save Guide Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 relative z-10">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
            <span>📱 অ্যান্ড্রয়েড গ্যালারিতে সেভ করার সহজ নিয়ম:</span>
          </div>
          <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-0.5 leading-relaxed pl-1">
            <li>নিচের ছবিটির উপর <strong className="text-white">২ সেকেন্ড চেপে ধরে রাখুন (Long Press)</strong>।</li>
            <li>স্ক্রিনে প্রদর্শিত মেন্যু থেকে <strong className="text-emerald-300">'Download image'</strong> বা <strong className="text-emerald-300">'ছবি সংরক্ষণ করুন'</strong> অপশনটি চাপুন।</li>
            <li>ছবিটি সরাসরি আপনার ফোনের গ্যালারি বা Downloads ফোল্ডারে সেভ হয়ে যাবে।</li>
          </ol>
        </div>

        {/* The Rendered High-Resolution Image Element */}
        <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/60 shadow-xl group">
          <img 
            src={dataUrl} 
            alt="BETGURU Voucher" 
            className="w-full h-auto block rounded-2xl select-all cursor-pointer transition-transform hover:scale-[1.01]"
            title="ছবিটি সেভ করতে চেপে ধরে রাখুন (Long Press to Save)"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 text-[9px] text-amber-300 font-mono font-bold pointer-events-none flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>LONG-PRESS TO SAVE</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleManualDownload}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{downloadSuccess ? 'ডাউনলোড সম্পন্ন!' : 'ডাউনলোড ট্যাপ করুন'}</span>
            </button>

            {onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare();
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>শেয়ার অপশন</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenFullImage}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-[11px] border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>নতুন উইন্ডোতে ফুল ইমেজ ভিউ করুন</span>
          </button>
        </div>

        {/* Footer Guarantee */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>অফিসিয়াল 2400x1350 Lossless 4K রেজোলিউশন নিশ্চিত</span>
        </div>
      </div>
    </div>
  );
};
