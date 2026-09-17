import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { EmailTemplateCategory, EmailTemplateOption, SmtpTemplateSettings, EmailActivityLog } from '../types';

export const DEFAULT_TEMPLATE_SETTINGS: SmtpTemplateSettings = {
  activeDepositTemplate: 'cyber_gold',
  activeWithdrawalTemplate: 'golden_vault',
  activeOtpTemplate: 'quantum_shield',
  activeBonusTemplate: 'trophy_sparkle',
  activeSecurityTemplate: 'sentinel_crimson',
  updatedAt: new Date().toISOString()
};

export const EMAIL_TEMPLATE_CATALOG: EmailTemplateOption[] = [
  // ---------------- DEPOSIT TEMPLATES (5) ----------------
  {
    id: 'cyber_gold',
    name: 'Cyberpunk 8K Gold & Sapphire',
    category: 'deposit',
    themeName: 'Cyber Gold 8K',
    accentColor: '#f59e0b',
    previewGradient: 'from-amber-500/30 via-yellow-600/20 to-blue-900/40',
    description: 'Ultra-luxury cyberpunk dark design with glowing gold gradients, pulsing border, and sapphire matrix receipt ledger.',
    features: ['8K CSS Glow Animation', 'Sapphire Matrix Border', 'Instant UTR Token Badge']
  },
  {
    id: 'royal_emerald',
    name: 'Royal Emerald 24K Banker',
    category: 'deposit',
    themeName: 'Emerald Crown',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500/30 via-teal-700/20 to-amber-900/30',
    description: 'Sovereign emerald & gold-foil banker certificate with gold crest watermark and verified escrow security seal.',
    features: ['24K Gold Foil Ribbons', 'Official Banker Watermark', 'Verified Escrow Seal']
  },
  {
    id: 'dark_titanium',
    name: 'Obsidian Titanium Minimalist',
    category: 'deposit',
    themeName: 'Dark Titanium',
    accentColor: '#38bdf8',
    previewGradient: 'from-slate-800 via-slate-900 to-cyan-950',
    description: 'Apple-grade obsidian monochrome with hyper-clean typography, subtle neon blue laser glow, and high-contrast tables.',
    features: ['Obsidian Matte Canvas', 'Laser Cyan Typography', 'Precision Itemized Matrix']
  },
  {
    id: 'diamond_prism',
    name: 'Holographic Diamond Prism VIP',
    category: 'deposit',
    themeName: 'Diamond Prism',
    accentColor: '#a855f7',
    previewGradient: 'from-purple-500/30 via-pink-600/20 to-indigo-950',
    description: 'High-roller holographic prism with multi-colored iridescent border reflection and VIP lounge deposit stamp.',
    features: ['Holographic Prismatic Trim', 'VIP High-Roller Stamp', 'Dynamic Multiplier Badge']
  },
  {
    id: 'speed_rail',
    name: 'Electric Neon Fast-Rail Instant',
    category: 'deposit',
    themeName: 'Neon Speed Rail',
    accentColor: '#06b6d4',
    previewGradient: 'from-cyan-500/30 via-blue-600/20 to-slate-950',
    description: 'High-velocity electric cyan with dynamic speed lines, instant settlement ticker, and real-time bank link indicator.',
    features: ['Electric Pulse Ticker', 'Fast-Rail Settlement Seal', 'Live Bank Link Indicator']
  },

  // ---------------- WITHDRAWAL TEMPLATES (5) ----------------
  {
    id: 'golden_vault',
    name: 'Sovereign 8K Gold Vault Payout',
    category: 'withdrawal',
    themeName: 'Gold Vault 8K',
    accentColor: '#eab308',
    previewGradient: 'from-yellow-500/30 via-amber-700/20 to-slate-950',
    description: 'Grand vault door aesthetics with 24K gold payout emblem, instant IMPS dispatch verification, and audited receipt seal.',
    features: ['8K Vault Door Emblem', 'IMPS Fast Dispatch Stamp', 'Encrypted Payout ID Matrix']
  },
  {
    id: 'platinum_wire',
    name: 'Platinum Elite Bank Wire Certificate',
    category: 'withdrawal',
    themeName: 'Platinum Elite',
    accentColor: '#94a3b8',
    previewGradient: 'from-slate-400/30 via-slate-700/20 to-slate-950',
    description: 'Prestigious Swiss-style platinum wire certificate with official banking typography, secure masked account box, and transfer certificate.',
    features: ['Swiss Wire Certificate', 'Masked Account Vault Box', 'Bank Transfer Authority']
  },
  {
    id: 'neon_velocity',
    name: 'Velocity Emerald Direct Dispatch',
    category: 'withdrawal',
    themeName: 'Neon Velocity',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500/30 via-teal-800/20 to-slate-950',
    description: 'Ultra-fast emerald neon with speed rails, immediate settlement confirmation, and zero-delay payout celebration banner.',
    features: ['Live Speed Rail Glow', 'Instant UPI/IMPS Confirmation', 'Zero-Delay Status Banner']
  },
  {
    id: 'royal_burgundy',
    name: 'Imperial Burgundy & Champagne Gold',
    category: 'withdrawal',
    themeName: 'Imperial Burgundy',
    accentColor: '#f43f5e',
    previewGradient: 'from-rose-600/30 via-purple-900/30 to-amber-950/30',
    description: 'Opulent burgundy velvet styling with champagne gold borders, imperial crest, and white-glove VIP payout assurance.',
    features: ['Champagne Gold Crest', 'Burgundy Velvet Canvas', 'VIP Concierge Guarantee']
  },
  {
    id: 'fintech_ledger',
    name: 'Dark Cyberpunk Fintech Ledger',
    category: 'withdrawal',
    themeName: 'Fintech Ledger',
    accentColor: '#6366f1',
    previewGradient: 'from-indigo-500/30 via-purple-900/20 to-slate-950',
    description: 'Modern high-tech fintech ledger with micro-animations, cryptographic transaction hash block, and real-time status tracker.',
    features: ['Cryptographic Hash Display', 'Real-time Tracker Timeline', 'Monospace Audit Trail']
  },

  // ---------------- SECURITY & OTP TEMPLATES (5) ----------------
  {
    id: 'quantum_shield',
    name: 'Quantum Cyber Shield & Glowing 6-Digit Matrix',
    category: 'otp',
    themeName: 'Quantum Cyber OTP',
    accentColor: '#3b82f6',
    previewGradient: 'from-blue-600/30 via-indigo-800/20 to-slate-950',
    description: 'State-of-the-art quantum shield with extra-large glowing 6-digit passcode block, 10-minute expiry counter, and anti-phishing seal.',
    features: ['Giant Glowing OTP Digits', '10-Min Expiry Countdown Card', 'Anti-Phishing Verification Seal']
  },
  {
    id: 'sentinel_crimson',
    name: 'Sentinel Firewall 2FA Security Badge',
    category: 'otp',
    themeName: 'Sentinel Crimson',
    accentColor: '#ef4444',
    previewGradient: 'from-rose-600/30 via-red-900/20 to-slate-950',
    description: 'High-security crimson firewall with biometric lock shield, official authorization notice, and dual-layer verification seal.',
    features: ['Biometric Lock Badge', 'Crimson Firewall Framing', 'Device Security Audit Checklist']
  },
  {
    id: 'gold_passcode',
    name: 'VIP 24K Gold Key Vault Passcode',
    category: 'otp',
    themeName: 'Gold Vault OTP',
    accentColor: '#f59e0b',
    previewGradient: 'from-amber-500/30 via-yellow-700/20 to-slate-950',
    description: 'Exclusive VIP black & gold card with embossed metallic passcode boxes, private banker crest, and pin-protection reminder.',
    features: ['Embossed Metallic Digits', 'VIP Private Banker Crest', 'PIN Safety Protocol']
  },
  {
    id: 'stealth_cipher',
    name: 'Midnight Cyan Monospace Stealth Matrix',
    category: 'otp',
    themeName: 'Stealth Cipher',
    accentColor: '#06b6d4',
    previewGradient: 'from-cyan-500/30 via-teal-900/20 to-slate-950',
    description: 'Matrix terminal aesthetics with cyan glowing monospace digits, security hash watermark, and instant copy support.',
    features: ['Matrix Monospace Code Box', 'Cryptographic Hash Watermark', 'Instant Security Directive']
  },
  {
    id: 'banker_auth',
    name: 'Official Bank-Grade Biometric Token Auth',
    category: 'otp',
    themeName: 'Bank-Grade Auth',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500/30 via-slate-800 to-slate-950',
    description: 'Commercial banking grade authentication card with dual security badges, fraud warning alert, and tamper-proof timestamp.',
    features: ['Dual Security Authority Badges', 'Fraud Protection Alert Box', 'Tamper-Proof Audit Timestamp']
  },

  // ---------------- BONUS & REWARDS TEMPLATES (5) ----------------
  {
    id: 'trophy_sparkle',
    name: '8K Golden Trophy Fireworks & Sparkles',
    category: 'bonus',
    themeName: 'Trophy Sparkle 8K',
    accentColor: '#f59e0b',
    previewGradient: 'from-amber-500/30 via-orange-600/20 to-purple-950',
    description: 'Spectacular celebration card with fireworks confetti, glowing 3D trophy emblem, and instant claim bonus chips banner.',
    features: ['Fireworks & Confetti FX', '3D Golden Trophy Emblem', 'One-Click Play Directive']
  },
  {
    id: 'vip_champagne',
    name: 'Royal VIP Champagne High-Roller Gift',
    category: 'bonus',
    themeName: 'Royal Champagne',
    accentColor: '#fbbf24',
    previewGradient: 'from-yellow-400/30 via-amber-800/20 to-slate-950',
    description: 'Palatial gold champagne atmosphere with VIP privilege badge, exclusive wagering chips credit, and luxury prestige border.',
    features: ['VIP Royal Privilege Crest', 'Champagne Gold Typography', 'Exclusive High-Roller Tier Perks']
  },
  {
    id: 'jackpot_wheel',
    name: 'Neon Carnival Mega Jackpot Wheel Drop',
    category: 'bonus',
    themeName: 'Jackpot Wheel',
    accentColor: '#ec4899',
    previewGradient: 'from-pink-500/30 via-purple-700/20 to-slate-950',
    description: 'Vibrant neon carnival design with spinning jackpot wheel motif, neon marquee border, and multiplier booster chip banner.',
    features: ['Neon Marquee Lights', 'Spinning Wheel Graphic', 'Multiplier Booster Pill']
  },
  {
    id: 'emerald_cashback',
    name: 'Emerald Laser Cashback & VIP Rebate',
    category: 'bonus',
    themeName: 'Emerald Cashback',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500/30 via-teal-900/30 to-slate-950',
    description: 'Brilliant emerald gemstone theme celebrating cashback refunds, loss rebates, and loyalty club reward points deposit.',
    features: ['Gemstone Laser Crest', 'Instant Wallet Credit Box', 'Weekly Rebate Summary']
  },
  {
    id: 'streak_lightning',
    name: 'Electric Lightning Daily Streak Reward',
    category: 'bonus',
    themeName: 'Electric Streak',
    accentColor: '#06b6d4',
    previewGradient: 'from-cyan-500/30 via-blue-700/20 to-slate-950',
    description: 'High-voltage electric lightning bolt with daily login streak badge, multiplier boost meter, and fast claim action button.',
    features: ['Electric Thunder Sparks', 'Daily Streak Counter Badge', 'Next Level Multiplier Meter']
  }
];

/**
 * Loads current template configurations from Firestore with fallback defaults.
 */
export async function getActiveTemplateSettings(): Promise<SmtpTemplateSettings> {
  try {
    const docRef = doc(db, 'smtp_template_settings', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_TEMPLATE_SETTINGS, ...snap.data() } as SmtpTemplateSettings;
    }
  } catch (err) {
    console.warn('Error reading active template settings:', err);
  }
  return DEFAULT_TEMPLATE_SETTINGS;
}

/**
 * Saves template configuration to Firestore in real-time.
 */
export async function saveActiveTemplateSettings(settings: Partial<SmtpTemplateSettings>): Promise<boolean> {
  try {
    const docRef = doc(db, 'smtp_template_settings', 'global');
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving template settings:', err);
    return false;
  }
}

/**
 * Logs every auto-sent or manual email into Firestore for Admin Tracking & 1-Click Resend.
 */
export async function logEmailActivity(activity: Omit<EmailActivityLog, 'id' | 'timestamp' | 'dateStr'>): Promise<string> {
  try {
    const logId = `EMAIL-LOG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullLog: EmailActivityLog = {
      ...activity,
      id: logId,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('en-IN')
    };
    await setDoc(doc(db, 'email_activity_logs', logId), fullLog, { merge: true });
    return logId;
  } catch (err) {
    console.warn('Error recording email activity log:', err);
    return '';
  }
}

/* ====================================================================
   HIGH-QUALITY 8K HTML EMAIL GENERATOR ENGINE
   ==================================================================== */

export interface RenderTemplateData {
  userName?: string;
  amount?: number;
  method?: string;
  utr?: string;
  accountEnding?: string;
  accountNumber?: string;
  status?: string;
  reason?: string;
  otp?: string;
  otpType?: string;
  bonusTitle?: string;
  bonusAmount?: number;
  securitySubject?: string;
  securityMessage?: string;
  noticeType?: string;
  urgency?: string;
  adminName?: string;
}

/**
 * Generates the identical BETGURU website logo in clean cross-client responsive HTML table format.
 * Matches the website Header logo exactly:
 * - Square golden gradient badge with 'B'
 * - 'ETGURU' in gold monospace/bold
 * - 'HD' amber pill badge
 * - 'CASINO & LOTTERY' subtitle
 */
export function renderBetguruWebsiteLogoHtml(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 16px auto; text-align: left; vertical-align: middle; border-collapse: separate;">
      <tr>
        <!-- Square Golden Gradient Box with 'B' -->
        <td style="vertical-align: middle; padding-right: 12px;">
          <table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; background: linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #d97706 100%); border-radius: 12px; padding: 2px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45);">
            <tr>
              <td style="background-color: #020617; border-radius: 10px; text-align: center; vertical-align: middle; height: 40px; width: 40px;">
                <span style="font-family: 'Courier New', Courier, monospace, 'Lucida Console', Monaco, sans-serif; font-weight: 900; font-size: 24px; line-height: 1; color: #fbbf24; text-shadow: 0 2px 8px rgba(251, 191, 36, 0.6); display: block; margin: 0 auto;">
                  B
                </span>
              </td>
            </tr>
          </table>
        </td>
        <!-- ETGURU + HD pill + Subtitle: CASINO & LOTTERY -->
        <td style="vertical-align: middle;">
          <table cellpadding="0" cellspacing="0" border="0" style="line-height: 1;">
            <tr>
              <td style="vertical-align: middle;">
                <span style="font-family: 'Courier New', Courier, monospace, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #fbbf24; text-shadow: 0 0 10px rgba(245, 158, 11, 0.4); text-transform: uppercase; line-height: 1; display: inline-block;">
                  ETGURU
                </span>
              </td>
              <td style="vertical-align: middle; padding-left: 6px;">
                <span style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.45); font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', Courier, monospace; letter-spacing: 1.5px; vertical-align: middle; display: inline-block; line-height: 1.2;">
                  HD
                </span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 4px;">
                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; display: block; line-height: 1;">
                  CASINO &amp; LOTTERY
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function renderEmailHtml(
  category: EmailTemplateCategory,
  templateId: string,
  data: RenderTemplateData
): string {
  const name = data.userName || 'Valued Player';
  const amtFormatted = (data.amount || data.bonusAmount || 0).toLocaleString('en-IN');
  const nowStr = new Date().toLocaleString('en-IN');

  // Common modern HTML Email wrapper with CSS animations & dark theme
  const renderWrapper = (titleBadge: string, mainHeading: string, subText: string, accentColor: string, bodyContent: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mainHeading}</title>
  <style>
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 25px ${accentColor}33, 0 10px 40px rgba(0,0,0,0.8); border-color: ${accentColor}66; }
      50% { box-shadow: 0 0 45px ${accentColor}66, 0 15px 50px rgba(0,0,0,0.9); border-color: ${accentColor}; }
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .email-container {
      animation: pulseGlow 4s infinite ease-in-out;
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <div class="email-container" style="max-width: 540px; margin: 0 auto; background: radial-gradient(circle at top, #0f172a 0%, #020617 100%); border-radius: 28px; border: 2px solid ${accentColor}55; padding: 36px 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); overflow: hidden; position: relative;">
    
    <!-- Top Website BETGURU Logo (Identical to Website Header) -->
    <div style="text-align: center; margin-bottom: 20px;">
      ${renderBetguruWebsiteLogoHtml()}
    </div>

    <!-- Category Header & Badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; margin-bottom: 10px;">
        <span style="background: linear-gradient(135deg, ${accentColor}25, rgba(15,23,42,0.8)); color: ${accentColor}; border: 1px solid ${accentColor}66; padding: 6px 18px; border-radius: 9999px; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
          ${titleBadge}
        </span>
      </div>
      <h1 style="margin: 6px 0 6px 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1.2;">
        ${mainHeading}
      </h1>
      <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
        ${subText}
      </p>
    </div>

    <!-- Greeting -->
    <div style="margin-bottom: 20px; font-size: 14px; color: #e2e8f0; line-height: 1.6;">
      Dear <strong style="color: #ffffff; font-weight: 700;">${name}</strong>,
    </div>

    <!-- Body Content Section -->
    ${bodyContent}

    <!-- Security & Protection Footer Badge -->
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(148,163,184,0.15); text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10b981;"></span>
        <span style="font-size: 11px; font-weight: 700; color: #cbd5e1; font-family: monospace;">256-BIT ENCRYPTED REAL-TIME SETTLEMENT</span>
      </div>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
        BETGURU Automated High-Roller Infrastructure • Verified 24/7 Support Desk<br/>
        <span style="font-size: 10px; opacity: 0.7;">Time: ${nowStr}</span>
      </p>
    </div>

  </div>
</body>
</html>
  `;

  // ----------------------------------------------------
  // CATEGORY 1: DEPOSIT NOTIFICATIONS
  // ----------------------------------------------------
  if (category === 'deposit') {
    const utrVal = data.utr || 'N/A';
    const methodVal = (data.method || 'UPI').toUpperCase();
    const isApproved = data.status === 'approved' || !data.status || data.status === 'success';
    const isRejected = data.status === 'rejected';

    if (templateId === 'royal_emerald') {
      return renderWrapper(
        '👑 ROYAL 24K EMERALD BANKER',
        isApproved ? 'Deposit Verified & Funded' : isRejected ? 'Deposit Notice: Verification Failed' : 'Deposit Request in Escrow',
        'Official 24K Sovereign Banker Settlement Certificate',
        '#10b981',
        `
        <div style="background: linear-gradient(180deg, rgba(6,78,59,0.3) 0%, rgba(15,23,42,0.8) 100%); border: 1px solid #10b98166; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center; box-shadow: inset 0 0 20px rgba(16,185,129,0.1);">
          <span style="font-size: 12px; color: #a7f3d0; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; font-family: monospace;">Amount Credited</span>
          <div style="font-size: 32px; font-weight: 900; color: #34d399; margin: 8px 0; text-shadow: 0 0 15px rgba(52,211,153,0.4);">
            + ₹${amtFormatted}
          </div>
          <span style="font-size: 11px; color: #6ee7b7; background: rgba(16,185,129,0.2); padding: 4px 12px; border-radius: 9999px; border: 1px solid #10b98144; font-family: monospace;">
            ✓ Instant Chips Loaded
          </span>
        </div>

        <div style="background: #090d16; border-radius: 16px; padding: 16px; border: 1px solid #1e293b; margin-bottom: 20px;">
          <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8;">Payment Method:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">${methodVal}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1e293b;">
              <td style="padding: 8px 0; color: #94a3b8;">UTR / TXID:</td>
              <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #34d399; text-align: right;">${utrVal}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Escrow Status:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #10b981; text-align: right;">${isApproved ? '✓ 100% Settled' : isRejected ? '❌ Cancelled' : '⏳ Processing'}</td>
            </tr>
          </table>
        </div>
        ${isRejected ? `<div style="background: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; color: #fca5a5; font-size: 13px; margin-bottom: 16px;"><strong>Reason:</strong> ${data.reason || 'Invalid UTR mismatch'}</div>` : ''}
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; text-align: center; margin: 0;">
          Your balance is now live. Enjoy Super Car 4D Draws, Aviator Crash, Roulette, and Mega Jackpot tables!
        </p>
        `
      );
    }

    if (templateId === 'dark_titanium') {
      return renderWrapper(
        '⚡ TITANIUM OBSIDIAN FINANCIAL',
        isApproved ? 'Deposit Completed' : isRejected ? 'Deposit Declined' : 'Deposit Processing',
        'High-Performance Transaction Matrix',
        '#38bdf8',
        `
        <div style="background: #0b1120; border: 1px solid #38bdf855; border-radius: 18px; padding: 24px; margin: 18px 0;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
            <span style="font-size: 11px; font-family: monospace; color: #38bdf8; text-transform: uppercase; font-weight: bold;">LEDGER ENTRY</span>
            <span style="font-size: 26px; font-weight: 900; color: #ffffff; font-family: monospace;">₹${amtFormatted}</span>
          </div>
          <div style="background: #020617; border-radius: 12px; padding: 14px; font-size: 12px; font-family: monospace; color: #cbd5e1;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span style="color: #64748b;">SOURCE_CHANNEL:</span>
              <span style="color: #38bdf8; font-weight: bold;">${methodVal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span style="color: #64748b;">UTR_HASH:</span>
              <span style="color: #e2e8f0;">${utrVal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span style="color: #64748b;">CONFIRMATION:</span>
              <span style="color: #4ade80; font-weight: bold;">${isApproved ? 'VERIFIED (PASS)' : isRejected ? 'FAILED' : 'QUEUED'}</span>
            </div>
          </div>
        </div>
        ${isRejected ? `<div style="background: rgba(239,68,68,0.15); border: 1px solid #ef4444; border-radius: 12px; padding: 12px; color: #f87171; font-size: 12px; margin-bottom: 16px;"><strong>Failure Notice:</strong> ${data.reason || 'Verification failed'}</div>` : ''}
        `
      );
    }

    if (templateId === 'diamond_prism') {
      return renderWrapper(
        '💎 HOLOGRAPHIC DIAMOND PRISM',
        isApproved ? 'VIP Deposit Approved & Boosted' : 'VIP Deposit In Review',
        'Exclusive High-Roller Lounge Priority Settlement',
        '#a855f7',
        `
        <div style="background: linear-gradient(135deg, rgba(88,28,135,0.4) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #a855f7; border-radius: 22px; padding: 24px; margin: 20px 0; text-align: center;">
          <span style="font-size: 11px; color: #d8b4fe; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">VIP CHIPS DEPOSITED</span>
          <div style="font-size: 34px; font-weight: 900; color: #f3e8ff; margin: 10px 0; text-shadow: 0 0 20px rgba(168,85,247,0.6);">
            ₹${amtFormatted}
          </div>
          <p style="margin: 0; font-size: 13px; color: #c084fc;">Method: <strong>${methodVal}</strong> • UTR: <span style="font-family: monospace;">${utrVal}</span></p>
        </div>
        `
      );
    }

    if (templateId === 'speed_rail') {
      return renderWrapper(
        '⚡ NEON SPEED-RAIL SETTLEMENT',
        isApproved ? 'Instant Settlement Succeeded!' : 'Speed-Rail Deposit Received',
        'Sub-Second Core Banking Settlement Network',
        '#06b6d4',
        `
        <div style="background: #081b2b; border: 2px solid #06b6d4; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #67e8f9; font-weight: 900; letter-spacing: 1px;">FAST-RAIL IMPS / UPI RECEPT</div>
          <div style="font-size: 32px; font-weight: 900; color: #a5f3fc; margin: 10px 0;">₹${amtFormatted}</div>
          <div style="background: rgba(6,182,212,0.15); border-radius: 12px; padding: 12px; font-size: 12px; color: #e0f2fe; font-family: monospace;">
            UTR: ${utrVal} | Rail: ${methodVal} | Latency: 0.2s
          </div>
        </div>
        `
      );
    }

    // Default: cyber_gold
    return renderWrapper(
      '💳 8K CYBERPUNK GOLD LEDGER',
      isApproved ? 'Deposit Approved & Wallet Funded' : isRejected ? 'Deposit Rejected Notice' : 'Deposit Request Received',
      'High-Roller Vault Financial Certificate',
      '#f59e0b',
      `
      <div style="background: linear-gradient(180deg, rgba(245,158,11,0.15) 0%, rgba(15,23,42,0.9) 100%); border: 1.5px solid #f59e0b; border-radius: 20px; padding: 24px; margin: 20px 0; text-align: center; box-shadow: 0 10px 30px rgba(245,158,11,0.15);">
        <span style="font-size: 11px; color: #fde68a; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace;">WALLET CREDITED</span>
        <div style="font-size: 34px; font-weight: 900; color: #fbbf24; margin: 10px 0; text-shadow: 0 0 20px rgba(251,191,36,0.4);">
          + ₹${amtFormatted}
        </div>
        <span style="font-size: 11px; color: #fef08a; background: rgba(245,158,11,0.25); padding: 5px 14px; border-radius: 9999px; border: 1px solid #f59e0b88; font-weight: 800; font-family: monospace;">
          ${isApproved ? '✓ VERIFIED & SETTLED' : isRejected ? '❌ DECLINED' : '⏳ PENDING REVIEW'}
        </span>
      </div>

      <div style="background: #0f172a; border-radius: 16px; padding: 18px; border: 1px solid #1e293b; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 8px 0; color: #94a3b8;">Method:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">${methodVal}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 8px 0; color: #94a3b8;">UTR Ref ID:</td>
            <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #fbbf24; text-align: right;">${utrVal}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #94a3b8;">Transaction Type:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #38bdf8; text-align: right;">Main Balance Top-Up</td>
          </tr>
        </table>
      </div>

      ${isRejected ? `<div style="background: rgba(239,68,68,0.15); border-left: 4px solid #ef4444; padding: 14px; border-radius: 10px; color: #fca5a5; font-size: 13px; margin-bottom: 20px;"><strong>Reason:</strong> ${data.reason || 'Incorrect UTR / Reference mismatch'}</div>` : ''}

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: center; margin: 0;">
        Thank you for playing on BETGURU. Your chips are ready for immediate deployment on all live tables.
      </p>
      `
    );
  }

  // ----------------------------------------------------
  // CATEGORY 2: WITHDRAWAL NOTIFICATIONS
  // ----------------------------------------------------
  if (category === 'withdrawal') {
    const accLast = data.accountEnding || (data.accountNumber ? data.accountNumber.slice(-4) : '••••');
    const isApproved = data.status === 'approved' || !data.status || data.status === 'success';
    const isRejected = data.status === 'rejected';

    if (templateId === 'platinum_wire') {
      return renderWrapper(
        '🏦 PLATINUM ELITE BANK WIRE',
        isApproved ? 'Payout Dispatched via IMPS Fast Rail' : isRejected ? 'Withdrawal Cancelled & Refunded' : 'Withdrawal Processing',
        'Official Swiss-Grade IMPS Wire Certificate',
        '#94a3b8',
        `
        <div style="background: linear-gradient(180deg, rgba(71,85,105,0.4) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #cbd5e1; border-radius: 20px; padding: 24px; margin: 20px 0; text-align: center;">
          <span style="font-size: 11px; color: #cbd5e1; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;">IMPS WIRE TRANSFER AMOUNT</span>
          <div style="font-size: 34px; font-weight: 900; color: #ffffff; margin: 10px 0; font-family: monospace;">
            ₹${amtFormatted}
          </div>
          <div style="display: inline-block; background: #020617; padding: 6px 16px; border-radius: 12px; border: 1px solid #475569; font-size: 12px; color: #94a3b8; font-family: monospace;">
            Recipient Account: <strong style="color: #ffffff;">••••${accLast}</strong>
          </div>
        </div>
        ${isRejected ? `<div style="background: rgba(239,68,68,0.15); border: 1px solid #ef4444; border-radius: 12px; padding: 14px; color: #fca5a5; font-size: 13px; margin-bottom: 20px;"><strong>Refund Reason:</strong> ${data.reason || 'Bank details mismatch'}. <br/><span style="color:#34d399; font-weight:bold;">✓ ₹${amtFormatted} has been instantly refunded back to your wallet.</span></div>` : ''}
        `
      );
    }

    if (templateId === 'neon_velocity') {
      return renderWrapper(
        '🚀 VELOCITY NEON DIRECT DISPATCH',
        isApproved ? 'Payout Sent in Seconds!' : 'Payout In Velocity Queue',
        'High-Frequency Zero-Delay Transfer Infrastructure',
        '#10b981',
        `
        <div style="background: #022c22; border: 2px solid #10b981; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #6ee7b7; font-weight: 900; letter-spacing: 1.5px;">DISPATCHED AMOUNT</div>
          <div style="font-size: 34px; font-weight: 900; color: #34d399; margin: 10px 0;">₹${amtFormatted}</div>
          <div style="background: rgba(16,185,129,0.2); border-radius: 12px; padding: 10px; font-size: 12px; color: #a7f3d0; font-family: monospace;">
            Status: ${isApproved ? '⚡ Transferred to A/C ••••' + accLast : '⏳ In Dispatch Queue'}
          </div>
        </div>
        `
      );
    }

    if (templateId === 'royal_burgundy') {
      return renderWrapper(
        '👑 IMPERIAL BURGUNDY & CHAMPAGNE',
        isApproved ? 'High-Roller Payout Fulfilled' : 'Payout Under Concierge Review',
        'Exclusive Sovereign White-Glove VIP Disbursement',
        '#f43f5e',
        `
        <div style="background: linear-gradient(135deg, rgba(136,19,55,0.4) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #f43f5e; border-radius: 22px; padding: 24px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #fecdd3; font-weight: 900; letter-spacing: 2px;">SOVEREIGN PAYOUT</div>
          <div style="font-size: 36px; font-weight: 900; color: #ffe4e6; margin: 10px 0;">₹${amtFormatted}</div>
          <p style="margin: 0; font-size: 13px; color: #fb7185;">Destined to: <strong>••••${accLast}</strong></p>
        </div>
        `
      );
    }

    if (templateId === 'fintech_ledger') {
      return renderWrapper(
        '📊 FINTECH ITEMISED LEDGER',
        isApproved ? 'Withdrawal Settlement Completed' : 'Withdrawal Request Ledger Logged',
        'Double-Entry Audited Payout Certification',
        '#6366f1',
        `
        <div style="background: #0f172a; border: 1.5px solid #6366f1; border-radius: 18px; padding: 20px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; font-family: monospace; font-size: 12px; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
            <span style="color: #818cf8;">TRANSACTION_PAYOUT:</span>
            <span style="color: #ffffff; font-weight: bold;">₹${amtFormatted}</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; font-family: monospace; line-height: 1.8;">
            DESTINATION: ••••${accLast}<br/>
            RAIL: IMPS 2.0 EXPRESS<br/>
            STATUS: <span style="color: ${isApproved ? '#4ade80' : '#f87171'}; font-weight: bold;">${isApproved ? 'SETTLED_OK' : 'PENDING'}</span>
          </div>
        </div>
        `
      );
    }

    // Default: golden_vault
    return renderWrapper(
      '💸 8K GOLD VAULT DISPATCH',
      isApproved ? 'Withdrawal Approved & Transferred' : isRejected ? 'Withdrawal Rejected & Refunded' : 'Withdrawal Queued for Dispatch',
      'Fast-Rail Verified Payout Receipt',
      '#eab308',
      `
      <div style="background: linear-gradient(180deg, rgba(234,179,8,0.15) 0%, rgba(15,23,42,0.9) 100%); border: 1.5px solid #eab308; border-radius: 20px; padding: 24px; margin: 20px 0; text-align: center; box-shadow: 0 10px 30px rgba(234,179,8,0.15);">
        <span style="font-size: 11px; color: #fef08a; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace;">PAYOUT AMOUNT</span>
        <div style="font-size: 34px; font-weight: 900; color: #facc15; margin: 10px 0; text-shadow: 0 0 20px rgba(250,204,21,0.4);">
          ₹${amtFormatted}
        </div>
        <span style="font-size: 11px; color: #fef9c3; background: rgba(234,179,8,0.25); padding: 5px 14px; border-radius: 9999px; border: 1px solid #eab30888; font-weight: 800; font-family: monospace;">
          ${isApproved ? '✓ DISPATCHED VIA IMPS' : isRejected ? '❌ REFUNDED TO WALLET' : '⏳ FINANCE QUEUE'}
        </span>
      </div>

      <div style="background: #0f172a; border-radius: 16px; padding: 18px; border: 1px solid #1e293b; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 8px 0; color: #94a3b8;">Destination Account:</td>
            <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #ffffff; text-align: right;">••••${accLast}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 8px 0; color: #94a3b8;">Payout Channel:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #facc15; text-align: right;">IMPS Fast Rail / UPI</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #94a3b8;">Settlement Time:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #38bdf8; text-align: right;">Instant</td>
          </tr>
        </table>
      </div>

      ${isRejected ? `
        <div style="background: rgba(239,68,68,0.15); border-left: 4px solid #ef4444; padding: 14px; border-radius: 10px; color: #fca5a5; font-size: 13px; margin-bottom: 20px;">
          <strong>Reason for Cancellation:</strong> ${data.reason || 'Bank details mismatch'}.<br/>
          <span style="color: #34d399; font-weight: bold; margin-top: 4px; display: inline-block;">✓ ₹${amtFormatted} has been instantly credited back to your account balance.</span>
        </div>
      ` : ''}

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: center; margin: 0;">
        Thank you for choosing BETGURU. Payouts arrive directly in your designated bank account or UPI within moments.
      </p>
      `
    );
  }

  // ----------------------------------------------------
  // CATEGORY 3: SECURITY & OTP NOTIFICATIONS
  // ----------------------------------------------------
  if (category === 'otp' || category === 'security') {
    const otpCode = data.otp || '784912';
    const otpTypeLabel = data.otpType === 'password_reset' || data.otpType === 'pin_reset' ? 'TRANSACTION PIN / PASSWORD RESET' : 'VERIFICATION PASSCODE';

    if (templateId === 'sentinel_crimson') {
      return renderWrapper(
        '🚨 SENTINEL FIREWALL 2FA',
        'Official Security Verification Code',
        'Biometric-Grade Two-Factor Authentication',
        '#ef4444',
        `
        <div style="background: linear-gradient(180deg, rgba(220,38,38,0.2) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #ef4444; border-radius: 20px; padding: 24px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #fca5a5; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">${otpTypeLabel}</div>
          <div style="font-size: 42px; font-weight: 900; color: #ffffff; letter-spacing: 10px; margin: 14px 0; font-family: monospace; text-shadow: 0 0 25px rgba(239,68,68,0.7);">
            ${otpCode}
          </div>
          <div style="font-size: 12px; color: #f87171; font-weight: bold;">Valid for 10 Minutes • Do Not Share</div>
        </div>
        `
      );
    }

    if (templateId === 'gold_passcode') {
      return renderWrapper(
        '🔑 24K GOLD VAULT PASSCODE',
        'High-Security Vault Access Code',
        'Encrypted One-Time Authorization Key',
        '#f59e0b',
        `
        <div style="background: radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(15,23,42,0.95) 100%); border: 2px solid #f59e0b; border-radius: 22px; padding: 26px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #fde68a; font-weight: 900; letter-spacing: 2px;">SECURE 6-DIGIT PASSKEY</div>
          <div style="font-size: 44px; font-weight: 900; color: #fbbf24; letter-spacing: 12px; margin: 16px 0; font-family: monospace; text-shadow: 0 0 30px rgba(251,191,36,0.6);">
            ${otpCode}
          </div>
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">Never disclose this code to anyone, including BETGURU staff.</p>
        </div>
        `
      );
    }

    if (templateId === 'stealth_cipher') {
      return renderWrapper(
        '💻 STEALTH MONOSPACE CIPHER',
        'Encrypted Security Token',
        'Terminal Cryptographic Authorization',
        '#06b6d4',
        `
        <div style="background: #041724; border: 2px solid #06b6d4; border-radius: 18px; padding: 22px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #67e8f9; font-family: monospace;">AUTH_KEY_EXPIRES_10M</div>
          <div style="font-size: 40px; font-weight: 900; color: #22d3ee; letter-spacing: 8px; margin: 12px 0; font-family: monospace;">
            [ ${otpCode} ]
          </div>
          <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">SHA-256 VERIFIED TOKEN</div>
        </div>
        `
      );
    }

    if (templateId === 'banker_auth') {
      return renderWrapper(
        '🏛️ BANK-GRADE TOKEN AUTH',
        'Official Transaction Authorization',
        'Tier-1 Dual-Lock Security Gateway',
        '#10b981',
        `
        <div style="background: #064e3b33; border: 2px solid #10b981; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; color: #6ee7b7; font-weight: 900; letter-spacing: 1px;">TOKEN PASSCODE</div>
          <div style="font-size: 42px; font-weight: 900; color: #34d399; letter-spacing: 10px; margin: 12px 0; font-family: monospace;">
            ${otpCode}
          </div>
          <div style="font-size: 12px; color: #a7f3d0;">Authorized for PIN Setup & Account Security</div>
        </div>
        `
      );
    }

    // Default: quantum_shield
    return renderWrapper(
      '🛡️ 8K QUANTUM CYBER SHIELD',
      'One-Time Verification Passcode (OTP)',
      'High-Grade 6-Digit Matrix Authentication',
      '#3b82f6',
      `
      <div style="background: linear-gradient(180deg, rgba(59,130,246,0.2) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #3b82f6; border-radius: 22px; padding: 28px 20px; margin: 20px 0; text-align: center; box-shadow: 0 15px 40px rgba(59,130,246,0.25);">
        <span style="font-size: 11px; color: #93c5fd; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;">
          ${otpTypeLabel}
        </span>
        <div style="font-size: 46px; font-weight: 900; color: #60a5fa; letter-spacing: 12px; margin: 16px 0; font-family: monospace; text-shadow: 0 0 35px rgba(96,165,250,0.8); padding-left: 12px;">
          ${otpCode}
        </div>
        <div style="display: inline-block; background: rgba(59,130,246,0.15); border: 1px solid #3b82f666; border-radius: 9999px; padding: 6px 18px; font-size: 12px; font-weight: 700; color: #bfdbfe; font-family: monospace;">
          ⏱️ Valid for exactly 10 minutes
        </div>
      </div>

      <div style="background: #0f172a; border-radius: 16px; padding: 16px; border: 1px solid #1e293b; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #ffffff;">Security Directives:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #94a3b8; line-height: 1.6;">
          <li>Never forward or share this OTP code with anyone, including customer service.</li>
          <li>Enter this 6-digit code in the app prompt to complete your verification or Transaction PIN setup.</li>
          <li>If you did not request this OTP, please contact the 24/7 Security Live Chat immediately.</li>
        </ul>
      </div>
      `
    );
  }

  // ----------------------------------------------------
  // CATEGORY 4: BONUS & REWARDS
  // ----------------------------------------------------
  const bTitle = data.bonusTitle || 'Special VIP Bonus Reward';
  const bAmt = data.bonusAmount || data.amount || 500;

  if (templateId === 'vip_champagne') {
    return renderWrapper(
      '🍾 ROYAL VIP CHAMPAGNE BONUS',
      'VIP High-Roller Bonus Credited!',
      'Exclusive VIP Tier Privilege Disbursement',
      '#fbbf24',
      `
      <div style="background: radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(15,23,42,0.95) 100%); border: 2px solid #fbbf24; border-radius: 22px; padding: 26px; margin: 20px 0; text-align: center;">
        <span style="font-size: 11px; color: #fef08a; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">${bTitle}</span>
        <div style="font-size: 38px; font-weight: 900; color: #fde047; margin: 12px 0; text-shadow: 0 0 30px rgba(253,224,71,0.6);">
          + ₹${bAmt.toLocaleString('en-IN')}
        </div>
        <span style="font-size: 12px; color: #fef9c3;">Credited Directly to Bonus Wallet Balance</span>
      </div>
      `
    );
  }

  if (templateId === 'jackpot_wheel') {
    return renderWrapper(
      '🎡 NEON JACKPOT WHEEL REWARD',
      'Mega Wheel Win & Bonus Boost!',
      'Carnival Multiplier Prize Loaded',
      '#ec4899',
      `
      <div style="background: #200518; border: 2px solid #ec4899; border-radius: 22px; padding: 24px; margin: 20px 0; text-align: center;">
        <div style="font-size: 11px; color: #fbcfe8; font-weight: 900; letter-spacing: 2px;">${bTitle}</div>
        <div style="font-size: 36px; font-weight: 900; color: #f472b6; margin: 10px 0;">+ ₹${bAmt.toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #f9a8d4;">Spin credits and bonus chips unlocked!</div>
      </div>
      `
    );
  }

  if (templateId === 'emerald_cashback') {
    return renderWrapper(
      '💎 EMERALD CASHBACK REBATE',
      'VIP Loyalty Cashback Credited',
      'Automated Loss Protection & VIP Rebate',
      '#10b981',
      `
      <div style="background: #022c22; border: 2px solid #10b981; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center;">
        <div style="font-size: 11px; color: #a7f3d0; font-weight: 900; letter-spacing: 1.5px;">CASHBACK REFUND</div>
        <div style="font-size: 36px; font-weight: 900; color: #34d399; margin: 10px 0;">+ ₹${bAmt.toLocaleString('en-IN')}</div>
        <p style="margin: 0; font-size: 12px; color: #6ee7b7;">Your loyalty cashback has been transferred to your playable balance.</p>
      </div>
      `
    );
  }

  if (templateId === 'streak_lightning') {
    return renderWrapper(
      '⚡ DAILY STREAK LIGHTNING',
      'Daily Streak Bonus Multiplier!',
      'Active Player Streak Milestone Award',
      '#06b6d4',
      `
      <div style="background: #082f49; border: 2px solid #06b6d4; border-radius: 20px; padding: 22px; margin: 20px 0; text-align: center;">
        <div style="font-size: 11px; color: #7dd3fc; font-weight: 900; letter-spacing: 1.5px;">DAILY STREAK REWARD</div>
        <div style="font-size: 36px; font-weight: 900; color: #38bdf8; margin: 10px 0;">+ ₹${bAmt.toLocaleString('en-IN')}</div>
        <p style="margin: 0; font-size: 12px; color: #bae6fd;">Keep your daily streak alive for higher multiplier rewards tomorrow!</p>
      </div>
      `
    );
  }

  // Default: trophy_sparkle
  return renderWrapper(
    '🏆 8K TROPHY SPARKLE REWARD',
    'Special Bonus Chips Credited!',
    'Exclusive BETGURU Promotional Reward',
    '#f59e0b',
    `
    <div style="background: linear-gradient(180deg, rgba(245,158,11,0.2) 0%, rgba(15,23,42,0.9) 100%); border: 2px solid #f59e0b; border-radius: 22px; padding: 26px; margin: 20px 0; text-align: center; box-shadow: 0 15px 40px rgba(245,158,11,0.25);">
      <span style="font-size: 11px; color: #fde68a; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">
        ${bTitle}
      </span>
      <div style="font-size: 40px; font-weight: 900; color: #fbbf24; margin: 12px 0; text-shadow: 0 0 30px rgba(251,191,36,0.6);">
        + ₹${bAmt.toLocaleString('en-IN')}
      </div>
      <div style="display: inline-block; background: rgba(245,158,11,0.25); border: 1px solid #f59e0b88; border-radius: 9999px; padding: 6px 18px; font-size: 12px; font-weight: 800; color: #fef08a; font-family: monospace;">
        🎁 Playable on Live Draws & Casino
      </div>
    </div>

    <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; text-align: center; margin: 0;">
      Enjoy your bonus chips! Spin the lucky wheel or bet on your favorite 3D/4D numbers now.
    </p>
    `
  );
}
