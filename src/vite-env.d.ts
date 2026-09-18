/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

export interface AndroidBridgeInterface {
  getFcmToken?: () => string | null;
  onUserLoggedIn?: (userId: string, email: string, name: string) => void;
  onUserLoggedOut?: () => void;
  onTokenSaved?: (token: string) => void;
  postMessage?: (message: string) => void;
  showToast?: (message: string) => void;
  vibrate?: (durationMs?: number) => void;
  getAppVersion?: () => string;
  copyToClipboard?: (text: string) => void;
  saveImage?: (base64Data: string, filename: string) => void;
  downloadFile?: (base64DataOrUrl: string, filename: string) => void;
  downloadBase64?: (base64Data: string, filename: string) => void;
  shareText?: (text: string, title?: string) => void;
  share?: (text: string, title?: string) => void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    saveTokenToUserDatabase?: (token: string) => void;
    saveUserFcmTokenToServer?: (token: string) => void;
    saveUserTokenToBackend?: (token: string) => void;
    handleNativePushNotification?: (payload: any) => void;
    getNativeFcmToken?: () => string | null;
    triggerAppUpdate?: (apkUrl: string, versionName: string, changelog?: string, forceUpdate?: boolean) => void;
    getNativeAppVersion?: () => string;
    clearNativeAppCache?: () => void;
    onAppResume?: () => void;
    betGuruResume?: () => void;
  }
}
