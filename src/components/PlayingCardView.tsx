import React from 'react';
import { PlayingCard } from '../types';
import { Crown, Sparkles } from 'lucide-react';

interface PlayingCardViewProps {
  card?: PlayingCard;
  isFaceDown?: boolean;
  isWinningCard?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNewDealt?: boolean;
  sideBadge?: 'DRAGON' | 'TIGER' | 'JOKER' | 'MATCH';
}

export const PlayingCardView: React.FC<PlayingCardViewProps> = ({
  card,
  isFaceDown = false,
  isWinningCard = false,
  size = 'md',
  className = '',
  isNewDealt = false,
  sideBadge,
}) => {
  // Size dimensions - Ultra crisp and prominent
  const sizeClasses = {
    sm: 'w-10 h-14 text-xs rounded-lg',
    md: 'w-16 h-22 sm:w-20 sm:h-28 text-sm rounded-xl',
    lg: 'w-24 h-34 sm:w-32 sm:h-44 text-base rounded-2xl',
    xl: 'w-28 h-40 sm:w-36 sm:h-48 text-lg rounded-2xl',
  };

  if (isFaceDown || !card) {
    return (
      <div
        className={`relative ${sizeClasses[size]} bg-gradient-to-br from-red-900 via-rose-950 to-slate-950 border-2 border-amber-400 shadow-2xl flex items-center justify-center overflow-hidden transition-all transform select-none ${
          isNewDealt ? 'animate-in zoom-in-50 fade-in duration-300' : ''
        } ${className}`}
      >
        {/* Card Back Royal Pattern */}
        <div className="absolute inset-1 border border-amber-400/60 rounded-xl flex items-center justify-center bg-slate-950/70 overflow-hidden">
          {/* Subtle Diamond Mesh Texture */}
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:8px_8px]" />
          
          <div className="flex flex-col items-center justify-center p-1 text-center">
            <Crown className="w-5 h-5 sm:w-8 sm:h-8 text-amber-400 animate-pulse drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]" />
            <span className="text-[9px] sm:text-[11px] font-black font-mono tracking-widest text-amber-300 mt-1">
              BETGURU
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.color === 'red';
  const suitSymbol = card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠';

  return (
    <div
      className={`relative ${sizeClasses[size]} bg-white border-2 ${
        isWinningCard 
          ? 'border-amber-400 ring-4 ring-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,0.95)] animate-pulse scale-105 z-20' 
          : 'border-slate-300 shadow-2xl hover:shadow-cyan-500/20'
      } flex flex-col justify-between p-2 sm:p-2.5 overflow-hidden transition-all transform select-none ${
        isNewDealt ? 'animate-in zoom-in-75 slide-in-from-top-6 duration-300' : ''
      } ${className}`}
    >
      {/* Winning Badge or Side Badge Overlay */}
      {isWinningCard && (
        <div className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[9px] sm:text-[10px] font-black font-mono px-1.5 py-0.5 rounded-bl-lg shadow-lg flex items-center gap-0.5 z-30 animate-bounce">
          <Sparkles className="w-3 h-3 stroke-[3]" />
          <span>WINNER</span>
        </div>
      )}

      {sideBadge && !isWinningCard && (
        <div className={`absolute -top-0.5 -left-0.5 text-[8px] sm:text-[9px] font-black font-mono px-1.5 py-0.2 rounded-br-lg z-20 ${
          sideBadge === 'DRAGON' ? 'bg-red-600 text-white' :
          sideBadge === 'TIGER' ? 'bg-cyan-600 text-slate-950' :
          'bg-amber-500 text-slate-950'
        }`}>
          {sideBadge}
        </div>
      )}

      {/* Top Left Rank & Pip - High Contrast */}
      <div className={`flex flex-col items-center leading-none ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono tracking-tighter text-sm sm:text-lg leading-none">{card.rank}</span>
        <span className="text-xs sm:text-base -mt-0.5 font-bold leading-none">{suitSymbol}</span>
      </div>

      {/* Center Main Pip or Face Card Emblem */}
      <div className="flex flex-col items-center justify-center my-auto">
        {['J', 'Q', 'K'].includes(card.rank) ? (
          <div className={`flex flex-col items-center ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
            <Crown className="w-6 h-6 sm:w-10 sm:h-10 drop-shadow-md opacity-95" />
            <span className="text-[10px] sm:text-xs font-black font-mono opacity-90 mt-0.5">{card.rank}</span>
          </div>
        ) : (
          <span className={`text-2xl sm:text-5xl font-black ${isRed ? 'text-rose-600' : 'text-slate-900'} drop-shadow-md`}>
            {suitSymbol}
          </span>
        )}
      </div>

      {/* Bottom Right Inverted Rank & Pip */}
      <div className={`flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono tracking-tighter text-sm sm:text-lg leading-none">{card.rank}</span>
        <span className="text-xs sm:text-base -mt-0.5 font-bold leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
};
