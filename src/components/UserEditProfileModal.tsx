import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  User as UserIcon, 
  FileText, 
  MapPin, 
  Phone, 
  Calendar, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { User } from '../types';
import { updateUserProfileDetails, readFileAsCompressedDataUrl } from '../utils/userDataManager';
import { soundFx } from '../utils/audio';

interface UserEditProfileModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export const UserEditProfileModal: React.FC<UserEditProfileModalProps> = ({
  user,
  onClose,
  onUserUpdated
}) => {
  const [name, setName] = useState<string>(user.name || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [age, setAge] = useState<string>(user.age ? String(user.age) : '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | undefined>(
    user.gender === 'male' || user.gender === 'female' || user.gender === 'other' ? user.gender : undefined
  );
  const [documentType, setDocumentType] = useState<string>(user.documentType || 'Aadhaar Card');
  const [documentId, setDocumentId] = useState<string>(user.documentId || '');
  const [address, setAddress] = useState<string>(user.address || '');
  const [city, setCity] = useState<string>(user.city || '');
  const [state, setState] = useState<string>(user.state || '');
  const [pincode, setPincode] = useState<string>(user.pincode || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl || '');

  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল (JPG, PNG, WEBP) আপলোড করুন।');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setErrorMsg(null);
      soundFx.playClick();

      // Compress avatar to max 350x350 with 0.85 quality for fast Firestore sync
      const compressedBase64 = await readFileAsCompressedDataUrl(file, 350, 350, 0.85);
      setAvatarUrl(compressedBase64);
      soundFx.playCoin();
      setSuccessMsg('ছবি সফলভাবে যুক্ত হয়েছে! সংরক্ষণ করতে নিচে সাবমিট বাটনে চাপ দিন।');
    } catch (err: any) {
      console.error('Error reading/compressing photo:', err);
      setErrorMsg('ছবি প্রসেসিং করতে সমস্যা হয়েছে। অনুগ্রহ করে অন্য ছবি নির্বাচন করুন।');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('নামের ঘরটি খালি রাখা যাবে না।');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      soundFx.playClick();

      const parsedAge = age ? parseInt(age, 10) : undefined;
      if (parsedAge !== undefined && (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120)) {
        setErrorMsg('অনুগ্রহ করে সঠিক বয়স লিখুন (১৮ বা তার বেশি)।');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim() || user.avatarUrl,
        age: parsedAge,
        gender,
        documentType: documentType.trim(),
        documentId: documentId.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim()
      };

      const result = await updateUserProfileDetails(user, payload);
      soundFx.playWinFanfare();
      setSuccessMsg('প্রোফাইল তথ্য ও ছবি সফলভাবে সংরক্ষিত ও আপডেট করা হয়েছে!');

      onUserUpdated(result.updatedUser);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMsg(`প্রোফাইল আপডেট করতে ব্যর্থ হয়েছে: ${err?.message || 'ডাটাবেজ সংযোগে ত্রুটি'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-5 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-mono flex items-center gap-2">
                <span>EDIT PROFILE</span>
                <span className="text-amber-400 text-sm font-bold">(প্রোফাইল এডিট)</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                আপনার ছবি, নাম, বয়স, জাতীয় পরিচয়পত্র ও ঠিকানা পরিবর্তন করুন
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-2xl text-rose-200 text-xs font-mono flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-mono flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Section 1: Avatar Upload & Preview */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group shrink-0">
              <img
                src={avatarUrl || user.avatarUrl}
                alt={name || user.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-amber-400 shadow-xl shadow-amber-500/20"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-amber-300 text-[10px] font-bold font-mono gap-1 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>CHANGE</span>
              </button>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div>
                <span className="text-xs font-bold text-white block">Profile Photo (প্রোফাইল ছবি):</span>
                <span className="text-[11px] text-slate-400">
                  সরাসরি গ্যালারি বা ক্যামেরা থেকে আপনার নতুন ছবি আপলোড করুন
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploadingPhoto}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isUploadingPhoto ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>প্রসেসিং হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 stroke-[3]" />
                      <span>📁 Upload Photo (ছবি আপলোড করুন)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Personal Identity Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Full Name (পূর্ণ নাম)*:</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                className="w-full bg-slate-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
              />
            </div>

            {/* Mobile Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Mobile Phone (মোবাইল নম্বর):</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-slate-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
              />
            </div>

            {/* Age */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Age (বয়স):</span>
              </label>
              <input
                type="number"
                min="18"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 25"
                className="w-full bg-slate-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
              />
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <span>Gender (লিঙ্গ):</span>
              </label>
              <select
                value={gender || ''}
                onChange={(e) => setGender(e.target.value as any || undefined)}
                className="w-full bg-slate-950 border border-slate-700 px-3.5 py-2.5 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
              >
                <option value="">Select Gender (নির্বাচন করুন)</option>
                <option value="male">Male (পুরুষ)</option>
                <option value="female">Female (মহিলা)</option>
                <option value="other">Other (অন্যান্য)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Official KYC & Document ID */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Identity Verification Document (পরিচয়পত্র ডকুমেন্টস)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Document Type */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Document Type (ডকুমেন্ট ধরন):
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                >
                  <option value="Aadhaar Card">Aadhaar Card (আধার কার্ড)</option>
                  <option value="PAN Card">PAN Card (প্যান কার্ড)</option>
                  <option value="Voter ID Card">Voter ID Card (ভোটার আইডি)</option>
                  <option value="Driving License">Driving License (ড্রাইভিং লাইসেন্স)</option>
                  <option value="Passport">Passport (পাসপোর্ট)</option>
                  <option value="National ID">National ID (জাতীয় পরিচয়পত্র)</option>
                </select>
              </div>

              {/* Document ID Number */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Document ID Number (ডকুমেন্ট নম্বর):
                </label>
                <input
                  type="text"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Address Details */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Full Address (সম্পূর্ণ ঠিকানা):</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Street, Landmark, Village/Town"
                className="w-full bg-slate-950 border border-slate-700 px-3.5 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none resize-none font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* City */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  City (শহর):
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Kolkata"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>

              {/* State */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  State (রাজ্য):
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. West Bengal"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>

              {/* PIN Code */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  PIN Code (পিন কোড):
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 700001"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-amber-400 outline-none font-bold"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
            >
              Cancel (বাতিল)
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black font-mono text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>⚡ Submit & Save (সংরক্ষণ করুন)</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
