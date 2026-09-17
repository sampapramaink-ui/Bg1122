import React, { useState } from 'react';
import { Image, Plus, Trash2, Edit3, Eye, EyeOff, Save, CheckCircle2, Sparkles, Link, Zap, Upload, LayoutGrid, RotateCcw } from 'lucide-react';
import { BannerSlide, BannerCategory } from '../../types';
import { DEFAULT_BANNER_SLIDES } from '../PromotionalSlider';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { compressImageToDataUrl } from '../../utils/imageCompressor';
import {
  bannerAviator8k,
  bannerAndarBahar8k,
  bannerDragonTiger8k,
  bannerSupercar8k,
  bannerDepositBonus8k,
  bannerLotteryMega8k,
  bannerRoulette8k,
  bannerFerrari8k
} from '../../assets/sliderBanners';

interface AdminBannerSliderManagerProps {
  slides: BannerSlide[];
  onSlidesUpdated?: () => void;
}

export const AdminBannerSliderManager: React.FC<AdminBannerSliderManagerProps> = ({ slides, onSlidesUpdated }) => {
  const allSlides = slides && slides.length > 0 ? slides : DEFAULT_BANNER_SLIDES;

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<BannerCategory>('supercar');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<BannerCategory>('supercar');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formActionType, setFormActionType] = useState<BannerSlide['actionType']>('supercar');
  const [formTargetUrl, setFormTargetUrl] = useState('');
  const [formBadgeText, setFormBadgeText] = useState('');
  const [formBgGradient, setFormBgGradient] = useState('from-amber-600/90 via-red-900/80 to-slate-950');
  const [formOrder, setFormOrder] = useState(1);
  const [formActive, setFormActive] = useState(true);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const filteredSlides = allSlides.filter((s) => s.category === activeCategoryFilter);

  const handleOpenAddNew = () => {
    setIsAddingNew(true);
    setEditingSlideId(null);
    setFormCategory(activeCategoryFilter);
    setFormTitle('');
    setFormSubtitle('');
    setFormImageUrl('https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80');
    setFormActionType(activeCategoryFilter === 'supercar' ? 'supercar' : activeCategoryFilter === 'lottery' ? 'lottery' : activeCategoryFilter === 'deposit' ? 'deposit' : 'wheel');
    setFormTargetUrl('');
    setFormBadgeText('PROMO');
    setFormBgGradient('from-amber-600/90 via-red-900/80 to-slate-950');
    setFormOrder(filteredSlides.length + 1);
    setFormActive(true);
  };

  const handleEditSlide = (slide: BannerSlide) => {
    setIsAddingNew(false);
    setEditingSlideId(slide.id);
    setFormCategory(slide.category);
    setFormTitle(slide.title);
    setFormSubtitle(slide.subtitle || '');
    setFormImageUrl(slide.imageUrl);
    setFormActionType(slide.actionType);
    setFormTargetUrl(slide.targetUrl || '');
    setFormBadgeText(slide.badgeText || '');
    setFormBgGradient(slide.bgGradient || 'from-amber-600/90 via-red-900/80 to-slate-950');
    setFormOrder(slide.order || 1);
    setFormActive(slide.active);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formImageUrl.trim()) {
      alert('Please fill out Title and Image URL!');
      return;
    }

    const slideId = editingSlideId || `slide-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const slideData: BannerSlide = {
      id: slideId,
      category: formCategory,
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      imageUrl: formImageUrl.trim(),
      actionType: formActionType,
      targetUrl: formTargetUrl.trim(),
      badgeText: formBadgeText.trim(),
      bgGradient: formBgGradient,
      order: Number(formOrder) || 1,
      active: formActive,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'banner_sliders', slideId), slideData, { merge: true });
      setStatusNotice('✅ Slide saved & updated in Firestore!');
      setTimeout(() => setStatusNotice(null), 3000);
      setIsAddingNew(false);
      setEditingSlideId(null);
      if (onSlidesUpdated) onSlidesUpdated();
    } catch (err) {
      console.error('Error saving slide:', err);
      alert('Error saving slide to Firestore!');
    }
  };

  const handleToggleActive = async (slide: BannerSlide) => {
    try {
      await setDoc(doc(db, 'banner_sliders', slide.id), { active: !slide.active }, { merge: true });
      if (onSlidesUpdated) onSlidesUpdated();
    } catch (err) {
      console.error('Error toggling slide active:', err);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Are you sure you want to delete this promotional banner slide?')) return;
    try {
      await deleteDoc(doc(db, 'banner_sliders', slideId));
      setStatusNotice('🗑️ Slide deleted successfully!');
      setTimeout(() => setStatusNotice(null), 3000);
      if (onSlidesUpdated) onSlidesUpdated();
    } catch (err) {
      console.error('Error deleting slide:', err);
    }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 1200, 0.8, 350000);
      setFormImageUrl(compressed.dataUrl);
    } catch (err) {
      console.error('Error compressing banner image:', err);
      alert('ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="space-y-6 font-mono">
      
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 rounded-2xl border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <Image className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>Promotional Banner Sliders Manager</span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Control live auto-sliding promotional banners, offer images, and action links in real-time.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddNew}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Slide</span>
        </button>
      </div>

      {statusNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {(['supercar', 'lottery', 'deposit', 'offers'] as BannerCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategoryFilter(cat);
              setIsAddingNew(false);
              setEditingSlideId(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
              activeCategoryFilter === cat
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{cat === 'supercar' ? '🏎️ Super Car' : cat === 'lottery' ? '🎟️ Lottery' : cat === 'deposit' ? '💰 Deposit' : '🎁 Special Offers'}</span>
          </button>
        ))}
      </div>

      {/* Add / Edit Slide Form */}
      {(isAddingNew || editingSlideId) && (
        <form onSubmit={handleSaveSlide} className="p-5 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{editingSlideId ? 'Edit Banner Slide' : 'Create New Banner Slide'}</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setEditingSlideId(null);
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as BannerCategory)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="supercar">🏎️ Three Super Car</option>
                <option value="lottery">🎟️ Lottery Draws</option>
                <option value="deposit">💰 Deposit Offers</option>
                <option value="offers">🎁 Special Offers</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Action Target</label>
              <select
                value={formActionType}
                onChange={(e) => setFormActionType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="supercar">Open Super Car Section</option>
                <option value="lottery">Open Lottery Section</option>
                <option value="deposit">Open Deposit Modal</option>
                <option value="wheel">Open Lucky Wheel</option>
                <option value="roulette">Open Live Casino</option>
                <option value="withdrawal">Open Withdrawal Section</option>
                <option value="custom_url">Custom Link URL</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Slide Headline Title *</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. 🏎️ 3 Super Car Live VIP Jackpot"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Slide Subtitle / Description</label>
              <input
                type="text"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder="e.g. Win 2.8x payout every 10 minutes!"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                <span>Banner Image (Direct Link URL, 8K Presets, or Upload) *</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                </label>
              </div>

              {/* Quick 8K Banner Presets */}
              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold">8K Presets:</span>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerAviator8k)}
                  className="px-2 py-0.5 bg-rose-950/60 border border-rose-500/30 hover:border-rose-400 text-rose-300 text-[10px] rounded-lg"
                >
                  🚀 Aviator 8K
                </button>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerSupercar8k)}
                  className="px-2 py-0.5 bg-amber-950/60 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-[10px] rounded-lg"
                >
                  🏎️ Super Car 8K
                </button>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerAndarBahar8k)}
                  className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 text-[10px] rounded-lg"
                >
                  🎴 Andar Bahar 8K
                </button>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerDragonTiger8k)}
                  className="px-2 py-0.5 bg-red-950/60 border border-red-500/30 hover:border-red-400 text-red-300 text-[10px] rounded-lg"
                >
                  🐉 Dragon Tiger 8K
                </button>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerLotteryMega8k)}
                  className="px-2 py-0.5 bg-yellow-950/60 border border-yellow-500/30 hover:border-yellow-400 text-yellow-300 text-[10px] rounded-lg"
                >
                  🎟️ Lottery Mega 8K
                </button>
                <button
                  type="button"
                  onClick={() => setFormImageUrl(bannerDepositBonus8k)}
                  className="px-2 py-0.5 bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-[10px] rounded-lg"
                >
                  💰 Deposit Bonus 8K
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Badge Text (e.g. 2.8x MULTIPLIER)</label>
              <input
                type="text"
                value={formBadgeText}
                onChange={(e) => setFormBadgeText(e.target.value)}
                placeholder="PROMO"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Display Order</label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setEditingSlideId(null);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Slide</span>
            </button>
          </div>
        </form>
      )}

      {/* Slide List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSlides.map((slide) => (
          <div
            key={slide.id}
            className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${
              slide.active
                ? 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
                : 'bg-slate-950/70 border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-20 h-16 object-cover rounded-xl border border-slate-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {slide.badgeText || 'PROMO'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Order #{slide.order}</span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{slide.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-1">{slide.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                Action: <span className="text-amber-300">{slide.actionType}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(slide)}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                    slide.active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title={slide.active ? 'Disable Slide' : 'Enable Slide'}
                >
                  {slide.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{slide.active ? 'Active' : 'Disabled'}</span>
                </button>

                <button
                  onClick={() => handleEditSlide(slide)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700"
                  title="Edit Slide"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteSlide(slide.id)}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30"
                  title="Delete Slide"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSlides.length === 0 && (
          <div className="col-span-full p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 text-xs font-mono">
            No custom slides found for {activeCategoryFilter}. Default fallback slides are being shown. Click "Add New Slide" to add custom slides.
          </div>
        )}
      </div>

    </div>
  );
};
