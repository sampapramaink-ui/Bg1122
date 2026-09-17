import React, { useState, useEffect } from 'react';
import { 
  Mail, ShieldCheck, Key, Plus, HelpCircle, CheckCircle2, AlertCircle, 
  Trash2, Edit, Send, Lock, Star, Check, Copy, ExternalLink, X, 
  ArrowRight, ShieldAlert, CreditCard, DollarSign, MessageSquare, 
  AlertTriangle, RefreshCw, Eye, Sparkles, CheckCheck, RotateCw, Gift
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { soundFx } from '../../utils/audio';
import { SmtpAccount, SmtpChannelPurpose, SecurityNoticeLog, User } from '../../types';
import { sendSecurityTeamEmail } from '../../utils/emailNotifier';
import { AdminEmailTemplatesTab } from './AdminEmailTemplatesTab';
import { AdminEmailActivityTab } from './AdminEmailActivityTab';

export const AdminSmtpManager: React.FC = () => {
  // Navigation tabs for dedicated channels, templates & activity
  const [activeTab, setActiveTab] = useState<'all' | 'otp' | 'deposit' | 'withdrawal' | 'security' | 'templates' | 'activity'>('all');
  
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityNoticeLog[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add/Edit Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formSenderName, setFormSenderName] = useState('BETGURU Security Team');
  const [formAppPassword, setFormAppPassword] = useState('');
  const [formShowPass, setFormShowPass] = useState(false);
  const [formHost, setFormHost] = useState('smtp.gmail.com');
  const [formPort, setFormPort] = useState<number>(587);
  const [formPurpose, setFormPurpose] = useState<SmtpChannelPurpose>('all');
  const [formIsPrimary, setFormIsPrimary] = useState(true);
  const [formIsDeposit, setFormIsDeposit] = useState(false);
  const [formIsWithdrawal, setFormIsWithdrawal] = useState(false);
  const [formIsSecurity, setFormIsSecurity] = useState(false);
  const [formDesc, setFormDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Account Confirmation Modal State
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; email: string; senderName?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test Email state
  const [testTargetEmail, setTestTargetEmail] = useState('');
  const [testingAccId, setTestingAccId] = useState<string | null>(null);

  // Security Direct Email Composer state
  const [secRecipientEmail, setSecRecipientEmail] = useState('');
  const [secRecipientName, setSecRecipientName] = useState('');
  const [secNoticeType, setSecNoticeType] = useState<SecurityNoticeLog['noticeType']>('security_alert');
  const [secUrgency, setSecUrgency] = useState<'normal' | 'high' | 'critical'>('high');
  const [secSubject, setSecSubject] = useState('Security Notice: Account Verification Required');
  const [secMessage, setSecMessage] = useState(
    'Our automated risk detection systems have flagged unusual activity on your account. To ensure your funds and profile are secure, please review your recent transactions and update your security settings immediately.'
  );
  const [isSendingSecEmail, setIsSendingSecEmail] = useState(false);

  // Real-time listener for smtp_accounts collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'smtp_accounts'), (snap) => {
      const list: SmtpAccount[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SmtpAccount);
      });
      // Sort primary first
      list.sort((a, b) => (b.isPrimaryOtpSender ? 1 : 0) - (a.isPrimaryOtpSender ? 1 : 0));
      setAccounts(list);
    }, (err) => console.warn('SMTP snapshot notice:', err.message));

    return () => unsub();
  }, []);

  // Fetch users list for Security Composer autocomplete
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList: User[] = [];
      snap.forEach((d) => {
        uList.push({ id: d.id, ...d.data() } as User);
      });
      setUsersList(uList);
    }, () => {});

    return () => unsubUsers();
  }, []);

  // Real-time listener for Security Notice logs
  useEffect(() => {
    const unsubSec = onSnapshot(collection(db, 'security_notices'), (snap) => {
      const sList: SecurityNoticeLog[] = [];
      snap.forEach((d) => {
        sList.push({ id: d.id, ...d.data() } as SecurityNoticeLog);
      });
      sList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSecurityLogs(sList);
    }, () => {});

    return () => unsubSec();
  }, []);

  // Preset sender presets
  const applySenderPreset = (type: 'otp' | 'deposit' | 'withdrawal' | 'security') => {
    soundFx.playClick();
    if (type === 'otp') {
      setFormSenderName('BETGURU Verification Team');
      setFormIsPrimary(true);
      setFormDesc('Dedicated sender for registration OTPs and password reset verification codes.');
    } else if (type === 'deposit') {
      setFormSenderName('BETGURU Deposit Desk');
      setFormIsDeposit(true);
      setFormDesc('Dedicated sender for instant deposit receipts and approval notices.');
    } else if (type === 'withdrawal') {
      setFormSenderName('BETGURU Payout Department');
      setFormIsWithdrawal(true);
      setFormDesc('Dedicated sender for withdrawal processing and payout confirmation emails.');
    } else if (type === 'security') {
      setFormSenderName('BETGURU Security & Compliance');
      setFormIsSecurity(true);
      setFormDesc('Official security team email for alerts, warnings, and KYC notices.');
    }
  };

  const handleOpenAddModal = (preset?: 'otp' | 'deposit' | 'withdrawal' | 'security') => {
    soundFx.playClick();
    setEditingId(null);
    setFormEmail('');
    setFormAppPassword('');
    setFormHost('smtp.gmail.com');
    setFormPort(587);
    setFormPurpose(preset || 'all');
    setFormIsPrimary(preset === 'otp' || accounts.length === 0);
    setFormIsDeposit(preset === 'deposit');
    setFormIsWithdrawal(preset === 'withdrawal');
    setFormIsSecurity(preset === 'security');
    
    if (preset) {
      applySenderPreset(preset);
    } else {
      setFormSenderName('BETGURU Security Team');
      setFormDesc('Multi-purpose Gmail SMTP account.');
    }
    setShowAddModal(true);
  };

  const handleOpenEditModal = (acc: SmtpAccount) => {
    soundFx.playClick();
    setEditingId(acc.id);
    setFormEmail(acc.email);
    setFormSenderName(acc.senderName || 'BETGURU Security Team');
    setFormAppPassword(acc.appPasswordEncrypted);
    setFormHost(acc.host || 'smtp.gmail.com');
    setFormPort(acc.port || 587);
    setFormPurpose(acc.channelPurpose || 'all');
    setFormIsPrimary(!!acc.isPrimaryOtpSender);
    setFormIsDeposit(!!acc.isDepositSender);
    setFormIsWithdrawal(!!acc.isWithdrawalSender);
    setFormIsSecurity(!!acc.isSecuritySender);
    setFormDesc(acc.description || '');
    setShowAddModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid Gmail address!' });
      return;
    }
    if (!formAppPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a 16-character Google App Password!' });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      const accId = editingId || `SMTP-${Date.now()}`;

      // Single-primary logic: if marked as primary for a specific channel, unmark other accounts for that channel
      if (formIsPrimary) {
        for (const acc of accounts) {
          if (acc.id !== accId && acc.isPrimaryOtpSender) {
            await setDoc(doc(db, 'smtp_accounts', acc.id), { isPrimaryOtpSender: false }, { merge: true });
          }
        }
      }
      if (formIsDeposit) {
        for (const acc of accounts) {
          if (acc.id !== accId && acc.isDepositSender) {
            await setDoc(doc(db, 'smtp_accounts', acc.id), { isDepositSender: false }, { merge: true });
          }
        }
      }
      if (formIsWithdrawal) {
        for (const acc of accounts) {
          if (acc.id !== accId && acc.isWithdrawalSender) {
            await setDoc(doc(db, 'smtp_accounts', acc.id), { isWithdrawalSender: false }, { merge: true });
          }
        }
      }
      if (formIsSecurity) {
        for (const acc of accounts) {
          if (acc.id !== accId && acc.isSecuritySender) {
            await setDoc(doc(db, 'smtp_accounts', acc.id), { isSecuritySender: false }, { merge: true });
          }
        }
      }

      const cleanPass = formAppPassword.replace(/\s+/g, '');
      const accData: SmtpAccount = {
        id: accId,
        email: formEmail.trim().toLowerCase(),
        senderName: formSenderName.trim() || 'BETGURU Security',
        appPasswordEncrypted: cleanPass,
        host: formHost.trim() || 'smtp.gmail.com',
        port: Number(formPort) || 587,
        isPrimaryOtpSender: formIsPrimary,
        isDepositSender: formIsDeposit,
        isWithdrawalSender: formIsWithdrawal,
        isSecuritySender: formIsSecurity,
        channelPurpose: formPurpose,
        description: formDesc.trim(),
        createdAt: new Date().toISOString(),
        status: 'Active'
      };

      await setDoc(doc(db, 'smtp_accounts', accId), accData, { merge: true });

      soundFx.playWinFanfare();
      setStatusMsg({
        type: 'success',
        text: `✓ Gmail account (${accData.email}) saved! Roles assigned: ${[
          formIsPrimary ? 'OTP Sender' : '',
          formIsDeposit ? 'Deposit Desk' : '',
          formIsWithdrawal ? 'Payout Desk' : '',
          formIsSecurity ? 'Security Desk' : ''
        ].filter(Boolean).join(', ') || 'General Sender'}.`
      });

      setShowAddModal(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to save account: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = (id: string, email: string, senderName?: string) => {
    soundFx.playClick();
    setAccountToDelete({ id, email, senderName });
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    soundFx.playClick();

    try {
      await deleteDoc(doc(db, 'smtp_accounts', accountToDelete.id));
      soundFx.playWin();
      setStatusMsg({ type: 'success', text: `✓ Gmail account (${accountToDelete.email}) সফলভাবে ডিলিট করা হয়েছে।` });
      setAccountToDelete(null);
    } catch (err: any) {
      console.error('Delete SMTP Account Error:', err);
      setStatusMsg({ type: 'error', text: `Failed to delete account: ${err.message || 'Error'}` });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleChannelRole = async (acc: SmtpAccount, role: 'otp' | 'deposit' | 'withdrawal' | 'security') => {
    soundFx.playClick();
    try {
      if (role === 'otp') {
        for (const a of accounts) {
          await setDoc(doc(db, 'smtp_accounts', a.id), { isPrimaryOtpSender: a.id === acc.id }, { merge: true });
        }
        setStatusMsg({ type: 'success', text: `Set ${acc.email} as Active OTP Sender.` });
      } else if (role === 'deposit') {
        for (const a of accounts) {
          await setDoc(doc(db, 'smtp_accounts', a.id), { isDepositSender: a.id === acc.id }, { merge: true });
        }
        setStatusMsg({ type: 'success', text: `Set ${acc.email} as Active Deposit Notifications Desk.` });
      } else if (role === 'withdrawal') {
        for (const a of accounts) {
          await setDoc(doc(db, 'smtp_accounts', a.id), { isWithdrawalSender: a.id === acc.id }, { merge: true });
        }
        setStatusMsg({ type: 'success', text: `Set ${acc.email} as Active Withdrawal & Payout Desk.` });
      } else if (role === 'security') {
        for (const a of accounts) {
          await setDoc(doc(db, 'smtp_accounts', a.id), { isSecuritySender: a.id === acc.id }, { merge: true });
        }
        setStatusMsg({ type: 'success', text: `Set ${acc.email} as Official Security & Compliance Desk.` });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to update role: ${err.message}` });
    }
  };

  const handleTestSmtp = async (acc: SmtpAccount, customTargetEmail?: string) => {
    soundFx.playClick();
    setTestingAccId(acc.id);
    setStatusMsg(null);

    try {
      const target = customTargetEmail || testTargetEmail.trim() || acc.email;
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: acc.email,
          appPassword: acc.appPasswordEncrypted,
          senderName: acc.senderName,
          host: acc.host,
          port: acc.port,
          testTarget: target
        })
      });

      let data: any = {};
      const textResp = await res.text();
      try {
        data = JSON.parse(textResp);
      } catch {
        data = {
          success: false,
          error: `Server returned non-JSON response (${res.status}): ${textResp.slice(0, 120)}`
        };
      }

      if (data.success) {
        await setDoc(doc(db, 'smtp_accounts', acc.id), {
          lastTestedAt: new Date().toISOString(),
          status: 'Active'
        }, { merge: true });

        soundFx.playWinFanfare();
        setStatusMsg({
          type: 'success',
          text: `⚡ ${data.message}`
        });
      } else {
        await setDoc(doc(db, 'smtp_accounts', acc.id), {
          status: 'Inactive'
        }, { merge: true });

        setStatusMsg({
          type: 'error',
          text: `❌ SMTP Connection Notice: ${data.error}`
        });
      }
    } catch (err: any) {
      console.error('SMTP test fetch error:', err);
      setStatusMsg({
        type: 'error',
        text: `Network Error: ${err.message}`
      });
    } finally {
      setTestingAccId(null);
    }
  };

  // Dispatch Official Security Direct Message
  const handleSendSecurityDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secRecipientEmail.trim() || !secRecipientEmail.includes('@')) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }
    if (!secMessage.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a security message body.' });
      return;
    }

    setIsSendingSecEmail(true);
    setStatusMsg(null);

    try {
      const success = await sendSecurityTeamEmail({
        to: secRecipientEmail.trim().toLowerCase(),
        userName: secRecipientName.trim() || 'Player',
        subject: secSubject.trim() || 'Official BETGURU Security Notice',
        message: secMessage.trim(),
        noticeType: secNoticeType,
        urgency: secUrgency,
        adminName: 'BETGURU Security Desk'
      });

      if (success) {
        soundFx.playWinFanfare();
        setStatusMsg({
          type: 'success',
          text: `✓ Official Security Message successfully dispatched to ${secRecipientEmail} via designated Security SMTP!`
        });
        setSecSubject('Security Notice: Account Verification Required');
        setSecMessage('');
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Failed to dispatch email. Please ensure a valid Security SMTP account is active.'
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Security dispatch error: ${err.message}` });
    } finally {
      setIsSendingSecEmail(false);
    }
  };

  // Channel Account Lookups
  const activeOtpAcc = accounts.find(a => a.isPrimaryOtpSender);
  const activeDepositAcc = accounts.find(a => a.isDepositSender) || activeOtpAcc;
  const activeWithdrawalAcc = accounts.find(a => a.isWithdrawalSender) || activeOtpAcc;
  const activeSecurityAcc = accounts.find(a => a.isSecuritySender) || activeOtpAcc;

  // Filter accounts according to active tab
  const displayedAccounts = accounts.filter(acc => {
    if (activeTab === 'all') return true;
    if (activeTab === 'otp') return acc.isPrimaryOtpSender || acc.channelPurpose === 'otp';
    if (activeTab === 'deposit') return acc.isDepositSender || acc.channelPurpose === 'deposit';
    if (activeTab === 'withdrawal') return acc.isWithdrawalSender || acc.channelPurpose === 'withdrawal';
    if (activeTab === 'security') return acc.isSecuritySender || acc.channelPurpose === 'security';
    return true;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-purple-950/70 to-slate-950 rounded-3xl border border-purple-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-2xl">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Gmail SMTP Multi-Channel Dispatcher</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                    SUPER ADMIN RESTRICTED ACCESS
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">
                    4 DEDICATED CHANNELS ACTIVE
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Organize dedicated Gmail accounts for <strong>Deposit Notifications</strong>, <strong>Withdrawal Alerts</strong>, <strong>Security Team Direct Messages</strong>, and <strong>OTP Verification</strong>. All dispatches use encrypted 16-character Google App Passwords.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => { soundFx.playClick(); setShowGuideModal(true); }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/40 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span>Google App Password Guide</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-purple-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Add Gmail Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Notification */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs space-y-3 shadow-lg animate-in fade-in ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5 sm:mt-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5 sm:mt-0" />
              )}
              <span className="font-bold leading-relaxed">{statusMsg.text}</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0">
              {statusMsg.type === 'error' && (
                <button
                  onClick={() => { soundFx.playClick(); setShowGuideModal(true); }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-[11px] flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>View Step-by-Step Guide</span>
                </button>
              )}
              <button
                onClick={() => setStatusMsg(null)}
                className="p-1 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Google 535 Error Quick-Fix Troubleshooter Banner */}
          {statusMsg.type === 'error' && (statusMsg.text.includes('535') || statusMsg.text.includes('App Password') || statusMsg.text.includes('rejected')) && (
            <div className="p-3 bg-slate-950/90 rounded-xl border border-amber-500/40 text-[11px] space-y-2 text-slate-300">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>How to resolve Google 535-5.7.8 Authentication Error:</span>
                </span>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg transition-all flex items-center gap-1.5 shadow"
                >
                  <span>🔑 Generate Google App Password</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                <li><strong className="text-white">Rule 1:</strong> Do not use your regular Gmail login password. Google strictly requires a <strong>16-character App Password</strong>.</li>
                <li><strong className="text-white">Rule 2:</strong> Ensure <strong>2-Step Verification</strong> is active on your Google Account (<code className="text-amber-300">myaccount.google.com/security</code>).</li>
                <li><strong className="text-white">Rule 3:</strong> Generate a password under App name <em>"BETGURU"</em>, copy the 16 characters, and paste it into the sender account settings.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 4 Multi-Channel Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* OTP Channel Card */}
        <div 
          onClick={() => { soundFx.playClick(); setActiveTab('otp'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'otp' ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/50' : 'bg-slate-900 border-slate-800 hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-purple-400 uppercase font-black flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              OTP SENDER
            </span>
            <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <span className="text-sm font-black text-white block mt-2 truncate">
            {activeOtpAcc ? activeOtpAcc.email : 'Not Assigned'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {activeOtpAcc ? activeOtpAcc.senderName : 'Uses default sender'}
          </span>
        </div>

        {/* Deposit Channel Card */}
        <div 
          onClick={() => { soundFx.playClick(); setActiveTab('deposit'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'deposit' ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/50' : 'bg-slate-900 border-slate-800 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-blue-400 uppercase font-black flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-blue-400" />
              DEPOSIT DESK
            </span>
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <span className="text-sm font-black text-white block mt-2 truncate">
            {activeDepositAcc ? activeDepositAcc.email : 'Not Assigned'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {activeDepositAcc ? activeDepositAcc.senderName : 'Uses primary OTP sender'}
          </span>
        </div>

        {/* Withdrawal Channel Card */}
        <div 
          onClick={() => { soundFx.playClick(); setActiveTab('withdrawal'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'withdrawal' ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-400 uppercase font-black flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-400" />
              PAYOUT DESK
            </span>
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-sm font-black text-white block mt-2 truncate">
            {activeWithdrawalAcc ? activeWithdrawalAcc.email : 'Not Assigned'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {activeWithdrawalAcc ? activeWithdrawalAcc.senderName : 'Uses primary OTP sender'}
          </span>
        </div>

        {/* Security Channel Card */}
        <div 
          onClick={() => { soundFx.playClick(); setActiveTab('security'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'security' ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/50' : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-400 uppercase font-black flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              SECURITY DESK
            </span>
            <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <span className="text-sm font-black text-white block mt-2 truncate">
            {activeSecurityAcc ? activeSecurityAcc.email : 'Not Assigned'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {activeSecurityAcc ? activeSecurityAcc.senderName : 'Uses primary OTP sender'}
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => { soundFx.playClick(); setActiveTab('all'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>All Accounts ({accounts.length})</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('deposit'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'deposit'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>💳 Deposit Notifications</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('withdrawal'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'withdrawal'
              ? 'bg-amber-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>💸 Withdrawal & Payouts</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('security'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-rose-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>🛡️ Security Team Direct Mail</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('otp'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'otp'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>📱 OTP Verification</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('templates'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>🎨 8K Animated Templates (20)</span>
        </button>

        <button
          onClick={() => { soundFx.playClick(); setActiveTab('activity'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>📜 Auto-Email Logs & Resend (রিসেন্ড)</span>
        </button>
      </div>

      {/* Tab 1, 2, 3: Channel Header Explanations */}
      {activeTab === 'deposit' && (
        <div className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-black text-blue-400 block">💳 Dedicated Deposit Email Channel</span>
            <p className="text-slate-300 text-[11px]">
              When users submit a deposit or when admin approves/rejects deposits, automated receipts are sent from this designated email.
            </p>
          </div>
          <button
            onClick={() => handleOpenAddModal('deposit')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deposit Desk Email</span>
          </button>
        </div>
      )}

      {activeTab === 'withdrawal' && (
        <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-black text-amber-400 block">💸 Dedicated Withdrawal & Payout Email Channel</span>
            <p className="text-slate-300 text-[11px]">
              Instant emails for withdrawal queue confirmation, transfer notifications, and refund updates are sent from this email.
            </p>
          </div>
          <button
            onClick={() => handleOpenAddModal('withdrawal')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Payout Desk Email</span>
          </button>
        </div>
      )}

      {activeTab === 'otp' && (
        <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-black text-purple-400 block">📱 Dedicated OTP Authentication Email Channel</span>
            <p className="text-slate-300 text-[11px]">
              All 6-digit verification codes for user registration and password resets are dispatched with high deliverability from this sender.
            </p>
          </div>
          <button
            onClick={() => handleOpenAddModal('otp')}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add OTP Sender Email</span>
          </button>
        </div>
      )}

      {/* SECURITY TAB: Interactive Security Email Composer & Logs */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-rose-500/30 rounded-3xl space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Send Official Security Direct Email to User</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Dispatched from: <strong className="text-rose-400">{activeSecurityAcc?.email || activeOtpAcc?.email || 'Default Security Desk'}</strong>
                  </span>
                </div>
              </div>

              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold">
                HIGH PRIORITY DISPATCH
              </span>
            </div>

            <form onSubmit={handleSendSecurityDirectMessage} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User selection / Email input */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block flex items-center justify-between">
                    <span>Recipient Email Address</span>
                    <span className="text-[10px] text-slate-500">Pick user or type custom email</span>
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@gmail.com"
                      value={secRecipientEmail}
                      onChange={(e) => setSecRecipientEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
                    />

                    {/* Quick Pick dropdown */}
                    {usersList.length > 0 && (
                      <select
                        onChange={(e) => {
                          const picked = usersList.find(u => u.email === e.target.value);
                          if (picked) {
                            setSecRecipientEmail(picked.email);
                            setSecRecipientName(picked.name || '');
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none"
                      >
                        <option value="">-- Or Select from Registered Players ({usersList.length}) --</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.email}>
                            {u.name || 'User'} ({u.email}) - {u.phone || 'No phone'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Recipient Name & Urgency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold block">Recipient Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={secRecipientName}
                      onChange={(e) => setSecRecipientName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-bold block">Urgency Level</label>
                    <select
                      value={secUrgency}
                      onChange={(e) => setSecUrgency(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="normal">Normal (Notice)</option>
                      <option value="high">High (Action Needed)</option>
                      <option value="critical">Critical (Immediate Warning)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notice Type & Subject */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Notice Category</label>
                  <select
                    value={secNoticeType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSecNoticeType(val);
                      if (val === 'kyc_required') setSecSubject('Action Required: Identity Verification & KYC Update');
                      else if (val === 'suspicious_login') setSecSubject('Security Alert: Unusual Device / Location Activity Detected');
                      else if (val === 'fair_play') setSecSubject('BETGURU Compliance: Fair Play & Multi-Account Policy');
                      else if (val === 'account_suspended') setSecSubject('Important: Account Security Hold Placed');
                      else setSecSubject('Security Notice: Account Verification Required');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="security_alert">🛡️ Security Alert</option>
                    <option value="kyc_required">🆔 KYC Required</option>
                    <option value="suspicious_login">🚨 Suspicious Login</option>
                    <option value="fair_play">⚖️ Fair Play Compliance</option>
                    <option value="account_suspended">⛔ Account Hold</option>
                    <option value="general_notice">📢 General Notice</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-slate-300 font-bold block">Email Subject</label>
                  <input
                    type="text"
                    required
                    value={secSubject}
                    onChange={(e) => setSecSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Message Body */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Security Message Body</label>
                <textarea
                  rows={4}
                  required
                  value={secMessage}
                  onChange={(e) => setSecMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500 leading-relaxed"
                  placeholder="Enter detailed security instructions, warnings, or KYC guidance for the user..."
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-500">
                  Email will be delivered with official BETGURU Security & Risk Operations formatting.
                </span>

                <button
                  type="submit"
                  disabled={isSendingSecEmail}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingSecEmail ? 'Sending Security Email...' : 'Send Security Email'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Security Notice Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Security Notice Dispatch Logs ({securityLogs.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400">Real-time Firestore Audit Stream</span>
            </div>

            {securityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No security notices dispatched yet. Use the composer above to send warnings or KYC notices.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {securityLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{log.userEmail}</span>
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.2 rounded font-bold uppercase">
                          {log.noticeType}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-bold">{log.subject}</p>
                    <p className="text-[10px] text-slate-400 truncate">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8K ANIMATED TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <AdminEmailTemplatesTab onNotify={(msg) => setStatusMsg(msg)} />
      )}

      {/* AUTO-EMAIL DISPATCH & RESEND ACTIVITY STREAM TAB */}
      {activeTab === 'activity' && (
        <AdminEmailActivityTab onNotify={(msg) => setStatusMsg(msg)} />
      )}

      {/* Test Email Dispatch Bar (Visible across accounts tabs) */}
      {activeTab !== 'templates' && activeTab !== 'activity' && accounts.length > 0 && (
        <div className="p-4 bg-slate-900 border border-purple-500/30 rounded-3xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              <span>Send Live Test Email to Custom Address</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Target Channel: <strong className="text-amber-400">{activeTab.toUpperCase()}</strong>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="email"
              placeholder="Enter recipient email (e.g. testuser@gmail.com)"
              value={testTargetEmail}
              onChange={(e) => setTestTargetEmail(e.target.value)}
              className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              onClick={() => {
                const targetAcc = activeOtpAcc || accounts[0];
                if (targetAcc) handleTestSmtp(targetAcc, testTargetEmail);
              }}
              disabled={!!testingAccId}
              className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shrink-0 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testingAccId ? 'Sending...' : 'Send Live Test Email'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Gmail Accounts List */}
      {activeTab !== 'templates' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Configured Gmail Accounts ({displayedAccounts.length})</span>
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-bold">
              TLS ENCRYPTED 256-BIT
            </span>
          </div>

          {displayedAccounts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Mail className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="text-xs text-slate-400 font-bold">No Gmail SMTP accounts configured for this view.</p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Click the "Add Gmail Account" button to add a dedicated sender.
              </p>
              <button
                onClick={() => handleOpenAddModal((activeTab === 'otp' || activeTab === 'deposit' || activeTab === 'withdrawal' || activeTab === 'security') ? activeTab : undefined)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                + Add Account For This Channel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    acc.isPrimaryOtpSender || acc.isDepositSender || acc.isWithdrawalSender || acc.isSecuritySender
                      ? 'bg-purple-950/40 border-purple-500/50 shadow-lg'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{acc.email}</span>

                      {/* Active Channel Badges */}
                      {acc.isPrimaryOtpSender && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Key className="w-3 h-3 text-purple-400" />
                          OTP SENDER
                        </span>
                      )}

                      {acc.isDepositSender && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-blue-400" />
                          DEPOSIT DESK
                        </span>
                      )}

                      {acc.isWithdrawalSender && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-amber-400" />
                          PAYOUT DESK
                        </span>
                      )}

                      {acc.isSecuritySender && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          SECURITY DESK
                        </span>
                      )}

                      <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-bold">
                        Host: {acc.host}:{acc.port}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Sender Name: <strong className="text-purple-300">{acc.senderName}</strong>
                      {acc.description && <span className="text-slate-500 ml-2">({acc.description})</span>}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                      <span>App Password: <strong className="text-slate-400">•••• •••• •••• {acc.appPasswordEncrypted.slice(-4)}</strong></span>
                      <span>• Status: <strong className="text-emerald-400">{acc.status}</strong></span>
                      {acc.lastTestedAt && <span>• Tested: {new Date(acc.lastTestedAt).toLocaleTimeString()}</span>}
                    </div>

                    {/* Quick Channel Assignment Buttons */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[10px] text-slate-500">Quick Set Role:</span>
                      <button
                        onClick={() => handleToggleChannelRole(acc, 'deposit')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          acc.isDepositSender ? 'bg-blue-500 text-white' : 'bg-slate-900 text-blue-400 hover:bg-slate-800 border border-blue-500/30'
                        }`}
                      >
                        {acc.isDepositSender ? '✓ Active Deposit Desk' : '+ Set Deposit Desk'}
                      </button>

                      <button
                        onClick={() => handleToggleChannelRole(acc, 'withdrawal')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          acc.isWithdrawalSender ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-amber-500/30'
                        }`}
                      >
                        {acc.isWithdrawalSender ? '✓ Active Payout Desk' : '+ Set Payout Desk'}
                      </button>

                      <button
                        onClick={() => handleToggleChannelRole(acc, 'security')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          acc.isSecuritySender ? 'bg-rose-500 text-white' : 'bg-slate-900 text-rose-400 hover:bg-slate-800 border border-rose-500/30'
                        }`}
                      >
                        {acc.isSecuritySender ? '✓ Active Security Desk' : '+ Set Security Desk'}
                      </button>

                      <button
                        onClick={() => handleToggleChannelRole(acc, 'otp')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          acc.isPrimaryOtpSender ? 'bg-purple-500 text-white' : 'bg-slate-900 text-purple-400 hover:bg-slate-800 border border-purple-500/30'
                        }`}
                      >
                        {acc.isPrimaryOtpSender ? '✓ Active OTP Sender' : '+ Set OTP Sender'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => handleTestSmtp(acc)}
                      disabled={testingAccId === acc.id}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Send Test Connection Request"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testingAccId === acc.id ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(acc)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                      title="Edit Credentials & Roles"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteAccount(acc.id, acc.email, acc.senderName)}
                      className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-400" />
                <span>{editingId ? 'Edit Gmail SMTP Account' : 'Add New Gmail SMTP Account'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold block">Quick Channel Presets:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applySenderPreset('otp')}
                  className="px-2 py-1.5 bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-500/40 rounded-xl text-[10px] font-bold text-center"
                >
                  📱 OTP Sender
                </button>
                <button
                  type="button"
                  onClick={() => applySenderPreset('deposit')}
                  className="px-2 py-1.5 bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-500/40 rounded-xl text-[10px] font-bold text-center"
                >
                  💳 Deposit Desk
                </button>
                <button
                  type="button"
                  onClick={() => applySenderPreset('withdrawal')}
                  className="px-2 py-1.5 bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-500/40 rounded-xl text-[10px] font-bold text-center"
                >
                  💸 Payout Desk
                </button>
                <button
                  type="button"
                  onClick={() => applySenderPreset('security')}
                  className="px-2 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-[10px] font-bold text-center"
                >
                  🛡️ Security Team
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Gmail Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. deposit.betguru@gmail.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Sender Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BETGURU Deposit Desk"
                  value={formSenderName}
                  onChange={(e) => setFormSenderName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-300 font-bold block">Google App Password (16 Characters)</label>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      formAppPassword.replace(/\s+/g, '').length === 16 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : formAppPassword.length > 0 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                        : 'text-slate-500'
                    }`}>
                      {formAppPassword.replace(/\s+/g, '').length}/16 {formAppPassword.replace(/\s+/g, '').length === 16 ? '✓ Valid' : 'chars'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>🔑 Open Google Page</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Guide
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={formShowPass ? 'text' : 'password'}
                    required
                    placeholder="e.g. abcd efgh ijkl mnop"
                    value={formAppPassword}
                    onChange={(e) => {
                      // Auto-sanitize spaces, quotes, and invalid characters on the fly
                      const sanitized = e.target.value.replace(/[\s\-_"'\u200B-\u200D\uFEFF]/g, '');
                      setFormAppPassword(sanitized);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-white focus:outline-none focus:border-purple-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setFormShowPass(!formShowPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                    title={formShowPass ? 'Hide password' : 'Show password'}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Must be generated from Google Account (not regular Gmail password). Spaces are removed automatically.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">SMTP Host</label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Port</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Roles & Capabilities Multi-Select */}
              <div className="space-y-2 pt-1 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <label className="text-[11px] text-purple-300 font-black uppercase block">
                  Assign Roles & Dispatch Capabilities:
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPrimary}
                      onChange={(e) => setFormIsPrimary(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-bold">📱 OTP Verification Sender</span>
                    <span className="text-[10px] text-slate-500">(Registration & Password reset)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsDeposit}
                      onChange={(e) => setFormIsDeposit(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-blue-300">💳 Deposit Notifications Desk</span>
                    <span className="text-[10px] text-slate-500">(Instant deposit receipt & approval)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsWithdrawal}
                      onChange={(e) => setFormIsWithdrawal(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-bold text-amber-300">💸 Withdrawal & Payout Desk</span>
                    <span className="text-[10px] text-slate-500">(Payout queue & fund transfer notice)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsSecurity}
                      onChange={(e) => setFormIsSecurity(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold text-rose-300">🛡️ Security Team Direct Mail</span>
                    <span className="text-[10px] text-slate-500">(Risk warnings, KYC & notices)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-lg cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Gmail Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google App Password Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-mono">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <span>Google App Password Setup Instructions</span>
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-center justify-between gap-2 p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl">
                <span className="font-bold text-white">
                  Direct Shortcut: Open Google App Passwords Page
                </span>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <span>🔑 Open Google Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="font-bold text-white">
                Follow these 4 quick steps to generate an App Password for high-deliverability Gmail SMTP:
              </p>

              <div className="space-y-2 pt-1">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 1: Enable 2-Step Verification</span>
                  <p className="text-[11px] text-slate-400">
                    Go to your Google Account (<span className="text-amber-300">myaccount.google.com/security</span>) -&gt; Turn on 2-Step Verification if not already enabled.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 2: Visit App Passwords Page</span>
                  <p className="text-[11px] text-slate-400">
                    Open <strong className="text-white">myaccount.google.com/apppasswords</strong> directly or search "App Passwords" in your Google Account security settings.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 3: Generate New Password</span>
                  <p className="text-[11px] text-slate-400">
                    Enter app name as <strong className="text-white">"BETGURU"</strong> and click Generate. Google will display a 16-character code (e.g., <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">abcd efgh ijkl mnop</code>).
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 4: Paste into BETGURU Admin</span>
                  <p className="text-[11px] text-slate-400">
                    Paste the 16-character code into the Google App Password field. Spaces and formatting are sanitized automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500">
                Need help? Ensure you do not use your normal Gmail login password.
              </span>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                Understood, Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-mono">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <span>Delete Gmail SMTP Account</span>
              </h3>
              <button
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-2">
              <p className="text-xs text-rose-200 font-bold">
                Are you sure you want to permanently delete this Gmail SMTP account?
              </p>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="text-white font-bold">{accountToDelete.email}</div>
                {accountToDelete.senderName && (
                  <div className="text-[11px] text-slate-400">{accountToDelete.senderName}</div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                This will remove it from the active dispatcher list in real-time. You can re-add it whenever needed.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
