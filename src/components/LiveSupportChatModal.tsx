import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Headphones, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  CheckCheck, 
  Clock, 
  HelpCircle, 
  AlertCircle, 
  CreditCard, 
  ArrowUpRight, 
  Gift, 
  Phone, 
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  Loader2,
  Bell,
  BellOff,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Trophy,
  Copy,
  Layers,
  Flame,
  Zap,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  SupportChatMessage, 
  SupportChatThread, 
  DepositRequest, 
  WithdrawalRequest, 
  PurchasedTicket 
} from '../types';
import { soundFx } from '../utils/audio';
import { processChatAttachment } from '../utils/imageCompressor';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { useSupportAgentConfig, setUserTypingStatus } from '../utils/supportAgentService';
import { sendAdminNotification } from '../utils/adminNotificationService';
import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit
} from 'firebase/firestore';

interface LiveSupportChatModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onOpenDeposit?: () => void;
  onOpenWithdrawal?: () => void;
  onUnreadCountChange?: (count: number, lastMessage?: SupportChatMessage) => void;
  initialPrefilledText?: string;
  deposits?: DepositRequest[];
  withdrawals?: WithdrawalRequest[];
  tickets?: PurchasedTicket[];
}

type SupportTab = 'chat' | 'pending' | 'faq' | 'quick';

const QUICK_PROMPTS = [
  { id: 'dep', text: '💰 Deposit verification / UTR verify', icon: CreditCard },
  { id: 'wth', text: '⚡ Withdrawal payout status query', icon: ArrowUpRight },
  { id: 'bon', text: '🎁 Bonus balance activation inquiry', icon: Gift },
  { id: 'car', text: '🏎️ Three Super Car draw rules & payout', icon: Sparkles },
  { id: 'gen', text: '❓ How to play Live Roulette & Casino', icon: HelpCircle },
];

const FAQ_ITEMS = [
  {
    q: 'How long does a Deposit take to reflect in my wallet?',
    a: 'Deposits are automatically verified and credited within 2 to 10 minutes once you submit the correct 12-digit UTR / Transaction reference number and payment slip.',
    category: 'deposit'
  },
  {
    q: 'What is the processing time for Withdrawals?',
    a: 'Instant Bank & UPI Withdrawals are processed by our automated financial settlement desk within 5 to 20 minutes. Ensure your bank account/UPI ID is entered accurately.',
    category: 'withdrawal'
  },
  {
    q: 'How can I claim my Welcome & Deposit Bonuses?',
    a: 'Welcome bonuses are instantly credited upon account verification. Deposit reload bonuses are added as soon as your deposit is approved. You can use your bonus wallet directly on Three Super Car draws.',
    category: 'bonus'
  },
  {
    q: 'Are the Live Casino & Lottery games provably fair?',
    a: 'Yes! All BETGURU games (Live Roulette, Dragon Tiger, Andar Bahar, Aviator Crash, and SuperCar Draws) use cryptographically secure RNG algorithms with transparent round hashes and certified RTP (Return-to-Player).',
    category: 'fairness'
  },
  {
    q: 'What should I do if my UTR number shows already used?',
    a: 'Each payment slip can only be submitted once. If you transferred funds and entered the wrong UTR, simply message our Live Support Agent here with your transaction screenshot.',
    category: 'deposit'
  }
];

export const LiveSupportChatModal: React.FC<LiveSupportChatModalProps> = ({
  user,
  isOpen,
  onClose,
  onOpen,
  onOpenDeposit,
  onOpenWithdrawal,
  onUnreadCountChange,
  initialPrefilledText,
  deposits = [],
  withdrawals = [],
  tickets = []
}) => {
  const { agentConfig } = useSupportAgentConfig();
  const [activeTab, setActiveTab] = useState<SupportTab>('chat');
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isExpandedFullScreen, setIsExpandedFullScreen] = useState<boolean>(true);
  const [isAdminTyping, setIsAdminTyping] = useState<boolean>(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  
  const [browserNotificationPerm, setBrowserNotificationPerm] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'file';
    size: string;
  } | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const userTypingTimerRef = useRef<any>(null);
  const isDocumentHiddenRef = useRef<boolean>(false);

  // Dynamic Visual Viewport Height tracking for on-screen mobile keyboard
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  });

  const activeUid = (user as any)?.canonicalUid || user?.id || 'anonymous';
  const userEmail = (user?.email || '').toLowerCase().trim();
  const userName = user?.name || (userEmail ? userEmail.split('@')[0] : 'Player');
  const userPhone = user?.phone || '';

  // Calculate real-time pending user requests
  const pendingDeposits = useMemo(() => {
    return deposits.filter(d => (d.userId === activeUid || d.userEmail?.toLowerCase() === userEmail) && d.status === 'pending');
  }, [deposits, activeUid, userEmail]);

  const pendingWithdrawals = useMemo(() => {
    return withdrawals.filter(w => (w.userId === activeUid || w.userEmail?.toLowerCase() === userEmail) && w.status === 'pending');
  }, [withdrawals, activeUid, userEmail]);

  const activeUserTickets = useMemo(() => {
    return tickets.filter(t => t.userId === activeUid && (t.status === 'active' || t.status === 'pending'));
  }, [tickets, activeUid]);

  const totalPendingCount = pendingDeposits.length + pendingWithdrawals.length;

  // Prefill message if provided
  useEffect(() => {
    if (initialPrefilledText && isOpen) {
      setInputText(initialPrefilledText);
      setActiveTab('chat');
    }
  }, [initialPrefilledText, isOpen]);

  // Reliable Auto-Scroll Helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Track Visual Viewport resize (Virtual Keyboard on Android / iOS)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        scrollToBottom('smooth');
      }
    };

    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, [scrollToBottom]);

  // Handle Input Focus to ensure full visibility above keyboard
  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      scrollToBottom('smooth');
      if (textInputRef.current) {
        textInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
    setTimeout(() => {
      scrollToBottom('smooth');
    }, 350);
  }, [scrollToBottom]);

  // Request browser notification permission if supported
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setBrowserNotificationPerm(perm);
      } catch (err) {
        console.warn('Could not request notification permission:', err);
      }
    }
  }, []);

  // Browser Visibility API Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      isDocumentHiddenRef.current = document.visibilityState === 'hidden' || document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle file selection (Photo / Screenshot / Document) with compression
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
      alert(err.message || 'File processing error.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Real-time listener for current user's thread (Typing indicator from Admin)
  useEffect(() => {
    if (!activeUid || activeUid === 'anonymous') return;

    try {
      const threadRef = doc(db, 'support_threads', activeUid);
      const unsubscribe = onSnapshot(
        threadRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const typingActive = data?.adminTyping === true && (Date.now() - (data?.adminTypingTimestamp || 0) < 6000);
            setIsAdminTyping(typingActive);
          } else {
            setIsAdminTyping(false);
          }
        },
        (error) => {
          console.warn('Support thread typing listener notice:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Error listening to support thread typing state:', e);
    }
  }, [activeUid]);

  // Real-time listener for current user's chat messages
  useEffect(() => {
    if (!activeUid || activeUid === 'anonymous') return;

    try {
      const msgRef = collection(db, 'support_messages');
      const candidateUserIds = Array.from(new Set([
        activeUid,
        user?.id,
        (user as any)?.canonicalUid,
        userEmail
      ].filter(Boolean))) as string[];

      const q = candidateUserIds.length > 1
        ? query(msgRef, where('userId', 'in', candidateUserIds.slice(0, 10)), limit(150))
        : query(msgRef, where('userId', '==', activeUid), limit(150));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loadedMsgs: SupportChatMessage[] = [];
          let unreadAdminReplies = 0;
          let latestAdminMsg: SupportChatMessage | undefined;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const msg: SupportChatMessage = {
              id: docSnap.id,
              userId: data.userId || activeUid,
              userName: data.userName || userName,
              userEmail: data.userEmail || userEmail,
              userPhone: data.userPhone || userPhone,
              senderRole: data.senderRole || 'user',
              senderId: data.senderId || activeUid,
              senderName: data.senderName || userName,
              senderAvatar: data.senderAvatar,
              senderTitle: data.senderTitle,
              text: data.text || '',
              read: data.read ?? true,
              timestamp: data.timestamp || new Date().toISOString(),
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : (data.timestamp ? new Date(data.timestamp).getTime() : Date.now()),
              attachmentUrl: data.attachmentUrl,
              attachmentName: data.attachmentName,
              attachmentType: data.attachmentType,
              attachmentSize: data.attachmentSize,
            };
            loadedMsgs.push(msg);

            if (msg.senderRole === 'admin' && !msg.read) {
              unreadAdminReplies++;
              latestAdminMsg = msg;
            }
          });

          // Sort messages chronologically in memory (no composite index required)
          loadedMsgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

          // Handle incoming message events (Audio + Browser Push Notification)
          if (loadedMsgs.length > prevMsgCountRef.current) {
            const lastMsg = loadedMsgs[loadedMsgs.length - 1];
            if (lastMsg && prevMsgCountRef.current > 0) {
              const isGlobalAudioEnabled = !isSoundMuted && (user?.settings?.soundEffectsEnabled !== false);

              // 1. Audio notifications
              if (isGlobalAudioEnabled) {
                if (lastMsg.senderRole === 'admin') {
                  if (user?.settings?.chatAgentNotificationSound !== false) {
                    soundFx.playChime();
                  }
                } else {
                  if (user?.settings?.chatNewMessageSound !== false) {
                    soundFx.playCoin();
                  }
                }
              }

              // 2. Trigger Browser-Level Visibility API Notification when minimized or tab hidden
              const isBackground = isDocumentHiddenRef.current || !isOpen || isMinimized;
              if (lastMsg.senderRole === 'admin' && isBackground) {
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    const agentDisplayName = lastMsg.senderName || agentConfig.name || 'Support Agent';
                    const notifTitle = `💬 ${agentDisplayName} (BETGURU Live Support)`;
                    const notifBody = lastMsg.text || (lastMsg.attachmentType === 'image' ? '📷 Sent a photo attachment' : '📎 Sent a document file');
                    const notifIcon = lastMsg.senderAvatar || agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80';

                    const notif = new Notification(notifTitle, {
                      body: notifBody,
                      icon: notifIcon,
                      tag: 'betguru-support-message',
                      silent: false
                    });

                    notif.onclick = () => {
                      try {
                        window.focus();
                      } catch (_) {}
                      setIsMinimized(false);
                      if (onOpen) onOpen();
                      notif.close();
                    };
                  } catch (err) {
                    console.warn('Browser system notification error:', err);
                  }
                }
              }
            }
          }
          prevMsgCountRef.current = loadedMsgs.length;

          setMessages(loadedMsgs);
          setUnreadCount(unreadAdminReplies);

          // Inform parent about unread count
          if (onUnreadCountChange) {
            onUnreadCountChange(unreadAdminReplies, latestAdminMsg || loadedMsgs.filter(m => m.senderRole === 'admin').slice(-1)[0]);
          }
        },
        (error) => {
          console.warn('Support messages listener warning:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Error setting up support messages listener:', e);
    }
  }, [activeUid, userEmail, userName, userPhone, isSoundMuted, isOpen, isMinimized, agentConfig, user?.settings, onUnreadCountChange, onOpen]);

  // Automatic scrolling to bottom on messages update or typing state change
  useEffect(() => {
    if (isOpen && !isMinimized && activeTab === 'chat') {
      scrollToBottom('smooth');
      const timer = setTimeout(() => scrollToBottom('smooth'), 120);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isAdminTyping, isOpen, isMinimized, activeTab, scrollToBottom]);

  // Immediate scroll on initial open
  useEffect(() => {
    if (isOpen && !isMinimized && activeTab === 'chat') {
      scrollToBottom('auto');
    }
  }, [isOpen, isMinimized, activeTab, scrollToBottom]);

  // Mark admin messages as read when user opens the chat
  useEffect(() => {
    if (isOpen && !isMinimized && unreadCount > 0 && activeUid && activeUid !== 'anonymous') {
      setUnreadCount(0);
      const threadRef = doc(db, 'support_threads', activeUid);
      setDoc(threadRef, { unreadUserCount: 0 }, { merge: true }).catch(() => {});

      messages.forEach((m) => {
        if (m.senderRole === 'admin' && !m.read) {
          setDoc(doc(db, 'support_messages', m.id), { read: true }, { merge: true }).catch(() => {});
        }
      });
    }
  }, [isOpen, isMinimized, unreadCount, activeUid, messages]);

  // Handle typing debounce for user
  const handleUserInputChange = (val: string) => {
    setInputText(val);
    if (activeUid && activeUid !== 'anonymous') {
      setUserTypingStatus(activeUid, true);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      userTypingTimerRef.current = setTimeout(() => {
        if (activeUid && activeUid !== 'anonymous') {
          setUserTypingStatus(activeUid, false);
        }
      }, 3000);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend || inputText).trim();
    if ((!rawText && !attachment) || isSending || isCompressing) return;

    try {
      setIsSending(true);
      soundFx.playClick();

      // Clear user typing status immediately
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      if (activeUid && activeUid !== 'anonymous') {
        setUserTypingStatus(activeUid, false);
      }

      // Request browser notification permission on user active interaction if not granted
      requestNotificationPermission();

      const msgId = `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();
      const isoTime = new Date().toISOString();

      const currentAttachment = attachment;
      const displayMessage = rawText || (currentAttachment ? (currentAttachment.type === 'image' ? '📷 [Photo Attached]' : `📎 [File: ${currentAttachment.name}]`) : '');

      const newMsg: SupportChatMessage = {
        id: msgId,
        userId: activeUid,
        userName: userName,
        userEmail: userEmail,
        userPhone: userPhone,
        senderRole: 'user',
        senderId: activeUid,
        senderName: userName,
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
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setAttachment(null);

      // Persist to Firestore: 1. Individual message
      await setDoc(doc(db, 'support_messages', msgId), cleanFirestoreData(newMsg));

      // 2. Update support thread summary
      const threadData: Partial<SupportChatThread> = {
        id: activeUid,
        userId: activeUid,
        userName: userName,
        userEmail: userEmail,
        userPhone: userPhone,
        lastMessage: displayMessage,
        lastSenderRole: 'user',
        lastMessageTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        lastMessageTimestamp: now,
        unreadAdminCount: 1,
        unreadUserCount: 0,
        status: 'open',
        userTyping: false,
        updatedAt: now,
      };

      await setDoc(doc(db, 'support_threads', activeUid), cleanFirestoreData(threadData), { merge: true });

      // Dispatch 0-second latency push notification to Admin Panel & Admin devices (PWA Background / Awake)
      sendAdminNotification({
        type: 'ticket',
        title: `💬 Support Message: ${userName}`,
        description: displayMessage.substring(0, 150),
        userName: userName,
        userId: activeUid,
        status: 'open',
        metadata: {
          chatMessage: displayMessage,
          userEmail: userEmail,
          userPhone: userPhone,
          targetUrl: '/support'
        }
      }).catch(() => {});
      
      if (user?.settings?.chatNewMessageSound !== false && !isSoundMuted) {
        soundFx.playCoin();
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'support_messages');
      console.error('Error sending support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to query about a specific pending request
  const handleQueryPendingRequest = (type: 'deposit' | 'withdrawal', req: any) => {
    soundFx.playClick();
    setActiveTab('chat');
    if (type === 'deposit') {
      const text = `Hello ${agentConfig.name || 'Support'}, please verify my pending deposit of ₹${(req.amount || 0).toLocaleString('en-IN')} (UTR: ${req.utr || 'N/A'}).`;
      setInputText(text);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } else {
      const text = `Hello ${agentConfig.name || 'Support'}, could you check the payout status for my pending withdrawal of ₹${(req.amount || 0).toLocaleString('en-IN')}?`;
      setInputText(text);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <>
      {/* Minimized Floating Widget Pill */}
      {isMinimized && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          onClick={() => {
            soundFx.playClick();
            setIsMinimized(false);
            if (!isOpen) onOpen();
          }}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 p-2.5 sm:px-4 sm:py-2.5 rounded-2xl sm:rounded-full shadow-2xl shadow-amber-500/40 border border-amber-300 flex items-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all font-mono font-black"
        >
          <div className="relative">
            <img
              src={agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
              alt={agentConfig.name}
              className="w-7 h-7 rounded-full object-cover border border-slate-950 shadow-sm"
            />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-slate-950 ${agentConfig.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          </div>

          <div className="text-left hidden sm:block leading-tight">
            <div className="text-xs font-black text-slate-950">{agentConfig.name || 'Support Desk'}</div>
            <div className="text-[10px] text-slate-900 font-bold">
              {agentConfig.isOnline !== false ? '🟢 Live Agent Ready' : '⚪ Leave Message'}
            </div>
          </div>

          {unreadCount > 0 && (
            <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-md">
              {unreadCount} NEW
            </span>
          )}

          {totalPendingCount > 0 && (
            <span className="bg-amber-950 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
              {totalPendingCount} Pending
            </span>
          )}

          <Maximize2 className="w-4 h-4 text-slate-950" />
        </motion.div>
      )}

      {/* Main Full-Screen Live Support Interface */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <div 
            className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-hidden font-mono select-none"
            style={{
              height: typeof window !== 'undefined' && window.visualViewport ? `${viewportHeight}px` : '100dvh',
              maxHeight: typeof window !== 'undefined' && window.visualViewport ? `${viewportHeight}px` : '100dvh'
            }}
          >
            {/* Top Primary Support Header */}
            <header className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-b border-amber-500/40 p-3 sm:p-4 flex items-center justify-between shadow-2xl shrink-0 z-30">
              
              {/* Agent Identity & Online Presence */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                    alt={agentConfig.name}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border-2 border-amber-400 shadow-lg shadow-amber-500/30"
                  />
                  <span 
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                      agentConfig.isOnline !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                    title={agentConfig.isOnline !== false ? 'Agent is Online' : 'Agent is Offline'} 
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                      {agentConfig.name || 'Official Support Desk'}
                    </h2>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      {agentConfig.title || 'Senior Support Specialist'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold mt-0.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="truncate">{agentConfig.responseSpeedText || 'Live Online • Replies in < 1 min'}</span>
                  </div>
                </div>
              </div>

              {/* Player Info Quick Pill & Header Control Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                
                {/* Embedded Player Info Pill (Desktop & Tablet) */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="leading-tight text-left">
                    <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <span className="truncate max-w-[100px]">{userName}</span>
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded font-mono">
                        {user.vipLevel || 'Bronze'}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono">
                      ₹{(user.balance || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Sound FX Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsSoundMuted(!isSoundMuted);
                  }}
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 transition-all cursor-pointer"
                  title={isSoundMuted ? 'Unmute chat sounds' : 'Mute chat sounds'}
                >
                  {isSoundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                </button>

                {/* Push Notification Opt-in */}
                {browserNotificationPerm !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      requestNotificationPermission();
                    }}
                    className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
                    title="Enable desktop notifications for agent replies"
                  >
                    <Bell className="w-4 h-4 text-amber-400" />
                  </button>
                )}

                {/* Minimize Window Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setIsMinimized(true);
                  }}
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 transition-all cursor-pointer"
                  title="Minimize Support Desk to floating bubble"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>

                {/* Close Fullscreen Support Desk */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onClose();
                  }}
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 transition-all cursor-pointer"
                  title="Exit Support Desk"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Support Desk Internal Tabbed Navigation Bar */}
            <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0 z-20">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {[
                  { id: 'chat', label: '💬 Live Chat', count: unreadCount },
                  { id: 'pending', label: '⏳ Pending Requests', count: totalPendingCount },
                  { id: 'faq', label: '❓ Help & FAQ Guide', count: 0 },
                  { id: 'quick', label: '⚡ Quick Services & Hotline', count: 0 },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        soundFx.playClick();
                        setActiveTab(tab.id as SupportTab);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
                          : 'bg-slate-950 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-slate-950 text-amber-300' : 'bg-rose-500 text-white animate-bounce'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Verified Badge */}
              <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>24/7 Priority VIP Support Verified</span>
              </div>
            </div>

            {/* Dynamic Player Information & Pending Requests Bar (Always Visible, Non-Obscuring) */}
            <div className="bg-slate-950/90 border-b border-slate-800/80 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              
              {/* Player Credentials */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono text-[11px]">Player:</span>
                  <span className="font-bold text-white">{userName}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded font-mono">
                    UID: {activeUid.slice(0, 8)}...
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[11px] text-slate-400">Balance:</span>
                  <span className="text-emerald-400 font-black">₹{(user.balance || 0).toLocaleString('en-IN')}</span>
                  {typeof user.bonusBalance === 'number' && user.bonusBalance > 0 && (
                    <span className="text-[10px] text-purple-300 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.2 rounded">
                      Bonus: ₹{user.bonusBalance.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>

              {/* Pending Requests Quick Actions */}
              {totalPendingCount > 0 ? (
                <div className="flex items-center gap-2">
                  {pendingDeposits.length > 0 && (
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setActiveTab('pending');
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-lg text-[10px] font-bold border border-amber-500/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowDownCircle className="w-3 h-3 text-amber-400" />
                      <span>{pendingDeposits.length} Deposit Pending (₹{pendingDeposits.reduce((acc, d) => acc + (d.amount || 0), 0).toLocaleString('en-IN')})</span>
                    </button>
                  )}

                  {pendingWithdrawals.length > 0 && (
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setActiveTab('pending');
                      }}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold border border-rose-500/40 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpCircle className="w-3 h-3 text-rose-400" />
                      <span>{pendingWithdrawals.length} Withdrawal In Queue (₹{pendingWithdrawals.reduce((acc, w) => acc + (w.amount || 0), 0).toLocaleString('en-IN')})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircleIcon className="w-3 h-3" />
                  <span>All account settlements up to date</span>
                </div>
              )}
            </div>

            {/* TAB CONTENT 1: LIVE CHAT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden relative">
                
                {/* Chat Scrollable Message Stream */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                >
                  {/* Greeting message from configured support agent */}
                  <div className="flex items-start gap-2.5 max-w-[88%] animate-in fade-in duration-300">
                    <div className="relative shrink-0 mt-0.5">
                      <img
                        src={agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                        alt={agentConfig.name}
                        className="w-8 h-8 rounded-xl object-cover border border-amber-400 shadow-md"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-slate-950 ${agentConfig.isOnline !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    </div>
                    <div className="space-y-1">
                      <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-900 border border-amber-500/30 text-slate-200 text-xs shadow-xl space-y-1.5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-amber-400">{agentConfig.name || 'Support Desk'}</span>
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                              {agentConfig.title || 'Official Agent'}
                            </span>
                          </div>
                          <span className="text-[9px] text-emerald-400 font-mono">Verified Live</span>
                        </div>
                        <p className="leading-relaxed">
                          {agentConfig.welcomeMessage || `স্বাগতম ${userName}! ডিপোজিট, উইথড্রয়াল, টিকিট বা গেম সংক্রান্ত যে কোনো সমস্যার জন্য নিচে মেসেজ পাঠান। আমি আপনাকে সাহায্য করতে প্রস্তুত।`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Messages */}
                  {messages.map((msg, idx) => {
                    const isUser = msg.senderRole === 'user';
                    const formattedTime = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex items-start gap-2.5 max-w-[90%] md:max-w-[75%] ${
                          isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        } animate-in fade-in slide-in-from-bottom-2 duration-200`}
                      >
                        {/* Avatar for Support Desk */}
                        {!isUser && (
                          <div className="relative shrink-0 mt-0.5">
                            <img
                              src={msg.senderAvatar || agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                              alt={msg.senderName || agentConfig.name}
                              className="w-7 h-7 rounded-xl object-cover border border-amber-400 shadow-md"
                            />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-slate-950 ${agentConfig.isOnline !== false ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          </div>
                        )}

                        <div className="space-y-0.5 min-w-0">
                          {/* Bubble */}
                          <div
                            className={`p-3 rounded-2xl text-xs break-words shadow-md ${
                              isUser
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold rounded-tr-xs shadow-amber-500/20'
                                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow-slate-950'
                            }`}
                          >
                            {/* Attachment if present */}
                            {msg.attachmentUrl && (
                              <div className="mb-2">
                                {msg.attachmentType === 'image' ? (
                                  <div 
                                    onClick={() => setPreviewImageModal(msg.attachmentUrl || null)}
                                    className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-700 max-w-sm"
                                  >
                                    <img
                                      src={msg.attachmentUrl}
                                      alt="attachment"
                                      className="max-h-60 w-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-mono text-[10px]">
                                      Click to View HD
                                    </div>
                                  </div>
                                ) : (
                                  <a
                                    href={msg.attachmentUrl}
                                    download={msg.attachmentName || 'document'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-400 text-amber-300 transition-colors"
                                  >
                                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-bold text-[11px]">{msg.attachmentName || 'Attachment Document'}</p>
                                      <p className="text-[9px] text-slate-400 font-mono">{msg.attachmentSize || 'Document File'}</p>
                                    </div>
                                    <Download className="w-4 h-4 text-slate-400 hover:text-white shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.text && (
                              <p className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                                {msg.text}
                              </p>
                            )}
                          </div>

                          {/* Message Metadata Timestamp & Read Receipts */}
                          <div
                            className={`flex items-center gap-1.5 text-[9px] font-mono px-1 ${
                              isUser ? 'justify-end text-amber-400/80' : 'justify-start text-slate-500'
                            }`}
                          >
                            <span>{formattedTime}</span>
                            {isUser && (
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
                  })}

                  {/* Admin Typing Indicator */}
                  {isAdminTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="flex items-start gap-2 max-w-[85%] mr-auto animate-in fade-in duration-200"
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={agentConfig.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80'}
                          alt={agentConfig.name}
                          className="w-7 h-7 rounded-xl object-cover border border-amber-400 shadow-md"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-slate-950 animate-ping" />
                      </div>
                      <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-2xl rounded-tl-xs flex items-center gap-2 text-xs text-amber-300 shadow-lg">
                        <span className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span className="font-bold text-[11px] text-amber-200">{agentConfig.name || 'Agent'} is typing...</span>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="px-3 sm:px-6 py-2 bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-1.5 shrink-0">
                  {QUICK_PROMPTS.map((prompt) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => {
                          handleSendMessage(prompt.text);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-[10px] font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer active:scale-95"
                      >
                        <Icon className="w-3 h-3 text-amber-400" />
                        <span>{prompt.text}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Chat Input Bar */}
                <div className="p-3 sm:p-4 bg-slate-950 border-t border-amber-500/30 shrink-0">
                  
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
                          <p className="text-[10px] text-amber-400/80 font-mono">{attachment.size} • Ready to send</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                        title="Remove file"
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
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    {/* File / Image Attachment Button */}
                    <button
                      type="button"
                      disabled={isCompressing || isSending}
                      onClick={() => {
                        soundFx.playClick();
                        fileInputRef.current?.click();
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                        attachment 
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' 
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border-slate-800 hover:border-amber-500/40'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Attach Screenshot / Slip / Document"
                    >
                      {isCompressing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Paperclip className="w-4 h-4" />}
                    </button>

                    <div className="relative flex-1">
                      <input
                        ref={textInputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => handleUserInputChange(e.target.value)}
                        onFocus={handleInputFocus}
                        onClick={handleInputFocus}
                        onKeyDown={handleKeyDown}
                        placeholder={attachment ? "Add optional caption..." : `Type your query to ${agentConfig.name || 'Support'}...`}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl text-sm sm:text-xs text-white placeholder-slate-500 outline-none transition-all pr-10 font-sans"
                        disabled={isSending}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={(!inputText.trim() && !attachment) || isSending}
                      className="p-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                      title="Send message"
                    >
                      <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: PENDING REQUESTS */}
            {activeTab === 'pending' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950">
                <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* Summary Banner */}
                  <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>Active Account Settlement Tracker</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Review the live verification status of your deposits, withdrawals, and lottery tickets.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          soundFx.playClick();
                          setActiveTab('chat');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message Agent</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Pending Deposits */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowDownCircle className="w-4 h-4" />
                        <span>Pending Deposits ({pendingDeposits.length})</span>
                      </h4>
                      {onOpenDeposit && (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            onOpenDeposit();
                          }}
                          className="text-[11px] text-amber-400 hover:underline font-bold"
                        >
                          + New Deposit
                        </button>
                      )}
                    </div>

                    {pendingDeposits.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center text-xs text-slate-500 font-mono">
                        No pending deposits. All deposits have been approved and added to your wallet!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pendingDeposits.map((dep) => (
                          <div 
                            key={dep.id}
                            className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-3 shadow-lg"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-base font-black text-amber-400 font-mono">
                                ₹{(dep.amount || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                <span>Verifying UTR</span>
                              </span>
                            </div>

                            <div className="space-y-1 text-xs text-slate-300">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-mono">UTR / Tx ID:</span>
                                <span className="font-mono font-bold text-white flex items-center gap-1">
                                  <span>{dep.utr || 'N/A'}</span>
                                  {dep.utr && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(dep.utr);
                                        setCopiedUtr(dep.utr);
                                        soundFx.playClick();
                                        setTimeout(() => setCopiedUtr(null), 2000);
                                      }}
                                      className="text-slate-400 hover:text-white"
                                      title="Copy UTR"
                                    >
                                      {copiedUtr === dep.utr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">Method:</span>
                                <span className="font-bold text-slate-300 uppercase">{dep.method || 'UPI'}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>Submitted:</span>
                                <span>{dep.date || 'Recent'}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleQueryPendingRequest('deposit', dep)}
                              className="w-full py-2 bg-slate-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Ask Agent About This Deposit</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Pending Withdrawals */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowUpCircle className="w-4 h-4" />
                        <span>Pending Withdrawals ({pendingWithdrawals.length})</span>
                      </h4>
                      {onOpenWithdrawal && (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            onOpenWithdrawal();
                          }}
                          className="text-[11px] text-rose-400 hover:underline font-bold"
                        >
                          + New Withdrawal
                        </button>
                      )}
                    </div>

                    {pendingWithdrawals.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center text-xs text-slate-500 font-mono">
                        No pending withdrawals. Your payout requests have been cleared.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pendingWithdrawals.map((wth) => (
                          <div 
                            key={wth.id}
                            className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-3 shadow-lg"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-base font-black text-rose-400 font-mono">
                                ₹{(wth.amount || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                <span>Payout In Queue</span>
                              </span>
                            </div>

                            <div className="space-y-1 text-xs text-slate-300">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Beneficiary Name:</span>
                                <span className="font-bold text-white">{wth.fullName || userName}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-mono">Account / UPI:</span>
                                <span className="font-mono text-slate-300">{wth.accountNumber || wth.upiId || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>Requested:</span>
                                <span>{wth.date || 'Recent'}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleQueryPendingRequest('withdrawal', wth)}
                              className="w-full py-2 bg-slate-800 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Query Withdrawal Payout Status</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Active Lottery & SuperCar Tickets */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="w-4 h-4" />
                      <span>Active Draw Tickets ({activeUserTickets.length})</span>
                    </h4>

                    {activeUserTickets.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                        No active lottery tickets awaiting draw results right now.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeUserTickets.map((t) => (
                          <div 
                            key={t.id}
                            className="p-3 rounded-xl bg-slate-900 border border-purple-500/30 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">{t.drawTitle || 'Lottery Draw'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Numbers: {(t.selectedNumbers || []).join(', ')} • Price: ₹{t.price}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                              Awaiting Draw
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* TAB CONTENT 3: HELP & FAQ */}
            {activeTab === 'faq' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950">
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                      <span>Frequently Asked Questions & Player Guidelines</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Instant answers regarding deposits, withdrawals, rules, and fairness.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {FAQ_ITEMS.map((item, idx) => {
                      const isExpanded = expandedFaqIndex === idx;
                      return (
                        <div 
                          key={idx}
                          className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-all"
                        >
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              setExpandedFaqIndex(isExpanded ? null : idx);
                            }}
                            className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[10px]">
                                {idx + 1}
                              </span>
                              <span>{item.q}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 bg-slate-950/40">
                              <p>{item.a}</p>
                              <div className="mt-3 flex justify-end">
                                <button
                                  onClick={() => {
                                    handleSendMessage(`I need more help regarding: "${item.q}"`);
                                    setActiveTab('chat');
                                  }}
                                  className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
                                >
                                  Ask Agent About This →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: QUICK SERVICES & HOTLINE */}
            {activeTab === 'quick' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950">
                <div className="max-w-3xl mx-auto space-y-6">
                  
                  {/* Quick Action Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                        <ArrowDownCircle className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-white">Instant Wallet Deposit</h4>
                      <p className="text-xs text-slate-400">
                        Top up your wallet via UPI, PhonePe, Google Pay, Paytm, or USDT.
                      </p>
                      {onOpenDeposit && (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            onClose();
                            onOpenDeposit();
                          }}
                          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                        >
                          Open Deposit Gateway
                        </button>
                      )}
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-900 border border-rose-500/30 space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                        <ArrowUpCircle className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-white">Instant Withdrawal Request</h4>
                      <p className="text-xs text-slate-400">
                        Withdraw your winnings directly into your Bank Account or UPI ID.
                      </p>
                      {onOpenWithdrawal && (
                        <button
                          onClick={() => {
                            soundFx.playClick();
                            onClose();
                            onOpenWithdrawal();
                          }}
                          className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-500 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                        >
                          Request Withdrawal
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Hotline & Security Details */}
                  <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 font-mono">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Official BETGURU Support Directives
                    </h4>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Live Support Desk:</span>
                        <span className="text-emerald-400 font-bold">24 Hours / 7 Days Active</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Average Reply Latency:</span>
                        <span className="text-amber-300 font-bold">&lt; 60 Seconds</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Data Security:</span>
                        <span className="text-emerald-400 font-bold">256-bit SSL Encrypted</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}
      </AnimatePresence>

      {/* Full Image Preview Modal */}
      <AnimatePresence>
        {previewImageModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] bg-slate-950 border border-amber-500/40 rounded-3xl p-3 shadow-2xl flex flex-col items-center"
            >
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                <span className="text-xs text-amber-400 font-mono">Attachment Preview</span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewImageModal}
                    download="support-attachment"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-amber-400 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal(null)}
                    className="p-1.5 bg-slate-900 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <img
                src={previewImageModal}
                alt="Full preview"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

// Simple internal icon component for checklist
function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
