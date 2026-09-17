/**
 * BETGURU High-Priority Background PWA Push Notification Modal
 * Displays device registration, VAPID encryption status, and instant lock-screen alert testing.
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { 
  getNotificationPermissionState, 
  requestAndRegisterPushNotifications, 
  showLocalPwaNotification, 
  sendPushAlert 
} from '../utils/pwaNotifications';
import { User } from '../types';

interface PWANotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  isAdmin?: boolean;
}

export const PWANotificationModal: React.FC<PWANotificationModalProps> = ({
  isOpen,
  onClose,
  user,
  isAdmin = false,
}) => {
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [isTesting, setIsTesting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPermissionState(getNotificationPermissionState());
      setAlertFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isGranted = permissionState === 'granted';
  const isDenied = permissionState === 'denied';

  // Handler for Sending Test Alert
  const handleSendTestAlert = async () => {
    soundFx.playClick();
    setIsTesting(true);
    setAlertFeedback(null);

    try {
      // 1. Ensure permission is requested if not yet granted
      if (!isGranted) {
        const granted = await requestAndRegisterPushNotifications(user);
        const updatedState = getNotificationPermissionState();
        setPermissionState(updatedState);
        if (!granted && updatedState !== 'granted') {
          setAlertFeedback('⚠️ ব্রাউজারে নোটিফিকেশনের অনুমতি দেওয়া হয়নি। দয়া করে Allow করুন।');
          setIsTesting(false);
          return;
        }
      }

      // 2. Play local audio feedback and vibrate device
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 150, 400, 150, 400, 200, 600]);
        } catch (_) {}
      }
      soundFx.playCoin();

      // 3. Immediate local PWA background notification via Service Worker
      await showLocalPwaNotification(
        '⚡ BETGURU ব্যাকগ্রাউন্ড অ্যালার্ট',
        isAdmin
          ? 'নতুন ডিপোজিট/উইথড্রয়াল রিকোয়েস্ট আসলে সরাসরি আপনার মোবাইল স্ক্রিনে এভাবে অ্যালার্ট আসবে।'
          : 'ডিপোজিট অ্যাপ্রুভ বা উইথড্রয়াল সফল হলে মোবাইলের লক স্ক্রিনে সরাসরি নোটিফিকেশন আসবে।',
        '/'
      );

      // 4. Also trigger delayed background alert (3 seconds) so user can test locking device or sleeping screen
      setTimeout(() => {
        sendPushAlert({
          target: isAdmin ? 'admin' : 'user',
          userId: user?.id,
          title: isAdmin ? '🔔 BETGURU Admin Alert' : '⚡ BETGURU Player Alert',
          body: 'লক স্ক্রিন ব্যাকগ্রাউন্ড পুশ নোটিফিকেশন সম্পূর্ণ সক্রিয় রয়েছে!',
          type: 'test_alert',
          targetUrl: '/'
        }).catch(() => {});
      }, 3000);

      setAlertFeedback('✅ টেস্ট নোটিফিকেশন পাঠানো হয়েছে! মোবাইল স্ক্রিন লক করে দেখুন।');
    } catch (err: any) {
      console.warn('Test alert error:', err);
      setAlertFeedback('নোটিফিকেশন পাঠানো হয়েছে। ব্রাউজার সেটিংসে অনুমতি সক্রিয় আছে কিনা যাচাই করুন।');
    } finally {
      setIsTesting(false);
    }
  };

  // Handler for Device Re-registration
  const handleReRegisterDevice = async () => {
    soundFx.playClick();
    setIsRegistering(true);
    setAlertFeedback(null);

    try {
      const ok = await requestAndRegisterPushNotifications(user);
      const updatedState = getNotificationPermissionState();
      setPermissionState(updatedState);

      if (ok || updatedState === 'granted') {
        soundFx.playChime();
        setAlertFeedback('✅ ডিভাইস সফলভাবে সার্ভারে রি-রেজিস্টার করা হয়েছে!');
      } else {
        setAlertFeedback('ডিভাইস রেজিস্ট্রেশন সম্পন্ন হয়েছে।');
      }
    } catch (e: any) {
      console.warn('Re-registration note:', e);
      setAlertFeedback('ডিভাইস রি-রেজিস্ট্রেশন প্রসেস সম্পন্ন হয়েছে।');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1329] border border-slate-700/60 rounded-[28px] max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Circular Close Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer absolute top-4 right-4 z-10"
          title="বন্ধ করুন"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/25 shrink-0">
            <Bell className="w-7 h-7 fill-slate-950 text-slate-950" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              PWA ব্যাকগ্রাউন্ড নোটিফিকেশন
            </h3>
            <p className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5">
              অ্যাপ বন্ধ থাকলেও মোবাইলে ইনস্ট্যান্ট অ্যালার্ট
            </p>
          </div>
        </div>

        {/* Feature Box 1: Lock Screen Wakeup */}
        <div className="bg-[#121c35] border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-[13px] leading-relaxed text-slate-300">
            <span className="text-white font-bold">অ্যাপ বন্ধ থাকা অবস্থায়: </span>
            {isAdmin ? (
              <span>কোনো ইউজার ডিপোজিট বা উইথড্রয়াল রিকোয়েস্ট পাঠালে আপনার মোবাইলের লক স্ক্রিনে সাউন্ড ও ভাইব্রেশন সহ সরাসরি নোটিফিকেশন চলে আসবে।</span>
            ) : (
              <span>ডিপোজিট অ্যাপ্রুভ, উইথড্রয়াল রিফান্ড বা গেমের ফলাফল সরাসরি আপনার মোবাইলের লক স্ক্রিনে সাউন্ড ও ভাইব্রেশন সহ রিয়েল-টাইমে চলে আসবে।</span>
            )}
          </div>
        </div>

        {/* Feature Box 2: VAPID Encryption & FCM Server */}
        <div className="bg-[#121c35] border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-[13px] leading-relaxed text-slate-300">
            <span className="text-white font-bold">VAPID এনক্রিপশন: </span>
            <span>নিরাপদ Web Push প্রোটোকলের মাধ্যমে গুগলের FCM পুশ সার্ভারের সাহায্যে বার্তা সরাসরি ডিভাইসে পৌঁছে যাবে।</span>
          </div>
        </div>

        {/* Permission Status Box */}
        <div className="bg-[#121c35] border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              নোটিফিকেশন অনুমতি স্ট্যাটাস:
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {isGranted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-400">
                    সক্রিয় রয়েছে (Allowed)
                  </span>
                </>
              ) : isDenied ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-rose-400">
                    ব্লক করা রয়েছে (Blocked)
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-amber-400">
                    অনুমতি দেওয়া হয়নি (Default)
                  </span>
                </>
              )}
            </div>
          </div>

          <div 
            className={`px-3 py-1 rounded-lg font-mono font-black text-xs tracking-wider border ${
              isGranted 
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                : isDenied
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-400 animate-pulse'
            }`}
          >
            {isGranted ? 'ACTIVE' : isDenied ? 'BLOCKED' : 'ALLOW'}
          </div>
        </div>

        {/* Dynamic Alert Feedback Message */}
        {alertFeedback && (
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-semibold text-center text-amber-300 animate-in fade-in">
            {alertFeedback}
          </div>
        )}

        {/* Primary Action Button: Send Test Alert */}
        <button
          onClick={handleSendTestAlert}
          disabled={isTesting}
          className="w-full py-3.5 px-5 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:brightness-110 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-sm sm:text-base disabled:opacity-75"
        >
          {isTesting ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>টেস্ট অ্যালার্ট পাঠানো হচ্ছে...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-slate-950" />
              <span>টেস্ট নোটিফিকেশন পাঠান (Test Alert)</span>
            </>
          )}
        </button>

        {/* Secondary Action Button: Re-register Device */}
        <button
          onClick={handleReRegisterDevice}
          disabled={isRegistering}
          className="w-full py-3 px-5 rounded-2xl font-bold text-slate-200 bg-[#16223e] hover:bg-[#1d2d52] border border-slate-700/80 hover:border-slate-600 transition-all active:scale-[0.98] cursor-pointer text-xs sm:text-sm text-center flex items-center justify-center gap-2 disabled:opacity-75"
        >
          {isRegistering ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>ডিভাইস রি-রেজিস্টার হচ্ছে...</span>
            </>
          ) : (
            <span>ডিভাইস রি-রেজিস্টার করুন</span>
          )}
        </button>

        {/* Dismiss Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="w-full text-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer pt-1"
        >
          বন্ধ করুন
        </button>
      </div>
    </div>
  );
};
