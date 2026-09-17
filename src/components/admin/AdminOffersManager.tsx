import React, { useState, useEffect, useRef } from 'react';
import { 
  Gift, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Flame, 
  Image as ImageIcon, 
  Zap, 
  RefreshCw, 
  Tag, 
  ExternalLink,
  ChevronRight,
  Eye,
  Check,
  Wand2,
  Calendar,
  Layers,
  Copy,
  X,
  AlertTriangle
} from 'lucide-react';
import { PromotionalOffer } from '../../types';
import { DEFAULT_PROMOTIONAL_OFFERS } from '../../data/defaultOffers';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot, getDocs } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';

interface AdminOffersManagerProps {
  onOffersUpdated?: () => void;
}

// Curated HD Casino & Gaming Banner Presets for AI generator
const BANNER_PRESETS = [
  {
    name: 'Gold Casino Luxury',
    url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-amber-600/90 via-yellow-700/80 to-slate-950'
  },
  {
    name: 'Neon Live Roulette',
    url: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-emerald-600/90 via-teal-800/80 to-slate-950'
  },
  {
    name: 'Super Sports Car Red',
    url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-rose-600/90 via-red-900/80 to-slate-950'
  },
  {
    name: 'Lucky VIP Wheel Neon',
    url: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-purple-600/90 via-indigo-900/80 to-slate-950'
  },
  {
    name: 'Cyber Crypto & Jackpot',
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-cyan-600/90 via-blue-900/80 to-slate-950'
  }
];

// 1-Click AI Generation Presets
const AI_OFFER_TEMPLATES = [
  {
    templateName: '🔥 Weekend 100% Deposit Bonus',
    title: '100% Weekend Deposit Blast',
    subtitle: 'সাপ্তাহিক স্পেশাল ডিপোজিটে পান ডাবল ক্যাশ বোনাস',
    description: 'এই শনি ও রবিবারে যেকোনো ₹500 বা তার বেশি ডিপোজিটে পান ইনস্ট্যান্ট 100% বোনাস ব্যালেন্স। সরাসরি সুপার কার ড্র ও লটারিতে ব্যবহারযোগ্য!',
    badgeText: '100% BONUS',
    bonusCode: 'WEEKEND100',
    bonusPercentage: 100,
    minDeposit: 500,
    actionType: 'deposit' as const,
    actionButtonText: 'Claim 100% Bonus',
    durationHours: 48,
    tagColor: 'amber',
    bannerIndex: 0
  },
  {
    templateName: '🎰 Live Casino 20% Cashback',
    title: '20% Instant Live Casino Cashback',
    subtitle: 'ড্রাগন টাইগার, রুলেট ও অন্দর বাহারে আনলিমিটেড ক্যাশব্যাক',
    description: 'লাইভ ক্যাসিনো টেবিলে খেলে প্রতিদিন পান সর্বোচ্চ ২০% ইনস্ট্যান্ট রিফান্ড ক্যাশব্যাক। সরাসরি ওয়ালেটে উইথড্রলযোগ্য টাকা যোগ হবে!',
    badgeText: '20% CASHBACK',
    bonusCode: 'CASINO20',
    bonusPercentage: 20,
    actionType: 'casino' as const,
    actionButtonText: 'Play Live Casino',
    durationHours: 36,
    tagColor: 'emerald',
    bannerIndex: 1
  },
  {
    templateName: '🏎️ Super Car Draw 3+1 Free Ticket Boost',
    title: 'Super Car Draw 3+1 Mega Boost',
    subtitle: '৩টি সুপার কার টিকিট কিনলে ১টি গোল্ডেন টিকিট ফ্রি',
    description: 'লাক্সারি সুপার কার মেগা ড্র-তে যেকোনো ৩টি টিকিট কিনলে সাথে সাথে পাবেন ১টি ভিআইপি গোল্ডেন টিকিট সম্পূর্ণ বিনামূল্যে!',
    badgeText: 'BUY 3 GET 1 FREE',
    bonusCode: 'SUPERCAR',
    bonusAmount: 100,
    actionType: 'supercar' as const,
    actionButtonText: 'Buy SuperCar Tickets',
    durationHours: 24,
    tagColor: 'rose',
    bannerIndex: 2
  },
  {
    templateName: '🎡 Lucky Wheel 3X Free Spin Multiplier',
    title: 'Lucky Wheel 3X VIP Spin Multiplier',
    subtitle: 'লাকি হুইলে ৩ গুণ অতিরিক্ত স্পিন জেতার সুযোগ',
    description: 'যেকোনো ডিপোজিটে লাকি হুইলে সরাসরি ট্রিপল স্পিন ক্রেডিট উপহার পাবেন। সর্বোচ্চ ₹10,000 পর্যন্ত নিশ্চিত ক্যাশ প্রাইজ!',
    badgeText: '3X SPINS',
    bonusCode: 'WHEEL3X',
    actionType: 'wheel' as const,
    actionButtonText: 'Spin Lucky Wheel',
    durationHours: 18,
    tagColor: 'purple',
    bannerIndex: 3
  },
  {
    templateName: '⚡ Flash 200% Midnight Booster',
    title: 'Flash 200% Midnight Super Bonus',
    subtitle: 'সীমিত সময়ের জন্য ২০০% মেগা বোনাস অফার',
    description: 'মাত্র কয়েক ঘণ্টার জন্য সক্রিয়! যেকোনো ডিপোজিটে পান অবিশ্বাস্য 200% ক্যাশ ব্যাক বোনাস। সময় শেষ হওয়ার আগেই ক্লেইম করুন!',
    badgeText: '200% FLASH BONUS',
    bonusCode: 'FLASH200',
    bonusPercentage: 200,
    minDeposit: 300,
    actionType: 'deposit' as const,
    actionButtonText: 'Claim 200% Flash Bonus',
    durationHours: 6,
    tagColor: 'amber',
    bannerIndex: 4
  }
];

export const AdminOffersManager: React.FC<AdminOffersManagerProps> = ({ onOffersUpdated }) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [offersList, setOffersList] = useState<PromotionalOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // In-app custom delete confirmation modal state (bypasses iframe confirm() block)
  const [offerToDelete, setOfferToDelete] = useState<PromotionalOffer | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>(BANNER_PRESETS[0].url);
  const [formBadgeText, setFormBadgeText] = useState<string>('SPECIAL OFFER');
  const [formTagColor, setFormTagColor] = useState<string>('amber');
  const [formBonusCode, setFormBonusCode] = useState<string>('');
  const [formBonusPercentage, setFormBonusPercentage] = useState<string>('');
  const [formMinDeposit, setFormMinDeposit] = useState<string>('');
  const [formActionType, setFormActionType] = useState<PromotionalOffer['actionType']>('deposit');
  const [formActionButtonText, setFormActionButtonText] = useState<string>('Claim Offer');
  const [formTargetUrl, setFormTargetUrl] = useState<string>('');
  const [formDurationHours, setFormDurationHours] = useState<number>(24);
  const [formCustomExpiry, setFormCustomExpiry] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formIsFeatured, setFormIsFeatured] = useState<boolean>(false);
  const [formBgGradient, setFormBgGradient] = useState<string>(BANNER_PRESETS[0].gradient);
  const [formOriginalCreatedAt, setFormOriginalCreatedAt] = useState<string>('');

  // AI Prompt custom input
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Real-time Firestore sync with promotional_offers collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'promotional_offers'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: PromotionalOffer[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          // Sort by creation date or active
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setOffersList(list);
        } else {
          // If Firestore collection has no documents, use default list
          setOffersList(DEFAULT_PROMOTIONAL_OFFERS);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Error fetching promotional offers snapshot:', error);
        setOffersList(DEFAULT_PROMOTIONAL_OFFERS);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Quick 1-Click AI Generation from Template
  const handleApplyAiTemplate = (template: typeof AI_OFFER_TEMPLATES[0]) => {
    soundFx.playClick();
    setIsAiGenerating(true);

    setTimeout(() => {
      setFormTitle(template.title);
      setFormSubtitle(template.subtitle);
      setFormDescription(template.description);
      setFormBadgeText(template.badgeText);
      setFormBonusCode(template.bonusCode);
      setFormBonusPercentage(template.bonusPercentage ? template.bonusPercentage.toString() : '');
      setFormMinDeposit(template.minDeposit ? template.minDeposit.toString() : '');
      setFormActionType(template.actionType);
      setFormActionButtonText(template.actionButtonText);
      setFormDurationHours(template.durationHours);
      setFormTagColor(template.tagColor);

      const banner = BANNER_PRESETS[template.bannerIndex] || BANNER_PRESETS[0];
      setFormImageUrl(banner.url);
      setFormBgGradient(banner.gradient);

      // Set expiry ISO datetime
      const expiry = new Date(Date.now() + template.durationHours * 60 * 60 * 1000);
      setFormCustomExpiry(expiry.toISOString().slice(0, 16));

      setIsAddingNew(true);
      setEditingOfferId(null);
      setFormOriginalCreatedAt(new Date().toISOString());
      setIsAiGenerating(false);

      setStatusNotice(`✨ এআই প্রমো অফার: "${template.title}" তৈরি হয়েছে! নিচের ফর্মটি চেক করে Save বাটনে চাপুন।`);
      
      // Auto-scroll to form
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      setTimeout(() => setStatusNotice(null), 5000);
    }, 300);
  };

  // Custom AI Generation from Text Prompt
  const handleCustomAiGenerate = () => {
    if (!aiCustomPrompt.trim()) {
      setStatusNotice('⚠️ অনুগ্রহ করে একটি প্রম্পট লিখুন (যেমন: 50% ডিপোজিট ক্যাশব্যাক অফার 12 ঘণ্টার জন্য)');
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    soundFx.playClick();
    setIsAiGenerating(true);

    setTimeout(() => {
      const prompt = aiCustomPrompt.toLowerCase();
      let generatedTitle = 'Special Limited Bonus Deal';
      let generatedSubtitle = 'এক্সক্লুসিভ বোনাস ও ক্যাশব্যাক অফার';
      let generatedDesc = `আমাদের প্ল্যাটফর্মের বিশেষ প্রমোশনাল অফার: ${aiCustomPrompt}। এখনই ক্লেইম করুন ও জিতে নিন আকর্ষণীয় পুরস্কার!`;
      let generatedCode = 'BONUS' + Math.floor(100 + Math.random() * 900);
      let badge = 'HOT DEAL';
      let hours = 24;
      let action: PromotionalOffer['actionType'] = 'deposit';
      let banner = BANNER_PRESETS[0];
      let bonusPct = '50';
      let minDep = '500';

      if (prompt.includes('casino') || prompt.includes('ক্যাসিনো') || prompt.includes('রুলেট') || prompt.includes('ড্রাগন')) {
        generatedTitle = 'Live Casino Cashback Super Boost';
        generatedSubtitle = 'লাইভ ক্যাসিনোয় আনলিমিটেড ক্যাশব্যাক অফার';
        badge = 'CASINO REWARD';
        action = 'casino';
        banner = BANNER_PRESETS[1];
        bonusPct = '20';
      } else if (prompt.includes('supercar') || prompt.includes('কার') || prompt.includes('লটারি') || prompt.includes('ড্র')) {
        generatedTitle = 'Super Car Lucky Draw Ticket Boost';
        generatedSubtitle = 'সুপার কার ড্র টিকিটে ৫০% অতিরিক্ত বোনাস';
        badge = 'SUPERCAR BOOST';
        action = 'supercar';
        banner = BANNER_PRESETS[2];
      } else if (prompt.includes('wheel') || prompt.includes('হুইল') || prompt.includes('স্পিন')) {
        generatedTitle = 'Lucky Wheel Free Spin Frenzy';
        generatedSubtitle = 'লাকি হুইল স্পিনে নিশ্চিত বড় ক্যাশ প্রাইজ';
        badge = 'FREE SPINS';
        action = 'wheel';
        banner = BANNER_PRESETS[3];
      } else if (prompt.includes('flash') || prompt.includes('ফ্ল্যাশ') || prompt.includes('midnight') || prompt.includes('রাত')) {
        generatedTitle = 'Flash Midnight Super Booster';
        generatedSubtitle = 'সীমিত সময়ের জন্য বিশেষ ফ্ল্যাশ অফার';
        hours = 6;
        badge = '⚡ FLASH DEAL';
        bonusPct = '100';
      }

      setFormTitle(generatedTitle);
      setFormSubtitle(generatedSubtitle);
      setFormDescription(generatedDesc);
      setFormBadgeText(badge);
      setFormBonusCode(generatedCode);
      setFormBonusPercentage(bonusPct);
      setFormMinDeposit(minDep);
      setFormActionType(action);
      setFormDurationHours(hours);
      setFormImageUrl(banner.url);
      setFormBgGradient(banner.gradient);

      const expiry = new Date(Date.now() + hours * 60 * 60 * 1000);
      setFormCustomExpiry(expiry.toISOString().slice(0, 16));

      setIsAddingNew(true);
      setEditingOfferId(null);
      setFormOriginalCreatedAt(new Date().toISOString());
      setIsAiGenerating(false);

      setStatusNotice('✨ আপনার প্রম্পট অনুযায়ী এআই প্রমোশনাল অফার তৈরি হয়েছে!');
      
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      setTimeout(() => setStatusNotice(null), 4000);
    }, 500);
  };

  const handleOpenAddNew = () => {
    soundFx.playClick();
    setIsAddingNew(true);
    setEditingOfferId(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormDescription('');
    setFormImageUrl(BANNER_PRESETS[0].url);
    setFormBadgeText('SPECIAL OFFER');
    setFormTagColor('amber');
    setFormBonusCode('BONUS' + Math.floor(100 + Math.random() * 900));
    setFormBonusPercentage('');
    setFormMinDeposit('500');
    setFormActionType('deposit');
    setFormActionButtonText('Claim Offer');
    setFormTargetUrl('');
    setFormDurationHours(24);
    setFormActive(true);
    setFormIsFeatured(false);
    setFormBgGradient(BANNER_PRESETS[0].gradient);
    setFormOriginalCreatedAt(new Date().toISOString());

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setFormCustomExpiry(expiry.toISOString().slice(0, 16));

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // EDIT EXISTING OFFER
  const handleEditOffer = (offer: PromotionalOffer) => {
    soundFx.playClick();
    setIsAddingNew(false);
    setEditingOfferId(offer.id);
    setFormTitle(offer.title || '');
    setFormSubtitle(offer.subtitle || '');
    setFormDescription(offer.description || '');
    setFormImageUrl(offer.imageUrl || BANNER_PRESETS[0].url);
    setFormBadgeText(offer.badgeText || 'SPECIAL OFFER');
    setFormTagColor(offer.tagColor || 'amber');
    setFormBonusCode(offer.bonusCode || '');
    setFormBonusPercentage(offer.bonusPercentage ? offer.bonusPercentage.toString() : '');
    setFormMinDeposit(offer.minDeposit ? offer.minDeposit.toString() : '');
    setFormActionType(offer.actionType || 'deposit');
    setFormActionButtonText(offer.actionButtonText || 'Claim Offer');
    setFormTargetUrl(offer.targetUrl || '');
    setFormDurationHours(offer.durationHours || 24);
    setFormActive(offer.active !== false);
    setFormIsFeatured(offer.isFeatured || false);
    setFormBgGradient(offer.bgGradient || BANNER_PRESETS[0].gradient);
    setFormOriginalCreatedAt(offer.createdAt || new Date().toISOString());

    if (offer.expiresAt) {
      try {
        const expDate = new Date(offer.expiresAt);
        if (!isNaN(expDate.getTime())) {
          setFormCustomExpiry(expDate.toISOString().slice(0, 16));
        } else {
          setFormCustomExpiry('');
        }
      } catch {
        setFormCustomExpiry('');
      }
    } else {
      const defaultExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setFormCustomExpiry(defaultExp.toISOString().slice(0, 16));
    }

    setStatusNotice(`✏️ সম্পাদনা মোড সক্রিয়: "${offer.title}" (ফর্ম নিচে দেখতে স্ক্রোল করুন)`);
    setTimeout(() => setStatusNotice(null), 4000);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // DUPLICATE EXISTING OFFER
  const handleDuplicateOffer = (offer: PromotionalOffer) => {
    soundFx.playClick();
    setIsAddingNew(true);
    setEditingOfferId(null);
    setFormTitle(`${offer.title} (Copy)`);
    setFormSubtitle(offer.subtitle || '');
    setFormDescription(offer.description || '');
    setFormImageUrl(offer.imageUrl);
    setFormBadgeText(offer.badgeText || 'SPECIAL OFFER');
    setFormTagColor(offer.tagColor || 'amber');
    setFormBonusCode((offer.bonusCode || 'BONUS') + '_2');
    setFormBonusPercentage(offer.bonusPercentage ? offer.bonusPercentage.toString() : '');
    setFormMinDeposit(offer.minDeposit ? offer.minDeposit.toString() : '');
    setFormActionType(offer.actionType);
    setFormActionButtonText(offer.actionButtonText || 'Claim Offer');
    setFormTargetUrl(offer.targetUrl || '');
    setFormDurationHours(offer.durationHours || 24);
    setFormActive(true);
    setFormIsFeatured(false);
    setFormBgGradient(offer.bgGradient || BANNER_PRESETS[0].gradient);
    setFormOriginalCreatedAt(new Date().toISOString());

    const expiry = new Date(Date.now() + (offer.durationHours || 24) * 60 * 60 * 1000);
    setFormCustomExpiry(expiry.toISOString().slice(0, 16));

    setStatusNotice(`📋 অফারটি কপি করা হয়েছে! প্রয়োজনীয় পরিবর্তন করে সেভ করুন।`);
    setTimeout(() => setStatusNotice(null), 4000);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // SAVE & PUBLISH OFFER TO FIRESTORE
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setStatusNotice('⚠️ অফার টাইটেল অবশ্যই পূরণ করতে হবে!');
      setTimeout(() => setStatusNotice(null), 3000);
      return;
    }
    if (!formImageUrl.trim()) {
      setStatusNotice('⚠️ ব্যানার ছবির URL অবশ্যই দিতে হবে!');
      setTimeout(() => setStatusNotice(null), 3000);
      return;
    }

    setIsSaving(true);
    const offerId = editingOfferId || `offer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let expiresAt = new Date(Date.now() + formDurationHours * 60 * 60 * 1000).toISOString();
    if (formCustomExpiry) {
      try {
        const parsed = new Date(formCustomExpiry).toISOString();
        if (parsed) expiresAt = parsed;
      } catch {
        // fallback
      }
    }

    const offerData: PromotionalOffer = {
      id: offerId,
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      description: formDescription.trim(),
      imageUrl: formImageUrl.trim(),
      badgeText: formBadgeText.trim(),
      tagColor: formTagColor,
      bonusCode: formBonusCode.trim(),
      bonusPercentage: formBonusPercentage ? parseFloat(formBonusPercentage) : undefined,
      minDeposit: formMinDeposit ? parseFloat(formMinDeposit) : undefined,
      actionType: formActionType,
      actionButtonText: formActionButtonText.trim(),
      targetUrl: formTargetUrl.trim(),
      expiresAt: expiresAt,
      durationHours: formDurationHours,
      active: formActive,
      isFeatured: formIsFeatured,
      bgGradient: formBgGradient,
      createdAt: formOriginalCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'promotional_offers', offerId), offerData, { merge: true });
      soundFx.playCoin();
      
      // Update local list instantly as well
      setOffersList((prev) => {
        const exists = prev.some((o) => o.id === offerId);
        if (exists) {
          return prev.map((o) => (o.id === offerId ? offerData : o));
        } else {
          return [offerData, ...prev];
        }
      });

      setStatusNotice(editingOfferId ? '✅ অফারটি সফলভাবে আপডেট করা হয়েছে!' : '✅ নতুন প্রমোশনাল অফার সফলভাবে পাবলিশ করা হয়েছে!');
      setTimeout(() => setStatusNotice(null), 4000);

      setIsAddingNew(false);
      setEditingOfferId(null);
      if (onOffersUpdated) onOffersUpdated();
    } catch (err: any) {
      console.error('Error saving promotional offer to Firestore:', err);
      setStatusNotice(`❌ সেভ করতে সমস্যা হয়েছে: ${err.message || 'Error'}`);
      setTimeout(() => setStatusNotice(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // IN-APP DELETE OFFER (Triggers safe confirmation modal)
  const handleRequestDelete = (offer: PromotionalOffer) => {
    soundFx.playClick();
    setOfferToDelete(offer);
  };

  // EXECUTE CONFIRMED DELETE
  const handleConfirmDelete = async () => {
    if (!offerToDelete) return;
    setIsDeleting(true);

    try {
      const offerId = offerToDelete.id;
      await deleteDoc(doc(db, 'promotional_offers', offerId));
      soundFx.playClick();
      
      // Remove from state immediately
      setOffersList((prev) => prev.filter((o) => o.id !== offerId));
      
      // If we were editing this offer, close the edit form
      if (editingOfferId === offerId) {
        setIsAddingNew(false);
        setEditingOfferId(null);
      }

      setStatusNotice(`🗑️ অফার "${offerToDelete.title}" সফলভাবে ডিলিট করা হয়েছে!`);
      setTimeout(() => setStatusNotice(null), 3500);

      if (onOffersUpdated) onOffersUpdated();
    } catch (err: any) {
      console.error('Error deleting offer from Firestore:', err);
      setStatusNotice(`❌ ডিলিট করতে সমস্যা হয়েছে: ${err.message || 'Error'}`);
      setTimeout(() => setStatusNotice(null), 4000);
    } finally {
      setIsDeleting(false);
      setOfferToDelete(null);
    }
  };

  // TOGGLE ACTIVE STATUS
  const handleToggleActive = async (offer: PromotionalOffer) => {
    try {
      const updated = !offer.active;
      await setDoc(doc(db, 'promotional_offers', offer.id), { active: updated, updatedAt: new Date().toISOString() }, { merge: true });
      soundFx.playClick();
      setOffersList((prev) => prev.map((o) => (o.id === offer.id ? { ...o, active: updated } : o)));
      setStatusNotice(`অফার স্ট্যাটাস: ${updated ? 'Active (চালু)' : 'Disabled (বন্ধ)'}`);
      setTimeout(() => setStatusNotice(null), 2500);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // SEED / SYNC ALL DEFAULT OFFERS TO DATABASE
  const handleSeedDefaults = async () => {
    soundFx.playClick();
    setIsSaving(true);
    try {
      for (const offer of DEFAULT_PROMOTIONAL_OFFERS) {
        await setDoc(doc(db, 'promotional_offers', offer.id), {
          ...offer,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      soundFx.playCoin();
      setStatusNotice('✅ সমস্ত ডিফল্ট অফার ডাটাবেজে রিস্টোর ও সিঙ্ক করা হয়েছে!');
      setTimeout(() => setStatusNotice(null), 4000);
      if (onOffersUpdated) onOffersUpdated();
    } catch (err: any) {
      console.error('Error seeding defaults:', err);
      setStatusNotice(`❌ সিঙ্ক ত্রুটি: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 border border-amber-500/30 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
            <Gift className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>OFFERS & AI PROMO GENERATOR</span>
              </h2>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {offersList.length} OFFERS
              </span>
            </div>
            <p className="text-xs text-amber-300/90 font-medium">
              ১ ক্লিকে এআই দিয়ে প্রমোশনাল ব্যানার অফার তৈরি, এডিট, লাইভ কাউন্টডাউন ও নিয়ন্ত্রণ করুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSeedDefaults}
            disabled={isSaving}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Reset or Sync default offers to database"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync Defaults</span>
          </button>

          <button
            onClick={handleOpenAddNew}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Custom Offer</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusNotice}</span>
          </div>
          <button 
            onClick={() => setStatusNotice(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1-CLICK AI PROMOTIONAL GENERATOR SECTION */}
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
              ⚡ 1-Click AI Promotional Generator (ইনস্ট্যান্ট এআই ব্যানার ও অফার)
            </h3>
          </div>
          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
            AUTO COUNTDOWN
          </span>
        </div>

        <p className="text-xs text-slate-300">
          নিচের যেকোনো প্রিসেট কার্ডে ক্লিক করলেই টাইটেল, বাংলা সাবটাইটেল, এইচডি ব্যানার ও কাউন্টডাউন টাইম সহ অফারটি রেডি হয়ে যাবে:
        </p>

        {/* 1-Click Preset Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {AI_OFFER_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyAiTemplate(tmpl)}
              disabled={isAiGenerating}
              className="p-3 bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                  {tmpl.templateName}
                </span>
                <span className="text-[9px] bg-slate-800 text-amber-400 font-bold px-1.5 py-0.5 rounded-full font-mono">
                  ⏳ {tmpl.durationHours}h
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                {tmpl.subtitle}
              </p>
              <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-900 text-slate-500 group-hover:text-amber-400 font-bold">
                <span>Code: {tmpl.bonusCode}</span>
                <span className="flex items-center gap-0.5">
                  <span>Generate</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Text Prompt Input */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={aiCustomPrompt}
            onChange={(e) => setAiCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomAiGenerate();
              }
            }}
            placeholder="অথবা কাস্টম এআই প্রম্পট লিখুন: যেমন '50% লাইভ ক্যাসিনো বোনাস ১২ ঘণ্টার জন্য'..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={handleCustomAiGenerate}
            disabled={isAiGenerating}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAiGenerating ? 'Generating...' : 'Generate with AI'}</span>
          </button>
        </div>
      </div>

      {/* CREATE / EDIT OFFER FORM MODAL / SECTION */}
      {(isAddingNew || editingOfferId) && (
        <div 
          ref={formRef}
          className={`bg-slate-900 border-2 rounded-3xl p-5 space-y-4 shadow-2xl animate-in fade-in transition-all duration-300 ${
            editingOfferId ? 'border-amber-400 ring-2 ring-amber-500/30' : 'border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                {editingOfferId ? <Edit3 className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>{editingOfferId ? 'Edit Promotional Offer' : 'Create New Promotional Offer'}</span>
                  {editingOfferId && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                      Editing Mode
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {editingOfferId ? 'অফারের তথ্য পরিবর্তন করে নিচের সেভ বাটনে চাপুন।' : 'নতুন অফারের বিবরণ প্রদান করে পাবলিশ করুন।'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsAddingNew(false);
                setEditingOfferId(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer flex items-center gap-1 transition"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>

          <form onSubmit={handleSaveOffer} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Title */}
              <div>
                <label className="font-bold text-slate-300 mb-1 block">
                  Offer Title (ইংরেজি টাইটেল) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 100% Mega Welcome Bonus"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white outline-none"
                  required
                />
              </div>

              {/* Subtitle / Bengali */}
              <div>
                <label className="font-bold text-slate-300 mb-1 block">
                  Subtitle (বাংলা সাবটাইটেল)
                </label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="যেমন: ডিপোজিটে পান ১০০% অতিরিক্ত বোনাস ব্যালেন্স"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-bold text-slate-300 mb-1 block">
                Detailed Terms & Description (শর্ত ও অফার বিস্তারিত)
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="নূন্যতম ₹500 ডিপোজিটে পান 100% বোনাস ক্যাশ..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-white outline-none"
              />
            </div>

            {/* Image URL & Preset Picker */}
            <div>
              <label className="font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>Promotional Banner Photo (ব্যানার ফটো URL) <span className="text-rose-400">*</span></span>
                <span className="text-slate-400 text-[10px]">নিচের এইচডি প্রিসেট সিলেক্ট করুন অথবা নিজস্ব লিঙ্ক দিন</span>
              </label>
              <input
                type="url"
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-white outline-none mb-2"
                required
              />

              {/* Quick Preset Banner Images */}
              <div className="flex flex-wrap gap-2">
                {BANNER_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormImageUrl(p.url);
                      setFormBgGradient(p.gradient);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      formImageUrl === p.url
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* COUNTDOWN TIMER SETTINGS */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Clock className="w-4 h-4" />
                <span>Countdown Expiry Settings (কাউন্টডাউন টাইম সেট করুন)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    Quick Preset Duration (কাউন্টডাউন সময়)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[2, 6, 12, 24, 36, 48, 72, 168].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => {
                          setFormDurationHours(hrs);
                          const exp = new Date(Date.now() + hrs * 60 * 60 * 1000);
                          setFormCustomExpiry(exp.toISOString().slice(0, 16));
                        }}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          formDurationHours === hrs
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        +{hrs >= 24 ? `${hrs / 24}d` : `${hrs}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">
                    Custom Expiry Date/Time (নির্দিষ্ট তারিখ ও সময়)
                  </label>
                  <input
                    type="datetime-local"
                    value={formCustomExpiry}
                    onChange={(e) => setFormCustomExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Badges & Action Target */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-300 mb-1 block">Badge Tag (যেমন: 100% BONUS)</label>
                <input
                  type="text"
                  value={formBadgeText}
                  onChange={(e) => setFormBadgeText(e.target.value)}
                  placeholder="e.g. 100% BONUS"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 mb-1 block">Promo Code (প্রোমো কোড)</label>
                <input
                  type="text"
                  value={formBonusCode}
                  onChange={(e) => setFormBonusCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-bold outline-none uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 mb-1 block">Action Target (ক্লিক করলে কোথায় যাবে)</label>
                <select
                  value={formActionType}
                  onChange={(e) => setFormActionType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="deposit">Deposit Modal (ডিপোজিট)</option>
                  <option value="casino">Live Casino (লাইভ ক্যাসিনো)</option>
                  <option value="supercar">Super Car Draw (সুপার কার ড্র)</option>
                  <option value="lottery">Lottery Section (লটারি ড্র)</option>
                  <option value="wheel">Lucky Wheel (লাকি হুইল)</option>
                  <option value="custom_url">External URL</option>
                </select>
              </div>
            </div>

            {/* Additional Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="font-bold text-slate-300 mb-1 block">Bonus % (ঐচ্ছিক)</label>
                <input
                  type="number"
                  value={formBonusPercentage}
                  onChange={(e) => setFormBonusPercentage(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 mb-1 block">Min Deposit ₹ (নূন্যতম ডিপোজিট)</label>
                <input
                  type="number"
                  value={formMinDeposit}
                  onChange={(e) => setFormMinDeposit(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 mb-1 block">Button Text (বাটনের লেখা)</label>
                <input
                  type="text"
                  value={formActionButtonText}
                  onChange={(e) => setFormActionButtonText(e.target.value)}
                  placeholder="e.g. Claim 100% Bonus"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
            </div>

            {/* Active & Featured Flags */}
            <div className="flex items-center gap-6 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-bold">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span>Active (প্লেয়ারদের জন্য সক্রিয় থাকবে)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-bold">
                <input
                  type="checkbox"
                  checked={formIsFeatured}
                  onChange={(e) => setFormIsFeatured(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <span>Featured Offer (টপে হাইলাইট থাকবে)</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setIsAddingNew(false);
                  setEditingOfferId(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : editingOfferId ? 'Save Changes (পরিবর্তন সেভ করুন)' : 'Publish Live Offer'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ACTIVE OFFERS LIST TABLE & CARDS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-black text-white">
              Currently Active Live Offers ({offersList.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-sans">
            Real-time synced with All Players
          </span>
        </div>

        {offersList.length === 0 ? (
          <div className="p-10 text-center space-y-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <Gift className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs font-bold">
              বর্তমানে কোনো অফার তালিকাভুক্ত নেই।
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleSeedDefaults}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Restore Default Offers
              </button>
              <button
                onClick={handleOpenAddNew}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer"
              >
                + Create Offer
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {offersList.map((offer) => {
              const expTime = new Date(offer.expiresAt).getTime();
              const isExpired = !isNaN(expTime) && expTime < Date.now();
              const isCurrentlyEditing = editingOfferId === offer.id;

              return (
                <div
                  key={offer.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 relative ${
                    isCurrentlyEditing
                      ? 'bg-amber-950/30 border-amber-400 ring-2 ring-amber-500/40 shadow-xl'
                      : offer.active && !isExpired
                      ? 'bg-slate-950 border-slate-800 hover:border-amber-500/40 hover:shadow-lg'
                      : 'bg-slate-950/50 border-rose-900/30 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={offer.imageUrl}
                      alt={offer.title}
                      className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-800"
                    />
                    <div className="space-y-1 overflow-hidden flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">{offer.title}</span>
                        {offer.badgeText && (
                          <span className="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                            {offer.badgeText}
                          </span>
                        )}
                        {isExpired && (
                          <span className="bg-rose-500/20 text-rose-300 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                            EXPIRED
                          </span>
                        )}
                        {isCurrentlyEditing && (
                          <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded font-mono animate-pulse">
                            EDITING
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-1">
                        {offer.subtitle || offer.description}
                      </p>
                      
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-3 pt-0.5">
                        {offer.bonusCode && (
                          <span className="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-900/60">
                            Code: {offer.bonusCode}
                          </span>
                        )}
                        <span>⏳ {offer.durationHours || 24}h</span>
                      </div>

                      <div className="text-[9px] text-slate-500 font-mono">
                        Expires: {new Date(offer.expiresAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                    {/* Active Status Switch Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(offer)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer transition ${
                        offer.active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {offer.active ? '● Active' : '○ Disabled'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* Duplicate Button */}
                      <button
                        type="button"
                        onClick={() => handleDuplicateOffer(offer)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Duplicate Offer (কপি করুন)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleEditOffer(offer)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                        title="Edit Offer (এডিট করুন)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Button (Opens custom confirm modal) */}
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(offer)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                        title="Delete Offer (ডিলিট করুন)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CUSTOM IN-APP DELETE CONFIRMATION MODAL */}
      {offerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-slate-900 border border-rose-500/40 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Delete Promotional Offer?</h4>
                <p className="text-xs text-slate-400">এই অফারটি কি নিশ্চিতভাবে ডিলিট করতে চান?</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
              <img 
                src={offerToDelete.imageUrl} 
                alt={offerToDelete.title} 
                className="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0" 
              />
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-white truncate">{offerToDelete.title}</h5>
                <p className="text-[11px] text-slate-400 truncate">{offerToDelete.subtitle || offerToDelete.description}</p>
                <span className="text-[10px] text-amber-400 font-mono">Code: {offerToDelete.bonusCode || 'N/A'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              ডিলিট করলে এই অফারটি ডাটাবেজ থেকে মুছে যাবে এবং সমস্ত ইউজারের অফার পেজ থেকে সাথে সাথে চলে যাবে।
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setOfferToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition"
              >
                Cancel (বাতিল)
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Offer (মুছে ফেলুন)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
