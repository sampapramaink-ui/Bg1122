import React, { useState, useRef } from 'react';
import { 
  X, User as UserIcon, Mail, Phone, MapPin, Shield, Crown, 
  Wallet, Gift, Image, Check, Sparkles, AlertCircle, RefreshCw,
  Camera, Lock, Award, Building, Compass, Trash2, Upload, FileText, CheckCircle2,
  ShieldAlert, Coins, Flame
} from 'lucide-react';
import { User } from '../../types';
import { soundFx } from '../../utils/audio';
import { db, cleanFirestoreData } from '../../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { safeApiPost } from '../../utils/apiConfig';
import { AdminUserGeoTrackingModal } from './AdminUserGeoTrackingModal';
import { readFileAsCompressedDataUrl } from '../../utils/userDataManager';
import { generatePermanentUserCode } from '../../utils/databaseSync';

interface AdminUserEditModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
  onUserDeleted?: (deletedUser: User) => void;
}

const PRESET_AVATARS = [
  { id: '1', name: 'Royal Gold King', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Sleek Queen', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: '3', name: 'VIP Gentleman', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80' },
  { id: '4', name: 'Cyberpunk Gambler', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { id: '5', name: 'Diamond High-Roller', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80' },
  { id: '6', name: 'Ace Player', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80' },
  { id: '7', name: 'Neon Aristocrat', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80' },
  { id: '8', name: 'Casino Master', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
];

export const AdminUserEditModal: React.FC<AdminUserEditModalProps> = ({
  user,
  onClose,
  onUserUpdated,
  onUserDeleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [name, setName] = useState<string>(user.name || '');
  const [email, setEmail] = useState<string>(user.email || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [age, setAge] = useState<string | number>(user.age ?? '');
  const [documentId, setDocumentId] = useState<string>(user.documentId || '');
  const [documentType, setDocumentType] = useState<string>(user.documentType || 'Aadhaar / National ID');
  const [address, setAddress] = useState<string>(user.address || '');
  const [city, setCity] = useState<string>(user.city || '');
  const [state, setState] = useState<string>(user.state || '');
  const [pincode, setPincode] = useState<string>(user.pincode || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || PRESET_AVATARS[0].url);
  const [role, setRole] = useState<'user' | 'admin'>(user.role || 'user');
  const [status, setStatus] = useState<'active' | 'suspended' | 'blocked'>(user.status || 'active');
  const [vipLevel, setVipLevel] = useState<'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'>(
    (user.vipLevel === 'VIP Platinum' ? 'Platinum' : user.vipLevel) as any || 'Bronze'
  );
  const [vipPoints, setVipPoints] = useState<number>(user.vipPoints ?? 120);
  const [balance, setBalance] = useState<number>(user.balance ?? 0);
  const [bonusBalance, setBonusBalance] = useState<number>(user.bonusBalance ?? 0);
  const [referralCode, setReferralCode] = useState<string>(user.referralCode || '');

  // Withdrawal Wagering (Turnover) requirements state
  const [mainWagerRequired, setMainWagerRequired] = useState<number>(
    typeof user.mainWagerRequired === 'number' ? user.mainWagerRequired : (user.balance ?? 0)
  );
  const [mainWagerCompleted, setMainWagerCompleted] = useState<number>(
    typeof user.mainWagerCompleted === 'number' ? user.mainWagerCompleted : (user.totalSpent ?? 0)
  );
  const [bonusWagerRequired, setBonusWagerRequired] = useState<number>(
    typeof user.bonusWagerRequired === 'number' ? user.bonusWagerRequired : ((user.bonusBalance || 0) * 5)
  );
  const [bonusWagerCompleted, setBonusWagerCompleted] = useState<number>(
    typeof user.bonusWagerCompleted === 'number' ? user.bonusWagerCompleted : 0
  );
  const [wagerExempt, setWagerExempt] = useState<boolean>(Boolean(user.wagerExempt));

  // UI state
  const [showAvatarPicker, setShowAvatarPicker] = useState<boolean>(false);
  const [showGeoModal, setShowGeoModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      setErrorMsg(null);
      soundFx.playClick();
      const compressed = await readFileAsCompressedDataUrl(file, 400, 400, 0.85);
      setAvatarUrl(compressed);
      soundFx.playCoin();
    } catch (err: any) {
      console.error('Failed to read image file:', err);
      setErrorMsg('Failed to process uploaded image. Please try another image.');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Suggest clean name if current name looks like raw email
  const isEmailName = name.toLowerCase().includes('@') || name.toLowerCase() === (email.split('@')[0] || '').toLowerCase();
  const suggestedCleanName = email && email.includes('@') 
    ? email.split('@')[0].replace(/[0-9_.]/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'Player'
    : 'Player';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Player Name cannot be empty.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Email cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      soundFx.playClick();

      const cleanEmail = email.toLowerCase().trim();
      const canonicalUid = user.id;

      const updatedPayload: Partial<User> & { updatedAt: string } = {
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim() || 'N/A',
        age: age ? (Number(age) || age.toString().trim()) : '',
        documentId: documentId.trim(),
        documentType: documentType.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        avatarUrl: avatarUrl.trim(),
        role: role,
        status: status,
        vipLevel: vipLevel,
        vipPoints: Number(vipPoints) || 0,
        isVip: vipLevel === 'Gold' || vipLevel === 'Platinum' || vipLevel === 'Diamond',
        balance: Math.max(0, Number(balance) || 0),
        bonusBalance: Math.max(0, Number(bonusBalance) || 0),
        mainWagerRequired: Math.max(0, Number(mainWagerRequired) || 0),
        mainWagerCompleted: Math.max(0, Number(mainWagerCompleted) || 0),
        bonusWagerRequired: Math.max(0, Number(bonusWagerRequired) || 0),
        bonusWagerCompleted: Math.max(0, Number(bonusWagerCompleted) || 0),
        wagerExempt: Boolean(wagerExempt),
        wagerUpdatedAt: new Date().toISOString(),
        referralCode: referralCode.trim() || user.referralCode,
        updatedAt: new Date().toISOString(),
      };

      // Write strictly to the canonical Firestore document
      await setDoc(doc(db, 'users', canonicalUid), updatedPayload, { merge: true });

      // Clean up legacy alias doc or other linked doc duplicates to ensure 0 duplicates in Firestore
      const aliasId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (aliasId !== canonicalUid) {
        deleteDoc(doc(db, 'users', aliasId)).catch(() => {});
      }
      if (user.linkedDocIds && Array.isArray(user.linkedDocIds)) {
        for (const linkedId of user.linkedDocIds) {
          if (linkedId !== canonicalUid) {
            deleteDoc(doc(db, 'users', linkedId)).catch(() => {});
          }
        }
      }

      const mergedUser: User = {
        ...user,
        ...updatedPayload,
        id: canonicalUid,
        linkedDocIds: [canonicalUid],
      };

      // Notify user if balance changed
      const oldBal = user.balance ?? 0;
      const newBal = Math.max(0, Number(balance) || 0);
      const balDiff = newBal - oldBal;
      if (Math.abs(balDiff) > 0) {
        const notifTitle = balDiff > 0 ? `💰 ₹${balDiff.toLocaleString('en-IN')} Credited to Wallet` : `💸 ₹${Math.abs(balDiff).toLocaleString('en-IN')} Adjusted by Admin`;
        const notifMsg = balDiff > 0 ? `অ্যাডমিন আপনার অ্যাকাউন্টে ₹${balDiff.toLocaleString('en-IN')} ক্রেডিট যোগ করেছেন। নতুন ব্যালেন্স: ₹${newBal.toLocaleString('en-IN')}` : `অ্যাডমিন আপনার অ্যাকাউন্টের ব্যালেন্স আপডেট করেছেন। বর্তমান ব্যালেন্স: ₹${newBal.toLocaleString('en-IN')}`;
        
        const nowMs = Date.now();
        const ntfId = `NTF-BAL-${nowMs}`;
        setDoc(doc(db, 'notifications', ntfId), {
          id: ntfId,
          userId: canonicalUid,
          targetUserId: canonicalUid,
          userEmail: cleanEmail,
          title: notifTitle,
          message: notifMsg,
          type: balDiff > 0 ? 'deposit' : 'system',
          date: new Date().toLocaleString('en-IN'),
          read: false,
          isGlobal: false,
          createdAt: nowMs,
          expiresAt: nowMs + 7 * 24 * 60 * 60 * 1000
        }).catch(() => {});

        safeApiPost('/api/send-user-push', {
          userId: canonicalUid,
          fcmToken: (user as any).fcmToken || undefined,
          title: notifTitle,
          message: notifMsg,
          body: notifMsg,
          type: 'deposit',
          targetUrl: '/'
        }).catch((err) => console.warn('Balance adjustment push notice:', err));
      }

      soundFx.playCoin();
      setSaveSuccessMsg('✅ User profile successfully updated in Firestore database!');
      onUserUpdated(mergedUser);

      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update user profile:', err);
      setErrorMsg(`Error saving user: ${err?.message || 'Unknown database error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden font-mono flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Edit Player Profile & Controls
                </h3>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                User ID: <span className="text-amber-300 font-bold font-mono">#{user.userCode || generatePermanentUserCode(user.email, undefined, user.id)}</span> <span className="text-[10px] text-slate-500 font-mono">({user.id})</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Notifications */}
          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-950/90 border border-emerald-500 text-emerald-200 rounded-2xl font-bold flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-950/90 border border-rose-500 text-rose-200 rounded-2xl font-bold flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handlePhotoFileChange}
          />

          {/* Section 1: Avatar / Profile Photo Upload & Select */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Player Profile Photo (ইউজার ফটো আপলোড ও পরিবর্তন)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
              >
                {showAvatarPicker ? 'Hide Gallery' : 'Choose Preset Avatar'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Clickable Avatar with Camera Overlay */}
              <div 
                onClick={() => {
                  soundFx.playClick();
                  fileInputRef.current?.click();
                }}
                className="relative group cursor-pointer w-22 h-22 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-xl shadow-amber-500/10 shrink-0 transition-transform hover:scale-105"
                title="Tap to upload image file from device"
              >
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PRESET_AVATARS[0].url;
                  }}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity p-1 text-center">
                  <Upload className="w-5 h-5 text-amber-300 mb-0.5 animate-bounce" />
                  <span className="text-[8px] font-black uppercase text-amber-300">UPLOAD PHOTO</span>
                </div>
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Avatar Upload & URL Controls */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New Photo (ছবি আপলোড করুন)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const randomAv = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
                      setAvatarUrl(randomAv.url);
                      soundFx.playClick();
                    }}
                    className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold border border-slate-700 shrink-0 cursor-pointer"
                    title="Randomize Avatar"
                  >
                    🎲 Random Avatar
                  </button>
                </div>

                <div className="relative">
                  <Image className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Expandable Avatar Grid Picker */}
            {showAvatarPicker && (
              <div className="pt-3 border-t border-slate-800 space-y-2 animate-in fade-in duration-150">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Select Preset Casino Avatar:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        setAvatarUrl(av.url);
                        soundFx.playClick();
                      }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer aspect-square ${
                        avatarUrl === av.url ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105' : 'border-slate-800 hover:border-slate-600'
                      }`}
                      title={av.name}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                      {avatarUrl === av.url && (
                        <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-amber-300 font-bold" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Personal, Age, Document & Contact Information */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-amber-400" />
              <span>Personal, Age & Identity Details (ব্যক্তিগত তথ্য, বয়স ও ডকুমেন্টস)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Full Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">
                    Full Name (প্লেয়ারের নাম):
                  </label>
                  {isEmailName && (
                    <button
                      type="button"
                      onClick={() => {
                        setName(suggestedCleanName);
                        soundFx.playClick();
                      }}
                      className="text-[9px] text-amber-400 hover:underline font-bold"
                    >
                      Use "{suggestedCleanName}"
                    </button>
                  )}
                </div>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter real player name"
                    className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Age (বয়স) */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Age (বয়স):
                </label>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Email Address (ইমেইল আইডি):
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-2 rounded-xl text-amber-300 font-mono text-xs focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Mobile Phone Number (মোবাইল নম্বর):
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              {/* Referral Code */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Referral Code (রেফারেল কোড):
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="BG123456"
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold uppercase"
                />
              </div>
            </div>

            {/* Document ID & Verification Details */}
            <div className="pt-3 border-t border-slate-850 space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Govt Document ID / Verification (ডকুমেন্টস আইডি):</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-2 rounded-xl text-white text-xs outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="Aadhaar Card">Aadhaar Card (আধার কার্ড)</option>
                    <option value="PAN Card">PAN Card (প্যান কার্ড)</option>
                    <option value="Voter ID">Voter ID (ভোটার আইডি)</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Passport / National ID">Passport / National ID</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">Document ID Number (ডকুমেন্ট নম্বর)</label>
                  <input
                    type="text"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
                    className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="pt-3 border-t border-slate-850 space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Player Address & Location (ঠিকানা):</span>
              </span>

              <div className="space-y-1.5">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, House / Flat No, Locality"
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">City / District</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kolkata"
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. West Bengal"
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">PIN Code</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="700001"
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Quick Geo Tracking Button */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-mono">
                  {user.geoInfo ? (
                    <span className="text-emerald-400">📍 Live Location: {user.geoInfo.city || 'India'}, {user.geoInfo.country || 'IN'} ({user.geoInfo.ip || 'Logged'})</span>
                  ) : (
                    <span className="text-slate-500">📍 No live IP/GPS logged yet</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowGeoModal(true)}
                  className="px-3 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Live Map & Telemetry</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: VIP Tier & Role Privileges */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>VIP Tier & System Privileges (ভিআইপি ও রোল)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* VIP Tier Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  VIP Loyalty Tier:
                </label>
                <select
                  value={vipLevel}
                  onChange={(e) => {
                    const nextTier = e.target.value as typeof vipLevel;
                    setVipLevel(nextTier);
                    if (nextTier === 'Diamond' && vipPoints < 25000) setVipPoints(25000);
                    else if (nextTier === 'Platinum' && vipPoints < 10000) setVipPoints(10000);
                    else if (nextTier === 'Gold' && vipPoints < 2000) setVipPoints(2000);
                    else if (nextTier === 'Silver' && vipPoints < 500) setVipPoints(500);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-amber-300 font-mono text-xs focus:border-amber-400 outline-none font-bold"
                >
                  <option value="Bronze">🥉 Bronze (0+ pts)</option>
                  <option value="Silver">🥈 Silver (500+ pts)</option>
                  <option value="Gold">🥇 Gold VIP (2,000+ pts)</option>
                  <option value="Platinum">💠 Platinum VIP (10,000+ pts)</option>
                  <option value="Diamond">💎 Diamond Royal (25,000+ pts)</option>
                </select>
              </div>

              {/* VIP Points */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  VIP Points (পয়েন্টস):
                </label>
                <input
                  type="number"
                  min="0"
                  value={vipPoints}
                  onChange={(e) => setVipPoints(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>

              {/* System Role */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  System Role (ইউজার রোল):
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                >
                  <option value="user">👤 Standard Player (User)</option>
                  <option value="admin">🛡️ Administrator (Full Control)</option>
                </select>
              </div>
            </div>

            {/* Account Status Switch */}
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">Account Status:</span>
                <span className="text-[10px] text-slate-400">Control if user can login and place bets</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStatus('active'); soundFx.playClick(); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    status === 'active'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => { setStatus('suspended'); soundFx.playClick(); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    status === 'suspended'
                      ? 'bg-rose-500 text-white font-black shadow-md shadow-rose-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  Suspended
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Live Balances Direct Edit */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Wallet Balances Direct Modification (ব্যালেন্স পরিবর্তন)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Main Wallet */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">Main Real Wallet (₹):</span>
                  <span className="text-[10px] text-slate-400">Deposits & Winnings</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-sm focus:border-amber-400 outline-none font-black"
                />
              </div>

              {/* Bonus Wallet */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400">Bonus Wallet (₹):</span>
                  <span className="text-[10px] text-slate-400">Promotions & Rewards</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bonusBalance}
                  onChange={(e) => setBonusBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-purple-200 font-mono text-sm focus:border-purple-400 outline-none font-black"
                />
              </div>
            </div>

            {/* Withdrawal Wagering (Turnover) Configuration */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-500/30 space-y-3.5 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white uppercase tracking-wider font-sans">
                    উইথড্রয়াল উয়েজার রিকোয়ারমেন্ট (Withdrawal Wagering)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-slate-300 font-sans cursor-pointer flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    <input
                      type="checkbox"
                      checked={wagerExempt}
                      onChange={(e) => setWagerExempt(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className={wagerExempt ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                      VIP ছাড় (Exempt)
                    </span>
                  </label>
                </div>
              </div>

              {/* Main and Bonus Wager Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Main Wager Card */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-bold font-sans">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      মেইন উয়েজার (Main Wager)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      বাকি: ₹{Math.max(0, mainWagerRequired - mainWagerCompleted).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">প্রয়োজনীয় লক্ষ্য (Target ₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={mainWagerRequired}
                        onChange={(e) => setMainWagerRequired(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-white font-mono text-xs focus:border-amber-400 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">সম্পন্ন হয়েছে (Completed ₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={mainWagerCompleted}
                        onChange={(e) => setMainWagerCompleted(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-xs focus:border-emerald-400 outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Bonus Wager Card */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-purple-400 font-bold font-sans">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      বোনাস উয়েজার (Bonus Wager)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      বাকি: ₹{Math.max(0, bonusWagerRequired - bonusWagerCompleted).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">প্রয়োজনীয় লক্ষ্য (Target ₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={bonusWagerRequired}
                        onChange={(e) => setBonusWagerRequired(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-white font-mono text-xs focus:border-purple-400 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">সম্পন্ন হয়েছে (Completed ₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={bonusWagerCompleted}
                        onChange={(e) => setBonusWagerCompleted(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-purple-300 font-mono text-xs focus:border-purple-400 outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 1-Click Action Buttons for this user */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMainWagerCompleted(mainWagerRequired);
                    setBonusWagerCompleted(bonusWagerRequired);
                    setWagerExempt(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-sans cursor-pointer transition-colors"
                >
                  ✓ ১০০% কমপ্লিট করুন
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMainWagerRequired(balance * 1);
                    setMainWagerCompleted(0);
                    setWagerExempt(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-sans cursor-pointer transition-colors"
                >
                  ১x মেইন ব্যালেন্স সেট
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMainWagerRequired(balance * 2);
                    setMainWagerCompleted(0);
                    setWagerExempt(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-sans cursor-pointer transition-colors"
                >
                  ২x মেইন ব্যালেন্স সেট
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMainWagerRequired(0);
                    setMainWagerCompleted(0);
                    setBonusWagerRequired(0);
                    setBonusWagerCompleted(0);
                    setWagerExempt(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold font-sans cursor-pointer transition-colors"
                >
                  উয়েজার ০ করুন
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsSaving(true);
                  soundFx.playClick();
                  const docIdsToDelete = new Set<string>(
                    user.linkedDocIds && user.linkedDocIds.length > 0 ? user.linkedDocIds : [user.id]
                  );
                  docIdsToDelete.add(user.id);
                  if (user.email) {
                    const cleanEmail = user.email.toLowerCase().trim();
                    docIdsToDelete.add(`user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);
                  }

                  await Promise.all(
                    Array.from(docIdsToDelete).map((dId) =>
                      deleteDoc(doc(db, 'users', dId)).catch(() => {})
                    )
                  );

                  soundFx.playCoin();
                  if (onUserDeleted) {
                    onUserDeleted(user);
                  }
                  onClose();
                } catch (err: any) {
                  console.error('Error deleting user:', err);
                  setErrorMsg(`Failed to delete user: ${err?.message || 'Unknown database error'}`);
                  setIsSaving(false);
                }
              }}
              className="px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete User Account</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { soundFx.playClick(); onClose(); }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>⚡ Submit & Save Changes (সংরক্ষণ করুন)</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* Real-time Geo Tracking Modal */}
      {showGeoModal && (
        <AdminUserGeoTrackingModal
          user={user}
          onClose={() => setShowGeoModal(false)}
          onUserUpdated={(updated) => {
            onUserUpdated(updated);
          }}
        />
      )}

    </div>
  );
};

