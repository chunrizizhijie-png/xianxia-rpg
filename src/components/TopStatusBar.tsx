import React from 'react';
import {
  Clock,
  Heart,
  Zap,
  Sword,
  Shield,
  Eye,
  Sparkles,
  Gem,
  Settings,
} from 'lucide-react';
import { PlayerState, RealmConfig } from '../types/game';
import { formatAge } from '../engine/gameEngine';

interface TopStatusBarProps {
  player: PlayerState;
  realm: RealmConfig;
  effectiveAtk: number;
  effectiveDef: number;
  onOpenSettings: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  player,
  realm,
  effectiveAtk,
  effectiveDef,
  onOpenSettings,
}) => {
  const ageYears = player.ageMonths / 12;
  const lifespanPct = Math.min(100, (ageYears / player.lifespanCapYears) * 100);
  const nearDeath = lifespanPct >= 85;

  return (
    <header className="xuan-card rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Identity + Realm */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#c5a059]/15 border border-[#c5a059]/45 flex items-center justify-center text-[#e2c488] font-bold text-lg">
          {player.daoName.slice(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-[#e2c488]">
              {player.daoName}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e2c488]">
              {realm.name}
            </span>
            {player.injury > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-red-950/70 border border-red-500/40 text-red-300">
                内伤 {player.injury}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <Clock
              className={`w-3.5 h-3.5 ${
                nearDeath ? 'text-red-400 animate-pulse' : 'text-[#c5a059]'
              }`}
            />
            <span className={nearDeath ? 'text-red-300 font-semibold' : 'text-stone-300'}>
              寿元：{formatAge(player.ageMonths)} / {player.lifespanCapYears} 年
            </span>
            <div className="w-20 h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  nearDeath ? 'bg-red-500' : 'bg-[#c5a059]'
                }`}
                style={{ width: `${lifespanPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Core Stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5" title="气血">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-stone-400">气血</span>
          <span className="font-semibold text-rose-200">
            {player.hp}/{player.maxHp}
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="灵力">
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-stone-400">灵力</span>
          <span className="font-semibold text-sky-200">
            {player.mp}/{player.maxMp}
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="攻击">
          <Sword className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-stone-400">攻击</span>
          <span className="font-semibold text-stone-100">{effectiveAtk}</span>
        </div>
        <div className="flex items-center gap-1.5" title="防御">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-stone-400">防御</span>
          <span className="font-semibold text-stone-100">{effectiveDef}</span>
        </div>
        <div className="flex items-center gap-1.5" title="神识">
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-stone-400">神识</span>
          <span className="font-semibold text-stone-100">{player.sense}</span>
        </div>
        <div className="flex items-center gap-1.5" title="气运">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-stone-400">气运</span>
          <span className="font-semibold text-yellow-200">{player.luck}</span>
        </div>
        <div className="flex items-center gap-1.5" title="灵石">
          <Gem className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-stone-400">灵石</span>
          <span className="font-semibold text-teal-200">{player.spiritStones}</span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f242d] hover:bg-[#2a303c] border border-[#c5a059]/35 text-[#e2c488] transition"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>存档 / JSON扩展</span>
        </button>
      </div>
    </header>
  );
};
