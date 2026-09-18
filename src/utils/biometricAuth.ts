/**
 * Biometric Authentication Helper (WebAuthn / Platform Authenticator)
 * Supports Fingerprint, Touch ID, Face ID, and Windows Hello.
 */

export interface BiometricStatus {
  isSupported: boolean;
  isAvailable: boolean;
  isEnrolled: boolean;
}

// Convert string to Uint8Array buffer
function strToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Generate secure random challenge buffer
function generateRandomChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(challenge);
  } else {
    for (let i = 0; i < 32; i++) {
      challenge[i] = Math.floor(Math.random() * 256);
    }
  }
  return challenge;
}

/**
 * Check if the current browser and device support biometric authentication
 */
export async function checkBiometricSupport(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (!window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(isAvailable);
  } catch (err) {
    console.warn('Biometric support check error:', err);
    return false;
  }
}

/**
 * Check if a user has enrolled biometric credentials on this device
 */
export function isUserBiometricEnrolled(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    const credId = localStorage.getItem(`betguru_bio_cred_${userId}`);
    const isEnabled = localStorage.getItem(`betguru_bio_enabled_${userId}`);
    return Boolean(credId || isEnabled === 'true');
  } catch (_) {
    return false;
  }
}

/**
 * Enable or disable biometric preference in localStorage
 */
export function setBiometricPreference(userId: string, enabled: boolean): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    if (enabled) {
      localStorage.setItem(`betguru_bio_enabled_${userId}`, 'true');
    } else {
      localStorage.removeItem(`betguru_bio_enabled_${userId}`);
      localStorage.removeItem(`betguru_bio_cred_${userId}`);
    }
  } catch (_) {}
}

/**
 * Register a new Biometric Credential for user (Fingerprint / Face ID)
 */
export async function registerBiometric(
  userId: string,
  userName: string = 'BETGURU Player'
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials) {
    return { success: false, error: 'WebAuthn is not supported in this browser.' };
  }

  try {
    const isSupported = await checkBiometricSupport();
    if (!isSupported) {
      return { success: false, error: 'Biometric hardware is not available on this device.' };
    }

    const challenge = generateRandomChallenge();
    const userIdBuffer = strToBuffer(userId);
    const domain = window.location.hostname;

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: 'BETGURU PRIME',
        id: domain
      },
      user: {
        id: userIdBuffer,
        name: userName.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 30) || 'Player',
        displayName: userName.slice(0, 30) || 'Player'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256 (P-256)
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    })) as PublicKeyCredential | null;

    if (credential && credential.id) {
      localStorage.setItem(`betguru_bio_cred_${userId}`, credential.id);
      localStorage.setItem(`betguru_bio_enabled_${userId}`, 'true');
      return { success: true, credentialId: credential.id };
    } else {
      return { success: false, error: 'Biometric registration was incomplete.' };
    }
  } catch (err: any) {
    console.warn('Biometric registration error:', err);
    let friendlyMsg = 'Biometric setup failed or was canceled.';
    if (err.name === 'NotAllowedError') {
      friendlyMsg = 'বায়োমেট্রিক রিকোয়েস্ট বাতিল করা হয়েছে অথবা অনুমতি দেওয়া হয়নি।';
    } else if (err.name === 'NotSupportedError') {
      friendlyMsg = 'এই ডিভাইসে বায়োমেট্রিক সাপোর্ট নেই।';
    } else if (err.message) {
      friendlyMsg = err.message;
    }
    return { success: false, error: friendlyMsg };
  }
}

/**
 * Authenticate user with Biometrics (Fingerprint / Touch ID / Face ID)
 */
export async function authenticateBiometric(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !navigator.credentials) {
    return { success: false, error: 'WebAuthn is not supported in this browser.' };
  }

  try {
    const isSupported = await checkBiometricSupport();
    if (!isSupported) {
      return { success: false, error: 'Biometric hardware is not available on this device.' };
    }

    const challenge = generateRandomChallenge();
    const domain = window.location.hostname;
    const storedCredId = localStorage.getItem(`betguru_bio_cred_${userId}`);

    const publicKeyRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      rpId: domain,
      timeout: 60000,
      userVerification: 'preferred'
    };

    // If we have a specific stored credential ID, we can offer it
    if (storedCredId) {
      try {
        const rawId = strToBuffer(storedCredId);
        publicKeyRequestOptions.allowCredentials = [
          {
            type: 'public-key',
            id: rawId
          }
        ];
      } catch (_) {
        // Fall back to any credential for this rpId
      }
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyRequestOptions
    });

    if (assertion) {
      return { success: true };
    } else {
      return { success: false, error: 'বায়োমেট্রিক প্রমাণীকরণ ব্যর্থ হয়েছে।' };
    }
  } catch (err: any) {
    console.warn('Biometric authentication error:', err);
    let friendlyMsg = 'বায়োমেট্রিক ভেরিফিকেশন ব্যর্থ হয়েছে বা বাতিল করা হয়েছে।';
    if (err.name === 'NotAllowedError') {
      friendlyMsg = 'বায়োমেট্রিক ভেরিফিকেশন বাতিল করা হয়েছে। পাসকোড দিয়ে চেষ্টা করুন।';
    } else if (err.message) {
      friendlyMsg = err.message;
    }
    return { success: false, error: friendlyMsg };
  }
}
