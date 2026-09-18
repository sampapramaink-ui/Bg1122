/**
 * Comprehensive Voucher & Slip Download & Share Helper
 * Optimized for Android Native WebView, Mobile Browsers, and Desktop.
 */

import { isAndroidNativeApp } from './androidBridge';
import { soundFx } from './audio';

export interface ShareVoucherParams {
  code?: string;
  amountStr?: string;
  title?: string;
  type?: string;
  dataUrl?: string | null;
  linkUrl?: string;
  activations?: string;
}

export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();
  return /android/i.test(ua) || isAndroidNativeApp();
}

/**
 * Universal safe clipboard copier that works in Android WebViews and secure/insecure contexts.
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try Native Android Bridge if present
  try {
    const win = window as any;
    if (win.AndroidBridge && typeof win.AndroidBridge.copyToClipboard === 'function') {
      win.AndroidBridge.copyToClipboard(text);
      if (typeof win.AndroidBridge.showToast === 'function') {
        win.AndroidBridge.showToast(`কপি হয়েছে: ${text}`);
      }
      return true;
    }
  } catch (_) {}

  // 2. Try Modern Async Clipboard API
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  // 3. Fallback: Classical textarea execCommand (100% reliable in Android WebViews)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.warn('Clipboard fallback failed:', err);
    return false;
  }
}

/**
 * Convert Canvas to PNG Data URL cleanly
 */
export function getCanvasDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png', 1.0);
  } catch (e) {
    console.warn('Canvas toDataURL failed:', e);
    return null;
  }
}

/**
 * Download Image with specialized Android Native WebView support
 */
export async function downloadVoucherImageSafe(
  canvasOrDataUrl: HTMLCanvasElement | string,
  filename: string,
  onToast?: (msg: string) => void
): Promise<{ success: boolean; dataUrl: string | null; requiresManualSave: boolean }> {
  try {
    soundFx.playWin();
  } catch (_) {}

  let dataUrl: string | null = null;
  if (typeof canvasOrDataUrl === 'string') {
    dataUrl = canvasOrDataUrl;
  } else if (canvasOrDataUrl && typeof canvasOrDataUrl.toDataURL === 'function') {
    dataUrl = getCanvasDataUrl(canvasOrDataUrl);
  }

  if (!dataUrl) {
    return { success: false, dataUrl: null, requiresManualSave: false };
  }

  const cleanFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
  const isAndroid = isAndroidDevice();
  const win = window as any;

  // 1. Try Android Native Bridge hooks if available
  if (win.AndroidBridge) {
    try {
      if (typeof win.AndroidBridge.saveImage === 'function') {
        win.AndroidBridge.saveImage(dataUrl, cleanFilename);
        if (onToast) onToast('গ্যালারিতে ভাউচার ফটো সেভ হচ্ছে...');
        return { success: true, dataUrl, requiresManualSave: false };
      }
      if (typeof win.AndroidBridge.downloadFile === 'function') {
        win.AndroidBridge.downloadFile(dataUrl, cleanFilename);
        if (onToast) onToast('ভাউচার ডাউনলোড শুরু হয়েছে...');
        return { success: true, dataUrl, requiresManualSave: false };
      }
      if (typeof win.AndroidBridge.downloadBase64 === 'function') {
        win.AndroidBridge.downloadBase64(dataUrl, cleanFilename);
        if (onToast) onToast('ভাউচার ডাউনলোড হচ্ছে...');
        return { success: true, dataUrl, requiresManualSave: false };
      }
      if (typeof win.AndroidBridge.postMessage === 'function') {
        win.AndroidBridge.postMessage(JSON.stringify({
          type: 'DOWNLOAD_IMAGE',
          filename: cleanFilename,
          data: dataUrl
        }));
      }
    } catch (bridgeErr) {
      console.warn('AndroidBridge file download error:', bridgeErr);
    }
  }

  // 2. Standard Browser Trigger using Data URL
  let downloadTriggered = false;
  try {
    const link = document.createElement('a');
    link.download = cleanFilename;
    link.href = dataUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch (_) {}
    }, 200);
    downloadTriggered = true;
  } catch (linkErr) {
    console.warn('Anchor download click failed:', linkErr);
  }

  // 3. In Android WebView, anchor downloads are often blocked by WebViewClient.
  // We return requiresManualSave: true on Android so the UI presents the direct
  // long-press image save / preview modal, ensuring the user is never stuck!
  return {
    success: downloadTriggered,
    dataUrl,
    requiresManualSave: isAndroid
  };
}

/**
 * Format share message for a voucher or promo code
 */
export function formatVoucherShareText(params: ShareVoucherParams): string {
  const code = (params.code || 'PROMO-CODE').toUpperCase();
  const amount = params.amountStr || 'অফার বোনাস';
  const type = params.type || 'অফিসিয়াল ভাউচার';
  const title = params.title || 'BETGURU Exclusive Voucher';
  const link = params.linkUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://betguru.app');
  const activations = params.activations ? `\n📌 ব্যবহার সীমা: ${params.activations}` : '';

  return `🎟️ *BETGURU স্পেশাল ভাউচার কোড!* 🎟️\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `🎁 অফার: ${title}\n` +
         `🔑 ভাউচার কোড: *${code}*\n` +
         `💰 বোনাস/রিওয়ার্ড: *${amount}*\n` +
         `🏷️ ক্যাটাগরি: ${type}${activations}\n` +
         `━━━━━━━━━━━━━━━━━━━━\n` +
         `⚡ এখনই BETGURU অ্যাপে লগইন করে কোডটি রিডিম করুন:\n` +
         `👉 ${link}`;
}

/**
 * Attempt native sharing via Web Share API or AndroidBridge.
 * Returns true if native share dialog was opened, false if fallback UI should open.
 */
export async function tryNativeShareVoucher(params: ShareVoucherParams): Promise<boolean> {
  const shareText = formatVoucherShareText(params);
  const win = window as any;

  // 1. Check Native Android Bridge
  if (win.AndroidBridge) {
    try {
      if (typeof win.AndroidBridge.shareText === 'function') {
        win.AndroidBridge.shareText(shareText, 'BETGURU Voucher Code');
        return true;
      }
      if (typeof win.AndroidBridge.share === 'function') {
        win.AndroidBridge.share(shareText, 'BETGURU Voucher Code');
        return true;
      }
    } catch (_) {}
  }

  // 2. Check Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // First check if file sharing is possible and file can be attached
      let sharedWithFile = false;
      if (params.dataUrl && navigator.canShare) {
        try {
          const arr = params.dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const codeClean = (params.code || 'VOUCHER').replace(/[^a-zA-Z0-9]/g, '');
          const file = new File([blob], `BETGURU-VOUCHER-${codeClean}.png`, { type: mime });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `BETGURU Voucher - ${params.code || ''}`,
              text: shareText,
              files: [file]
            });
            sharedWithFile = true;
            return true;
          }
        } catch (fileShareErr: any) {
          if (fileShareErr?.name === 'AbortError') {
            // User actively closed the share dialog
            return true;
          }
          console.warn('File share failed, falling back to text share:', fileShareErr);
        }
      }

      if (!sharedWithFile) {
        await navigator.share({
          title: `BETGURU Voucher - ${params.code || ''}`,
          text: shareText,
          url: params.linkUrl || window.location.origin
        });
        return true;
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User cancelled the share dialog
        return true;
      }
      console.warn('navigator.share failed, opening custom share modal:', shareErr);
    }
  }

  return false;
}
