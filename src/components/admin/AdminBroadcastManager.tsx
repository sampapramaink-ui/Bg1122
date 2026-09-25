import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Bell, ShieldCheck, CheckCircle2, AlertCircle, Trash2, Search, Smartphone, Mail, MessageSquare, Radio, Sparkles, Filter, RefreshCw, Eye, Users, Gift, User, ShieldAlert, Check, X, UserCheck, Download, Code, Play } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../../firebase';
import { safeApiPost } from '../../utils/apiConfig';
import { soundFx } from '../../utils/audio';
import { sendSmtpEmail } from '../../utils/emailNotifier';
import { NotificationItem, AppUpdateConfig } from '../../types';
import { getUserDisplayCode, calculateUserSearchScore } from '../../utils/databaseSync';
import { triggerAppUpdate, clearNativeAppCache, getNativeAppVersion, saveAppUpdateConfigToFirestore, DEFAULT_APP_UPDATE_CONFIG } from '../../utils/appUpdateService';

interface BroadcastCampaign {
  id: string;
  title: string;
  priority: 'Urgent / Alert' | 'High Priority' | 'Normal Announcement' | 'Promotional';
  targetSegment: 'All Users' | 'Active Players' | 'VIP Players' | 'High Balance Users' | 'Single Player';
  body: string;
  channels: string[];
  createdAt: string;
  sentCount?: number;
  status?: 'Sent' | 'Scheduled' | 'Failed';
  recipientName?: string;
  recipientCode?: string;
}

export const AdminBroadcastManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'personal' | 'reg_bonus' | 'app_update'>('app_update');

  const [campaignTitle, setCampaignTitle] = useState('');
  const [priorityType, setPriorityType] = useState<BroadcastCampaign['priority']>('Urgent / Alert');
  const [targetSegment, setTargetSegment] = useState<BroadcastCampaign['targetSegment']>('All Users');
  const [messageBody, setMessageBody] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['In-App Push', 'Banner']);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Real-time campaigns list
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // All Registered Users list for instant live search & autocompletion
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  // Personal / Targeted Notification States
  const [personalUserSearch, setPersonalUserSearch] = useState('');
  const [selectedTargetUser, setSelectedTargetUser] = useState<any | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [personalType, setPersonalType] = useState<'deposit' | 'withdrawal' | 'win' | 'loss' | 'system'>('system');
  const [personalSelectedChannels, setPersonalSelectedChannels] = useState<string[]>(['In-App Push', 'Native Push (FCM)', 'Email Newsletter']);
  const [isSendingPersonal, setIsSendingPersonal] = useState(false);

  // Search input dropdown ref for outside click handling
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Registration Bonus Settings States
  const [bonusAmount, setBonusAmount] = useState<number>(100);
  const [isBonusEnabled, setIsBonusEnabled] = useState<boolean>(true);
  const [duplicateDetectionEnabled, setDuplicateDetectionEnabled] = useState<boolean>(true);
  const [isSavingBonusConfig, setIsSavingBonusConfig] = useState<boolean>(false);

  // App Update & Version Control States
  const [updateVersionCode, setUpdateVersionCode] = useState<number>(2);
  const [updateVersionName, setUpdateVersionName] = useState<string>('2.0');
  const [updateApkUrl, setUpdateApkUrl] = useState<string>('https://your-domain.com/downloads/betguru.apk');
  const [updateChangelog, setUpdateChangelog] = useState<string>('• নতুন লাইভ ক্যাসিনো ফিচার\n• ফাস্ট উইথড্রয়াল গেটওয়ে\n• পারফরমেন্স উন্নতি');
  const [updateForceUpdate, setUpdateForceUpdate] = useState<boolean>(false);
  const [isSavingUpdateConfig, setIsSavingUpdateConfig] = useState<boolean>(false);
  const [isBroadcastingUpdate, setIsBroadcastingUpdate] = useState<boolean>(false);

  useEffect(() => {
    // 1. Listen to Broadcast Campaigns
    const unsubBroadcasts = onSnapshot(collection(db, 'broadcasts'), (snap) => {
      const list: BroadcastCampaign[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as BroadcastCampaign);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(list);
    }, (err) => console.warn('Broadcasts snapshot notice:', err.message));

    // 2. Real-time Listen to Users for instant User ID search & select
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setAllUsers(list);
      setIsUsersLoading(false);
    }, (err) => {
      console.warn('Users snapshot notice:', err.message);
      setIsUsersLoading(false);
    });

    // 3. Fetch Registration Config
    getDoc(doc(db, 'system_settings', 'registration_config')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.bonusAmount === 'number') setBonusAmount(d.bonusAmount);
        if (typeof d.isBonusEnabled === 'boolean') setIsBonusEnabled(d.isBonusEnabled);
        if (typeof d.duplicateDetectionEnabled === 'boolean') setDuplicateDetectionEnabled(d.duplicateDetectionEnabled);
      }
    }).catch((err) => console.warn('Reg config load notice:', err));

    // 4. Fetch App Update Remote Config
    getDoc(doc(db, 'system_settings', 'app_update')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as AppUpdateConfig;
        if (typeof d.versionCode === 'number') setUpdateVersionCode(d.versionCode);
        if (d.versionName) setUpdateVersionName(d.versionName);
        if (d.apkUrl) setUpdateApkUrl(d.apkUrl);
        if (d.changelog) setUpdateChangelog(d.changelog);
        if (typeof d.forceUpdate === 'boolean') setUpdateForceUpdate(d.forceUpdate);
      }
    }).catch((err) => console.warn('App update config load notice:', err));

    return () => {
      unsubBroadcasts();
      unsubUsers();
    };
  }, []);

  // Save App Update Remote Configuration
  const handleSaveAppUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    setIsSavingUpdateConfig(true);
    setStatusMsg(null);

    try {
      const config: AppUpdateConfig = {
        versionCode: Number(updateVersionCode) || 2,
        versionName: updateVersionName.trim() || '2.0',
        apkUrl: updateApkUrl.trim() || DEFAULT_APP_UPDATE_CONFIG.apkUrl,
        changelog: updateChangelog.trim() || DEFAULT_APP_UPDATE_CONFIG.changelog,
        forceUpdate: Boolean(updateForceUpdate),
        enabled: true,
        releaseDate: new Date().toISOString().split('T')[0]
      };

      await saveAppUpdateConfigToFirestore(config);
      soundFx.playChime();
      setStatusMsg({
        type: 'success',
        text: `✅ App update configuration saved for Version ${config.versionName} (Build #${config.versionCode})!`
      });
    } catch (err: any) {
      soundFx.playError();
      setStatusMsg({
        type: 'error',
        text: `Failed to save update configuration: ${err.message}`
      });
    } finally {
      setIsSavingUpdateConfig(false);
    }
  };

  // Broadcast App Update Notification to all players
  const handleBroadcastAppUpdate = async () => {
    soundFx.playClick();
    if (!updateApkUrl.trim() || !updateVersionName.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter valid APK URL and Version Name before broadcasting.' });
      return;
    }

    setIsBroadcastingUpdate(true);
    setStatusMsg(null);

    try {
      const nowMs = Date.now();
      const ntfId = `NTF-UPDATE-${nowMs}`;
      const effectiveTitle = `🚀 নতুন আপডেট উপলব্ধ! (v${updateVersionName})`;
      const effectiveBody = updateChangelog || 'লেটেস্ট ফিচার ও ফাস্ট গেমসের জন্য এখনই আপডেট করুন।';

      // 1. Write Firestore Global Notification with actionType 'app_update'
      const ntfObj: NotificationItem = {
        id: ntfId,
        userId: 'ALL',
        isGlobal: true,
        title: effectiveTitle,
        message: effectiveBody,
        type: 'app_update',
        actionType: 'app_update',
        actionUrl: updateApkUrl.trim(),
        date: new Date().toLocaleString('en-IN'),
        read: false,
        createdAt: nowMs,
        expiresAt: nowMs + 7 * 24 * 60 * 60 * 1000,
        isCritical: updateForceUpdate,
        priority: updateForceUpdate ? 'Urgent / Alert' : 'High Priority',
        channels: ['In-App Push', 'Native Push (FCM)', 'Banner']
      };

      await setDoc(doc(db, 'notifications', ntfId), ntfObj);

      // 2. Also save to app_update system settings
      await saveAppUpdateConfigToFirestore({
        versionCode: Number(updateVersionCode) || 2,
        versionName: updateVersionName.trim() || '2.0',
        apkUrl: updateApkUrl.trim(),
        changelog: updateChangelog.trim(),
        forceUpdate: Boolean(updateForceUpdate),
        enabled: true
      });

      // 3. Dispatch native FCM broadcast payload
      try {
        const userTokens = allUsers
          .map((u: any) => u.fcmToken)
          .filter((t: any) => typeof t === 'string' && t.trim().length > 10);

        fetch('/api/send-broadcast-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: effectiveTitle,
            message: effectiveBody,
            type: 'app_update',
            apk_url: updateApkUrl.trim(),
            version_name: updateVersionName.trim(),
            changelog: updateChangelog.trim(),
            force_update: updateForceUpdate,
            tokens: userTokens.length > 0 ? userTokens : undefined
          })
        }).catch((err) => console.warn('FCM Broadcast API trigger notice:', err));
      } catch (_) {}

      soundFx.playChime();
      setStatusMsg({
        type: 'success',
        text: `🚀 App Update Broadcast successfully dispatched to ${allUsers.length} players!`
      });
    } catch (err: any) {
      soundFx.playError();
      setStatusMsg({
        type: 'error',
        text: `Failed to dispatch update broadcast: ${err.message}`
      });
    } finally {
      setIsBroadcastingUpdate(false);
    }
  };

  // Filter users based on search input (5-digit ID, UID, Name, Email, Phone)
  const filteredUsersList = useMemo(() => {
    if (!personalUserSearch.trim()) {
      return allUsers.slice(0, 8);
    }
    const q = personalUserSearch.trim();
    return allUsers
      .map(u => {
        const scoreObj = calculateUserSearchScore(u, q);
        return { user: u, score: scoreObj.score, matches: scoreObj.matches };
      })
      .filter(item => item.matches && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.user);
  }, [allUsers, personalUserSearch]);

  const handleSelectUser = (u: any) => {
    soundFx.playClick();
    setSelectedTargetUser(u);
    const code = getUserDisplayCode(u);
    setPersonalUserSearch(`#${code} - ${u.name || 'User'}`);
    setIsUserDropdownOpen(false);
  };

  const handleClearSelectedUser = () => {
    soundFx.playClick();
    setSelectedTargetUser(null);
    setPersonalUserSearch('');
    setIsUserDropdownOpen(false);
  };

  const handleChannelToggle = (channel: string) => {
    soundFx.playClick();
    if (selectedChannels.includes(channel)) {
      setSelectedChannels(selectedChannels.filter(c => c !== channel));
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleSaveBonusConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBonusConfig(true);
    setStatusMsg(null);
    try {
      await setDoc(doc(db, 'system_settings', 'registration_config'), {
        bonusAmount: Number(bonusAmount) || 0,
        isBonusEnabled,
        duplicateDetectionEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      soundFx.playCoin();
      setStatusMsg({ type: 'success', text: `✅ Registration Bonus Settings updated! New users will receive ₹${bonusAmount} welcome bonus.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to save bonus config: ${err.message}` });
    } finally {
      setIsSavingBonusConfig(false);
    }
  };

  // SEND STRICT PERSONAL NOTIFICATION TO SPECIFIC SINGLE USER
  const handleSendPersonalNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetUserObj = selectedTargetUser;

    // If no user clicked from dropdown, attempt auto-resolution from search text
    if (!targetUserObj && personalUserSearch.trim()) {
      const rawTarget = personalUserSearch.trim();
      const cleanNumeric = rawTarget.replace(/^[#\s]+/, '').trim();
      targetUserObj = allUsers.find(u => {
        const uCode = getUserDisplayCode(u);
        return (
          u.id === rawTarget ||
          uCode === cleanNumeric ||
          `#${uCode}`.toLowerCase() === rawTarget.toLowerCase() ||
          u.email?.toLowerCase() === rawTarget.toLowerCase() ||
          u.phone?.trim() === rawTarget ||
          u.name?.toLowerCase().includes(rawTarget.toLowerCase())
        );
      });
    }

    if (!targetUserObj) {
      soundFx.playLoss();
      setStatusMsg({ 
        type: 'error', 
        text: '❌ অনুগ্রহ করে সার্চ বক্স থেকে প্লেয়ারের ইউজার আইডি দিয়ে প্লেয়ারটিকে সিলেক্ট (Select) করুন!' 
      });
      return;
    }

    if (!personalTitle.trim() || !personalMessage.trim()) {
      soundFx.playLoss();
      setStatusMsg({ type: 'error', text: 'Please fill in both notification title and message.' });
      return;
    }

    setIsSendingPersonal(true);
    setStatusMsg(null);

    try {
      const targetUid = targetUserObj.id;
      const targetEmail = targetUserObj.email || null;
      const targetName = targetUserObj.name || 'ইউজার';
      const targetFcmToken = targetUserObj.fcmToken || null;
      const userDisplayCode = getUserDisplayCode(targetUserObj);

      const channelNotes: string[] = [];
      const nowMs = Date.now();
      const expiresAt = nowMs + 24 * 60 * 60 * 1000;
      const ntfId = `NTF-PERS-${nowMs}`;

      // 1. In-App Notification (Stored strictly for this specific User in Firestore)
      if (personalSelectedChannels.includes('In-App Push')) {
        const ntfObj: NotificationItem = {
          id: ntfId,
          userId: targetUid,
          targetUserId: targetUid,
          canonicalUid: targetUserObj.canonicalUid || targetUid,
          userEmail: targetEmail || undefined,
          targetUserName: targetName,
          title: personalTitle.trim(),
          message: personalMessage.trim(),
          type: personalType,
          date: new Date().toLocaleString('en-IN'),
          read: false,
          createdAt: nowMs,
          expiresAt: expiresAt,
          isCritical: personalType === 'loss' || personalType === 'system',
          isGlobal: false // STRICTLY FALSE: This ensures no other user ever sees this
        };

        // Write ONLY this single isolated document
        await setDoc(doc(db, 'notifications', ntfId), cleanFirestoreData(ntfObj));
        channelNotes.push('In-App Delivered');
      }

      // 2. Native Mobile Push (Android FCM targeted directly to this single player)
      if (personalSelectedChannels.includes('Native Push (FCM)')) {
        safeApiPost('/api/send-user-push', {
          userId: targetUid,
          fcmToken: targetFcmToken || undefined,
          title: personalTitle.trim(),
          message: personalMessage.trim(),
          body: personalMessage.trim(),
          type: personalType,
          targetUrl: '/'
        }).catch((err) => console.warn('Personal FCM Push dispatch notice:', err));
        channelNotes.push('Native Mobile Push');
      }

      // 3. Email Direct / Newsletter (SMTP)
      if (personalSelectedChannels.includes('Email Newsletter') && targetEmail && targetEmail.includes('@')) {
        const emailSent = await sendSmtpEmail({
          to: targetEmail,
          subject: `[BetGuru Alert] ${personalTitle.trim()}`,
          html: `
            <div style="background-color: #030712; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border-radius: 16px; border: 1px solid #312e81; max-width: 550px; margin: auto;">
              <h2 style="color: #fbbf24; margin: 0 0 8px 0;">🎰 BetGuru Direct Notification</h2>
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 16px 0;">Recipient: <strong>${targetName}</strong> (ID: #${userDisplayCode})</p>
              <h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 18px;">${personalTitle.trim()}</h3>
              <div style="background-color: #0f172a; padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap; margin-bottom: 20px;">
                ${personalMessage.trim()}
              </div>
              <div style="text-align: center;">
                <a href="https://betguruprime.vercel.app/" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 800; font-size: 13px; display: inline-block;">OPEN BETGURU APP</a>
              </div>
            </div>
          `,
          text: `Dear ${targetName},\n\n${personalTitle.trim()}\n\n${personalMessage.trim()}`
        }).catch(() => false);
        if (emailSent) channelNotes.push(`Email (${targetEmail})`);
      }

      // Record in Campaign History as Single Player notification
      const campaignRecord: BroadcastCampaign = {
        id: `PERS-${nowMs}`,
        title: personalTitle.trim(),
        priority: 'Normal Announcement',
        targetSegment: 'Single Player',
        body: personalMessage.trim(),
        channels: personalSelectedChannels,
        createdAt: new Date().toISOString(),
        sentCount: 1,
        status: 'Sent',
        recipientName: targetName,
        recipientCode: userDisplayCode
      };
      await setDoc(doc(db, 'broadcasts', campaignRecord.id), campaignRecord).catch(() => {});

      soundFx.playWinFanfare();
      setStatusMsg({ 
        type: 'success', 
        text: `✅ ব্যক্তিগত নোটিফিকেশন সফলভাবে পাঠানো হয়েছে: ${targetName} (ID: #${userDisplayCode}) কে! [${channelNotes.join(', ')}]` 
      });

      setPersonalTitle('');
      setPersonalMessage('');
      setSelectedTargetUser(null);
      setPersonalUserSearch('');
    } catch (err: any) {
      soundFx.playLoss();
      setStatusMsg({ type: 'error', text: `Failed to send personal notification: ${err.message}` });
    } finally {
      setIsSendingPersonal(false);
    }
  };

  // TRIGGER GLOBAL / BROADCAST CAMPAIGN
  const handleTriggerBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTitle = campaignTitle.trim() || `📢 ${priorityType} Announcement`;
    const effectiveBody = messageBody.trim();

    if (!effectiveBody) {
      soundFx.playLoss();
      setStatusMsg({ type: 'error', text: 'Please write the Broadcast Message Body!' });
      return;
    }

    if (selectedChannels.length === 0) {
      soundFx.playLoss();
      setStatusMsg({ type: 'error', text: 'Please select at least one Active Dispatch Channel!' });
      return;
    }

    setIsSending(true);
    setStatusMsg(null);

    try {
      const broadcastId = `BC-${Date.now()}`;
      let inAppSentCount = 0;
      let emailSentCount = 0;
      let smsSentCount = 0;

      // Filter target users based on segment
      let targetUsers = allUsers;
      if (targetSegment === 'VIP Players') {
        targetUsers = allUsers.filter(u => u.vipTier || u.role === 'vip' || (typeof u.balance === 'number' && u.balance > 5000));
      } else if (targetSegment === 'Active Players') {
        targetUsers = allUsers.filter(u => (typeof u.balance === 'number' && u.balance > 0) || u.lastActive);
      } else if (targetSegment === 'High Balance Users') {
        targetUsers = allUsers.filter(u => typeof u.balance === 'number' && u.balance >= 1000);
      }

      // 1. DISPATCH CHANNEL: In-App Global Broadcast
      if (selectedChannels.includes('In-App Push')) {
        const nowMs = Date.now();
        const expiresAt = nowMs + 24 * 60 * 60 * 1000;
        const ntfId = `NTF-BC-${nowMs}`;
        const ntfObj: NotificationItem = {
          id: ntfId,
          userId: 'ALL',
          isGlobal: true, // Strictly for global broadcasts
          title: effectiveTitle,
          message: effectiveBody,
          type: 'system',
          date: new Date().toLocaleString('en-IN'),
          read: false,
          createdAt: nowMs,
          expiresAt: expiresAt,
          isCritical: priorityType.includes('Urgent') || priorityType.includes('Alert'),
          priority: priorityType,
          channels: selectedChannels
        };

        // Write SINGLE global notification document
        await setDoc(doc(db, 'notifications', ntfId), ntfObj);
        inAppSentCount = targetUsers.length || allUsers.length || 1;

        // Native FCM Android & Web Push Broadcast via Server
        try {
          const userTokens = targetUsers
            .map((u: any) => u.fcmToken)
            .filter((t: any) => typeof t === 'string' && t.trim().length > 10);

          fetch('/api/send-broadcast-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: effectiveTitle,
              message: effectiveBody,
              targetUrl: "https://betguruprime.vercel.app/offers",
              topic: targetSegment === 'VIP Players' ? 'vip' : 'all',
              tokens: userTokens.length > 0 ? userTokens : undefined
            })
          }).catch((err) => console.warn('FCM Broadcast API trigger notice:', err));
        } catch (_) {}
      }

      // 2. DISPATCH CHANNEL: Top Site Announcement Banner
      if (selectedChannels.includes('Banner')) {
        await setDoc(doc(db, 'system_settings', 'active_broadcast_banner'), {
          id: broadcastId,
          title: effectiveTitle,
          message: effectiveBody,
          priority: priorityType,
          active: true,
          createdAt: Date.now(),
          expiresAt: Date.now() + 48 * 60 * 60 * 1000
        }, { merge: true });
      }

      // 3. DISPATCH CHANNEL: Email Newsletter via Gmail SMTP
      if (selectedChannels.includes('Email Newsletter')) {
        const emailSet = new Set<string>();
        targetUsers.forEach(u => {
          if (u.email && u.email.includes('@')) {
            emailSet.add(u.email.trim().toLowerCase());
          }
        });
        emailSet.add('asishp92@gmail.com');

        const emailRecipients = Array.from(emailSet);
        const emailPromises = emailRecipients.map(recipient =>
          sendSmtpEmail({
            to: recipient,
            subject: `[BetGuru Alert] ${effectiveTitle}`,
            html: `
              <div style="background-color: #030712; color: #f8fafc; font-family: sans-serif; padding: 24px; border-radius: 16px; border: 1px solid #312e81; max-width: 550px; margin: auto;">
                <h2 style="color: #fbbf24; margin: 0 0 12px 0;">🎰 BetGuru Official Announcement</h2>
                <h3 style="color: #ffffff; margin: 0 0 12px 0;">${effectiveTitle}</h3>
                <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap; margin-bottom: 20px;">
                  ${effectiveBody}
                </div>
                <div style="text-align: center;">
                  <a href="https://betguruprime.vercel.app/" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 800; font-size: 13px; display: inline-block;">OPEN BETGURU APP</a>
                </div>
              </div>
            `,
            text: `${effectiveTitle}\n\n${effectiveBody}`
          }).then(res => {
            if (res) emailSentCount++;
            return res;
          }).catch(() => false)
        );

        await Promise.allSettled(emailPromises);
      }

      // 4. Record Campaign in Firestore broadcasts collection
      const totalDispatched = Math.max(inAppSentCount + emailSentCount + smsSentCount, targetUsers.length, 1);
      const newCampaign: BroadcastCampaign = {
        id: broadcastId,
        title: effectiveTitle,
        priority: priorityType,
        targetSegment,
        body: effectiveBody,
        channels: selectedChannels,
        createdAt: new Date().toISOString(),
        sentCount: totalDispatched,
        status: 'Sent'
      };

      await setDoc(doc(db, 'broadcasts', broadcastId), newCampaign);

      soundFx.playWinFanfare();
      setStatusMsg({
        type: 'success',
        text: `🚀 গ্লোবাল ব্রডকাস্ট সফলভাবে পাঠানো হয়েছে! (${totalDispatched} জন ব্যবহারকারী)`
      });

      setCampaignTitle('');
      setMessageBody('');
    } catch (err: any) {
      soundFx.playLoss();
      setStatusMsg({ type: 'error', text: `Failed to trigger broadcast: ${err.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    soundFx.playClick();
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
      soundFx.playCoin();
    } catch (err: any) {
      console.warn('Delete campaign notice:', err.message);
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.priority.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.recipientName && c.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.recipientCode && c.recipientCode.includes(searchTerm))
  );

  return (
    <div className="space-y-6 font-mono">
      {/* Top Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-950 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
            <Bell className="w-6 h-6 text-indigo-400 animate-bounce" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Broadcast & Notification Center</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase">
                REALTIME MULTI-CHANNEL
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              সিঙ্গেল প্লেয়ারের ইউজার আইডি সার্চ করে নির্দিষ্ট প্লেয়ারকে মেসেজ পাঠান অথবা সকল প্লেয়ারের জন্য গ্লোবাল ব্রডকাস্ট করুন
            </p>
          </div>
        </div>
      </div>

      {/* Top Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => { soundFx.playClick(); setActiveTab('personal'); }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'personal'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <User className="w-4 h-4 text-indigo-300" />
          <span>👤 Send to Specific Player (সিঙ্গেল প্লেয়ার)</span>
        </button>

        <button
          type="button"
          onClick={() => { soundFx.playClick(); setActiveTab('broadcast'); }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'broadcast'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Radio className="w-4 h-4 text-indigo-300" />
          <span>📢 Global Broadcasts (সকলের জন্য)</span>
        </button>

        <button
          type="button"
          onClick={() => { soundFx.playClick(); setActiveTab('reg_bonus'); }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'reg_bonus'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Gift className="w-4 h-4 text-amber-300" />
          <span>🎁 Registration Bonus & Security</span>
        </button>

        <button
          type="button"
          onClick={() => { soundFx.playClick(); setActiveTab('app_update'); }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'app_update'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-300" />
          <span>📲 App Update & Native Bridge (ইন-অ্যাপ আপডেট)</span>
        </button>
      </div>

      {/* Notification Toast */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 shadow-lg animate-in fade-in ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />}
          <span className="font-bold">{statusMsg.text}</span>
        </div>
      )}

      {/* TAB 1: PERSONAL USER NOTIFICATIONS (Targeted Single Player with Instant Search & Select) */}
      {activeTab === 'personal' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl max-w-4xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Send Personal Notification to Specific Single Player</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                প্লেয়ারের ইউজার আইডি (#XXXXX) বা নাম দিয়ে খুঁজুন এবং সিলেক্ট করে শুধুমাত্র সেই প্লেয়ারকে মেসেজ পাঠান
              </p>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold uppercase">
              100% ISOLATED
            </span>
          </div>

          <form onSubmit={handleSendPersonalNotification} className="space-y-5">
            {/* STEP 1: Interactive User Search & Selection */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-300 font-black">
                  <span>1. Search & Select Player (ইউজার আইডি বা নাম দিয়ে সিলেক্ট করুন)</span>
                  <span className="text-rose-400">*</span>
                </span>
                {allUsers.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    Total Registered: <strong className="text-slate-300">{allUsers.length} players</strong>
                  </span>
                )}
              </label>

              {/* If a User is Selected, Show Selected Recipient Card */}
              {selectedTargetUser ? (
                <div className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-950 to-indigo-950/70 border-2 border-emerald-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg shrink-0">
                      {(selectedTargetUser.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">{selectedTargetUser.name || 'User'}</span>
                        <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full font-mono">
                          ID: #{getUserDisplayCode(selectedTargetUser)}
                        </span>
                        {selectedTargetUser.role === 'admin' && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                            ADMIN
                          </span>
                        )}
                        {selectedTargetUser.vipTier && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                            ⭐ VIP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        {selectedTargetUser.phone && <span>📞 {selectedTargetUser.phone}</span>}
                        {selectedTargetUser.email && <span>✉️ {selectedTargetUser.email}</span>}
                        <span className="text-emerald-400 font-bold">💰 Wallet: ₹{(selectedTargetUser.balance ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelectedUser}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-center shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Change Player (অন্য প্লেয়ার খুঁজুন)</span>
                  </button>
                </div>
              ) : (
                /* Search Input Box */
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Type 5-digit User ID (e.g. 84921 or #84921), Name, Phone, or Email..."
                      value={personalUserSearch}
                      onChange={(e) => {
                        setPersonalUserSearch(e.target.value);
                        setIsUserDropdownOpen(true);
                      }}
                      onFocus={() => setIsUserDropdownOpen(true)}
                      className="w-full bg-slate-950 border-2 border-indigo-500/40 focus:border-indigo-400 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none shadow-inner font-mono"
                    />
                  </div>

                  {/* Live Instant Search Dropdown */}
                  {isUserDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border-2 border-indigo-500/40 rounded-2xl shadow-2xl max-h-72 overflow-y-auto z-50 divide-y divide-slate-800/60">
                      <div className="p-2.5 bg-indigo-950/80 border-b border-indigo-500/30 flex items-center justify-between text-[11px] text-indigo-300 font-bold">
                        <span>👇 Select a matching player from the list below:</span>
                        <button
                          type="button"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {filteredUsersList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {isUsersLoading ? 'Loading users list...' : 'No users found matching your search term.'}
                        </div>
                      ) : (
                        filteredUsersList.map((u) => {
                          const uCode = getUserDisplayCode(u);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleSelectUser(u)}
                              className="w-full p-3 hover:bg-indigo-950/50 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 group-hover:border-indigo-500 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">
                                  {(u.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-white group-hover:text-indigo-300 transition-colors">
                                      {u.name || 'User'}
                                    </span>
                                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded font-mono">
                                      ID: #{uCode}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                                    {u.phone && <span>{u.phone}</span>}
                                    {u.email && <span>&bull; {u.email}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold text-emerald-400 block font-mono">
                                  ₹{(u.balance ?? 0).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[9px] text-indigo-400 font-bold group-hover:underline">
                                  Click to Select &rarr;
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 2: Title and Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Notification Title (শিরোনাম) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deposit Verified ₹5,000 বা আপনার ডিপোজিট সফল হয়েছে"
                  value={personalTitle}
                  onChange={(e) => setPersonalTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Type / Category</label>
                <select
                  value={personalType}
                  onChange={(e) => setPersonalType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="system">System / Admin Direct Message</option>
                  <option value="deposit">Deposit Alert (ডিপোজিট আপডেট)</option>
                  <option value="withdrawal">Withdrawal Alert (উইথড্রয়াল আপডেট)</option>
                  <option value="win">Prize / Bonus Reward (পুরস্কার/বোনাস)</option>
                  <option value="loss">Bet Result Notice (বেট রেজাল্ট)</option>
                </select>
              </div>
            </div>

            {/* STEP 3: Delivery Channels for Personal Message */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-300 block">Dispatch Channels for this User</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'In-App Push', icon: Smartphone, desc: 'অ্যাপ ও ওয়েবসাইট নোটিফিকেশন ড্রয়ার' },
                  { name: 'Native Push (FCM)', icon: Radio, desc: 'অ্যান্ড্রয়েড ফোনের নোটিফিকেশন বার' },
                  { name: 'Email Newsletter', icon: Mail, desc: 'সরাসরি জিমেইলে ইমেইল' }
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isSel = personalSelectedChannels.includes(ch.name);
                  return (
                    <button
                      key={ch.name}
                      type="button"
                      onClick={() => {
                        if (isSel) {
                          if (personalSelectedChannels.length > 1) {
                            setPersonalSelectedChannels(personalSelectedChannels.filter((c) => c !== ch.name));
                          }
                        } else {
                          setPersonalSelectedChannels([...personalSelectedChannels, ch.name]);
                        }
                      }}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{ch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 4: Message Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Message Body (মেসেজের বিস্তারিত) <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="Write your personal message for this player..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSendingPersonal}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSendingPersonal
                  ? 'DISPATCHING TO SELECTED PLAYER...'
                  : selectedTargetUser
                  ? `SEND NOTIFICATION TO ${selectedTargetUser.name?.toUpperCase() || 'PLAYER'} (#${getUserDisplayCode(selectedTargetUser)})`
                  : 'SEND PERSONAL NOTIFICATION'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: MULTI-CHANNEL GLOBAL BROADCASTS */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2-Cols: Compose Broadcast Campaign Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Compose Global Broadcast Campaign</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  সকল প্লেয়ার অথবা নির্দিষ্ট সেগমেন্টের (VIP/Active) কাছে ব্রডকাস্ট করুন
                </p>
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                LIVE DISPATCH
              </span>
            </div>

            <form onSubmit={handleTriggerBroadcast} className="space-y-4">
              {/* Campaign Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Campaign Title</label>
                <input
                  type="text"
                  placeholder="e.g. 🎉 ₹1,00,000 Mega Lucky Draw Tonight!"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Dropdowns Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Priority Type</label>
                  <select
                    value={priorityType}
                    onChange={(e) => setPriorityType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Urgent / Alert">Urgent / Alert</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Normal Announcement">Normal Announcement</option>
                    <option value="Promotional">Promotional</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Target Segment</label>
                  <select
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="All Users">All Users (সকল রেজিস্টার্ড ইউজার)</option>
                    <option value="Active Players">Active Players (সক্রিয় প্লেয়ার)</option>
                    <option value="VIP Players">VIP Players (ভিআইপি প্লেয়ার)</option>
                    <option value="High Balance Users">High Balance Users (উচ্চ ব্যালেন্স)</option>
                  </select>
                </div>
              </div>

              {/* Channels Selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-300 block">Active Dispatch Channels</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'In-App Push', icon: Smartphone },
                    { name: 'Banner', icon: Radio },
                    { name: 'Email Newsletter', icon: Mail }
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isSel = selectedChannels.includes(ch.name);
                    return (
                      <button
                        key={ch.name}
                        type="button"
                        onClick={() => handleChannelToggle(ch.name)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                          isSel
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Broadcast Message Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Broadcast Message Body</label>
                <textarea
                  rows={4}
                  placeholder="Type push/email body..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Trigger Button */}
              <button
                type="submit"
                disabled={isSending}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'DISPATCHING BROADCAST...' : 'TRIGGER GLOBAL BROADCAST'}</span>
              </button>
            </form>
          </div>

          {/* Right 1-Col: Status & Tips */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Broadcast System Overview</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Total Registered Users</span>
                  <span className="font-black text-indigo-300 font-mono">{allUsers.length}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Targeting Mode</span>
                  <span className="font-bold text-amber-400">{targetSegment}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Dispatch Channels</span>
                  <span className="font-bold text-emerald-400">{selectedChannels.length} Active</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-1 text-xs text-indigo-200">
              <span className="font-bold block flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Real-Time Sync active</span>
              </span>
              <p className="text-[10px] text-slate-400">
                গ্লোবাল ব্রডকাস্ট পাঠানো হলে তা সকল প্লেয়ারের নোটিফিকেশন ড্রয়ারে রিয়েল-টাইমে পৌঁছে যাবে।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REGISTRATION BONUS & SECURITY SETTINGS */}
      {activeTab === 'reg_bonus' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Registration Welcome Bonus & Security Settings</span>
            </h3>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase">
              AUTO-CREDIT CONTROL
            </span>
          </div>

          <form onSubmit={handleSaveBonusConfig} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Registration Welcome Bonus Amount (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="100"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-emerald-400 font-black focus:outline-none focus:border-amber-500"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              </div>
              <p className="text-[10px] text-slate-500">Every newly registered user automatically receives this exact amount once upon signup.</p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Enable Registration Welcome Bonus</p>
                <p className="text-[10px] text-slate-400">If disabled, new accounts start with ₹0 balance.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBonusEnabled(!isBonusEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${isBonusEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isBonusEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Duplicate Account & Suspicious Registration Flagging</p>
                <p className="text-[10px] text-slate-400">Detect matching phone/email and show blinking warning badges in Admin Panel.</p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateDetectionEnabled(!duplicateDetectionEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${duplicateDetectionEnabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${duplicateDetectionEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <button
              type="submit"
              disabled={isSavingBonusConfig}
              className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-amber-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSavingBonusConfig ? 'SAVING CONFIGURATION...' : 'SAVE REGISTRATION BONUS SETTINGS'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: APP UPDATE & NATIVE BRIDGE VERSION CONTROL */}
      {activeTab === 'app_update' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Main App Update Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Android App Update & Remote Version Controller</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Manage live APK releases, force updates, changelogs, and push instant update notifications to player screens
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2.5 py-1 rounded-full font-bold">
                  Current Client: v{getNativeAppVersion()}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAppUpdateConfig} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Version Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Version Name (ভার্সন নাম)</span>
                    <span className="text-[10px] text-slate-500">e.g. 2.0 or 2.1.0</span>
                  </label>
                  <input
                    type="text"
                    value={updateVersionName}
                    onChange={(e) => setUpdateVersionName(e.target.value)}
                    placeholder="2.0"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                {/* Version Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Version Code / Build # (ভার্সন কোড)</span>
                    <span className="text-[10px] text-slate-500">Integer: 2, 3, 4...</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={updateVersionCode}
                    onChange={(e) => setUpdateVersionCode(parseInt(e.target.value) || 1)}
                    placeholder="2"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* APK Download URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>New APK Direct Download Link (ডাউনলোড লিঙ্ক)</span>
                  <span className="text-[10px] text-emerald-400">Direct .apk or CDN link</span>
                </label>
                <input
                  type="url"
                  value={updateApkUrl}
                  onChange={(e) => setUpdateApkUrl(e.target.value)}
                  placeholder="https://your-domain.com/downloads/betguru-v2.apk"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Release Notes / Changelog */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Changelog / Release Notes (আপডেট বিবরণী - বাংলা/ইংরেজি)</span>
                  <span className="text-[10px] text-slate-500">Bullet points recommended</span>
                </label>
                <textarea
                  rows={4}
                  value={updateChangelog}
                  onChange={(e) => setUpdateChangelog(e.target.value)}
                  placeholder="• নতুন লাইভ ক্যাসিনো ফিচার&#10;• ফাস্ট উইথড্রয়াল গেটওয়ে&#10;• পারফরমেন্স উন্নতি"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
                />
              </div>

              {/* Force Update Toggle */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldAlert className={`w-4 h-4 ${updateForceUpdate ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                    <span>Force Update Mandatory (বাধ্যতামূলক আপডেট)</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {updateForceUpdate 
                      ? '⚠️ Users cannot close or bypass the dialog until they update the app.'
                      : 'ℹ️ Users can dismiss or close the dialog and update later.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUpdateForceUpdate(!updateForceUpdate)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${updateForceUpdate ? 'bg-rose-500' : 'bg-slate-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${updateForceUpdate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingUpdateConfig}
                  className="py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingUpdateConfig ? 'SAVING TO FIRESTORE...' : 'SAVE REMOTE CONFIGURATION'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBroadcastAppUpdate}
                  disabled={isBroadcastingUpdate}
                  className="py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Radio className="w-4 h-4" />
                  <span>{isBroadcastingUpdate ? 'DISPATCHING PUSH...' : '🚀 BROADCAST UPDATE TO ALL PLAYERS'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test & Debug Actions Bar */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              <span>Direct JavaScript API Testing (টেস্টিং টুলস)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  triggerAppUpdate(updateApkUrl, updateVersionName, updateChangelog, updateForceUpdate);
                }}
                className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white group-hover:text-emerald-300">
                    👉 Test triggerAppUpdate(...)
                  </span>
                  <Eye className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Triggers the native update dialog immediately on this screen with the current form values.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  clearNativeAppCache();
                }}
                className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white group-hover:text-amber-300">
                    🧹 Test clearNativeAppCache()
                  </span>
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Clears browser caches and hard-reloads the web app to purge stale assets.
                </p>
              </button>
            </div>
          </div>

          {/* Reference Snippets for Android WebView Developers */}
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl space-y-4">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Android Bridge & Web API Specifications</span>
            </h4>

            <div className="space-y-3 text-[11px] font-mono">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                <span className="text-emerald-400 font-bold block">// ১. প্লেয়ারের স্ক্রিনে সরাসরি আপডেট ডায়ালগ ওপেন করতে:</span>
                <pre className="text-indigo-300 overflow-x-auto">
{`window.triggerAppUpdate(
  "${updateApkUrl}", // নতুন APK ডাউনলোড লিঙ্ক
  "${updateVersionName}", // নতুন ভার্সন
  \`${updateChangelog}\`, // চেঞ্জলগ
  ${updateForceUpdate} // Force Update (true/false)
);`}
                </pre>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                <span className="text-emerald-400 font-bold block">// ২. বর্তমান অ্যাপ ভার্সন চেক করতে:</span>
                <pre className="text-amber-300 overflow-x-auto">
{`const currentVersion = window.getNativeAppVersion(); // Output: "${getNativeAppVersion()}"`}
                </pre>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                <span className="text-emerald-400 font-bold block">// ৩. ক্যাশ ক্লিয়ার করে রিলোড করতে:</span>
                <pre className="text-rose-300 overflow-x-auto">
{`window.clearNativeAppCache();`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign & Personal Notification Dispatch History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Broadcast & Personal Notification History ({campaigns.length})</span>
            </h3>
            <p className="text-[10px] text-slate-400">Real-time log of all previously dispatched messages and personal alerts</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search history by player ID, title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-slate-500 text-xs">
            <Bell className="w-8 h-8 text-slate-700 mx-auto" />
            <p>No campaigns or messages recorded yet. Use the form above to dispatch your first message!</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {filteredCampaigns.map((c) => (
              <div key={c.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm">{c.title}</span>
                    {c.targetSegment === 'Single Player' ? (
                      <span className="text-[9px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full uppercase">
                        👤 Single Player: {c.recipientName || 'User'} {c.recipientCode ? `(#${c.recipientCode})` : ''}
                      </span>
                    ) : (
                      <>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                          c.priority === 'Urgent / Alert'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : c.priority === 'High Priority'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        }`}>
                          {c.priority}
                        </span>
                        <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-bold">
                          Segment: {c.targetSegment}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-slate-300 text-xs">{c.body}</p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap pt-1">
                    <span>Dispatched: {new Date(c.createdAt).toLocaleString()}</span>
                    <span>• Channels: {c.channels?.join(', ') || 'In-App Push'}</span>
                    <span>• Recipient Count: <strong className="text-emerald-400">{c.sentCount || 1} {c.sentCount === 1 ? 'player' : 'players'}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteCampaign(c.id)}
                  className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white rounded-xl border border-rose-500/30 transition-colors shrink-0 self-start sm:self-center cursor-pointer"
                  title="Delete Log Entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
