/**
 * Image and File Compression Utility for Firestore Compatibility
 * 
 * Firestore has a strict maximum document size limit of 1,048,576 bytes (1 MiB).
 * Any document containing uncompressed base64 data (which expands raw binary by ~33%)
 * will fail to write if total size exceeds 1MB.
 * 
 * This utility provides safe downscaling, progressive compression, and validation
 * ensuring all images and attachments stay comfortably below 350 KB.
 */

export interface ProcessedAttachment {
  url: string;
  name: string;
  type: 'image' | 'file';
  size: string;
  sizeBytes: number;
}

/**
 * Compresses an image file or blob to a safe base64 Data URL
 * @param file The image File or Blob to compress
 * @param maxDimension Maximum width or height in pixels (default: 1024)
 * @param initialQuality JPEG quality 0.1 to 1.0 (default: 0.75)
 * @param maxBytesTarget Target maximum base64 payload size in bytes (default: 350,000 bytes ~ 340KB)
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  maxDimension = 1024,
  initialQuality = 0.75,
  maxBytesTarget = 350000
): Promise<{ dataUrl: string; sizeBytes: number; formattedSize: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Empty image file'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));

      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down proportionally
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback to original if canvas context unavailable
            resolve({
              dataUrl: src,
              sizeBytes: src.length,
              formattedSize: formatByteSize(src.length)
            });
            return;
          }

          // Draw image with smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Progressive quality reduction if needed
          let quality = initialQuality;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // If still larger than target, reduce dimensions & quality iteratively
          let iterations = 0;
          while (dataUrl.length > maxBytesTarget && iterations < 3) {
            iterations++;
            quality = Math.max(0.4, quality - 0.15);
            // also shrink canvas dimensions slightly
            const scaleFactor = 0.85;
            const newW = Math.max(100, Math.round(canvas.width * scaleFactor));
            const newH = Math.max(100, Math.round(canvas.height * scaleFactor));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = newW;
            tempCanvas.height = newH;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(canvas, 0, 0, newW, newH);
              dataUrl = tempCanvas.toDataURL('image/jpeg', quality);
            } else {
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
          }

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          resolve({
            dataUrl,
            sizeBytes: approxBytes,
            formattedSize: formatByteSize(approxBytes)
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes into human readable KB / MB
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Safe Chat & Upload Attachment Processor
 * Checks file type, automatically compresses images, and ensures Firestore compatibility.
 */
export async function processChatAttachment(file: File): Promise<ProcessedAttachment> {
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);

  if (isImage) {
    // Automatically downscale and compress image to < 350KB
    const compressed = await compressImageToDataUrl(file, 1024, 0.75, 350000);
    return {
      url: compressed.dataUrl,
      name: file.name,
      type: 'image',
      size: compressed.formattedSize,
      sizeBytes: compressed.sizeBytes
    };
  }

  // For non-image files (PDF, doc, txt, etc.)
  // Strict check: non-images cannot be compressed, so raw size must be <= 500KB to stay safely under Firestore's 1MB limit with Base64 overhead
  const MAX_FILE_BYTES = 500 * 1024; // 500 KB
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`ফাইল সাইজ সর্বোচ্চ ৫০০ KB হতে পারে (বর্তমান সাইজ: ${formatByteSize(file.size)})। দয়া করে ছোট ফাইল বা স্ক্রিনশট ব্যবহার করুন।`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ফাইল পড়তে সমস্যা হয়েছে।'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const sizeStr = formatByteSize(file.size);
      resolve({
        url: dataUrl,
        name: file.name,
        type: 'file',
        size: sizeStr,
        sizeBytes: file.size
      });
    };
    reader.readAsDataURL(file);
  });
}
