import confetti from 'canvas-confetti';

// Polyfill OffscreenCanvas.prototype.getBoundingClientRect for older/partial browser worker engines
if (typeof OffscreenCanvas !== 'undefined' && !('getBoundingClientRect' in OffscreenCanvas.prototype)) {
  try {
    (OffscreenCanvas.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = function (this: OffscreenCanvas): DOMRect {
      const w = this.width || (typeof window !== 'undefined' ? window.innerWidth : 300);
      const h = this.height || (typeof window !== 'undefined' ? window.innerHeight : 150);
      return {
        top: 0,
        left: 0,
        right: w,
        bottom: h,
        width: w,
        height: h,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    };
  } catch (_) {}
}

// Create a direct, main-thread safe confetti instance with useWorker: false
// This completely avoids the OffscreenCanvas worker bug in canvas-confetti
let safeConfettiInstance: confetti.CreateTypes | null = null;

const getSafeConfetti = (): confetti.CreateTypes => {
  if (!safeConfettiInstance && typeof document !== 'undefined') {
    try {
      safeConfettiInstance = confetti.create(undefined as unknown as HTMLCanvasElement, {
        resize: true,
        useWorker: false
      });
    } catch (e) {
      console.warn('[Confetti] Creation fallback:', e);
    }
  }
  return safeConfettiInstance || confetti;
};

/**
 * Triggers safe celebration confetti without worker OffscreenCanvas getBoundingClientRect errors
 */
export const triggerConfetti = (options?: confetti.Options): Promise<null> | void => {
  if (typeof window === 'undefined') return;
  try {
    const fn = getSafeConfetti();
    return fn({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      ...options
    });
  } catch (err) {
    console.warn('[Confetti] Error suppressed:', err);
  }
};

/**
 * Triggers an Ultra Luxury 8K Gold Confetti & Sparkles Celebration Explosion
 */
export const triggerGoldConfetti = () => {
  if (typeof window === 'undefined') return;
  try {
    const fn = getSafeConfetti();
    const goldColors = ['#FFD700', '#FFA500', '#FFF8DC', '#F59E0B', '#FBBF24', '#FCD34D', '#FFFFFF'];

    // Center Big Gold Blast
    fn({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.55 },
      colors: goldColors,
      ticks: 250,
      gravity: 0.9,
      scalar: 1.2
    });

    // Left Cannon
    setTimeout(() => {
      fn({
        particleCount: 60,
        angle: 60,
        spread: 70,
        origin: { x: 0.1, y: 0.7 },
        colors: goldColors,
        ticks: 200,
        gravity: 0.85
      });
    }, 150);

    // Right Cannon
    setTimeout(() => {
      fn({
        particleCount: 60,
        angle: 120,
        spread: 70,
        origin: { x: 0.9, y: 0.7 },
        colors: goldColors,
        ticks: 200,
        gravity: 0.85
      });
    }, 300);

    // Delayed Golden Star Shower
    setTimeout(() => {
      fn({
        particleCount: 75,
        spread: 120,
        origin: { y: 0.35 },
        colors: ['#F59E0B', '#FCD34D', '#FFEDD5', '#10B981', '#E11D48'],
        ticks: 220,
        shapes: ['circle', 'square'],
        scalar: 1.1
      });
    }, 550);
  } catch (err) {
    console.warn('[GoldConfetti] Error suppressed:', err);
  }
};

export default triggerConfetti;
