import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Headphones, 
  CheckCheck, 
  Check, 
  Clock, 
  User as UserIcon, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  Wallet, 
  ExternalLink,
  Volume2,
  VolumeX,
  X,
  Zap,
  ChevronUp,
  ChevronDown,
  Gamepad2,
  Maximize2,
  Minimize2,
  Eye,
  Calendar,
  Copy,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Loader2,
  UserCheck,
  Camera,
  Upload,
  Save,
  ChevronLeft,
  Users,
  Menu,
  SlidersHorizontal,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, SupportChatMessage, SupportChatThread, NotificationItem, SupportAgentConfig } from '../../types';
import { soundFx } from '../../utils/audio';
import { processChatAttachment } from '../../utils/imageCompressor';
import { useSupportAgentConfig, AGENT_AVATAR_PRESETS, setAdminTypingStatus } from '../../utils/supportAgentService';
import { generatePermanentUserCode } from '../../utils/databaseSync';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../../firebase';
import { safeApiPost } from '../../utils/apiConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit, 
  getDocs 
} from 'firebase/firestore';

interface AdminSupportChatManagerProps {
  adminUser: User;
  allUsers: User[];
  onOpenUserDossier?: (user: User) => void;
  initialTargetUserId?: string | null;
}

const ADMIN_QUICK_RESPONSES = [
  '✅ আপনার ডিপোজিট যাচাই করা হয়েছে এবং ওয়ালেটে ক্রেডিট করে দেওয়া হয়েছে।',
  '⏳ আপনার উইথড্রয়াল প্রসেসিং এ রয়েছে, ৫-১৫ মিনিটের মধ্যে একাউন্টে পৌঁছাবে।',
  '📸 দয়া করে পেমেন্টের সঠিক UTR / ট্রানজেকশন স্ক্রিনশট শেয়ার করুন।',
  '🎁 আপনার একাউন্টে বিশেষ বোনাস ক্রেডিট করা হয়েছে! খেলে উপভোগ করুন।',
  '🔒 আপনার একাউন্ট সিকিউরিটি সম্পূর্ণ নিরাপদ এবং ভেরিফাইড রয়েছে।',
  '👋 হ্যালো! BETGURU সাপোর্টে আপনাকে স্বাগতম। আপনার সমস্যাটি বিস্তারিত বলুন।'
];

export const AdminSupportChatManager: React.FC<AdminSupportChatManagerProps> = ({
  adminUser,
  allUsers,
  onOpenUserDossier,
  initialTargetUserId,
}) => {
  const { agentConfig, updateAgentConfig } = useSupportAgentConfig();
  const [isAgentConfigModalOpen, setIsAgentConfigModalOpen] = useState<boolean>(false);
  const [editingAgent, setEditingAgent] = useState<SupportAgentConfig>(agentConfig);
  const [isSavingAgent, setIsSavingAgent] = useState<boolean>(false);
  const [agentPhotoCompressing, setAgentPhotoCompressing] = useState<boolean>(false);
  const agentPhotoInputRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<SupportChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialTargetUserId || null);
  const [mobileTab, setMobileTab] = useState<'threads' | 'chat'>(initialTargetUserId ? 'chat' : 'threads');
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);

  useEffect(() => {
    if (initialTargetUserId) {
      setSelectedThreadId(initialTargetUserId);
      setMobileTab('chat');
    }
  }, [initialTargetUserId]);
  const [activeMessages, setActiveMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'open' | 'resolved'>('all');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState<boolean>(false);
  const [isFullChatModalOpen, setIsFullChatModalOpen] = useState<boolean>(false);
  const [isDeskFullScreen, setIsDeskFullScreen] = useState<boolean>(false);
  const [isControlsMenuOpen, setIsControlsMenuOpen] = useState<boolean>(false);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [isUserDetailsHidden, setIsUserDetailsHidden] = useState<boolean>(false);
  const [isModalUserDetailsHidden, setIsModalUserDetailsHidden] = useState<boolean>(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'file';
    size: string;
  } | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const embeddedTextInputRef = useRef<HTMLInputElement>(null);
  const modalTextInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminTypingTimerRef = useRef<any>(null);

  // Dynamic Visual Viewport Height tracking for on-screen mobile keyboard
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  });

  // Track Visual Viewport resize (Virtual Keyboard on Android / iOS)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        modalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  const handleEmbeddedInputFocus = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (embeddedTextInputRef.current) {
        embeddedTextInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
  };

  const handleModalInputFocus = () => {
    setTimeout(() => {
      modalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (modalTextInputRef.current) {
        modalTextInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
    setTimeout(() => {
      modalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
  };

  const handleAdminInputChange = (val: string) => {
    setInputText(val);
    if (selectedThreadId) {
      setAdminTypingStatus(selectedThreadId, true);
      if (adminTypingTimerRef.current) {
        clearTimeout(adminTypingTimerRef.current);
      }
      adminTypingTimerRef.current = setTimeout(() => {
        if (selectedThreadId) {
          setAdminTypingStatus(selectedThreadId, false);
        }
      }, 3000);
    }
  };

  // Sync editing agent whenever agentConfig updates
  useEffect(() => {
    if (agentConfig) {
      setEditingAgent(agentConfig);
    }
  }, [agentConfig]);

  const handleAgentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAgentPhotoCompressing(true);
      const processed = await processChatAttachment(file);
      if (processed.type === 'image') {
        soundFx.playClick();
        setEditingAgent((prev) => ({ ...prev, avatarUrl: processed.url }));
      } else {
        alert('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল আপলোড করুন।');
      }
    } catch (err: any) {
      alert(err.message || 'ফটো প্রসেসিং এ সমস্যা হয়েছে।');
    } finally {
      setAgentPhotoCompressing(false);
      if (agentPhotoInputRef.current) agentPhotoInputRef.current.value = '';
    }
  };

  const handleSaveAgentConfig = async () => {
    if (!editingAgent.name.trim()) {
      alert('এজেন্টের নাম অবশ্যই দিতে হবে।');
      return;
    }
    try {
      setIsSavingAgent(true);
      soundFx.playClick();
      await updateAgentConfig(editingAgent);
      soundFx.playCoin();
      setIsAgentConfigModalOpen(false);
    } catch (err: any) {
      alert('এজেন্ট প্রোফাইল সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    soundFx.playClick();
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const processed = await processChatAttachment(file);
      soundFx.playClick();
      setAttachment({
        url: processed.url,
        name: processed.name,
        type: processed.type,
        size: processed.size
      });
    } catch (err: any) {
      alert(err.message || 'ফাইল প্রসেসিং এ ত্রুটি হয়েছে।');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
    }
  };
  const modalMessagesEndRef = useRef<HTMLDivElement>(null);
  const prevThreadsRef = useRef<{ [threadId: string]: number }>({});

  // 1. Real-time Listener for all Support Threads (Zero Refresh)
  useEffect(() => {
    try {
      const threadsRef = collection(db, 'support_threads');
      const q = query(threadsRef, limit(250));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loadedThreads: SupportChatThread[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const thread: SupportChatThread = {
              id: docSnap.id,
              userId: data.userId || docSnap.id,
              userName: data.userName || 'Player',
              userEmail: data.userEmail || '',
              userPhone: data.userPhone || '',
              lastMessage: data.lastMessage || '',
              lastSenderRole: data.lastSenderRole || 'user',
              lastMessageTime: data.lastMessageTime || '',
              lastMessageTimestamp: data.lastMessageTimestamp || data.updatedAt || Date.now(),
              unreadAdminCount: data.unreadAdminCount || 0,
              unreadUserCount: data.unreadUserCount || 0,
              status: data.status || 'open',
              updatedAt: data.updatedAt || data.lastMessageTimestamp || Date.now(),
            };
            loadedThreads.push(thread);

            // Audio Alert when a user sends a new message to Admin
            const prevTimestamp = prevThreadsRef.current[thread.id] || 0;
            if (
              thread.lastSenderRole === 'user' &&
              thread.lastMessageTimestamp > prevTimestamp &&
              prevTimestamp > 0
            ) {
              if (!isSoundMuted) {
                soundFx.playChime();
              }
            }
            prevThreadsRef.current[thread.id] = thread.lastMessageTimestamp;
          });

          // Sort threads: prioritize pending user requests (unread count > 0 OR status open and last sender was user) at the top, then newest timestamp
          loadedThreads.sort((a, b) => {
            const aPending = (a.unreadAdminCount && a.unreadAdminCount > 0) || (a.status === 'open' && a.lastSenderRole === 'user') ? 1 : 0;
            const bPending = (b.unreadAdminCount && b.unreadAdminCount > 0) || (b.status === 'open' && b.lastSenderRole === 'user') ? 1 : 0;
            if (aPending !== bPending) return bPending - aPending;
            return (b.updatedAt || b.lastMessageTimestamp || 0) - (a.updatedAt || a.lastMessageTimestamp || 0);
          });

          setThreads(loadedThreads);

          // Default select the first thread if none selected
          setSelectedThreadId((prev) => {
            if (prev && loadedThreads.some((t) => t.userId === prev || t.id === prev)) {
              return prev;
            }
            return loadedThreads.length > 0 ? (loadedThreads[0].userId || loadedThreads[0].id) : null;
          });
        },
        (error) => {
          console.warn('Support threads listener error:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up support threads listener:', err);
    }
  }, [isSoundMuted]);

  // Find active user profile from allUsers
  const activeUser = useMemo(() => {
    if (!selectedThreadId) return null;
    return allUsers.find(
      (u) =>
        u.id === selectedThreadId ||
        (u.linkedDocIds && u.linkedDocIds.includes(selectedThreadId)) ||
        (u.email && u.email.toLowerCase() === selectedThreadId.toLowerCase())
    );
  }, [selectedThreadId, allUsers]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.userId === selectedThreadId || t.id === selectedThreadId);
  }, [threads, selectedThreadId]);

  // Calculate all candidate IDs for the selected user to guarantee 100% complete message loading
  const targetUserIds = useMemo(() => {
    if (!selectedThreadId) return [];
    const idSet = new Set<string>();
    idSet.add(selectedThreadId);
    if (activeThread?.userId) idSet.add(activeThread.userId);
    if (activeThread?.id) idSet.add(activeThread.id);
    if (activeUser?.id) idSet.add(activeUser.id);
    if (activeUser?.email) idSet.add(activeUser.email.toLowerCase().trim());
    if (activeThread?.userEmail) idSet.add(activeThread.userEmail.toLowerCase().trim());
    if (activeUser?.linkedDocIds) {
      activeUser.linkedDocIds.forEach((id) => idSet.add(id));
    }
    return Array.from(idSet).filter(Boolean);
  }, [selectedThreadId, activeThread, activeUser]);

  // 2. Real-time Listener for Active Thread Messages (Zero Refresh & Guaranteed Complete History)
  useEffect(() => {
    if (!selectedThreadId || targetUserIds.length === 0) {
      setActiveMessages([]);
      return;
    }

    try {
      const msgRef = collection(db, 'support_messages');
      // Use 'in' query with target candidate IDs to get every single message written by user or admin
      const q = targetUserIds.length === 1
        ? query(msgRef, where('userId', '==', targetUserIds[0]), limit(200))
        : query(msgRef, where('userId', 'in', targetUserIds.slice(0, 10)), limit(200));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loaded: SupportChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            loaded.push({
              id: docSnap.id,
              userId: data.userId || selectedThreadId,
              userName: data.userName || activeThread?.userName || activeUser?.name || 'Player',
              userEmail: data.userEmail || activeThread?.userEmail || activeUser?.email || '',
              userPhone: data.userPhone || activeThread?.userPhone || activeUser?.phone || '',
              senderRole: data.senderRole || 'user',
              senderId: data.senderId || selectedThreadId,
              senderName: data.senderName || 'Player',
              text: data.text || '',
              read: data.read ?? true,
              timestamp: data.timestamp || new Date().toISOString(),
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : (data.timestamp ? new Date(data.timestamp).getTime() : Date.now()),
              attachmentUrl: data.attachmentUrl,
              attachmentName: data.attachmentName,
              attachmentType: data.attachmentType,
              attachmentSize: data.attachmentSize,
            });
          });

          // Sort messages chronologically (oldest to newest)
          loaded.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

          setActiveMessages(loaded);

          // Mark unread user messages as read by Admin
          if (activeThread && activeThread.unreadAdminCount > 0) {
            setDoc(doc(db, 'support_threads', activeThread.id || activeThread.userId), { unreadAdminCount: 0 }, { merge: true }).catch(() => {});
          }
        },
        (error) => {
          console.warn('Active chat messages listener error:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error subscribing to active thread messages:', err);
    }
  }, [selectedThreadId, targetUserIds, activeThread, activeUser]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (isFullChatModalOpen) {
      modalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages, isFullChatModalOpen]);

  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const q = searchTerm.toLowerCase().trim();
      const cleanNumericQ = q.replace(/^[#\s]+/, '').trim();
      const uCode = (generatePermanentUserCode(t.userEmail, undefined, t.userId)).toLowerCase();
      const matchesSearch =
        !q ||
        t.userName.toLowerCase().includes(q) ||
        (t.userEmail && t.userEmail.toLowerCase().includes(q)) ||
        (t.userPhone && t.userPhone.includes(q)) ||
        t.userId.toLowerCase().includes(q) ||
        (cleanNumericQ && t.userId.toLowerCase().includes(cleanNumericQ)) ||
        t.lastMessage.toLowerCase().includes(q) ||
        uCode === cleanNumericQ ||
        uCode.includes(cleanNumericQ) ||
        (cleanNumericQ && `#${uCode}`.includes(q));

      const isPending = (t.unreadAdminCount && t.unreadAdminCount > 0) || (t.status === 'open' && t.lastSenderRole === 'user');
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unread' && isPending) ||
        (statusFilter === 'open' && t.status === 'open') ||
        (statusFilter === 'resolved' && t.status === 'resolved');

      return matchesSearch && matchesStatus;
    });
  }, [threads, searchTerm, statusFilter]);

  // Total unread user messages waiting for admin attention
  const totalAdminUnread = useMemo(() => {
    return threads.reduce((acc, curr) => acc + (curr.unreadAdminCount || 0), 0);
  }, [threads]);

  // Total pending requests waiting for admin reply
  const pendingRequestsCount = useMemo(() => {
    return threads.filter(
      (t) => (t.unreadAdminCount && t.unreadAdminCount > 0) || (t.status === 'open' && t.lastSenderRole === 'user')
    ).length;
  }, [threads]);

  // Send Admin Reply
  const handleSendAdminReply = async (textToSend?: string) => {
    const rawText = (textToSend || inputText).trim();
    if ((!rawText && !attachment) || !selectedThreadId || isSending || isCompressing) return;

    try {
      setIsSending(true);
      soundFx.playClick();

      const msgId = `MSG-ADM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();
      const isoTime = new Date().toISOString();
      const effectiveAgentName = agentConfig.name || adminUser?.name || 'BETGURU Support Specialist';
      const effectiveAgentAvatar = agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80';
      const effectiveAgentTitle = agentConfig.title || 'Senior Live Support Specialist';

      const targetUserName = activeThread?.userName || activeUser?.name || 'Player';
      const targetUserEmail = activeThread?.userEmail || activeUser?.email || '';
      const targetUserPhone = activeThread?.userPhone || activeUser?.phone || '';

      const currentAttachment = attachment;
      const displayMessage = rawText || (currentAttachment ? (currentAttachment.type === 'image' ? '📷 [Photo Attached]' : `📎 [File: ${currentAttachment.name}]`) : '');

      const newMsg: SupportChatMessage = {
        id: msgId,
        userId: selectedThreadId,
        userName: targetUserName,
        userEmail: targetUserEmail,
        userPhone: targetUserPhone,
        senderRole: 'admin',
        senderId: adminUser?.id || 'admin',
        senderName: effectiveAgentName,
        senderAvatar: effectiveAgentAvatar,
        senderTitle: effectiveAgentTitle,
        text: rawText,
        read: false,
        timestamp: isoTime,
        createdAt: now,
        ...(currentAttachment ? {
          attachmentUrl: currentAttachment.url,
          attachmentName: currentAttachment.name,
          attachmentType: currentAttachment.type,
          attachmentSize: currentAttachment.size,
        } : {})
      };

      // Optimistic update
      setActiveMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setAttachment(null);

      // 1. Save message to Firestore
      await setDoc(doc(db, 'support_messages', msgId), cleanFirestoreData(newMsg));

      // 2. Update thread summary
      const updatedThreadData: Partial<SupportChatThread> = {
        lastMessage: displayMessage,
        lastSenderRole: 'admin',
        lastMessageTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        lastMessageTimestamp: now,
        unreadAdminCount: 0,
        unreadUserCount: (activeThread?.unreadUserCount || 0) + 1,
        status: 'open',
        updatedAt: now,
      };
      await setDoc(doc(db, 'support_threads', selectedThreadId), cleanFirestoreData(updatedThreadData), { merge: true });

      // 3. Trigger a direct push notification in the user's notification drawer
      const notifId = `NTF-SUP-${Date.now()}`;
      const userNotification: NotificationItem = {
        id: notifId,
        userId: selectedThreadId,
        targetUserId: selectedThreadId,
        title: `💬 Reply from ${effectiveAgentName}`,
        message: displayMessage,
        type: 'system',
        actionType: 'support',
        date: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        read: false,
        isGlobal: false,
        createdAt: now,
        priority: 'SUPPORT',
      };
      await setDoc(doc(db, 'notifications', notifId), cleanFirestoreData(userNotification));

      // Dispatch real-time Android FCM push notification to target user via resilient safeApiPost
      safeApiPost('/api/send-user-push', {
        userId: selectedThreadId,
        title: `💬 Support: ${effectiveAgentName}`,
        message: displayMessage,
        body: displayMessage,
        type: 'support',
        targetUrl: '/'
      }).catch((err) => console.warn('Support Chat FCM Push dispatch notice:', err));

      if (selectedThreadId) {
        if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
        setAdminTypingStatus(selectedThreadId, false);
      }

      soundFx.playCoin();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'support_messages');
      console.error('Error sending admin support reply:', err);
      alert(`Error sending reply: ${err?.message || 'Check database connection'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Toggle Thread Status (Open / Resolved)
  const handleToggleStatus = async (newStatus: 'open' | 'resolved') => {
    if (!selectedThreadId) return;
    try {
      soundFx.playClick();
      await setDoc(doc(db, 'support_threads', selectedThreadId), { status: newStatus }, { merge: true });
      soundFx.playCoin();
    } catch (e: any) {
      console.error('Error updating thread status:', e);
    }
  };

  // Permanently Delete & Close Entire Support Conversation (Zero Trace, Fresh start next time)
  const handleDeleteAndCloseChat = async () => {
    if (!selectedThreadId || isDeleting) return;

    try {
      setIsDeleting(true);
      soundFx.playClick();

      // Collect all candidate IDs to wipe all related docs
      const candidateIds = Array.from(new Set([
        selectedThreadId,
        activeThread?.userId,
        activeThread?.id,
        activeUser?.id,
        activeUser?.email,
        activeThread?.userEmail,
      ].filter(Boolean))) as string[];

      // 1. Delete all message documents in support_messages
      for (const uid of candidateIds) {
        try {
          const q = query(collection(db, 'support_messages'), where('userId', '==', uid));
          const snap = await getDocs(q);
          const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, 'support_messages', d.id)));
          await Promise.all(deletePromises);
        } catch (err) {
          console.warn(`Error deleting messages for ${uid}:`, err);
        }
      }

      // 2. Delete thread document from support_threads
      for (const uid of candidateIds) {
        try {
          await deleteDoc(doc(db, 'support_threads', uid));
        } catch (err) {
          console.warn(`Error deleting thread doc ${uid}:`, err);
        }
      }

      // 3. Clear active messages and filter out from local thread list
      setActiveMessages([]);
      const updatedThreads = threads.filter(
        (t) => !candidateIds.includes(t.userId) && !candidateIds.includes(t.id)
      );
      setThreads(updatedThreads);

      if (updatedThreads.length > 0) {
        setSelectedThreadId(updatedThreads[0].userId || updatedThreads[0].id);
      } else {
        setSelectedThreadId(null);
      }

      soundFx.playCoin();
    } catch (e: any) {
      console.error('Error deleting and closing support chat:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear Chat History for user
  const handleClearHistory = async () => {
    if (!selectedThreadId) return;

    try {
      soundFx.playClick();
      // Delete all messages in thread
      const q = query(collection(db, 'support_messages'), where('userId', '==', selectedThreadId));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, 'support_messages', d.id)));
      await Promise.all(deletePromises);

      // Reset thread summary
      await setDoc(
        doc(db, 'support_threads', selectedThreadId),
        {
          lastMessage: '[Chat history cleared by Admin]',
          lastSenderRole: 'admin',
          unreadAdminCount: 0,
          unreadUserCount: 0,
          status: 'resolved',
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setActiveMessages([]);
      soundFx.playCoin();
    } catch (e: any) {
      console.error('Error clearing chat:', e);
    }
  };

  // Helper to open full User Betting Dossier safely for any player
  const handleOpenDossier = (targetThreadId?: string, targetThread?: SupportChatThread) => {
    if (!onOpenUserDossier) return;
    soundFx.playClick();
    const thread = targetThread || activeThread;
    const uid = targetThreadId || selectedThreadId;
    if (!uid && !thread) return;

    // Check activeUser first if matches
    let matched: User | null = null;
    if (activeUser && (activeUser.id === uid || (uid && activeUser.linkedDocIds?.includes(uid)) || (thread?.userEmail && activeUser.email?.toLowerCase() === thread.userEmail.toLowerCase()))) {
      matched = activeUser;
    }

    if (!matched) {
      matched = allUsers.find(
        (u) =>
          u.id === uid ||
          (u.linkedDocIds && u.linkedDocIds.includes(uid || '')) ||
          (u.email && thread?.userEmail && u.email.toLowerCase() === thread.userEmail.toLowerCase()) ||
          (u.email && uid && u.email.toLowerCase() === uid.toLowerCase()) ||
          (u.phone && thread?.userPhone && u.phone === thread.userPhone)
      ) || null;
    }

    if (matched) {
      onOpenUserDossier(matched);
    } else {
      const fallbackUser: User = {
        id: uid || `USR-${Date.now()}`,
        name: thread?.userName || 'Player',
        email: thread?.userEmail || '',
        phone: thread?.userPhone || '',
        balance: 0,
        bonusBalance: 0,
        referralCode: 'BETGURU',
        totalWon: 0,
        totalSpent: 0,
        role: 'user',
        status: 'active',
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
        vipLevel: 'Bronze',
        regDate: new Date().toLocaleDateString('en-IN')
      };
      onOpenUserDossier(fallbackUser);
    }
  };

  return (
    <div className={`bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl font-mono flex flex-col transition-all duration-300 ${
      isDeskFullScreen 
        ? 'fixed inset-0 z-[100] w-screen h-screen rounded-none border-0' 
        : 'w-full min-h-[calc(100vh-170px)] h-[calc(100vh-170px)]'
    } animate-in fade-in duration-200`}>
      {/* Top Header - Ultra Sleek & Uncluttered Single Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Back Button to Thread List when inside Chat */}
          {mobileTab === 'chat' && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setMobileTab('threads');
              }}
              className="md:hidden px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-xl border border-amber-500/40 flex items-center gap-1 text-xs font-black shrink-0 active:scale-95 transition-all shadow-sm"
              title="ইউজার লিস্টে ফিরে যান"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
              <span>লিস্ট ({threads.length})</span>
              {pendingRequestsCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Headphones className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate">
                Live Support Desk
              </h2>
              {pendingRequestsCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.2 rounded-full animate-pulse shrink-0">
                  {pendingRequestsCount} পেন্ডিং
                </span>
              )}
            </div>
            <p className="text-[10px] text-amber-400/80 truncate hidden sm:block">
              {threads.length} User Conversations • Real-time Sync
            </p>
          </div>
        </div>

        {/* Right Header Controls: Agent Avatar + Dedicated Options Tab Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* AGENT AVATAR & QUICK STATUS (Tap opens Options Tab) */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsControlsMenuOpen(true);
            }}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-md group active:scale-95"
            title="এজেন্ট ও সেটিংস অপশন খুলুন"
          >
            <div className="relative shrink-0">
              <img
                src={agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                alt={agentConfig.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover border border-amber-400"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-slate-950 ${agentConfig.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </div>
            <div className="text-left hidden md:block leading-tight">
              <span className="text-[11px] font-black text-white block group-hover:text-amber-200 truncate max-w-[100px]">{agentConfig.name}</span>
              <span className={`text-[9px] font-bold ${agentConfig.isOnline !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                {agentConfig.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </button>

          {/* DEDICATED OPTIONS TAB BUTTON (Directly beside Agent Photo as requested) */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsControlsMenuOpen(true);
            }}
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 ring-2 ring-amber-400/50"
            title="সমস্ত ফিচার ও অপশন ট্যাব খুলুন (Open Action & Options Tab)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
            <span className="tracking-wide uppercase">ট্যাব অপশন</span>
            {isDeskFullScreen && (
              <span className="bg-slate-950 text-amber-300 text-[9px] px-1 py-0.2 rounded font-mono hidden sm:inline">FULL</span>
            )}
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Threads List on Left | Conversation on Right */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Threads Sidebar */}
        <div className={`${
          isSidebarVisible ? 'md:col-span-4 lg:col-span-4' : 'hidden'
        } ${
          mobileTab === 'threads' ? 'flex' : 'hidden md:flex'
        } border-r border-slate-800 bg-slate-950/70 flex-col overflow-hidden w-full h-full`}>
          
          {/* Search & Filter Controls */}
          <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900/40">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, user code..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[10px]">
              {(['all', 'unread', 'open', 'resolved'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => {
                    soundFx.playClick();
                    setStatusFilter(filterKey);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer shrink-0 ${
                    statusFilter === filterKey
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {filterKey === 'all' && `সব (${threads.length})`}
                  {filterKey === 'unread' && `🔴 পেন্ডিং (${pendingRequestsCount})`}
                  {filterKey === 'open' && 'ওপেন'}
                  {filterKey === 'resolved' && 'সমাধানকৃত'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                <p className="text-xs font-bold">No active conversations found</p>
                <p className="text-[11px] text-slate-400">Incoming user support requests will appear here instantly.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = thread.userId === selectedThreadId;
                const userMatch = allUsers.find(
                  (u) =>
                    u.id === thread.userId ||
                    (u.linkedDocIds && u.linkedDocIds.includes(thread.userId)) ||
                    (u.email && u.email.toLowerCase() === thread.userEmail?.toLowerCase())
                );
                const hasUnread = (thread.unreadAdminCount && thread.unreadAdminCount > 0);
                const isPending = hasUnread || (thread.status === 'open' && thread.lastSenderRole === 'user');

                return (
                  <button
                    key={thread.id || thread.userId}
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedThreadId(thread.userId);
                      setMobileTab('chat');
                    }}
                    className={`w-full p-3.5 text-left transition-all flex items-start gap-3 relative cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-l-4 border-amber-500'
                        : isPending
                        ? 'bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-rose-500/80'
                        : 'hover:bg-slate-900/80 border-l-4 border-transparent'
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border flex items-center justify-center text-amber-400 font-bold text-sm shadow-md ${
                        isPending ? 'border-amber-400 ring-2 ring-rose-500/50' : 'border-slate-700'
                      }`}>
                        {thread.userName.charAt(0).toUpperCase()}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-950 animate-bounce shadow-md">
                          {thread.unreadAdminCount}
                        </span>
                      )}
                    </div>

                    {/* Thread Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs font-black truncate ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {thread.userName}
                          </span>
                          {isPending && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black shrink-0 animate-pulse">
                              পেন্ডিং
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{thread.lastMessageTime}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        {userMatch && (
                          <span className="text-amber-300 font-bold">₹{userMatch.balance?.toLocaleString('en-IN')}</span>
                        )}
                        <span>•</span>
                        <span className="truncate">{thread.userEmail || thread.userPhone || 'User'}</span>
                      </div>

                      <p
                        className={`text-xs truncate ${
                          isPending ? 'text-amber-200 font-bold' : 'text-slate-400 font-normal'
                        }`}
                      >
                        {thread.lastSenderRole === 'admin' ? <span className="text-amber-400 font-bold">You: </span> : null}
                        {thread.lastMessage}
                      </p>

                      {/* Status Badges & Dossier Action */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              thread.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {thread.status || 'open'}
                          </span>
                          {userMatch?.vipLevel && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                              {userMatch.vipLevel}
                            </span>
                          )}
                        </div>

                        {/* Quick View Chat & Dossier Buttons in Sidebar Item */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              soundFx.playClick();
                              setSelectedThreadId(thread.userId);
                              setIsFullChatModalOpen(true);
                            }}
                            className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-[9px] font-black rounded-md border border-amber-500/40 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            title="ভিউ চ্যাট - সম্পূর্ণ চ্যাট হিস্ট্রি ফুল স্ক্রিনে দেখুন"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            <span>ভিউ চ্যাট</span>
                          </div>

                          {onOpenUserDossier && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDossier(thread.userId, thread);
                              }}
                              className="px-1.5 py-0.5 bg-indigo-950/80 hover:bg-indigo-700 text-indigo-300 hover:text-white text-[9px] font-bold rounded-md border border-indigo-700/50 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="ইউজারের সমস্ত ডজিয়ার ডিটেলস দেখুন"
                            >
                              <Gamepad2 className="w-2.5 h-2.5 text-indigo-400" />
                              <span>ডজিয়ার</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat & Action Panel */}
        <div className={`${
          !isSidebarVisible ? 'md:col-span-12' : 'md:col-span-8 lg:col-span-8'
        } ${
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        } bg-slate-950 flex-col overflow-hidden w-full h-full`}>
          {selectedThreadId ? (
            <>
              {/* Selected User Details Header (Collapsible to maximize chat message view) */}
              {isUserDetailsHidden ? (
                <div className="px-3.5 py-2 bg-slate-900/95 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shadow-md animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Mobile Back Button to Thread List */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setMobileTab('threads');
                      }}
                      className="md:hidden px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-xl border border-amber-500/40 flex items-center gap-1 text-xs font-black shrink-0 active:scale-95 transition-all"
                      title="ইউজার লিস্টে ফিরে যান"
                    >
                      <ChevronLeft className="w-4 h-4 text-amber-400" />
                      <span>লিস্ট ({threads.length})</span>
                      {pendingRequestsCount > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </button>

                    {/* Expand Sidebar Button on Desktop if Sidebar is Hidden */}
                    {!isSidebarVisible && (
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setIsSidebarVisible(true);
                        }}
                        className="hidden md:flex px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                        title="ইউজার লিস্ট প্যানেল খুলুন"
                      >
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>ইউজার লিস্ট</span>
                      </button>
                    )}

                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-black text-white truncate max-w-[120px] sm:max-w-[160px]">
                      {activeThread?.userName || 'Player'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedThreadId || '', 'UID')}
                      className="text-[10px] text-amber-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 hover:border-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                      title="UID কপি করুন"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>{copiedLabel === 'UID' ? 'কপি হয়েছে!' : `UID: ${selectedThreadId?.slice(0, 8)}...`}</span>
                    </button>
                    {activeUser?.phone && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(activeUser.phone, 'Phone')}
                        className="text-[10px] text-slate-300 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 hover:border-amber-400 hidden sm:flex items-center gap-1 cursor-pointer"
                        title="ফোন নম্বর কপি করুন"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>{copiedLabel === 'Phone' ? 'কপি হয়েছে!' : activeUser.phone}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Chat Fullscreen Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsFullChatModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-[11px] font-black rounded-lg border border-amber-500/40 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                      title="ভিউ চ্যাট - সম্পূর্ণ চ্যাট হিস্ট্রি ফুল স্ক্রিন পপআপে দেখুন"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>ভিউ চ্যাট</span>
                    </button>

                    {/* Show User Details Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsUserDetailsHidden(false);
                      }}
                      className="px-3 py-1 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-200 hover:text-white text-xs font-black rounded-xl border border-indigo-500/50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                      title="ইউজারের বিস্তারিত তথ্য নিচে নামান (Show User Details)"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-amber-300" />
                      <span>👤 ইউজারের তথ্য দেখুন (Details)</span>
                      <ChevronDown className="w-3.5 h-3.5 text-indigo-300" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-1 duration-150 relative">
                  <div className="flex items-center gap-3">
                    {/* Mobile Back Button to Thread List */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setMobileTab('threads');
                      }}
                      className="md:hidden px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-xl border border-amber-500/40 flex items-center gap-1 text-xs font-black shrink-0 active:scale-95 transition-all"
                      title="ইউজার লিস্টে ফিরে যান"
                    >
                      <ChevronLeft className="w-4 h-4 text-amber-400" />
                      <span>লিস্ট ({threads.length})</span>
                      {pendingRequestsCount > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </button>

                    {/* Expand Sidebar Button on Desktop if Sidebar is Hidden */}
                    {!isSidebarVisible && (
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setIsSidebarVisible(true);
                        }}
                        className="hidden md:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                        title="ইউজার লিস্ট প্যানেল খুলুন"
                      >
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>ইউজার লিস্ট</span>
                      </button>
                    )}

                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-base shadow-md shrink-0">
                      {(activeThread?.userName || 'P').charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-white">{activeThread?.userName || 'Player'}</h3>
                        {activeUser?.vipLevel && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {activeUser.vipLevel}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyText(selectedThreadId || '', 'UID')}
                          className="text-[10px] text-amber-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 hover:border-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="UID কপি করতে ক্লিক করুন"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>{copiedLabel === 'UID' ? 'কপি হয়েছে!' : `UID: ${selectedThreadId}`}</span>
                        </button>

                        {/* Prominent Dossier Button Next to User ID */}
                        {onOpenUserDossier && (
                          <button
                            type="button"
                            onClick={() => handleOpenDossier()}
                            className="px-2 py-0.5 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-200 hover:text-white text-[10px] font-black rounded-lg border border-indigo-500/50 flex items-center gap-1 transition-all cursor-pointer shadow-md active:scale-95"
                            title="ইউজারের সমস্ত ডিটেলস ও ব্যাটিং ডজিয়ার দেখুন (Open Full User Dossier)"
                          >
                            <Gamepad2 className="w-3 h-3 text-amber-300" />
                            <span>DOSSIER (ডজিয়ার)</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                        <span className="text-amber-400 font-bold">
                          Main Bal: ₹{(activeUser?.balance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span>•</span>
                        <span className="text-purple-300">
                          Bonus: ₹{(activeUser?.bonusBalance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span>•</span>
                        {activeUser?.phone || activeThread?.userPhone ? (
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeThread?.userPhone || activeUser?.phone || '', 'Phone')}
                            className="text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700 hover:border-slate-500 cursor-pointer"
                            title="ফোন নম্বর কপি করুন"
                          >
                            <Phone className="w-2.5 h-2.5 text-amber-400" />
                            <span>{copiedLabel === 'Phone' ? 'কপি হয়েছে!' : (activeThread?.userPhone || activeUser?.phone)}</span>
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ) : (
                          <span>Phone: N/A</span>
                        )}
                        {(activeThread?.userEmail || activeUser?.email) && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeThread?.userEmail || activeUser?.email || '', 'Email')}
                            className="text-slate-300 hover:text-white hidden lg:flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700 hover:border-slate-500 cursor-pointer"
                            title="ইমেইল কপি করুন"
                          >
                            <Mail className="w-2.5 h-2.5 text-amber-400" />
                            <span>{copiedLabel === 'Email' ? 'কপি হয়েছে!' : (activeThread?.userEmail || activeUser?.email)}</span>
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Chat Fullscreen Modal Trigger */}
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setIsFullChatModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black rounded-xl border border-amber-400 flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                      title="ভিউ চ্যাট - সম্পূর্ণ চ্যাট হিস্ট্রি ফুল স্ক্রিন পপআপে বড় করে দেখুন"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>ভিউ চ্যাট (View Chat)</span>
                    </button>

                    {onOpenUserDossier && (
                      <button
                        onClick={() => handleOpenDossier()}
                        className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white text-xs font-black rounded-xl border border-indigo-500/40 flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                        title="Open Full User Betting Dossier & Complete History"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-indigo-300" />
                        <span>User Dossier</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleStatus(activeThread?.status === 'resolved' ? 'open' : 'resolved')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeThread?.status === 'resolved'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{activeThread?.status === 'resolved' ? 'Reopen' : 'Resolved'}</span>
                    </button>

                    <button
                      onClick={handleDeleteAndCloseChat}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-black rounded-xl border border-rose-500/40 hover:border-rose-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-900/30 disabled:opacity-50"
                      title="Delete entire chat history & close conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeleting ? 'মুছছে...' : 'Delete'}</span>
                    </button>

                    {/* CROSS / HIDE USER DETAILS BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsUserDetailsHidden(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-700 hover:border-rose-500/40 flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer shadow-md active:scale-95"
                      title="ইউজারের বিস্তারিত তথ্য উপরে লুকিয়ে রাখুন (চ্যাট হিস্ট্রি বড় করতে)"
                    >
                      <X className="w-4 h-4 text-rose-400" />
                      <span>✕ লুকান (Hide)</span>
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-400 opacity-40" />
                    <p className="text-sm font-bold">No messages in this conversation yet</p>
                    <p className="text-xs text-slate-400">Use quick replies below or type a custom message to respond.</p>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const isFromAdmin = msg.senderRole === 'admin';
                    const timeStr = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex items-start gap-2.5 max-w-[85%] ${
                          isFromAdmin ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="shrink-0 mt-0.5">
                          {isFromAdmin ? (
                            <div className="relative">
                              <img
                                src={msg.senderAvatar || agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                                alt={msg.senderName || agentConfig.name}
                                className="w-8 h-8 rounded-xl object-cover border border-amber-400 shadow-md"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-1 ring-slate-950" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shadow-md">
                              {(msg.userName || 'U').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="space-y-0.5 min-w-0">
                          <div
                            className={`p-3 rounded-2xl text-xs break-words shadow-md ${
                              isFromAdmin
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-tr-xs'
                                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs'
                            }`}
                          >
                            <div className="text-[10px] opacity-80 flex items-center justify-between gap-2 mb-1 border-b border-black/10 pb-0.5">
                              <span className="font-black">
                                {isFromAdmin ? (msg.senderName || agentConfig.name) : msg.userName}
                              </span>
                              {isFromAdmin && (
                                <span className="text-[8px] bg-slate-950/20 px-1 py-0.5 rounded font-mono">
                                  {msg.senderTitle || agentConfig.title || 'Support'}
                                </span>
                              )}
                            </div>

                            {/* Image Attachment Rendering */}
                            {msg.attachmentUrl && msg.attachmentType === 'image' && (
                              <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/40 group relative">
                                <img
                                  src={msg.attachmentUrl}
                                  alt={msg.attachmentName || 'Attached image'}
                                  className="max-h-60 max-w-full object-contain mx-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImageModal(msg.attachmentUrl || null)}
                                />
                                <div className="p-1.5 bg-black/60 backdrop-blur-xs flex items-center justify-between text-[10px] text-white">
                                  <span className="truncate max-w-[150px]">{msg.attachmentName || 'Image'}</span>
                                  <div className="flex items-center gap-2">
                                    {msg.attachmentSize && <span className="opacity-75">{msg.attachmentSize}</span>}
                                    <a
                                      href={msg.attachmentUrl}
                                      download={msg.attachmentName || 'attachment'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 hover:text-amber-400 cursor-pointer"
                                      title="ডাউনলোড করুন"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* File Attachment Rendering */}
                            {msg.attachmentUrl && msg.attachmentType === 'file' && (
                              <div className={`mb-2 p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                isFromAdmin ? 'bg-amber-600/30 border-amber-600/40 text-slate-950' : 'bg-slate-950 border-slate-800 text-white'
                              }`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">{msg.attachmentName || 'Attachment File'}</p>
                                    {msg.attachmentSize && <p className="text-[10px] opacity-75">{msg.attachmentSize}</p>}
                                  </div>
                                </div>
                                <a
                                  href={msg.attachmentUrl}
                                  download={msg.attachmentName || 'file'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg flex items-center gap-1 text-[10px] font-bold cursor-pointer shrink-0"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Save</span>
                                </a>
                              </div>
                            )}

                            {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                          </div>

                          <div
                            className={`flex items-center gap-1 text-[9px] text-slate-400 px-1 ${
                              isFromAdmin ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span>{timeStr}</span>
                            {isFromAdmin && (
                              <span>
                                {msg.read ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-400 inline" />
                                ) : (
                                  <Check className="w-3 h-3 text-slate-400 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* User Typing Indicator in Admin View */}
                {activeThread?.userTyping && (Date.now() - (activeThread.userTypingTimestamp || 0) < 7000) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/30 rounded-2xl w-fit text-indigo-300 text-xs animate-pulse shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <span className="font-bold">{activeThread.userName || 'Player'} is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Response Collapsible Section */}
              <div className="bg-slate-950 border-t border-slate-800/80">
                {isQuickRepliesOpen ? (
                  <div className="p-3 bg-slate-900/95 border-b border-amber-500/30 space-y-2 animate-in slide-in-from-bottom duration-150 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-black text-amber-400 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Instant Quick Responses (ক্লিক করলেই সরাসরি সেন্ড হবে):</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setIsQuickRepliesOpen(false);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg text-xs font-black flex items-center gap-1 border border-slate-700 hover:border-rose-500/40 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="কুইক রেসপন্স নিচে পাঠান / বন্ধ করুন"
                      >
                        <X className="w-3.5 h-3.5 text-rose-400" />
                        <span>✕ বন্ধ করুন (Close)</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                      {ADMIN_QUICK_RESPONSES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendAdminReply(tmpl)}
                          className="p-2 text-left text-xs bg-slate-950 hover:bg-amber-500/20 text-slate-200 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 rounded-xl transition-all truncate cursor-pointer active:scale-95 shadow-sm"
                          title={tmpl}
                        >
                          {tmpl}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-950 border-b border-slate-800/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsQuickRepliesOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>⚡ কুইক রেসপন্স ওপেন করুন (Quick Responses)</span>
                      <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      চ্যাট মেসেজ ভিউ সম্পূর্ণ দৃশ্যমান
                    </span>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-slate-950 border-t border-amber-500/30">
                {/* Pending Attachment Preview Bar */}
                {attachment && (
                  <div className="mb-2 p-2 bg-slate-900 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2 min-w-0">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt="preview"
                          className="w-10 h-10 object-cover rounded-xl border border-amber-400 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-[11px]">{attachment.name}</p>
                        <p className="text-[10px] text-amber-400/80 font-mono">{attachment.size} • প্রস্তুত সেন্ড করার জন্য</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                      title="ফাইল বাদ দিন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAdminReply();
                  }}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    disabled={isCompressing || isSending}
                    onClick={() => {
                      soundFx.playClick();
                      fileInputRef.current?.click();
                    }}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                      attachment 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-slate-800 hover:border-amber-500/40'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="ইউজারকে ফটো বা ফাইল সেন্ড করুন (Screenshot/Photo/Document)"
                  >
                    {isCompressing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Paperclip className="w-4 h-4" />}
                  </button>

                  <input
                    ref={embeddedTextInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => handleAdminInputChange(e.target.value)}
                    onFocus={handleEmbeddedInputFocus}
                    onClick={handleEmbeddedInputFocus}
                    placeholder={attachment ? "Add caption (ঐচ্ছিক মেসেজ)..." : `Reply to ${activeThread?.userName || 'user'}... (Press Enter to send)`}
                    className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl text-base sm:text-xs text-white placeholder-slate-500 outline-none transition-all"
                    disabled={isSending}
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !attachment) || isSending}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">REPLY</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
                <Headphones className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-white">Select a Support Conversation</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Choose an incoming support chat from the left panel to inspect user details, view issue history, and send direct live replies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULL CHAT HISTORY POPUP MODAL (ভিউ চ্যাট / FULL VIEW POPUP)             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isFullChatModalOpen && selectedThreadId && (
          <div
            id="admin-full-chat-modal-backdrop"
            className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 md:p-6 overflow-hidden"
            style={{
              height: typeof window !== 'undefined' && window.visualViewport ? `${viewportHeight}px` : '100%',
              maxHeight: typeof window !== 'undefined' && window.visualViewport ? `${viewportHeight}px` : '100%'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              id="admin-full-chat-modal"
              className="w-full max-w-5xl h-full sm:h-[92vh] max-h-full sm:max-h-[920px] bg-slate-900 border-0 sm:border-2 border-amber-500/50 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col font-mono relative"
            >
              {/* Modal Top Header (Collapsible) */}
              {isModalUserDetailsHidden ? (
                <div className="px-4 py-2.5 bg-slate-950 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shadow-lg animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-sm font-black text-white truncate">{activeThread?.userName || 'Player'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedThreadId || '', 'ModalUID')}
                      className="text-xs text-amber-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 hover:border-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                      title="UID কপি করুন"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedLabel === 'ModalUID' ? 'কপি হয়েছে!' : `UID: ${selectedThreadId}`}</span>
                    </button>
                    {(activeUser?.phone || activeThread?.userPhone) && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(activeThread?.userPhone || activeUser?.phone || '', 'ModalPhone')}
                        className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 hover:border-amber-400 hidden sm:flex items-center gap-1 cursor-pointer"
                        title="ফোন নম্বর কপি করুন"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedLabel === 'ModalPhone' ? 'কপি হয়েছে!' : (activeThread?.userPhone || activeUser?.phone)}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenUserDossier && (
                      <button
                        type="button"
                        onClick={() => handleOpenDossier()}
                        className="px-2.5 py-1 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-200 hover:text-white text-xs font-black rounded-lg border border-indigo-500/50 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Dossier</span>
                      </button>
                    )}

                    {/* Expand Details button */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsModalUserDetailsHidden(false);
                      }}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-black rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                      title="ইউজারের বিস্তারিত তথ্য নিচে নামান"
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      <span>👤 ইউজারের তথ্য দেখুন (Show Details)</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Close Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsFullChatModalOpen(false);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-rose-500 transition-all cursor-pointer"
                      title="Close Modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/50 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20 shrink-0">
                      {(activeThread?.userName || 'P').charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black text-white">{activeThread?.userName || 'Player'}</h2>
                        {activeUser?.vipLevel && (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {activeUser.vipLevel} VIP
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyText(selectedThreadId || '', 'ModalUID')}
                          className="text-xs text-amber-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 hover:border-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="UID কপি করতে ক্লিক করুন"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedLabel === 'ModalUID' ? 'কপি হয়েছে!' : `UID: ${selectedThreadId}`}</span>
                        </button>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                            activeThread?.status === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {activeThread?.status || 'open'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1 flex-wrap">
                        <span className="text-amber-300 font-bold">
                          Main Balance: ₹{(activeUser?.balance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span>•</span>
                        <span className="text-purple-300">
                          Bonus: ₹{(activeUser?.bonusBalance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span>•</span>
                        {(activeThread?.userEmail || activeUser?.email) && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeThread?.userEmail || activeUser?.email || '', 'ModalEmail')}
                            className="text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 cursor-pointer"
                            title="ইমেইল কপি করুন"
                          >
                            <Mail className="w-2.5 h-2.5 text-amber-400" />
                            <span>{copiedLabel === 'ModalEmail' ? 'কপি হয়েছে!' : (activeThread?.userEmail || activeUser?.email)}</span>
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        )}
                        <span>•</span>
                        {(activeThread?.userPhone || activeUser?.phone) && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeThread?.userPhone || activeUser?.phone || '', 'ModalPhone')}
                            className="text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 cursor-pointer"
                            title="ফোন নম্বর কপি করুন"
                          >
                            <Phone className="w-2.5 h-2.5 text-amber-400" />
                            <span>{copiedLabel === 'ModalPhone' ? 'কপি হয়েছে!' : (activeThread?.userPhone || activeUser?.phone)}</span>
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Top Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Open Dossier */}
                    {onOpenUserDossier && (
                      <button
                        type="button"
                        onClick={() => handleOpenDossier()}
                        className="px-3 py-1.5 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-200 hover:text-white text-xs font-black rounded-xl border border-indigo-500/50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                        title="ইউজারের সম্পূর্ণ বেটিং ও ট্রানজেকশন হিস্ট্রি দেখুন"
                      >
                        <Gamepad2 className="w-4 h-4 text-amber-300" />
                        <span>User Dossier (ডজিয়ার)</span>
                      </button>
                    )}

                    {/* Toggle Status */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(activeThread?.status === 'resolved' ? 'open' : 'resolved')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeThread?.status === 'resolved'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{activeThread?.status === 'resolved' ? 'Reopen Chat' : 'Mark Resolved'}</span>
                    </button>

                    {/* Delete & Close */}
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteAndCloseChat();
                        setIsFullChatModalOpen(false);
                      }}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-black rounded-xl border border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isDeleting ? 'মুছছে...' : 'Delete Chat'}</span>
                    </button>

                    {/* Sound Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsSoundMuted(!isSoundMuted)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      title={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
                    >
                      {isSoundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                    </button>

                    {/* Cross / Hide Header Details in Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsModalUserDetailsHidden(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-700 hover:border-rose-500/40 flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer shadow-md active:scale-95"
                      title="ইউজারের বিস্তারিত তথ্য উপরে লুকিয়ে রাখুন (চ্যাট আরও বড় দেখতে)"
                    >
                      <X className="w-4 h-4 text-rose-400" />
                      <span className="hidden sm:inline">লুকান (Hide)</span>
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* Close Full Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsFullChatModalOpen(false);
                      }}
                      className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl border border-slate-700 hover:border-rose-500 transition-all cursor-pointer shadow-md"
                      title="Close Full Chat View"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* In-Modal Search Bar */}
              <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="এই চ্যাটে কোনো মেসেজ বা শব্দ খুঁজুন..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                  />
                  {modalSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setModalSearchTerm('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>মোট মেসেজ: <strong className="text-amber-400">{activeMessages.length}</strong></span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    লাইভ সিঙ্ক চালু
                  </span>
                </div>
              </div>

              {/* Modal Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 bg-slate-950/60">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                    <MessageSquare className="w-12 h-12 text-slate-500 opacity-40" />
                    <p className="text-base font-bold text-slate-300">এই কথোপকথনে এখনও কোনো বার্তা নেই</p>
                    <p className="text-xs text-slate-500 max-w-md text-center">
                      নিচের কুইক রেসপন্স ব্যবহার করে অথবা মেসেজ টাইপ করে ইউজারের সাথে লাইভ চ্যাট শুরু করুন।
                    </p>
                  </div>
                ) : (
                  activeMessages
                    .filter((msg) => {
                      if (!modalSearchTerm.trim()) return true;
                      const q = modalSearchTerm.toLowerCase().trim();
                      return (
                        msg.text.toLowerCase().includes(q) ||
                        msg.senderName?.toLowerCase().includes(q) ||
                        msg.userName?.toLowerCase().includes(q)
                      );
                    })
                    .map((msg, idx) => {
                      const isFromAdmin = msg.senderRole === 'admin';
                      const msgDate = new Date(msg.createdAt || msg.timestamp);
                      const timeStr = msgDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });
                      const dateStr = msgDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex items-start gap-3 max-w-[80%] ${
                            isFromAdmin ? 'ml-auto flex-row-reverse' : 'mr-auto'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="shrink-0 mt-0.5">
                            {isFromAdmin ? (
                              <div className="relative">
                                <img
                                  src={msg.senderAvatar || agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                                  alt={msg.senderName || agentConfig.name}
                                  className="w-10 h-10 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-1 ring-slate-950" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-md">
                                {(msg.userName || 'U').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Bubble */}
                          <div className="space-y-1 min-w-0 max-w-full">
                            <div
                              className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm break-words shadow-lg ${
                                isFromAdmin
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-tr-xs'
                                  : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-xs'
                              }`}
                            >
                              <div className="text-[11px] opacity-80 flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-black/10">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black">
                                    {isFromAdmin ? (msg.senderName || agentConfig.name) : msg.userName || 'Player'}
                                  </span>
                                  {isFromAdmin && (
                                    <span className="text-[9px] bg-slate-950/20 px-1.5 py-0.5 rounded font-mono font-normal">
                                      {msg.senderTitle || agentConfig.title || 'Support Specialist'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] opacity-75 font-mono">{dateStr}</span>
                              </div>

                              {/* Image Attachment in Full Modal */}
                              {msg.attachmentUrl && msg.attachmentType === 'image' && (
                                <div className="mb-2.5 rounded-2xl overflow-hidden border border-black/20 bg-black/40 group relative">
                                  <img
                                    src={msg.attachmentUrl}
                                    alt={msg.attachmentName || 'Attached image'}
                                    className="max-h-80 max-w-full object-contain mx-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setPreviewImageModal(msg.attachmentUrl || null)}
                                  />
                                  <div className="p-2 bg-black/60 backdrop-blur-xs flex items-center justify-between text-xs text-white">
                                    <span className="truncate max-w-[200px]">{msg.attachmentName || 'Image'}</span>
                                    <div className="flex items-center gap-2">
                                      {msg.attachmentSize && <span className="opacity-75">{msg.attachmentSize}</span>}
                                      <a
                                        href={msg.attachmentUrl}
                                        download={msg.attachmentName || 'attachment'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 hover:text-amber-400 cursor-pointer"
                                        title="ডাউনলোড করুন"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* File Attachment in Full Modal */}
                              {msg.attachmentUrl && msg.attachmentType === 'file' && (
                                <div className={`mb-2.5 p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                                  isFromAdmin ? 'bg-amber-600/30 border-amber-600/40 text-slate-950' : 'bg-slate-950 border-slate-800 text-white'
                                }`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold truncate">{msg.attachmentName || 'Attachment File'}</p>
                                      {msg.attachmentSize && <p className="text-xs opacity-75">{msg.attachmentSize}</p>}
                                    </div>
                                  </div>
                                  <a
                                    href={msg.attachmentUrl}
                                    download={msg.attachmentName || 'file'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 shadow-md"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>
                                </div>
                              )}

                              {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                            </div>

                            <div
                              className={`flex items-center gap-1.5 text-[10px] text-slate-400 px-1 font-mono ${
                                isFromAdmin ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <span>{timeStr}</span>
                              {isFromAdmin && (
                                <span>
                                  {msg.read ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}

                {/* User Typing Indicator in Modal View */}
                {activeThread?.userTyping && (Date.now() - (activeThread.userTypingTimestamp || 0) < 7000) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/30 rounded-2xl w-fit text-indigo-300 text-xs animate-pulse shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <span className="font-bold">{activeThread.userName || 'Player'} is typing...</span>
                  </div>
                )}

                <div ref={modalMessagesEndRef} />
              </div>

              {/* In-Modal Quick Responses Drawer */}
              <div className="bg-slate-950 border-t border-slate-800/80">
                {isQuickRepliesOpen ? (
                  <div className="p-3 bg-slate-900/95 border-b border-amber-500/30 space-y-2 animate-in slide-in-from-bottom duration-150 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Instant Quick Responses (ক্লিক করলেই সরাসরি সেন্ড হবে):</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setIsQuickRepliesOpen(false);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg text-xs font-black flex items-center gap-1 border border-slate-700 hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
                      >
                        <X className="w-3.5 h-3.5 text-rose-400" />
                        <span>✕ বন্ধ করুন (Close)</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                      {ADMIN_QUICK_RESPONSES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendAdminReply(tmpl)}
                          className="p-2 text-left text-xs bg-slate-950 hover:bg-amber-500/20 text-slate-200 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 rounded-xl transition-all truncate cursor-pointer active:scale-95 shadow-sm"
                          title={tmpl}
                        >
                          {tmpl}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-950 border-b border-slate-800/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsQuickRepliesOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>⚡ কুইক রেসপন্স ওপেন করুন (Quick Responses)</span>
                      <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                      চ্যাট মেসেজ হিস্ট্রি সম্পূর্ণ ফুল স্ক্রিনে দেখা যাচ্ছে
                    </span>
                  </div>
                )}
              </div>

              {/* In-Modal Bottom Reply Input */}
              <div className="p-4 bg-slate-950 border-t border-amber-500/30">
                {/* Pending Attachment Preview Bar in Modal */}
                {attachment && (
                  <div className="mb-3 p-2.5 bg-slate-900 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt="preview"
                          className="w-12 h-12 object-cover rounded-xl border border-amber-400 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-xs">{attachment.name}</p>
                        <p className="text-[11px] text-amber-400/80 font-mono">{attachment.size} • প্রস্তুত সেন্ড করার জন্য</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                      title="ফাইল বাদ দিন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Hidden File Input for Modal */}
                <input
                  type="file"
                  ref={modalFileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAdminReply();
                  }}
                  className="flex items-center gap-3"
                >
                  <button
                    type="button"
                    disabled={isCompressing || isSending}
                    onClick={() => {
                      soundFx.playClick();
                      modalFileInputRef.current?.click();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                      attachment 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' 
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-slate-800 hover:border-amber-500/40'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="ইউজারকে ফটো বা ফাইল সেন্ড করুন (Screenshot/Photo/Document)"
                  >
                    {isCompressing ? <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> : <Paperclip className="w-5 h-5" />}
                  </button>

                  <input
                    ref={modalTextInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => handleAdminInputChange(e.target.value)}
                    onFocus={handleModalInputFocus}
                    onClick={handleModalInputFocus}
                    placeholder={attachment ? "Add caption (ঐচ্ছিক বার্তা)..." : `Reply to ${activeThread?.userName || 'user'}... (Press Enter to send)`}
                    className="flex-1 px-5 py-3 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl text-base sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    disabled={isSending}
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !attachment) || isSending}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 flex items-center gap-2"
                  >
                    <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                    <span>REPLY</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agent Profile & Photo Configuration Modal */}
      <AnimatePresence>
        {isAgentConfigModalOpen && (
          <div className="fixed inset-0 z-[10070] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-amber-500/20 text-white font-mono my-8 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Live Support Agent Setup</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                        Real-time Sync
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      লাইভ চ্যাটে এজেন্টের নাম, ছবি ও ওয়েলকাম মেসেজ পরিবর্তন করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAgentConfigModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-5">
                {/* Agent Name & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>👤 এজেন্টের নাম (Agent Name):</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingAgent.name}
                      onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                      placeholder="e.g. Priya Sharma / সুমন রয়"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🎖️ পদবী / ডেজিগনেশন (Title / Role):</span>
                    </label>
                    <input
                      type="text"
                      value={editingAgent.title || ''}
                      onChange={(e) => setEditingAgent({ ...editingAgent, title: e.target.value })}
                      placeholder="e.g. Senior Live Support Specialist"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Photo Selection & Upload */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>📸 এজেন্টের ফটো ও অবতার (Agent Photo):</span>
                    </label>
                    <span className="text-[10px] text-slate-400">আপলোড অথবা প্রিসেট নির্বাচন করুন</span>
                  </div>

                  {/* Current Avatar & Upload Controls */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="relative shrink-0">
                      <img
                        src={editingAgent.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                        alt={editingAgent.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-lg"
                      />
                      <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-slate-950 ${editingAgent.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    </div>

                    <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={agentPhotoInputRef}
                          onChange={handleAgentPhotoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => agentPhotoInputRef.current?.click()}
                          disabled={agentPhotoCompressing}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {agentPhotoCompressing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>ডিভাইস থেকে ফটো আপলোড</span>
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={editingAgent.avatarUrl || ''}
                          onChange={(e) => setEditingAgent({ ...editingAgent, avatarUrl: e.target.value })}
                          placeholder="Or paste Direct Image URL (https://...)"
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset Avatar Selection Grid */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-slate-300">প্রিসেট অবতার তালিকা থেকে বেছে নিন (Quick Presets):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {AGENT_AVATAR_PRESETS.map((p) => {
                        const isSelected = editingAgent.avatarUrl === p.avatarUrl;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              soundFx.playClick();
                              setEditingAgent({
                                ...editingAgent,
                                name: editingAgent.name || p.name,
                                title: editingAgent.title || p.title,
                                avatarUrl: p.avatarUrl
                              });
                            }}
                            className={`p-2 rounded-xl flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <img
                              src={p.avatarUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                            />
                            <div className="leading-tight">
                              <span className="text-[10px] font-black text-white block truncate max-w-[80px]">{p.name}</span>
                              <span className="text-[8px] text-amber-400 font-mono">{p.roleTag}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Welcome Message & Speed */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                      <span>💬 লাইভ চ্যাট ওয়েলকাম মেসেজ (Welcome Greeting):</span>
                      <span className="text-[10px] text-slate-400 font-normal">চ্যাট ওপেন হলে শুরুতে এটি দেখাবে</span>
                    </label>
                    <textarea
                      rows={2}
                      value={editingAgent.welcomeMessage || ''}
                      onChange={(e) => setEditingAgent({ ...editingAgent, welcomeMessage: e.target.value })}
                      placeholder="Welcome greeting message for users..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner resize-none font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-amber-300">
                        ⚡ রেসপন্স টাইম টেক্সট (Response Speed Text):
                      </label>
                      <input
                        type="text"
                        value={editingAgent.responseSpeedText || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, responseSpeedText: e.target.value })}
                        placeholder="e.g. Replies in ~30 seconds"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col justify-end">
                      <label className="text-xs font-bold text-amber-300">
                        🟢 অনলাইন স্ট্যাটাস (Online Indicator):
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingAgent({ ...editingAgent, isOnline: editingAgent.isOnline === false ? true : false })}
                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                          editingAgent.isOnline !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${editingAgent.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{editingAgent.isOnline !== false ? 'ONLINE (সক্রিয় দেখাচ্ছে)' : 'OFFLINE (নিষ্ক্রিয়)'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Preview Card */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-500/30 rounded-2xl space-y-2">
                  <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>User Chat Preview (ইউজারের চ্যাটে যেভাবে প্রদর্শিত হবে):</span>
                  </span>
                  
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={editingAgent.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                        alt={editingAgent.name}
                        className="w-10 h-10 rounded-xl object-cover border border-amber-400 shadow-md"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-slate-950 ${editingAgent.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white truncate">{editingAgent.name || 'Support Agent'}</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                          {editingAgent.title || 'Support'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {editingAgent.responseSpeedText || 'Replies in ~30 seconds'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAgentConfigModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleSaveAgentConfig}
                  disabled={isSavingAgent}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>সেভ ও আপডেট করুন (Save & Apply Live)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
