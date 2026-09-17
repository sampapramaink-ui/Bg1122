import { useState, useEffect } from 'react';
import { SupportAgentConfig } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export const DEFAULT_SUPPORT_AGENT: SupportAgentConfig = {
  name: 'Priya Sharma',
  avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  title: 'Senior Live Support Specialist',
  isOnline: true,
  welcomeMessage: 'স্বাগতম! আমি BETGURU লাইভ সাপোর্ট এক্সিকিউটিভ। ডিপোজিট, উইথড্রয়াল, গেম বা অ্যাকাউন্ট সংক্রান্ত যেকোনো সমস্যায় আমাকে জানান, আমি তৎক্ষণাৎ সমাধান করে দেব।',
  responseSpeedText: 'Replies in ~30 seconds'
};

export const AGENT_AVATAR_PRESETS = [
  {
    id: 'priya',
    name: 'Priya Sharma',
    title: 'Senior Live Support Specialist',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    gender: 'Female',
    roleTag: 'VIP Executive'
  },
  {
    id: 'rajesh',
    name: 'Rajesh Verma',
    title: '24/7 VIP Account Manager',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80',
    gender: 'Male',
    roleTag: 'Desk Lead'
  },
  {
    id: 'ananya',
    name: 'Ananya Sen',
    title: 'Instant Payout & Deposit Help Desk',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
    gender: 'Female',
    roleTag: 'Payout Officer'
  },
  {
    id: 'vikram',
    name: 'Vikram Malhotra',
    title: 'Executive Support Manager',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    gender: 'Male',
    roleTag: 'Head Support'
  },
  {
    id: 'sneha',
    name: 'Sneha Roy',
    title: 'Priority Resolution Officer',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    gender: 'Female',
    roleTag: 'Live Specialist'
  },
  {
    id: 'arjun',
    name: 'Arjun Das',
    title: 'Lead Operations Executive',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    gender: 'Male',
    roleTag: 'Senior Agent'
  }
];

const LOCAL_STORAGE_KEY = 'betguru_support_agent_config';

export function getLocalSupportAgentConfig(): SupportAgentConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SUPPORT_AGENT, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return DEFAULT_SUPPORT_AGENT;
}

export async function saveSupportAgentConfig(config: SupportAgentConfig): Promise<void> {
  try {
    const cleanConfig = { ...config, updatedAt: Date.now() };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanConfig));
    const docRef = doc(db, 'settings', 'support_agent_config');
    await setDoc(docRef, cleanConfig, { merge: true });
  } catch (e) {
    console.warn('Could not save support agent config to Firestore:', e);
  }
}

export async function setAdminTypingStatus(userId: string, isTyping: boolean): Promise<void> {
  if (!userId) return;
  try {
    const threadRef = doc(db, 'support_threads', userId);
    await setDoc(threadRef, {
      adminTyping: isTyping,
      adminTypingTimestamp: isTyping ? Date.now() : 0
    }, { merge: true });
  } catch (e) {
    // silent catch
  }
}

export async function setUserTypingStatus(userId: string, isTyping: boolean): Promise<void> {
  if (!userId || userId === 'anonymous') return;
  try {
    const threadRef = doc(db, 'support_threads', userId);
    await setDoc(threadRef, {
      userTyping: isTyping,
      userTypingTimestamp: isTyping ? Date.now() : 0
    }, { merge: true });
  } catch (e) {
    // silent catch
  }
}

export function useSupportAgentConfig(): {
  agentConfig: SupportAgentConfig;
  updateAgentConfig: (config: SupportAgentConfig) => Promise<void>;
  isLoading: boolean;
} {
  const [agentConfig, setAgentConfig] = useState<SupportAgentConfig>(() => getLocalSupportAgentConfig());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const docRef = doc(db, 'settings', 'support_agent_config');
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as SupportAgentConfig;
            const merged = { ...DEFAULT_SUPPORT_AGENT, ...data };
            setAgentConfig(merged);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            } catch (_) {}
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn('Support agent config listener warning:', err);
          setIsLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('Error subscribing to support agent config:', e);
      setIsLoading(false);
    }
  }, []);

  const updateAgentConfig = async (newConfig: SupportAgentConfig) => {
    setAgentConfig(newConfig);
    await saveSupportAgentConfig(newConfig);
  };

  return { agentConfig, updateAgentConfig, isLoading };
}
