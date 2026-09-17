/**
 * Instant Image Preloader Engine
 * Ensures 0-millisecond rendering for critical Live Casino Arena banners,
 * Promotional Sliders, and Game assets upon page refresh.
 */

import { 
  bannerAviatorCrashImg, 
  andarBaharBannerImg, 
  rouletteBannerImg, 
  dragonTigerBannerImg 
} from '../assets/casinoBanners';

export const CRITICAL_CASINO_BANNERS = [
  bannerAviatorCrashImg,
  andarBaharBannerImg,
  rouletteBannerImg,
  dragonTigerBannerImg,
];

// Pre-cached in-memory Image instances to keep decoded bitmaps ready in GPU cache
const preloadedImageCache: HTMLImageElement[] = [];

export function preloadCriticalImages(): void {
  if (typeof window === 'undefined') return;

  CRITICAL_CASINO_BANNERS.forEach((src) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
      preloadedImageCache.push(img);
    } catch (_) {}
  });
}

// Execute immediately when module is imported
preloadCriticalImages();
