import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Zap, Eye, Video, RotateCw } from 'lucide-react';
import dealerHandSpinImg from '../assets/images/roulette_hand_spin_1787485265551.jpg';
import dealerActionImg from '../assets/images/roulette_dealer_action_1787485284877.jpg';
import dealerWelcomeImg from '../assets/images/roulette_dealer_welcome_1787484882512.jpg';
import dealerResultImg from '../assets/images/roulette_dealer_result_1787484902160.jpg';
import dealerSpeakingImg from '../assets/images/roulette_dealer_speaking_1787485687844.jpg';

interface DealerVideoStageProps {
  dealerImage: string;
  gamePhase: 'betting' | 'lightning' | 'spinning' | 'settled';
  countdown: number;
  selectedLanguage: 'bn' | 'hi' | 'en';
  winningNumber: number | null;
  userWonAmount: number;
  dealerMessage: string;
  isMuted: boolean;
  activeLanguageLabel: string;
  lightningNumbers: { number: number; multiplier: number }[];
  getNumberColor: (num: number) => 'green' | 'red' | 'black';
}

export const DealerVideoStage: React.FC<DealerVideoStageProps> = ({
  dealerImage,
  gamePhase,
  countdown,
  selectedLanguage,
  winningNumber,
  userWonAmount,
  dealerMessage,
  isMuted,
  activeLanguageLabel,
  lightningNumbers,
  getNumberColor
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraMode, setCameraMode] = useState<'auto' | 'hand' | 'studio'>('auto');
  const [spinSecondsElapsed, setSpinSecondsElapsed] = useState<number>(0);
  const [isSpeakingMouthOpen, setIsSpeakingMouthOpen] = useState<boolean>(false);

  // Track sub-phase timing during spin to transition camera angles smoothly
  useEffect(() => {
    if (gamePhase === 'spinning') {
      setSpinSecondsElapsed(0);
      const interval = setInterval(() => {
        setSpinSecondsElapsed((prev) => prev + 0.2);
      }, 200);
      return () => clearInterval(interval);
    } else {
      setSpinSecondsElapsed(0);
    }
  }, [gamePhase]);

  // Realistic Lip Sync / Mouth Talking Animation while Dealer talks
  useEffect(() => {
    if (!dealerMessage) return;
    const interval = setInterval(() => {
      setIsSpeakingMouthOpen((prev) => !prev);
    }, 220);
    return () => clearInterval(interval);
  }, [dealerMessage]);

  // Determine active dynamic frame based on real-time dealer hand action & speech
  let activeFrameImg = isSpeakingMouthOpen ? dealerSpeakingImg : dealerWelcomeImg;

  if (gamePhase === 'settled' && userWonAmount > 0) {
    activeFrameImg = dealerResultImg;
  } else if (gamePhase === 'lightning') {
    activeFrameImg = isSpeakingMouthOpen ? dealerSpeakingImg : dealerActionImg;
  } else if (gamePhase === 'spinning') {
    if (cameraMode === 'hand') {
      activeFrameImg = dealerHandSpinImg;
    } else if (cameraMode === 'studio') {
      activeFrameImg = isSpeakingMouthOpen ? dealerSpeakingImg : dealerActionImg;
    } else {
      // Auto mode: First 2.5s show close-up hand releasing & spinning the ball, then transition to full action
      activeFrameImg = spinSecondsElapsed < 2.5 ? dealerHandSpinImg : (isSpeakingMouthOpen ? dealerSpeakingImg : dealerActionImg);
    }
  } else if (gamePhase === 'settled') {
    activeFrameImg = isSpeakingMouthOpen ? dealerSpeakingImg : dealerResultImg;
  } else {
    activeFrameImg = isSpeakingMouthOpen ? dealerSpeakingImg : dealerWelcomeImg;
  }

  // High-FPS realistic physics canvas animation of the hand-flicked marble ball
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let ballAngle = 0;
    let ballRadius = 0;
    let ballSpeed = 0.12;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (gamePhase === 'spinning' || gamePhase === 'lightning') {
        const isHandCloseUp = activeFrameImg === dealerHandSpinImg;
        
        // Dynamic centers & radius depending on camera mode
        const centerX = isHandCloseUp ? canvas.width * 0.52 : canvas.width * 0.62;
        const centerY = isHandCloseUp ? canvas.height * 0.58 : canvas.height * 0.68;
        const radiusX = isHandCloseUp ? canvas.width * 0.38 : canvas.width * 0.28;
        const radiusY = isHandCloseUp ? canvas.height * 0.24 : canvas.height * 0.16;

        ballSpeed = Math.max(0.04, ballSpeed * 0.999);
        ballAngle += ballSpeed;

        // Glowing Golden Track on Mahogany Rim
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = isHandCloseUp ? 4 : 2.5;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
        ctx.shadowBlur = 12;
        ctx.stroke();

        // 1. Hand Flick Release Sparkles (during first 1.5 seconds of spin)
        if (gamePhase === 'spinning' && spinSecondsElapsed < 1.8) {
          const handX = centerX + radiusX * 0.8;
          const handY = centerY - radiusY * 0.6;
          
          // Kinetic launch ring
          ctx.beginPath();
          ctx.arc(handX, handY, 15 * (spinSecondsElapsed / 1.8), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - spinSecondsElapsed / 1.8})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sparkle burst
          for (let p = 0; p < 8; p++) {
            const angle = (p * Math.PI) / 4;
            const dist = 10 + spinSecondsElapsed * 15;
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(handX + Math.cos(angle) * dist, handY + Math.sin(angle) * dist, 2.5, 2.5);
          }
        }

        // 2. High-Velocity Motion Trail behind Marble
        for (let i = 1; i <= 8; i++) {
          const trailAngle = ballAngle - i * 0.07;
          const trailX = centerX + Math.cos(trailAngle) * radiusX;
          const trailY = centerY + Math.sin(trailAngle) * radiusY;
          ctx.beginPath();
          ctx.arc(trailX, trailY, Math.max(1, (isHandCloseUp ? 5 : 3.5) - i * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.45 - i * 0.05})`;
          ctx.shadowBlur = 0;
          ctx.fill();
        }

        // 3. Real 3D Ivory Marble Ball
        const bx = centerX + Math.cos(ballAngle) * radiusX;
        const by = centerY + Math.sin(ballAngle) * radiusY;
        const ballSize = isHandCloseUp ? 6.5 : 4.8;

        ctx.shadowColor = 'rgba(255, 255, 255, 1)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, ballSize);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#f8fafc');
        grad.addColorStop(0.85, '#cbd5e1');
        grad.addColorStop(1, '#64748b');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gamePhase, activeFrameImg, spinSecondsElapsed]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-amber-500/40 bg-black shadow-[0_0_25px_rgba(0,0,0,0.8)] select-none group">
      {/* 1. Base Video Frame (Dealer Dynamic Action Shot) */}
      <img
        src={activeFrameImg}
        alt="Live Roulette Dealer Saanvi Hand Spinning Ball"
        className={`w-full h-full object-cover object-center transition-all duration-500 ${
          gamePhase === 'spinning' && activeFrameImg === dealerHandSpinImg
            ? 'scale-110 filter brightness-110 contrast-105'
            : gamePhase === 'spinning'
            ? 'scale-105 filter brightness-105'
            : 'scale-100'
        }`}
      />

      {/* 2. Realistic Studio Lighting & Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none" />

      {/* 3. Physical Hand-Flicked Marble Animation Canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={260}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 4. Live Stream Header Overlay */}
      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 z-20">
        <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-rose-500/60 flex items-center gap-1 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider font-mono">LIVE HD</span>
        </div>
        <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-amber-500/40 flex items-center gap-1 shadow-lg">
          <span className="text-[9px] font-black text-amber-300 font-mono">Host: Saanvi</span>
        </div>
        <div className="px-1.5 py-0.5 rounded-md bg-amber-500/20 backdrop-blur-md border border-amber-400/50 flex items-center gap-1">
          <span className="text-[8px] font-bold text-yellow-300 font-mono">🌐 {activeLanguageLabel}</span>
        </div>
      </div>

      {/* 4.1 Camera Angle Switcher (Auto / Hand Zoom / Studio View) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
        {gamePhase === 'betting' ? (
          <div className="px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-black/90 to-amber-950/90 border-2 border-amber-400 backdrop-blur-md flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.6)]">
            <span className="text-[9px] font-bold text-amber-300 uppercase font-mono">Place Bets:</span>
            <span className={`text-xs font-black font-mono px-1.5 py-0.2 rounded ${
              countdown <= 5 ? 'bg-rose-600 text-white animate-bounce shadow-[0_0_10px_#f43f5e]' : 'bg-black text-amber-300'
            }`}>
              ⏱ {countdown}s
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-0.5 rounded-lg border border-amber-500/40 shadow-lg">
            <button
              onClick={() => setCameraMode('auto')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition cursor-pointer ${
                cameraMode === 'auto' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
              }`}
              title="Automatic Dynamic Camera Switch"
            >
              🎥 Auto
            </button>
            <button
              onClick={() => setCameraMode('hand')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition cursor-pointer flex items-center gap-0.5 ${
                cameraMode === 'hand' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
              }`}
              title="Close-Up Hand Ball Spin View"
            >
              ✋ Hand
            </button>
            <button
              onClick={() => setCameraMode('studio')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition cursor-pointer ${
                cameraMode === 'studio' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
              }`}
              title="Studio Panoramic View"
            >
              🏛 Studio
            </button>
          </div>
        )}
      </div>

      {/* 5. Phase-Specific Visual Overlays */}

      {/* 5.2 Lightning Phase: Golden Electric Frame Showcase */}
      {gamePhase === 'lightning' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-20 animate-in fade-in duration-300">
          <div className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black font-mono text-xs uppercase tracking-wider mb-2 shadow-[0_0_15px_rgba(245,158,11,0.9)] animate-pulse flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>LIGHTNING NUMBERS STRIKING</span>
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
          </div>
          <div className="flex items-center gap-2">
            {lightningNumbers.map((l) => (
              <div
                key={l.number}
                className="w-13 h-13 rounded-xl border-2 border-amber-400 bg-black/90 flex flex-col items-center justify-between p-1 shadow-[0_0_16px_rgba(245,158,11,0.8)] animate-lightning-strike"
              >
                <div className="w-full flex-1 flex items-center justify-center">
                  <span className={`text-base font-black font-mono ${
                    getNumberColor(l.number) === 'red' ? 'text-rose-400' : l.number === 0 ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {l.number}
                  </span>
                </div>
                <div className="w-full py-0.2 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-[8px] rounded text-center font-mono">
                  ⚡{l.multiplier}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5.3 Spinning Phase: Kinetic Hand Release Notification */}
      {gamePhase === 'spinning' && (
        <div className="absolute top-8 right-2 z-20 animate-in fade-in">
          <div className="px-2.5 py-1 rounded-xl bg-black/90 border border-yellow-400 backdrop-blur-md flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.7)]">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
            <span className="text-[9px] font-black text-yellow-300 font-mono uppercase tracking-wider">
              {activeFrameImg === dealerHandSpinImg 
                ? (selectedLanguage === 'bn' ? '✋ হাত দিয়ে বল ছোড়া হচ্ছে...' : selectedLanguage === 'hi' ? '✋ हाथ से गेंद घुमाई जा रही है...' : '✋ Hand spinning marble...')
                : (selectedLanguage === 'bn' ? '🌀 হুইলে বল তীব্র বেগে ঘুরছে...' : selectedLanguage === 'hi' ? '🌀 पहिए पर गेंद घूम रही है...' : '🌀 Ball spinning on wheel...')}
            </span>
          </div>
        </div>
      )}

      {/* 5.4 Settled Phase: Winning Number Spotlight */}
      {gamePhase === 'settled' && winningNumber !== null && (
        <div className="absolute top-2 right-2 z-20 animate-in zoom-in-95 duration-200">
          <div className="px-3 py-1 rounded-xl bg-black/95 border-2 border-amber-400 backdrop-blur-md flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.9)]">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-base text-white border ${
              getNumberColor(winningNumber) === 'red' ? 'bg-rose-600 border-rose-400 shadow-[0_0_8px_#f43f5e]' :
              getNumberColor(winningNumber) === 'green' ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_8px_#10b981]' :
              'bg-slate-950 border-slate-700'
            }`}>
              {winningNumber}
            </div>
            <div className="text-left font-mono">
              <span className="text-[8px] font-bold text-amber-400 block uppercase">
                {getNumberColor(winningNumber)} • {winningNumber === 0 ? 'Zero' : winningNumber % 2 === 0 ? 'Even' : 'Odd'}
              </span>
              <span className="text-[9px] font-black text-white block">
                {winningNumber <= 18 && winningNumber !== 0 ? 'Low (1-18)' : winningNumber > 18 ? 'High (19-36)' : 'Single 0'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Victory Overlay Toast */}
      {gamePhase === 'settled' && userWonAmount > 0 && (
        <div className="absolute inset-x-4 bottom-10 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border border-white text-slate-950 font-mono font-black text-center shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-bounce z-30">
          <span className="text-[10px] uppercase tracking-wider block">🎉 CONGRATULATIONS! WINNER! 🎉</span>
          <span className="text-xs sm:text-sm">₹{userWonAmount.toLocaleString('en-IN')} WON!</span>
        </div>
      )}

      {/* 7. Live Subtitle Ticker Bar */}
      <div className="absolute inset-x-0 bottom-0 py-1 px-2.5 bg-black/90 backdrop-blur-md border-t border-amber-500/30 flex items-center justify-between text-[10px] font-mono text-amber-300 z-20">
        <p className="truncate font-bold leading-tight max-w-[85%]">{dealerMessage}</p>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[8px] font-bold text-emerald-400">AUDIO ON</span>
        </div>
      </div>
    </div>
  );
};
