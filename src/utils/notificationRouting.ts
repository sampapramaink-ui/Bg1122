import { NotificationItem } from '../types';

export type NotificationActionType =
  | 'deposit'
  | 'withdrawal'
  | 'lottery'
  | 'supercar'
  | 'crash'
  | 'roulette'
  | 'dragon_tiger'
  | 'andar_bahar'
  | 'lucky_wheel'
  | 'offers'
  | 'tickets'
  | 'results'
  | 'history'
  | 'profile'
  | 'support'
  | 'settings'
  | 'app_update';

export interface NotificationDestinationInfo {
  actionType: NotificationActionType;
  labelBn: string;
  labelEn: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  category: 'wallet' | 'game' | 'promotion' | 'account' | 'support' | 'results';
}

/**
 * Intelligent Smart-Resolver to map any NotificationItem (by type, title, message, priority, or metadata)
 * directly to the exact target destination/screen/modal in the application.
 */
export function resolveNotificationDestination(ntf: NotificationItem): NotificationDestinationInfo {
  const title = (ntf.title || '').toLowerCase();
  const message = (ntf.message || '').toLowerCase();
  const priority = (ntf.priority || '').toLowerCase();
  const explicitAction = ntf.actionType;
  const combined = `${title} ${message} ${priority}`;

  // 1. Explicit Action Type Override (if defined)
  if (explicitAction) {
    switch (explicitAction) {
      case 'deposit':
        return {
          actionType: 'deposit',
          labelBn: 'ডিপোজিট পেইজে যান',
          labelEn: 'Go to Deposit',
          badgeBg: 'bg-emerald-500/15',
          badgeText: 'text-emerald-300',
          badgeBorder: 'border-emerald-500/30',
          category: 'wallet'
        };
      case 'withdrawal':
        return {
          actionType: 'withdrawal',
          labelBn: 'উইথড্রয়াল পেইজে যান',
          labelEn: 'Go to Withdrawal',
          badgeBg: 'bg-amber-500/15',
          badgeText: 'text-amber-300',
          badgeBorder: 'border-amber-500/30',
          category: 'wallet'
        };
      case 'supercar':
        return {
          actionType: 'supercar',
          labelBn: 'সুপার কার ড্রোতে যান',
          labelEn: 'Super Car Draw',
          badgeBg: 'bg-rose-500/15',
          badgeText: 'text-rose-300',
          badgeBorder: 'border-rose-500/30',
          category: 'game'
        };
      case 'crash':
        return {
          actionType: 'crash',
          labelBn: 'এভিয়েটর খেলুন',
          labelEn: 'Play Aviator Crash',
          badgeBg: 'bg-rose-500/15',
          badgeText: 'text-rose-300',
          badgeBorder: 'border-rose-500/30',
          category: 'game'
        };
      case 'roulette':
        return {
          actionType: 'roulette',
          labelBn: 'লাইভ রুলেট খেলুন',
          labelEn: 'Play Live Roulette',
          badgeBg: 'bg-yellow-500/15',
          badgeText: 'text-yellow-300',
          badgeBorder: 'border-yellow-500/30',
          category: 'game'
        };
      case 'dragon_tiger':
        return {
          actionType: 'dragon_tiger',
          labelBn: 'ড্রাগন টাইগার খেলুন',
          labelEn: 'Play Dragon Tiger',
          badgeBg: 'bg-red-500/15',
          badgeText: 'text-red-300',
          badgeBorder: 'border-red-500/30',
          category: 'game'
        };
      case 'andar_bahar':
        return {
          actionType: 'andar_bahar',
          labelBn: 'আন্দার বাহার খেলুন',
          labelEn: 'Play Andar Bahar',
          badgeBg: 'bg-teal-500/15',
          badgeText: 'text-teal-300',
          badgeBorder: 'border-teal-500/30',
          category: 'game'
        };
      case 'lucky_wheel':
        return {
          actionType: 'lucky_wheel',
          labelBn: 'লাকি হুইল স্পিন করুন',
          labelEn: 'Spin Lucky Wheel',
          badgeBg: 'bg-purple-500/15',
          badgeText: 'text-purple-300',
          badgeBorder: 'border-purple-500/30',
          category: 'game'
        };
      case 'lottery':
        return {
          actionType: 'lottery',
          labelBn: 'মেগা লটারি ড্রোতে যান',
          labelEn: 'Mega Lottery Draw',
          badgeBg: 'bg-amber-500/15',
          badgeText: 'text-amber-300',
          badgeBorder: 'border-amber-500/30',
          category: 'game'
        };
      case 'tickets':
        return {
          actionType: 'tickets',
          labelBn: 'আমার টিকেট ও বেট দেখুন',
          labelEn: 'View My Tickets',
          badgeBg: 'bg-cyan-500/15',
          badgeText: 'text-cyan-300',
          badgeBorder: 'border-cyan-500/30',
          category: 'results'
        };
      case 'results':
        return {
          actionType: 'results',
          labelBn: 'ড্রো ফলাফল দেখুন',
          labelEn: 'View Results',
          badgeBg: 'bg-indigo-500/15',
          badgeText: 'text-indigo-300',
          badgeBorder: 'border-indigo-500/30',
          category: 'results'
        };
      case 'offers':
        return {
          actionType: 'offers',
          labelBn: 'অফার ও বোনাস দেখুন',
          labelEn: 'View Offers',
          badgeBg: 'bg-pink-500/15',
          badgeText: 'text-pink-300',
          badgeBorder: 'border-pink-500/30',
          category: 'promotion'
        };
      case 'support':
        return {
          actionType: 'support',
          labelBn: 'লাইভ সাপোর্ট চ্যাট খুলুন',
          labelEn: 'Live Support Chat',
          badgeBg: 'bg-blue-500/15',
          badgeText: 'text-blue-300',
          badgeBorder: 'border-blue-500/30',
          category: 'support'
        };
      case 'history':
        return {
          actionType: 'history',
          labelBn: 'লেনদেন হিস্ট্রি দেখুন',
          labelEn: 'Transaction History',
          badgeBg: 'bg-slate-500/15',
          badgeText: 'text-slate-300',
          badgeBorder: 'border-slate-500/30',
          category: 'account'
        };
      case 'profile':
        return {
          actionType: 'profile',
          labelBn: 'প্রোফাইল পেইজে যান',
          labelEn: 'View Profile',
          badgeBg: 'bg-slate-500/15',
          badgeText: 'text-slate-300',
          badgeBorder: 'border-slate-500/30',
          category: 'account'
        };
      case 'settings':
        return {
          actionType: 'settings',
          labelBn: 'সেটিংস দেখুন',
          labelEn: 'View Settings',
          badgeBg: 'bg-slate-500/15',
          badgeText: 'text-slate-300',
          badgeBorder: 'border-slate-500/30',
          category: 'account'
        };
      case 'app_update':
        return {
          actionType: 'app_update',
          labelBn: 'অ্যাপ আপডেট করুন',
          labelEn: 'Update App (APK)',
          badgeBg: 'bg-emerald-500/15',
          badgeText: 'text-emerald-300',
          badgeBorder: 'border-emerald-500/30',
          category: 'promotion'
        };
    }
  }

  // 1.5 App Update / APK Update Detection
  if (
    ntf.type === 'app_update' ||
    combined.includes('app_update') ||
    combined.includes('নতুন আপডেট') ||
    combined.includes('update available') ||
    combined.includes('আপডেট করুন') ||
    combined.includes('apk update') ||
    combined.includes('version 2.') ||
    combined.includes('ডাউনলোড লিঙ্ক')
  ) {
    return {
      actionType: 'app_update',
      labelBn: 'অ্যাপ আপডেট করুন',
      labelEn: 'Update App (APK)',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      category: 'promotion'
    };
  }

  // 2. Support / Help Desk Inquiries
  if (
    priority === 'support' ||
    combined.includes('support reply') ||
    combined.includes('live support') ||
    combined.includes('help desk') ||
    combined.includes('সহায়তা') ||
    combined.includes('সাপোর্ট') ||
    combined.includes('লাইভ চ্যাট')
  ) {
    return {
      actionType: 'support',
      labelBn: 'লাইভ সাপোর্ট চ্যাটে যান',
      labelEn: 'Open Support Chat',
      badgeBg: 'bg-blue-500/15',
      badgeText: 'text-blue-300',
      badgeBorder: 'border-blue-500/30',
      category: 'support'
    };
  }

  // 3. Deposit Related Notifications (Approval, Rejection, Submissions, UPI, Crypto)
  if (
    ntf.type === 'deposit' ||
    combined.includes('deposit') ||
    combined.includes('ডিপোজিট') ||
    combined.includes('রিচার্জ') ||
    combined.includes('recharge') ||
    combined.includes('utr') ||
    combined.includes('usdt') ||
    combined.includes('crypto deposit')
  ) {
    return {
      actionType: 'deposit',
      labelBn: 'ডিপোজিট ওয়ালেটে যান',
      labelEn: 'Go to Deposit Wallet',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      category: 'wallet'
    };
  }

  // 4. Withdrawal Related Notifications (Approved, Rejected, Bank Payout)
  if (
    ntf.type === 'withdrawal' ||
    combined.includes('withdrawal') ||
    combined.includes('উইথড্রয়াল') ||
    combined.includes('উত্তোলন') ||
    combined.includes('payout') ||
    combined.includes('bank a/c')
  ) {
    return {
      actionType: 'withdrawal',
      labelBn: 'উইথড্রয়াল সেকশনে যান',
      labelEn: 'Go to Withdrawal',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30',
      category: 'wallet'
    };
  }

  // 5. Aviator / Crash Game Notifications
  if (
    combined.includes('aviator') ||
    combined.includes('crash') ||
    combined.includes('এভিয়েটর') ||
    combined.includes('ক্র্যাশ') ||
    combined.includes('spribe') ||
    combined.includes('supersonic')
  ) {
    return {
      actionType: 'crash',
      labelBn: 'এভিয়েটর গেম খুলুন',
      labelEn: 'Play Aviator Crash',
      badgeBg: 'bg-rose-500/15',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-500/30',
      category: 'game'
    };
  }

  // 6. Lightning Roulette Live
  if (
    combined.includes('roulette') ||
    combined.includes('রুলেট') ||
    combined.includes('lightning') ||
    combined.includes('লাইভ রুলেট')
  ) {
    return {
      actionType: 'roulette',
      labelBn: 'লাইভ রুলেট খেলুন',
      labelEn: 'Play Live Roulette',
      badgeBg: 'bg-yellow-500/15',
      badgeText: 'text-yellow-300',
      badgeBorder: 'border-yellow-500/30',
      category: 'game'
    };
  }

  // 7. Dragon vs Tiger Live
  if (
    combined.includes('dragon tiger') ||
    combined.includes('dragon vs tiger') ||
    combined.includes('ড্রাগন টাইগার') ||
    combined.includes('ড্রাগন') ||
    combined.includes('টাইগার')
  ) {
    return {
      actionType: 'dragon_tiger',
      labelBn: 'ড্রাগন টাইগার খেলুন',
      labelEn: 'Play Dragon Tiger',
      badgeBg: 'bg-red-500/15',
      badgeText: 'text-red-300',
      badgeBorder: 'border-red-500/30',
      category: 'game'
    };
  }

  // 8. Super Andar Bahar Live
  if (
    combined.includes('andar bahar') ||
    combined.includes('super andar bahar') ||
    combined.includes('আন্দার বাহার') ||
    combined.includes('আন্দার') ||
    combined.includes('বাহার')
  ) {
    return {
      actionType: 'andar_bahar',
      labelBn: 'আন্দার বাহার খেলুন',
      labelEn: 'Play Andar Bahar',
      badgeBg: 'bg-teal-500/15',
      badgeText: 'text-teal-300',
      badgeBorder: 'border-teal-500/30',
      category: 'game'
    };
  }

  // 9. Lucky Wheel / Fortune Spin
  if (
    combined.includes('wheel') ||
    combined.includes('spin') ||
    combined.includes('হুইল') ||
    combined.includes('স্পিন') ||
    combined.includes('fortune') ||
    combined.includes('চাকা')
  ) {
    return {
      actionType: 'lucky_wheel',
      labelBn: 'লাকি হুইল স্পিন করুন',
      labelEn: 'Spin Lucky Wheel',
      badgeBg: 'bg-purple-500/15',
      badgeText: 'text-purple-300',
      badgeBorder: 'border-purple-500/30',
      category: 'game'
    };
  }

  // 10. Super Car Draw
  if (
    combined.includes('super car') ||
    combined.includes('supercar') ||
    combined.includes('সুপার কার') ||
    combined.includes('কার ড্রো') ||
    combined.includes('ferrari') ||
    combined.includes('stealth black') ||
    combined.includes('yellow turbo')
  ) {
    if (ntf.type === 'win' || combined.includes('win') || combined.includes('জিত') || combined.includes('বিজয়ী')) {
      return {
        actionType: 'tickets',
        labelBn: 'টিকেটের ফলাফল দেখুন',
        labelEn: 'View Winning Ticket',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-300',
        badgeBorder: 'border-amber-500/30',
        category: 'results'
      };
    }
    return {
      actionType: 'supercar',
      labelBn: 'সুপার কার ড্রোতে যান',
      labelEn: 'Go to Super Car Draw',
      badgeBg: 'bg-rose-500/15',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-500/30',
      category: 'game'
    };
  }

  // 11. Mega Lottery & Regular Lottery
  if (
    combined.includes('lottery') ||
    combined.includes('লটারি') ||
    combined.includes('jackpot') ||
    combined.includes('জ্যাকপট') ||
    combined.includes('ticket') ||
    combined.includes('টিকেট')
  ) {
    if (ntf.type === 'win' || combined.includes('won') || combined.includes('win') || combined.includes('বিজয়ী')) {
      return {
        actionType: 'tickets',
        labelBn: 'আমার টিকেট দেখুন',
        labelEn: 'View Won Ticket',
        badgeBg: 'bg-amber-500/15',
        badgeText: 'text-amber-300',
        badgeBorder: 'border-amber-500/30',
        category: 'results'
      };
    }
    return {
      actionType: 'lottery',
      labelBn: 'লটারি ড্রো পেইজে যান',
      labelEn: 'Go to Lottery Draws',
      badgeBg: 'bg-yellow-500/15',
      badgeText: 'text-yellow-300',
      badgeBorder: 'border-yellow-500/30',
      category: 'game'
    };
  }

  // 12. Offers, Promo, Bonuses, Cashbacks
  if (
    combined.includes('offer') ||
    combined.includes('bonus') ||
    combined.includes('অফার') ||
    combined.includes('বোনাস') ||
    combined.includes('promo') ||
    combined.includes('cashback') ||
    combined.includes('voucher')
  ) {
    return {
      actionType: 'offers',
      labelBn: 'অফার ও বোনাস দেখুন',
      labelEn: 'View Special Offers',
      badgeBg: 'bg-pink-500/15',
      badgeText: 'text-pink-300',
      badgeBorder: 'border-pink-500/30',
      category: 'promotion'
    };
  }

  // 13. Draw Results
  if (
    combined.includes('result') ||
    combined.includes('ফলাফল') ||
    combined.includes('winner list')
  ) {
    return {
      actionType: 'results',
      labelBn: 'ড্রো ফলাফল দেখুন',
      labelEn: 'View Draw Results',
      badgeBg: 'bg-indigo-500/15',
      badgeText: 'text-indigo-300',
      badgeBorder: 'border-indigo-500/30',
      category: 'results'
    };
  }

  // 14. Transactions / Ledger
  if (
    combined.includes('transaction') ||
    combined.includes('লেনদেন') ||
    combined.includes('statement') ||
    combined.includes('হিস্ট্রি') ||
    combined.includes('ledger')
  ) {
    return {
      actionType: 'history',
      labelBn: 'লেনদেন হিস্ট্রি দেখুন',
      labelEn: 'View History',
      badgeBg: 'bg-slate-500/15',
      badgeText: 'text-slate-300',
      badgeBorder: 'border-slate-500/30',
      category: 'account'
    };
  }

  // 15. Profile / KYC / Account / Security Settings
  if (
    combined.includes('profile') ||
    combined.includes('প্রোফাইল') ||
    combined.includes('kyc') ||
    combined.includes('verification') ||
    combined.includes('ভেরিফিকেশন') ||
    combined.includes('password') ||
    combined.includes('settings') ||
    combined.includes('সেটিংস')
  ) {
    return {
      actionType: 'profile',
      labelBn: 'আমার প্রোফাইলে যান',
      labelEn: 'Go to Profile',
      badgeBg: 'bg-slate-500/15',
      badgeText: 'text-slate-300',
      badgeBorder: 'border-slate-500/30',
      category: 'account'
    };
  }

  // Default fallback depending on type
  if (ntf.type === 'win') {
    return {
      actionType: 'tickets',
      labelBn: 'টিকেটের হিস্ট্রি দেখুন',
      labelEn: 'View Ticket History',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30',
      category: 'results'
    };
  }

  return {
    actionType: 'offers',
    labelBn: 'বিস্তারিত ও অফার দেখুন',
    labelEn: 'View Details',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    category: 'promotion'
  };
}
