import { PromotionalOffer } from '../types';
import {
  bannerDepositBonus8k,
  bannerDragonTiger8k,
  bannerSupercar8k,
  bannerRoulette8k
} from '../assets/sliderBanners';

export const DEFAULT_PROMOTIONAL_OFFERS: PromotionalOffer[] = [
  {
    id: 'offer-100-deposit',
    title: '100% Mega Welcome Bonus',
    subtitle: 'ডিপোজিটে পান ১০০% অতিরিক্ত বোনাস ব্যালেন্স',
    description: 'নূন্যতম ₹500 ডিপোজিটে পান 100% বোনাস ক্যাশ। বোনাস দিয়ে সরাসরি থ্রি সুপার কার ড্র টিকিট কিনুন ও জিতে নিন আকর্ষণীয় পুরস্কার!',
    imageUrl: bannerDepositBonus8k,
    badgeText: '100% BONUS',
    tagColor: 'amber',
    bonusCode: 'WELCOME100',
    bonusPercentage: 100,
    minDeposit: 500,
    actionType: 'deposit',
    actionButtonText: 'Claim 100% Bonus',
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
    durationHours: 48,
    active: true,
    isFeatured: true,
    bgGradient: 'from-amber-600/90 via-yellow-700/80 to-slate-950',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-casino-cashback',
    title: '20% Live Casino Weekend Cashback',
    subtitle: 'লাইভ ক্যাসিনোয় আনলিমিটেড ক্যাশব্যাক অফার',
    description: 'ড্রাগন টাইগার, লাইভ রুলেট, এভিয়েটর এবং অন্দর বাহার টেবিলে প্রতিটি গেমে পান সর্বোচ্চ ২০% ইনস্ট্যান্ট রিফান্ড ক্যাশব্যাক। কোনো ওয়েজারিং নেই!',
    imageUrl: bannerDragonTiger8k,
    badgeText: '20% CASHBACK',
    tagColor: 'emerald',
    bonusCode: 'CASINO20',
    bonusPercentage: 20,
    actionType: 'casino',
    actionButtonText: 'Play Live Casino',
    expiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(), // 36 hours from now
    durationHours: 36,
    active: true,
    isFeatured: true,
    bgGradient: 'from-emerald-600/90 via-teal-800/80 to-slate-950',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-supercar-special',
    title: 'Super Car Draw 50% Ticket Boost',
    subtitle: 'লাক্সারি সুপার কার ড্র-তে ৫০% অতিরিক্ত উইনিং পাওয়ার',
    description: 'যেকোনো ৩টি সুপার কার টিকিট কিনলে পাবেন ১টি লাকি গোল্ডেন টিকিট সম্পূর্ণ ফ্রি! প্রতিদিনের জ্যাকপট কোটিপতি হওয়ার সুযোগ।',
    imageUrl: bannerSupercar8k,
    badgeText: 'BUY 3 GET 1 FREE',
    tagColor: 'rose',
    bonusCode: 'SUPERCAR',
    bonusAmount: 100,
    actionType: 'supercar',
    actionButtonText: 'Buy SuperCar Tickets',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    durationHours: 24,
    active: true,
    isFeatured: false,
    bgGradient: 'from-rose-600/90 via-red-900/80 to-slate-950',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-vip-wheel',
    title: 'VIP Lucky Wheel 3X Spin Multiplier',
    subtitle: 'লাকি হুইলে ৩ গুণ অতিরিক্ত স্পিন জেতার সুযোগ',
    description: 'আজকের যেকোনো ডিপোজিটে লাকি হুইলে সরাসরি ট্রিপল স্পিন ক্রেডিট উপহার পাবেন। সর্বোচ্চ ₹10,000 ক্যাশ প্রাইজ জেতার নিশ্চয়তা।',
    imageUrl: bannerRoulette8k,
    badgeText: '3X SPINS',
    tagColor: 'purple',
    bonusCode: 'WHEEL3X',
    actionType: 'wheel',
    actionButtonText: 'Spin Lucky Wheel',
    expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 18 hours from now
    durationHours: 18,
    active: true,
    isFeatured: false,
    bgGradient: 'from-purple-600/90 via-indigo-900/80 to-slate-950',
    createdAt: new Date().toISOString()
  }
];
