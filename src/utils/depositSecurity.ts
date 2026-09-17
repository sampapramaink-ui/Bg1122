import { DepositRequest } from '../types';

/**
 * Generates a fast 32-bit FNV-1a hash signature for an image base64 / URL string
 * to reliably detect duplicate uploaded screenshots across all accounts.
 */
export function generateImageFingerprint(imageStr: string): string {
  if (!imageStr) return '';
  // Normalize string (strip whitespace/data uri header if uniform)
  const cleanStr = imageStr.replace(/^data:image\/[a-z]+;base64,/, '').slice(0, 10000);
  let hash = 2166136261;
  for (let i = 0; i < cleanStr.length; i++) {
    hash ^= cleanStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16) + `_len${imageStr.length}`;
}

/**
 * Validates whether a UTR / Transaction Hash or screenshot has already been submitted
 * anywhere in the database (by current user or ANY other user/account).
 */
export function checkDuplicateDeposit(
  rawUtr: string,
  screenshotUrl: string,
  allDeposits: DepositRequest[]
): {
  isDuplicate: boolean;
  duplicateType?: 'utr' | 'screenshot';
  matchedDeposit?: DepositRequest;
  message?: string;
} {
  const cleanUtr = (rawUtr || '').trim().toLowerCase();
  
  if (!cleanUtr) {
    return { isDuplicate: false };
  }

  // 1. Check UTR / TxID duplication
  const matchedByUtr = allDeposits.find((d) => {
    const existingUtr = (d.utr || '').trim().toLowerCase();
    return existingUtr === cleanUtr;
  });

  if (matchedByUtr) {
    const statusLabel = matchedByUtr.status.toUpperCase();
    const isCredited = matchedByUtr.status === 'approved';
    return {
      isDuplicate: true,
      duplicateType: 'utr',
      matchedDeposit: matchedByUtr,
      message: isCredited
        ? `⚠️ Already Credited! This UTR / Transaction ID (${rawUtr}) has already been approved and credited to an account. Repeated submissions are strictly blocked.`
        : `⚠️ Already Submitted! This UTR / Transaction ID (${rawUtr}) is already registered in the system (Status: ${statusLabel}). Please check your transaction history.`
    };
  }

  // 2. Check Screenshot Duplication
  if (screenshotUrl && screenshotUrl.length > 50) {
    const currentFingerprint = generateImageFingerprint(screenshotUrl);
    const matchedByScreenshot = allDeposits.find((d) => {
      if (!d.screenshotUrl || d.screenshotUrl.length < 50) return false;
      if (d.screenshotHash && d.screenshotHash === currentFingerprint) return true;
      if (d.screenshotUrl === screenshotUrl) return true;
      return false;
    });

    if (matchedByScreenshot) {
      return {
        isDuplicate: true,
        duplicateType: 'screenshot',
        matchedDeposit: matchedByScreenshot,
        message: `⚠️ Duplicate Screenshot Detected! This payment proof image has already been submitted for another transaction (${matchedByScreenshot.id}). Please upload a fresh, valid receipt.`
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Downloads a QR code image / Canvas directly to the client device
 */
export function downloadQrCode(imageUrl: string, filename = 'payment-qr-code.png') {
  if (!imageUrl) return;

  try {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error downloading QR code:', err);
    window.open(imageUrl, '_blank');
  }
}
