import React, { useState } from 'react';
import { Menu, Home, Flame, ArrowUpRight, Ticket, User as UserIcon, Disc, Award, Sparkles, X, ChevronRight, Zap, Gift } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { 
  bannerAviatorCrashImg, 
  andarBaharBannerImg, 
  rouletteBannerImg, 
  dragonTigerBannerImg 
} from '../assets/casinoBanners';
import { LiveOnlinePlayerCounter } from './LiveOnlinePlayerCounter';

export type NavTab = 'home' | 'lottery' | 'withdrawal' | 'tickets' | 'history' | 'results' | 'lucky_wheel' | 'profile' | 'offers' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMenu?: () => void;
  activeTicketsCount: number;
  unreadSupportCount?: number;
  onOpenRoulette?: () => void;
  onOpenAndarBahar?: () => void;
  onOpenCrash?: () => void;
  onOpenDragonTiger?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  activeTab,
  onSelectTab,
  onOpenMenu,
  activeTicketsCount,
  unreadSupportCount = 0,
  onOpenRoulette,
  onOpenAndarBahar,
  onOpenCrash,
  onOpenDragonTiger
}) => {
  const [isCasinoMenuOpen, setIsCasinoMenuOpen] = useState<boolean>(false);

  const tabs = [
    { 
      id: 'home' as NavTab, 
      label: 'Home', 
      icon: Home,
      animationClass: 'group-hover:scale-110 group-active:scale-95'
    },
    { 
      id: 'lottery' as NavTab, 
      label: 'Lottery', 
      icon: Flame,
      animationClass: 'group-hover:scale-110 group-active:scale-95'
    },
    { 
      id: 'tickets' as NavTab, 
      label: 'Tickets', 
      icon: Ticket, 
      badge: activeTicketsCount,
      animationClass: 'group-hover:-rotate-12 group-active:rotate-0'
    },
    { 
      id: 'profile' as NavTab, 
      label: 'Profile', 
      icon: UserIcon,
      animationClass: 'group-hover:-translate-y-1 group-active:translate-y-0'
    }
  ];

  const handleCasinoClick = () => {
    soundFx.playClick();
    setIsCasinoMenuOpen(true);
  };

  return (
    <>
      {/* Casino Selection Bottom Sheet Modal */}
      {isCasinoMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-in fade-in"
          onClick={() => setIsCasinoMenuOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4 font-mono animate-in slide-in-from-bottom-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">BETGURU LIVE CASINO</h3>
                  <p className="text-[10px] text-amber-300">Select a real-time HD casino game to play</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCasinoMenuOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Dragon Tiger Live Card */}
              {onOpenDragonTiger && (
                <div
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenDragonTiger();
                  }}
                  className="rainbow-spin-border-wrap group !min-h-[88px] cursor-pointer"
                >
                  <div className="rainbow-spin-border-inner !min-h-[84px] p-3.5 flex items-center justify-between text-left relative">
                    <img 
                      src={dragonTigerBannerImg} 
                      alt="Dragon Tiger Live Casino" 
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-400/50 flex items-center justify-center text-2xl shadow-md backdrop-blur-sm">
                        🐉
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white uppercase tracking-wide">Dragon Tiger Live</span>
                          <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                            HD LIVE
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <LiveOnlinePlayerCounter gameKey="dragon_tiger" size="compact" showBengaliLabel={false} />
                        </div>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-2">
                      <div className="casino-btn-vibe-red px-2.5 py-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black rounded-lg border border-red-300/80 shadow flex items-center gap-0.5 group-hover:scale-105 transition-transform">
                        <span>PLAY</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Aviator Crash Card */}
              {onOpenCrash && (
                <div
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenCrash();
                  }}
                  className="rainbow-spin-border-wrap group !min-h-[88px] cursor-pointer"
                >
                  <div className="rainbow-spin-border-inner !min-h-[84px] p-3.5 flex items-center justify-between text-left relative">
                    <img 
                      src={bannerAviatorCrashImg} 
                      alt="Aviator Crash Game" 
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-rose-600/30 border border-rose-400/50 flex items-center justify-center text-2xl shadow-md backdrop-blur-sm">
                        ✈️
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white uppercase tracking-wide">Aviator Crash</span>
                          <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                            POPULAR
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <LiveOnlinePlayerCounter gameKey="aviator" size="compact" showBengaliLabel={false} />
                        </div>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-2">
                      <div className="casino-btn-vibe-rose px-2.5 py-1 bg-gradient-to-r from-rose-600 to-red-600 text-white text-[10px] font-black rounded-lg border border-rose-300/80 shadow flex items-center gap-0.5 group-hover:scale-105 transition-transform">
                        <span>FLY</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Andar Bahar Card */}
              {onOpenAndarBahar && (
                <div
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenAndarBahar();
                  }}
                  className="rainbow-spin-border-wrap group !min-h-[88px] cursor-pointer"
                >
                  <div className="rainbow-spin-border-inner !min-h-[84px] p-3.5 flex items-center justify-between text-left relative">
                    <img 
                      src={andarBaharBannerImg} 
                      alt="Andar Bahar" 
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-400/50 flex items-center justify-center text-2xl shadow-md backdrop-blur-sm">
                        🎴
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white uppercase tracking-wide">Andar Bahar</span>
                          <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                            HOT NEW
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <LiveOnlinePlayerCounter gameKey="andar_bahar" size="compact" showBengaliLabel={false} />
                        </div>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-2">
                      <div className="casino-btn-vibe-emerald px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black rounded-lg border border-emerald-300/80 shadow flex items-center gap-0.5 group-hover:scale-105 transition-transform">
                        <span>PLAY</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lightning Roulette Card */}
              {onOpenRoulette && (
                <div
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenRoulette();
                  }}
                  className="rainbow-spin-border-wrap group !min-h-[88px] cursor-pointer"
                >
                  <div className="rainbow-spin-border-inner !min-h-[84px] p-3.5 flex items-center justify-between text-left relative">
                    <img 
                      src={rouletteBannerImg} 
                      alt="Lightning Roulette" 
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-transparent pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-600/30 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-md backdrop-blur-sm">
                        <Disc className="w-6 h-6 animate-spin [animation-duration:8s]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-1">
                            <span>⚡</span> Lightning Roulette
                          </span>
                          <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                            500x LIVE
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <LiveOnlinePlayerCounter gameKey="roulette" size="compact" showBengaliLabel={false} />
                        </div>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-2">
                      <div className="casino-btn-vibe-amber px-2.5 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-[10px] font-black rounded-lg border border-amber-200/90 shadow flex items-center gap-0.5 group-hover:scale-105 transition-transform">
                        <span>PLAY</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Maintenance Notice if all live casino games are disabled */}
              {!onOpenCrash && !onOpenAndarBahar && !onOpenRoulette && (
                <div className="p-4 text-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono space-y-1">
                  <div className="font-bold text-white flex items-center justify-center gap-1.5">
                    <span>🛠️</span> Live Casino Maintenance
                  </div>
                  <p className="text-[11px] text-amber-300/80">All live casino tables are temporarily under scheduled maintenance. Please check back shortly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-amber-500/30 backdrop-blur-xl px-1.5 py-1.5 shadow-2xl shadow-black gpu-accelerate">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {/* Menu Button on the Far Left of Home */}
          {onOpenMenu && (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenMenu();
              }}
              className="group relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 text-slate-400 hover:text-amber-300 active:opacity-50 active:scale-90 cursor-pointer"
              title={unreadSupportCount > 0 ? `${unreadSupportCount} unread support messages` : "Open Navigation Menu"}
            >
              <div className="relative">
                <Menu className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] transition-transform duration-200 ease-out group-hover:scale-110 ${
                  unreadSupportCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400 group-hover:text-amber-300'
                }`} />

                {/* Blinking indicator when unread support message exists */}
                {unreadSupportCount > 0 && (
                  <>
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border border-slate-950 shadow-md shadow-rose-500/50 animate-bounce">
                      {unreadSupportCount}
                    </span>
                    <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-rose-400 rounded-full animate-ping pointer-events-none" />
                  </>
                )}
              </div>
              <span className={`text-[9px] sm:text-[10px] mt-0.5 tracking-tight font-medium transition-colors ${
                unreadSupportCount > 0 ? 'text-amber-300 font-bold' : 'text-slate-400 group-hover:text-amber-200'
              }`}>
                Menu
              </span>
            </button>
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  onSelectTab(tab.id);
                }}
                className={`group relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 active:opacity-50 active:scale-90 cursor-pointer ${
                  isActive
                    ? 'text-amber-400 font-extrabold scale-105'
                    : 'text-slate-400 hover:text-slate-100 font-medium'
                }`}
              >
                {/* Highlight Glow for Active Tab */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-2xl blur-xs -z-10 animate-pulse"></div>
                )}

                <div className="relative">
                  <Icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] transition-transform duration-200 ease-out ${tab.animationClass} ${
                      isActive
                        ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                        : 'text-slate-400 group-hover:text-amber-300'
                    }`}
                  />

                  {/* Badge if available */}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-bounce">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>

                <span className={`text-[9px] sm:text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${isActive ? 'text-amber-300 font-bold' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {tab.label}
                </span>

                {/* Active Indicator Pill */}
                {isActive && (
                  <div className="w-4 h-0.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-full mt-0.5 shadow-sm shadow-amber-500/50"></div>
                )}
              </button>
            );
          })}

          {/* Dedicated Live Casino Launcher */}
          {(onOpenRoulette || onOpenAndarBahar) && (
            <button
              onClick={handleCasinoClick}
              className="group relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 text-amber-400 font-extrabold active:opacity-50 active:scale-90 cursor-pointer"
              title="Play Live Casino (Andar Bahar & Roulette)"
            >
              <div className="relative">
                <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-spin [animation-duration:6s] drop-shadow-[0_0_12px_rgba(245,158,11,0.7)] group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[7px] font-black px-1 py-0.2 rounded-full animate-pulse border border-rose-400 shadow-md">
                  LIVE
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight text-amber-300 font-bold group-hover:text-amber-200">
                Casino
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
});

