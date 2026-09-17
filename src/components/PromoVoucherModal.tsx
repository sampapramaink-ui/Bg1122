import React from 'react';
import { X, Sparkles, Tag, ShieldCheck } from 'lucide-react';
import { PromoCode } from '../types';
import { PromoVoucherCard, PromoVoucherData } from './PromoVoucherCard';

interface PromoVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  promo: PromoCode | PromoVoucherData | null;
}

export const PromoVoucherModal: React.FC<PromoVoucherModalProps> = ({
  isOpen,
  onClose,
  promo
}) => {
  if (!isOpen || !promo) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>অফিসিয়াল প্রোমো ভাউচার কার্ড</span>
                <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  4K ULTRA HD
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                হাই-রেজোলিউশন ফটো ভাউচার (সোশ্যাল মিডিয়া ও ব্যানার রেডি)
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

        {/* Voucher Preview Card */}
        <div className="py-2">
          <PromoVoucherCard 
            data={promo} 
            showDownloadButton={true}
            onDownloaded={onClose}
          />
        </div>

        {/* Informative Footer */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>এটি সরাসরি ডাউনলোড করে ফেসবুক, টেলিগ্রাম বা হোয়াটসঅ্যাপে পোস্ট করতে পারবেন। কোয়ালিটি ১০০% অক্ষুণ্ণ থাকবে।</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer ml-3 shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
