import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SmtpChannelPurpose, EmailActivityLog } from '../types';
import { 
  renderEmailHtml, 
  getActiveTemplateSettings, 
  logEmailActivity 
} from './emailTemplates';

export interface SmtpConfig {
  email: string;
  appPasswordEncrypted: string;
  senderName: string;
  host: string;
  port: number;
  purpose?: SmtpChannelPurpose;
}

export interface SendOtpResult {
  success: boolean;
  isInstantFallback?: boolean;
  message?: string;
}

/**
 * Retrieves the designated active SMTP account configured by Admin in Firestore for a specific purpose.
 */
export async function getActiveSmtpConfig(purpose?: SmtpChannelPurpose): Promise<SmtpConfig | null> {
  try {
    const q = collection(db, 'smtp_accounts');
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const accounts: any[] = [];
    snap.forEach((docSnap) => {
      accounts.push({ id: docSnap.id, ...docSnap.data() });
    });

    let matchedAcc: any = null;

    if (purpose) {
      if (purpose === 'deposit') {
        matchedAcc = accounts.find((a) => a.isDepositSender || a.channelPurpose === 'deposit');
      } else if (purpose === 'withdrawal') {
        matchedAcc = accounts.find((a) => a.isWithdrawalSender || a.channelPurpose === 'withdrawal');
      } else if (purpose === 'security') {
        matchedAcc = accounts.find((a) => a.isSecuritySender || a.channelPurpose === 'security');
      } else if (purpose === 'otp') {
        matchedAcc = accounts.find((a) => a.isPrimaryOtpSender || a.channelPurpose === 'otp');
      }
    }

    // Fallback: Primary OTP sender or first available account
    if (!matchedAcc) {
      matchedAcc = accounts.find((a) => a.isPrimaryOtpSender) || accounts[0];
    }

    if (matchedAcc && matchedAcc.email && matchedAcc.appPasswordEncrypted) {
      let defaultSenderName = matchedAcc.senderName;
      if (!defaultSenderName) {
        if (purpose === 'deposit') defaultSenderName = 'BETGURU Deposit Desk';
        else if (purpose === 'withdrawal') defaultSenderName = 'BETGURU Payout Department';
        else if (purpose === 'security') defaultSenderName = 'BETGURU Security & Compliance';
        else defaultSenderName = 'BETGURU Security Team';
      }

      return {
        email: matchedAcc.email,
        appPasswordEncrypted: matchedAcc.appPasswordEncrypted,
        senderName: defaultSenderName,
        host: matchedAcc.host || 'smtp.gmail.com',
        port: Number(matchedAcc.port) || 587,
        purpose: matchedAcc.channelPurpose || purpose || 'all'
      };
    }
  } catch (err) {
    console.warn('Error fetching SMTP config from Firestore:', err);
  }
  return null;
}

/**
 * Sends a standard email via the backend /api/send-email route with purpose-specific SMTP routing.
 */
export async function sendSmtpEmail({
  to,
  subject,
  html,
  text,
  purpose = 'all',
  customSenderName
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  purpose?: SmtpChannelPurpose;
  customSenderName?: string;
}): Promise<boolean> {
  try {
    if (!to || !to.includes('@')) return false;
    const smtp = await getActiveSmtpConfig(purpose);
    if (!smtp) {
      console.warn(`No active SMTP account found for purpose '${purpose}' in Admin Panel.`);
      return false;
    }

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.trim().toLowerCase(),
        subject,
        html,
        text,
        smtp: {
          email: smtp.email,
          appPassword: smtp.appPasswordEncrypted,
          senderName: customSenderName || smtp.senderName,
          host: smtp.host,
          port: smtp.port
        }
      })
    });

    const textResp = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(textResp);
    } catch {
      console.warn('Non-JSON response from /api/send-email:', textResp.slice(0, 100));
      return false;
    }

    return !!data.success;
  } catch (err) {
    console.error('Error sending SMTP email:', err);
    return false;
  }
}

/**
 * Sends an OTP email via the backend /api/send-otp route with Firestore real-time tracking.
 */
export async function sendSmtpOtp({
  email,
  otp,
  name,
  type = 'registration'
}: {
  email: string;
  otp: string;
  name?: string;
  type?: 'registration' | 'security' | 'forgot_password' | 'password_reset' | 'pin_reset' | 'pin_setup';
}): Promise<SendOtpResult> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Record OTP in Firestore collection in real-time
  try {
    const otpDocRef = doc(db, 'email_otps', cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
    await setDoc(otpDocRef, {
      email: cleanEmail,
      otp,
      name: name || '',
      type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false
    }, { merge: true });
  } catch (firestoreErr) {
    console.warn('Real-time Firestore OTP record notice:', firestoreErr);
  }

  // 2. Retrieve active template and SMTP configuration dedicated for OTP
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeOtpTemplate || 'quantum_shield';
  const customHtml = renderEmailHtml('otp', templateId, {
    userName: name,
    otp,
    otpType: type
  });

  const smtp = await getActiveSmtpConfig('otp');

  // 3. Attempt API dispatch
  let isSmtpSuccess = false;
  let smtpErrorMsg = '';

  if (smtp && smtp.email && smtp.appPasswordEncrypted) {
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp,
          name,
          type,
          customHtml,
          smtp: {
            email: smtp.email,
            appPassword: smtp.appPasswordEncrypted,
            senderName: smtp.senderName || 'BETGURU Security Team',
            host: smtp.host,
            port: smtp.port
          }
        })
      });

      const textResp = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(textResp);
      } catch {
        console.warn('Non-JSON response from /api/send-otp:', textResp.slice(0, 100));
        data = { success: false, error: 'Server response non-JSON' };
      }

      if (data.success) {
        isSmtpSuccess = true;
      } else {
        smtpErrorMsg = data.error || 'SMTP dispatch failed';
      }
    } catch (netErr: any) {
      console.warn('Network error while reaching /api/send-otp:', netErr.message);
      smtpErrorMsg = netErr.message || 'Network unreachable';
    }
  } else {
    smtpErrorMsg = 'Admin SMTP credentials not configured yet';
  }

  // 4. Log in Email Activity
  logEmailActivity({
    recipientEmail: cleanEmail,
    recipientName: name,
    category: 'otp',
    templateId,
    subject: `🔐 BETGURU Security OTP: ${otp}`,
    status: isSmtpSuccess ? 'sent' : 'failed',
    errorMessage: isSmtpSuccess ? undefined : smtpErrorMsg
  }).catch(() => {});

  if (isSmtpSuccess) {
    return {
      success: true,
      isInstantFallback: false,
      message: `ইমেইলে (${cleanEmail}) সফলভাবে ৬-সংখ্যার OTP কোড পাঠানো হয়েছে।`
    };
  }

  return {
    success: true,
    isInstantFallback: true,
    message: `ইনস্ট্যান্ট সিকিউরিটি OTP তৈরি হয়েছে। কোডটি দিয়ে ভেরিফিকেশন সম্পন্ন করুন।`
  };
}

/* ====================================================================
   DEPOSIT NOTIFICATION DISPATCHERS (Using Dedicated Deposit SMTP & 8K Templates)
   ==================================================================== */

export async function notifyDepositSubmitted(email: string, userName: string, amount: number, method: string, utr: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeDepositTemplate || 'cyber_gold';
  const html = renderEmailHtml('deposit', templateId, {
    userName,
    amount,
    method,
    utr,
    status: 'pending'
  });

  const subject = `⏳ BETGURU Deposit Received: ₹${amount.toLocaleString('en-IN')}`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'deposit',
    customSenderName: 'BETGURU Deposit Desk',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'deposit',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    method,
    utr
  }).catch(() => {});

  return sent;
}

export async function notifyDepositApproved(email: string, userName: string, amount: number, method?: string, utr?: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeDepositTemplate || 'cyber_gold';
  const html = renderEmailHtml('deposit', templateId, {
    userName,
    amount,
    method: method || 'UPI',
    utr: utr || 'VERIFIED-AUTO',
    status: 'approved'
  });

  const subject = `✅ BETGURU Deposit Approved! ₹${amount.toLocaleString('en-IN')} Credited`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'deposit',
    customSenderName: 'BETGURU Deposit Desk',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'deposit',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    method: method || 'UPI',
    utr: utr || 'VERIFIED-AUTO'
  }).catch(() => {});

  return sent;
}

export async function notifyDepositRejected(email: string, userName: string, amount: number, reason: string, method?: string, utr?: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeDepositTemplate || 'cyber_gold';
  const html = renderEmailHtml('deposit', templateId, {
    userName,
    amount,
    method: method || 'UPI',
    utr: utr || 'N/A',
    status: 'rejected',
    reason
  });

  const subject = `❌ BETGURU Deposit Notice: ₹${amount.toLocaleString('en-IN')} Rejected`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'deposit',
    customSenderName: 'BETGURU Deposit Desk',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'deposit',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    method,
    utr,
    reason
  }).catch(() => {});

  return sent;
}

/* ====================================================================
   WITHDRAWAL NOTIFICATION DISPATCHERS (Using Dedicated Payout SMTP & 8K Templates)
   ==================================================================== */

export async function notifyWithdrawalSubmitted(email: string, userName: string, amount: number, accountLast4: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeWithdrawalTemplate || 'golden_vault';
  const html = renderEmailHtml('withdrawal', templateId, {
    userName,
    amount,
    accountEnding: accountLast4,
    status: 'pending'
  });

  const subject = `⏳ BETGURU Withdrawal Request: ₹${amount.toLocaleString('en-IN')} Received`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'withdrawal',
    customSenderName: 'BETGURU Payout Department',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'withdrawal',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    accountEnding: accountLast4
  }).catch(() => {});

  return sent;
}

export async function notifyWithdrawalApproved(email: string, userName: string, amount: number, accountNumber: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeWithdrawalTemplate || 'golden_vault';
  const html = renderEmailHtml('withdrawal', templateId, {
    userName,
    amount,
    accountNumber,
    accountEnding: accountNumber.slice(-4),
    status: 'approved'
  });

  const subject = `✅ BETGURU Payout Sent! ₹${amount.toLocaleString('en-IN')} Dispatched`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'withdrawal',
    customSenderName: 'BETGURU Payout Department',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'withdrawal',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    accountEnding: accountNumber.slice(-4)
  }).catch(() => {});

  return sent;
}

export async function notifyWithdrawalRejected(email: string, userName: string, amount: number, reason: string, accountNumber?: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeWithdrawalTemplate || 'golden_vault';
  const html = renderEmailHtml('withdrawal', templateId, {
    userName,
    amount,
    accountEnding: accountNumber ? accountNumber.slice(-4) : '••••',
    status: 'rejected',
    reason
  });

  const subject = `❌ BETGURU Withdrawal Update: ₹${amount.toLocaleString('en-IN')} Refunded`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'withdrawal',
    customSenderName: 'BETGURU Payout Department',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'withdrawal',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount,
    reason
  }).catch(() => {});

  return sent;
}

/* ====================================================================
   SECURITY TEAM DIRECT MESSAGE / NOTICE DISPATCHER
   ==================================================================== */

export async function sendSecurityTeamEmail({
  to,
  userName,
  subject,
  message,
  noticeType = 'security_alert',
  urgency = 'high',
  adminName = 'BETGURU Security Desk'
}: {
  to: string;
  userName?: string;
  subject: string;
  message: string;
  noticeType?: 'security_alert' | 'kyc_required' | 'suspicious_login' | 'fair_play' | 'account_suspended' | 'general_notice';
  urgency?: 'normal' | 'high' | 'critical';
  adminName?: string;
}): Promise<boolean> {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeSecurityTemplate || 'sentinel_crimson';

  const formattedHtml = renderEmailHtml('security', templateId, {
    userName: userName || 'Player',
    securitySubject: subject,
    securityMessage: message,
    noticeType,
    urgency,
    adminName
  });

  // 1. Send via Security SMTP Account
  const sendSuccess = await sendSmtpEmail({
    to,
    subject: `🛡️ ${subject}`,
    html: formattedHtml,
    text: message,
    purpose: 'security',
    customSenderName: 'BETGURU Security & Compliance Desk'
  });

  // 2. Log in Firestore collection for security auditing
  try {
    const noticeId = `SEC-MSG-${Date.now()}`;
    await setDoc(doc(db, 'security_notices', noticeId), {
      id: noticeId,
      userEmail: to.trim().toLowerCase(),
      userName: userName || '',
      subject,
      message,
      noticeType,
      urgency,
      senderName: 'BETGURU Security & Compliance Desk',
      sentAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: sendSuccess ? 'sent' : 'failed',
      adminName
    });
  } catch (logErr) {
    console.warn('Security notice logging notice:', logErr);
  }

  // 3. Log in Email Activity
  logEmailActivity({
    recipientEmail: to,
    recipientName: userName,
    category: 'security',
    templateId,
    subject: `🛡️ ${subject}`,
    status: sendSuccess ? 'sent' : 'failed'
  }).catch(() => {});

  return sendSuccess;
}

/* ====================================================================
   BONUS NOTIFICATION DISPATCHER
   ==================================================================== */

export async function notifyBonusCredited(email: string, userName: string, bonusAmount: number, bonusTitle: string) {
  const tmplSettings = await getActiveTemplateSettings();
  const templateId = tmplSettings.activeBonusTemplate || 'trophy_sparkle';
  const html = renderEmailHtml('bonus', templateId, {
    userName,
    bonusAmount,
    bonusTitle
  });

  const subject = `🎉 BETGURU Bonus Alert! ₹${bonusAmount.toLocaleString('en-IN')} Credited`;
  const sent = await sendSmtpEmail({
    to: email,
    purpose: 'deposit',
    customSenderName: 'BETGURU Rewards & VIP Desk',
    subject,
    html
  });

  logEmailActivity({
    recipientEmail: email,
    recipientName: userName,
    category: 'bonus',
    templateId,
    subject,
    status: sent ? 'sent' : 'failed',
    amount: bonusAmount,
    bonusTitle
  }).catch(() => {});

  return sent;
}

/* ====================================================================
   RESEND EMAIL HELPER (1-Click Resend for Admin Activity Log)
   ==================================================================== */

export async function resendEmailActivity(log: EmailActivityLog): Promise<boolean> {
  try {
    let success = false;
    if (log.category === 'deposit') {
      if (log.subject.includes('Approved')) {
        success = await notifyDepositApproved(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.method, log.utr);
      } else if (log.subject.includes('Reject')) {
        success = await notifyDepositRejected(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.reason || 'Verification update', log.method, log.utr);
      } else {
        success = await notifyDepositSubmitted(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.method || 'UPI', log.utr || 'N/A');
      }
    } else if (log.category === 'withdrawal') {
      if (log.subject.includes('Sent') || log.subject.includes('Approved')) {
        success = await notifyWithdrawalApproved(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.accountEnding || '••••');
      } else if (log.subject.includes('Update') || log.subject.includes('Refund')) {
        success = await notifyWithdrawalRejected(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.reason || 'Account details update', log.accountEnding);
      } else {
        success = await notifyWithdrawalSubmitted(log.recipientEmail, log.recipientName || 'Player', log.amount || 0, log.accountEnding || '••••');
      }
    } else if (log.category === 'bonus') {
      success = await notifyBonusCredited(log.recipientEmail, log.recipientName || 'Player', log.amount || 500, log.bonusTitle || 'VIP Bonus Reward');
    } else if (log.category === 'otp') {
      const res = await sendSmtpOtp({
        email: log.recipientEmail,
        otp: Math.floor(100000 + Math.random() * 900000).toString(),
        name: log.recipientName,
        type: 'security'
      });
      success = res.success;
    }

    // Mark as resent
    if (log.id) {
      await setDoc(doc(db, 'email_activity_logs', log.id), {
        isResend: true,
        lastResentAt: new Date().toISOString()
      }, { merge: true });
    }

    return success;
  } catch (err) {
    console.error('Error resending email activity:', err);
    return false;
  }
}
