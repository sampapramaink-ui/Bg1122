import React, { useEffect, useRef } from 'react';

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  growthRate: number;
  rotation: number;
  vRot: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  colorType: 'hot_amber' | 'ivory_white' | 'slate_fog';
  puffBlobs: { offsetX: number; offsetY: number; radiusRatio: number }[];
}

interface FrictionSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface RouletteFrictionSmokeCanvasProps {
  wheelContainerRef: React.RefObject<HTMLDivElement | null>;
  wheelRotation: number;
  gamePhase: 'betting' | 'lightning' | 'spinning' | 'settled';
  spinElapsed: number;
  isResultRevealed: boolean;
}

export const RouletteFrictionSmokeCanvas: React.FC<RouletteFrictionSmokeCanvasProps> = ({
  wheelContainerRef,
  wheelRotation,
  gamePhase,
  spinElapsed,
  isResultRevealed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<SmokeParticle[]>([]);
  const sparksRef = useRef<FrictionSpark[]>([]);
  const prevRotationRef = useRef<number>(wheelRotation);
  const spinElapsedRef = useRef<number>(spinElapsed);
  spinElapsedRef.current = spinElapsed;
  const isResultRevealedRef = useRef<boolean>(isResultRevealed);
  isResultRevealedRef.current = isResultRevealed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const createSmokeParticle = (
      originX: number,
      originY: number,
      tangentAngle: number,
      intensity: number,
      isAmbient: boolean = false
    ): SmokeParticle => {
      // Tangential velocity from wheel rotation + outward centrifugal momentum + thermal updraft
      const speed = isAmbient ? 0.3 + Math.random() * 0.8 : 0.8 + Math.random() * 2.2;
      const tangVX = -Math.sin(tangentAngle) * speed * 1.3;
      const tangVY = Math.cos(tangentAngle) * speed * 1.3;
      const radialDirX = Math.cos(tangentAngle);
      const radialDirY = Math.sin(tangentAngle);

      const radialSpeed = 0.5 + Math.random() * 1.4;
      const updraft = -0.2 - Math.random() * 0.5; // Natural warm smoke rising

      const vx = (tangVX + radialDirX * radialSpeed) * (0.8 + Math.random() * 0.4);
      const vy = (tangVY + radialDirY * radialSpeed + updraft) * (0.8 + Math.random() * 0.4);

      const initialSize = isAmbient ? 30 + Math.random() * 40 : 18 + Math.random() * 26;
      // Smoke grows as it spreads across the screen
      const maxSize = initialSize * (3.5 + Math.random() * 3.0);
      const maxLife = isAmbient ? 160 + Math.random() * 100 : 110 + Math.random() * 90;

      // Realistic random color distribution: early particles near rim are warm amber, drifting ones are soft ivory/slate fog
      const randColor = Math.random();
      const colorType: 'hot_amber' | 'ivory_white' | 'slate_fog' =
        randColor < 0.28 ? 'hot_amber' : randColor < 0.72 ? 'ivory_white' : 'slate_fog';

      // Organic puff shape with 3-4 sub-cloud spheres
      const puffBlobs = [
        { offsetX: 0, offsetY: 0, radiusRatio: 1.0 },
        { offsetX: (Math.random() - 0.5) * 0.7, offsetY: (Math.random() - 0.5) * 0.7, radiusRatio: 0.65 + Math.random() * 0.35 },
        { offsetX: (Math.random() - 0.5) * 0.7, offsetY: (Math.random() - 0.5) * 0.7, radiusRatio: 0.55 + Math.random() * 0.3 },
      ];

      // Max opacity increases progressively with spinElapsed (অল্প অল্প হয়ে হয়ে বেশি হবে)
      const baseAlpha = Math.min(0.28, 0.04 + intensity * 0.24);
      const maxAlpha = baseAlpha * (0.6 + Math.random() * 0.4);

      return {
        x: originX,
        y: originY,
        vx,
        vy,
        size: initialSize,
        maxSize,
        growthRate: (maxSize - initialSize) / (maxLife * 0.85),
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.035,
        alpha: 0,
        maxAlpha,
        life: 0,
        maxLife,
        colorType,
        puffBlobs,
      };
    };

    const createFrictionSpark = (originX: number, originY: number, tangentAngle: number): FrictionSpark => {
      const speed = 2.5 + Math.random() * 4.0;
      const vx = -Math.sin(tangentAngle) * speed + (Math.random() - 0.5) * 1.5;
      const vy = Math.cos(tangentAngle) * speed + (Math.random() - 0.5) * 1.5 - 0.5;
      return {
        x: originX,
        y: originY,
        vx,
        vy,
        size: 1.2 + Math.random() * 1.8,
        alpha: 0.95,
        life: 0,
        maxLife: 20 + Math.random() * 25,
      };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Get wheel geometry relative to viewport
      let wheelCenterX = width / 2;
      let wheelCenterY = height / 2;
      let wheelRadius = 140;

      if (wheelContainerRef.current) {
        const rect = wheelContainerRef.current.getBoundingClientRect();
        wheelCenterX = rect.left + rect.width / 2;
        wheelCenterY = rect.top + rect.height / 2;
        wheelRadius = rect.width / 2;
      }

      const elapsed = spinElapsedRef.current;
      const revealed = isResultRevealedRef.current;

      // Calculate smoke buildup intensity: starts at 0.1, ramps up smoothly over 5 seconds to 1.0 (অল্প অল্প হয়ে হয়ে বেশি হবে)
      let smokeIntensity = 0.1;
      if (!revealed) {
        smokeIntensity = Math.min(1.0, 0.12 + (elapsed / 4.5) * 0.88);
      } else {
        smokeIntensity = Math.max(0, 0.5 - (elapsed - 6) * 0.2);
      }

      // 2. Spawn new particles along the spinning wheel rim
      if (!revealed && smokeIntensity > 0.05) {
        // Number of particles spawned per frame increases as intensity builds up
        const spawnCount = Math.floor(1 + smokeIntensity * 4.5);

        for (let i = 0; i < spawnCount; i++) {
          // Angle around rim where friction occurs
          const theta = Math.random() * Math.PI * 2;
          // Spawn near the outer mahogany/brass rim perimeter
          const rimOffset = (Math.random() - 0.5) * 16;
          const r = wheelRadius * 0.94 + rimOffset;
          const originX = wheelCenterX + r * Math.cos(theta);
          const originY = wheelCenterY + r * Math.sin(theta);

          particlesRef.current.push(createSmokeParticle(originX, originY, theta, smokeIntensity, false));

          // Occasional friction sparks
          if (Math.random() < 0.35 * smokeIntensity) {
            sparksRef.current.push(createFrictionSpark(originX, originY, theta));
          }
        }

        // Secondary ambient smoke puffs drifting towards screen corners and edges for full display immersion
        if (elapsed > 1.5 && Math.random() < 0.45 * smokeIntensity) {
          const ambientTheta = Math.random() * Math.PI * 2;
          const ambientR = wheelRadius * (1.1 + Math.random() * 0.6);
          const ambX = wheelCenterX + ambientR * Math.cos(ambientTheta);
          const ambY = wheelCenterY + ambientR * Math.sin(ambientTheta);
          particlesRef.current.push(createSmokeParticle(ambX, ambY, ambientTheta, smokeIntensity, true));
        }
      }

      // 3. Draw Rotating Swirling Friction Aura Ring around Wheel Perimeter
      if (smokeIntensity > 0.15) {
        ctx.save();
        ctx.translate(wheelCenterX, wheelCenterY);
        ctx.rotate((elapsed * 1.5) % (Math.PI * 2));

        const haloGrad = ctx.createRadialGradient(0, 0, wheelRadius * 0.82, 0, 0, wheelRadius * 1.25);
        haloGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
        haloGrad.addColorStop(0.35, `rgba(251, 191, 36, ${0.12 * smokeIntensity})`);
        haloGrad.addColorStop(0.65, `rgba(226, 232, 240, ${0.09 * smokeIntensity})`);
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, wheelRadius * 1.25, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();
        ctx.restore();
      }

      // 4. Update and Render Smoke Particles
      const nextParticles: SmokeParticle[] = [];

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.life += 1;

        // Life cycle alpha: smooth ease-in, then gradual decay and diffusion
        const progress = p.life / p.maxLife;
        if (progress < 0.2) {
          p.alpha = (progress / 0.2) * p.maxAlpha;
        } else {
          p.alpha = (1 - (progress - 0.2) / 0.8) * p.maxAlpha;
        }

        // Expand size as smoke billows and dissipates
        if (p.size < p.maxSize) {
          p.size += p.growthRate;
        }

        // Velocity damping & natural swirling fluid motion
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.vy -= 0.04; // Gentle upward thermal buoyancy
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.life < p.maxLife && p.alpha > 0.002) {
          nextParticles.push(p);

          // Draw the smoke particle with multi-layered soft volumetric puffs
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          for (const blob of p.puffBlobs) {
            const bx = blob.offsetX * p.size;
            const by = blob.offsetY * p.size;
            const br = p.size * blob.radiusRatio;

            const puffGrad = ctx.createRadialGradient(bx, by, br * 0.05, bx, by, br);

            if (p.colorType === 'hot_amber') {
              // Warm golden friction smoke core near the rim
              puffGrad.addColorStop(0, `rgba(253, 224, 71, ${p.alpha * 1.1})`);
              puffGrad.addColorStop(0.3, `rgba(245, 158, 11, ${p.alpha * 0.85})`);
              puffGrad.addColorStop(0.65, `rgba(180, 83, 9, ${p.alpha * 0.45})`);
              puffGrad.addColorStop(1, 'rgba(120, 53, 15, 0)');
            } else if (p.colorType === 'ivory_white') {
              // Thick white-ivory smoke billow
              puffGrad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 1.0})`);
              puffGrad.addColorStop(0.35, `rgba(241, 245, 249, ${p.alpha * 0.8})`);
              puffGrad.addColorStop(0.7, `rgba(203, 213, 225, ${p.alpha * 0.4})`);
              puffGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
            } else {
              // Deep moody slate casino haze
              puffGrad.addColorStop(0, `rgba(226, 232, 240, ${p.alpha * 0.9})`);
              puffGrad.addColorStop(0.4, `rgba(148, 163, 184, ${p.alpha * 0.6})`);
              puffGrad.addColorStop(0.75, `rgba(71, 85, 105, ${p.alpha * 0.25})`);
              puffGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            }

            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fillStyle = puffGrad;
            ctx.fill();
          }

          ctx.restore();
        }
      }

      particlesRef.current = nextParticles;

      // 5. Update and Render Friction Sparks
      const nextSparks: FrictionSpark[] = [];
      for (let i = 0; i < sparksRef.current.length; i++) {
        const s = sparksRef.current[i];
        s.life += 1;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.96;
        s.vy *= 0.96;
        s.vy += 0.08; // Gravity on tiny sparks
        s.alpha = Math.max(0, 1 - s.life / s.maxLife);

        if (s.life < s.maxLife && s.alpha > 0.05) {
          nextSparks.push(s);

          ctx.save();
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(254, 240, 138, ${s.alpha})`;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.restore();
        }
      }
      sparksRef.current = nextSparks;

      // 6. Full Display Atmospheric Edge Haze (starts very subtle and gently covers the screen borders)
      if (smokeIntensity > 0.25) {
        ctx.save();
        const displayMistAlpha = Math.min(0.22, (smokeIntensity - 0.25) * 0.28);
        const screenGrad = ctx.createRadialGradient(
          wheelCenterX,
          wheelCenterY,
          wheelRadius * 0.9,
          wheelCenterX,
          wheelCenterY,
          Math.max(width, height) * 0.75
        );
        screenGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        screenGrad.addColorStop(0.4, `rgba(251, 191, 36, ${displayMistAlpha * 0.25})`);
        screenGrad.addColorStop(0.75, `rgba(226, 232, 240, ${displayMistAlpha * 0.5})`);
        screenGrad.addColorStop(1, `rgba(15, 23, 42, ${displayMistAlpha * 0.7})`);

        ctx.fillStyle = screenGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      prevRotationRef.current = wheelRotation;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [wheelContainerRef, wheelRotation, gamePhase]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-15 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
