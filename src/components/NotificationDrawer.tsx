import React from 'react';
import { 
  X, Bell, CheckCircle2, XCircle, Trophy, Megaphone, Check, Trash2, 
  Wallet, ArrowUpRight, Crown, Flame, Zap, Swords, Award, Gift, Tag, Ticket, MessageSquare, Clock, User, Settings, Sparkles
} from 'lucide-react';
import { NotificationItem } from '../types';
import { soundFx } from '../utils/audio';
import { resolveNotificationDestination, NotificationActionType } from '../utils/notificationRouting';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onRemoveNotification?: (id: string) => void;
  onNotificationClick?: (notification: NotificationItem) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onRemoveNotification,
  onNotificationClick
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: NotificationItem['type'], actionType?: NotificationActionType) => {
    if (actionType === 'crash') return <Flame className="w-5 h-5 text-rose-400 animate-pulse" />;
    if (actionType === 'roulette') return <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />;
    if (actionType === 'dragon_tiger') return <Swords className="w-5 h-5 text-red-400" />;
    if (actionType === 'andar_bahar') return <Award className="w-5 h-5 text-teal-400" />;
    if (actionType === 'lucky_wheel') return <Gift className="w-5 h-5 text-purple-400 animate-bounce" />;
    if (actionType === 'support') return <MessageSquare className="w-5 h-5 text-blue-400" />;
    if (actionType === 'supercar') return <Crown className="w-5 h-5 text-amber-400" />;
    if (actionType === 'offers') return <Tag className="w-5 h-5 text-pink-400" />;

    switch (type) {
      case 'win':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'deposit':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-5 h-5 text-amber-400" />;
      case 'loss':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'system':
      default:
        return <Megaphone className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getActionIcon = (actionType: NotificationActionType) => {
    switch (actionType) {
      case 'deposit':
        return <Wallet className="w-3.5 h-3.5" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'lottery':
      case 'results':
        return <Trophy className="w-3.5 h-3.5" />;
      case 'supercar':
        return <Crown className="w-3.5 h-3.5" />;
      case 'crash':
        return <Flame className="w-3.5 h-3.5" />;
      case 'roulette':
        return <Zap className="w-3.5 h-3.5" />;
      case 'dragon_tiger':
        return <Swords className="w-3.5 h-3.5" />;
      case 'andar_bahar':
        return <Award className="w-3.5 h-3.5" />;
      case 'lucky_wheel':
        return <Gift className="w-3.5 h-3.5" />;
      case 'offers':
        return <Tag className="w-3.5 h-3.5" />;
      case 'tickets':
        return <Ticket className="w-3.5 h-3.5" />;
      case 'support':
        return <MessageSquare className="w-3.5 h-3.5" />;
      case 'history':
        return <Clock className="w-3.5 h-3.5" />;
      case 'profile':
        return <User className="w-3.5 h-3.5" />;
      case 'settings':
        return <Settings className="w-3.5 h-3.5" />;
      default:
        return <ArrowUpRight className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-950 border-l border-amber-500/20 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
              )}
            </div>
            <h2 className="text-base font-extrabold text-white font-mono">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={() => { soundFx.playClick(); onMarkAllRead(); }}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors"
                title="Mark all as read"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={() => { soundFx.playClick(); onClearAll(); }}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Header Bar */}
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-950/40 border-b border-amber-500/20 px-4 py-2 text-[11px] text-amber-300 font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />
            <span>নোটিফিকেশনে ক্লিক করলেই সরাসরি সেই অপশনে চলে যান</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Live Synced
          </span>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-20 text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-300">কোন নোটিফিকেশন নেই</p>
              <p className="text-xs text-slate-500">আপনার সমস্ত ডিপোজিট, উইথড্রয়াল ও গেম এলার্ট এখানে প্রদর্শিত হবে</p>
            </div>
          ) : (
            notifications.map((ntf, idx) => {
              const destInfo = resolveNotificationDestination(ntf);
              return (
                <div
                  key={`${ntf.id || 'ntf'}_${idx}`}
                  onClick={() => {
                    soundFx.playClick();
                    if (onNotificationClick) {
                      onNotificationClick(ntf);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all relative group cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    ntf.read
                      ? 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700 text-slate-400'
                      : 'bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/25 border-amber-500/40 hover:border-amber-400/80 text-white shadow-xl ring-1 ring-amber-500/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 shadow-inner">
                      {getIcon(ntf.type, destInfo.actionType)}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap truncate">
                          <h4 className={`text-xs font-extrabold truncate font-mono ${ntf.read ? 'text-slate-200' : 'text-amber-200'}`}>
                            {ntf.title}
                          </h4>
                          {ntf.priority && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {ntf.priority}
                            </span>
                          )}
                          {ntf.isGlobal && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Broadcast
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{ntf.date}</span>
                      </div>
                      
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{ntf.message}</p>

                      {ntf.channels && ntf.channels.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {ntf.channels.map((ch, cIdx) => (
                            <span key={cIdx} className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                              {ch}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Interactive Direct Navigation CTA Button */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold font-mono px-2.5 py-1 rounded-xl border transition-all ${destInfo.badgeBg} ${destInfo.badgeText} ${destInfo.badgeBorder} group-hover:brightness-125`}>
                          {getActionIcon(destInfo.actionType)}
                          <span>{destInfo.labelBn}</span>
                        </span>
                        
                        <span className="text-[10px] text-amber-400/90 font-mono font-bold flex items-center gap-0.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                          <span>যান</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    {/* Delete individual notification button */}
                    {onRemoveNotification && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          soundFx.playClick();
                          onRemoveNotification(ntf.id);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                        title="Permanently remove notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
