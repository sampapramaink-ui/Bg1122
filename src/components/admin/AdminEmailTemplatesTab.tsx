import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, Eye, Send, RefreshCw, X, 
  CreditCard, DollarSign, Key, Gift, ShieldCheck, Check, 
  Palette, Play, ShieldAlert 
} from 'lucide-react';
import { 
  EMAIL_TEMPLATE_CATALOG, 
  getActiveTemplateSettings, 
  saveActiveTemplateSettings, 
  renderEmailHtml 
} from '../../utils/emailTemplates';
import { SmtpTemplateSettings, EmailTemplateOption, EmailTemplateCategory } from '../../types';
import { soundFx } from '../../utils/audio';
import { sendSmtpEmail } from '../../utils/emailNotifier';

interface AdminEmailTemplatesTabProps {
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export const AdminEmailTemplatesTab: React.FC<AdminEmailTemplatesTabProps> = ({ onNotify }) => {
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplateCategory>('deposit');
  const [activeSettings, setActiveSettings] = useState<SmtpTemplateSettings>({
    activeDepositTemplate: 'cyber_gold',
    activeWithdrawalTemplate: 'golden_vault',
    activeOtpTemplate: 'quantum_shield',
    activeBonusTemplate: 'trophy_sparkle',
    activeSecurityTemplate: 'sentinel_crimson',
    updatedAt: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateOption | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Load saved template choices from Firestore
  useEffect(() => {
    getActiveTemplateSettings().then((settings) => {
      setActiveSettings(settings);
    }).catch((err) => console.warn('Load template settings err:', err));
  }, []);

  const templatesForCategory = EMAIL_TEMPLATE_CATALOG.filter(t => t.category === selectedCategory);

  const getActiveTemplateId = (cat: EmailTemplateCategory) => {
    if (cat === 'deposit') return activeSettings.activeDepositTemplate;
    if (cat === 'withdrawal') return activeSettings.activeWithdrawalTemplate;
    if (cat === 'otp') return activeSettings.activeOtpTemplate;
    if (cat === 'security') return activeSettings.activeSecurityTemplate;
    return activeSettings.activeBonusTemplate;
  };

  const handleSetActiveTemplate = async (templateId: string) => {
    soundFx.playWin();
    setIsLoading(true);

    const updated: SmtpTemplateSettings = {
      ...activeSettings,
      updatedAt: new Date().toISOString()
    };

    if (selectedCategory === 'deposit') updated.activeDepositTemplate = templateId;
    else if (selectedCategory === 'withdrawal') updated.activeWithdrawalTemplate = templateId;
    else if (selectedCategory === 'otp') updated.activeOtpTemplate = templateId;
    else if (selectedCategory === 'security') updated.activeSecurityTemplate = templateId;
    else if (selectedCategory === 'bonus') updated.activeBonusTemplate = templateId;

    setActiveSettings(updated);

    const success = await saveActiveTemplateSettings(updated);
    setIsLoading(false);

    if (success) {
      if (onNotify) {
        onNotify({
          type: 'success',
          text: `✓ সফলভাবে ${selectedCategory.toUpperCase()} এর জন্য নতুন 8K এনিমেটেড টেমপ্লেট (${templateId}) সেট করা হয়েছে!`
        });
      }
    } else {
      if (onNotify) {
        onNotify({
          type: 'error',
          text: 'টেমপ্লেট সেভ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
        });
      }
    }
  };

  // Generate Sample Dynamic Payload for live preview
  const getSamplePayload = (template: EmailTemplateOption) => {
    if (template.category === 'deposit') {
      return {
        userName: 'Rahul Sharma',
        amount: 5000,
        status: 'approved' as const,
        utr: 'UTR892031894291',
        method: 'UPI Instant / PhonePe'
      };
    }
    if (template.category === 'withdrawal') {
      return {
        userName: 'Sneha Roy',
        amount: 12500,
        status: 'approved' as const,
        method: 'IMPS Direct Bank Rail',
        accountEnding: '4892'
      };
    }
    if (template.category === 'otp') {
      return {
        userName: 'Player One',
        otpCode: '849201',
        type: 'verification'
      };
    }
    if (template.category === 'security') {
      return {
        userName: 'Account Holder',
        reason: 'Suspicious IP Login Attempt Blocked',
        status: 'approved' as const
      };
    }
    return {
      userName: 'VIP Champion',
      bonusTitle: 'Mega Supercar Festival Reward',
      bonusAmount: 2500
    };
  };

  const handleSendTestTemplate = async () => {
    if (!previewTemplate || !testEmailAddress.trim()) {
      if (onNotify) onNotify({ type: 'error', text: 'অনুগ্রহ করে টেস্ট ইমেইল ঠিকানা দিন।' });
      return;
    }

    setIsSendingTest(true);
    soundFx.playClick();

    const sample = getSamplePayload(previewTemplate);
    const html = renderEmailHtml(previewTemplate.category, previewTemplate.id, sample);
    const subject = `[8K PREVIEW] BETGURU Test: ${previewTemplate.name}`;

    const res = await sendSmtpEmail({
      to: testEmailAddress.trim(),
      customSenderName: `BETGURU ${previewTemplate.category.toUpperCase()} PREVIEW`,
      subject,
      html,
      purpose: previewTemplate.category === 'otp' ? 'otp' : previewTemplate.category === 'deposit' ? 'deposit' : previewTemplate.category === 'withdrawal' ? 'withdrawal' : previewTemplate.category === 'security' ? 'security' : 'all'
    });

    setIsSendingTest(false);

    if (res) {
      soundFx.playWinFanfare();
      if (onNotify) onNotify({ type: 'success', text: `✓ 8K টেমপ্লেট সফলভাবে ${testEmailAddress} ঠিকানায় টেস্ট সেন্ট হয়েছে!` });
    } else {
      if (onNotify) onNotify({ type: 'error', text: 'টেস্ট ইমেইল পাঠানো ব্যর্থ হয়েছে। সক্রিয় SMTP একাউন্ট চেক করুন।' });
    }
  };

  return (
    <div className="space-y-6 font-mono">
      
      {/* Top Description Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-950 border border-amber-500/30 rounded-3xl space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-spin [animation-duration:8s]" />
              <h3 className="text-base sm:text-lg font-black text-white">8K Ultra-Luxury Animated Email Templates</h3>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase">
                5 TEMPLATES PER CATEGORY (20 TOTAL)
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Select which high-definition animated email template is sent automatically for Deposits, Withdrawals, Security OTPs, and Bonuses.
            </p>
          </div>
        </div>

        {/* Category Selector Tabs */}
        <div className="flex items-center gap-2 pt-2 overflow-x-auto">
          {[
            { id: 'deposit', label: '💳 Deposit (5 Templates)', icon: CreditCard, color: 'blue' },
            { id: 'withdrawal', label: '💸 Withdrawal (5 Templates)', icon: DollarSign, color: 'amber' },
            { id: 'otp', label: '🔐 OTP Verification (5 Templates)', icon: Key, color: 'purple' },
            { id: 'security', label: '🛡️ Security Alerts (5 Templates)', icon: ShieldAlert, color: 'rose' },
            { id: 'bonus', label: '🎁 Bonus & Rewards (5 Templates)', icon: Gift, color: 'emerald' },
          ].map((cat) => {
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundFx.playClick();
                  setSelectedCategory(cat.id as any);
                }}
                className={`py-2.5 px-4 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                  isSel
                    ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-amber-500/40'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of 5 Templates for Selected Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templatesForCategory.map((tpl) => {
          const isActive = getActiveTemplateId(selectedCategory) === tpl.id;

          return (
            <div
              key={tpl.id}
              className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 shadow-xl ${
                isActive
                  ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/10'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {tpl.themeName || '8K ULTRA LUXURY'}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1.5 flex items-center gap-1.5">
                      {tpl.name}
                    </h4>
                  </div>

                  {isActive ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      ACTIVE
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {tpl.description}
                </p>

                {/* Animated FX Highlights */}
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>Visual Style: {tpl.themeName}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    256-bit SSL encrypted • HTML5 Animated Responsive Container
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setPreviewTemplate(tpl);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>8K Preview</span>
                </button>

                {!isActive ? (
                  <button
                    type="button"
                    onClick={() => handleSetActiveTemplate(tpl.id)}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Set Active</span>
                  </button>
                ) : (
                  <span className="flex-1 py-2.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Current Default
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 8K LIVE HTML TEMPLATE PREVIEW MODAL                                       */}
      {/* ========================================================================= */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border-2 border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    {previewTemplate.name}
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/40">
                      {previewTemplate.themeName}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Live 8K Responsive HTML Preview with real mock data</p>
                </div>
              </div>

              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Test Send Bar */}
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Send className="w-4 h-4 text-purple-400 shrink-0" />
                <input
                  type="email"
                  placeholder="Enter email to send live test..."
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-full sm:w-64"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleSendTestTemplate}
                  disabled={isSendingTest || !testEmailAddress.trim()}
                  className="py-1.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSendingTest ? 'Sending Test...' : 'Send Live Test Email'}</span>
                </button>

                <button
                  onClick={() => {
                    handleSetActiveTemplate(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  className="py-1.5 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Set as Active Template</span>
                </button>
              </div>
            </div>

            {/* Rendered HTML Sandbox Frame */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center items-start">
              <div 
                className="w-full max-w-xl shadow-2xl rounded-2xl overflow-hidden border border-slate-800"
                dangerouslySetInnerHTML={{
                  __html: renderEmailHtml(previewTemplate.category, previewTemplate.id, getSamplePayload(previewTemplate))
                }}
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
