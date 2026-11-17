import React, { useState } from 'react';
import { Flame, ShieldAlert, Sparkles, X, HeartHandshake } from 'lucide-react';
import { PlayerState, RealmConfig } from '../types/game';
import {
  calculateBreakthroughRate,
  getRecommendedBreakthroughPill,
} from '../engine/gameEngine';

interface BreakthroughModalProps {
  player: PlayerState;
  currentRealm: RealmConfig;
  nextRealm?: RealmConfig;
  onAttempt: (
    useMainPill: boolean,
    useHeartGuardPill: boolean,
    spendLuck: boolean
  ) => void;
  onClose: () => void;
}

export const BreakthroughModal: React.FC<BreakthroughModalProps> = ({
  player,
  currentRealm,
  nextRealm,
  onAttempt,
  onClose,
}) => {
  const [useMainPill, setUseMainPill] = useState(true);
  const [useHeartGuard, setUseHeartGuard] = useState(false);
  const [spendLuck, setSpendLuck] = useState(false);

  const recPill = getRecommendedBreakthroughPill(currentRealm);
  const mainPillCount = player.inventory[recPill.pillId] ?? 0;
  const heartGuardCount = player.inventory.heart_guard_pill ?? 0;
  const dualBonus = player.nextBreakthroughBonus ?? 0;

  const rate = calculateBreakthroughRate(
    player,
    currentRealm,
    useMainPill && mainPillCount > 0,
    useHeartGuard && heartGuardCount > 0,
    spendLuck && player.luck >= 9
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-lg w-full p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#c5a059]" />
            <h3 className="text-lg font-bold text-[#e2c488]">
              {currentRealm.isMajorBottleneck ? '⚡ 冲击大境界天堑' : '冲击境界瓶颈'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="xuan-panel rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-400">当前境界</p>
            <p className="text-base font-bold text-stone-200">{currentRealm.name}</p>
          </div>
          <span className="text-[#c5a059] text-lg">→</span>
          <div className="text-right">
            <p className="text-xs text-stone-400">目标境界</p>
            <p className="text-base font-bold text-[#e2c488]">
              {nextRealm ? nextRealm.name : '已达巅峰'}
            </p>
          </div>
        </div>

        <div className="text-center py-1">
          <p className="text-xs text-stone-400">
            推演本次渡劫突破成功率（要求神识基准：{currentRealm.baseSense}，当前：{player.sense}）
          </p>
          <p
            className={`text-4xl font-bold mt-1 ${
              rate >= 70
                ? 'text-emerald-400'
                : rate >= 45
                  ? 'text-[#e2c488]'
                  : 'text-rose-400'
            }`}
          >
            {rate}%
          </p>
          {dualBonus > 0 && (
            <p className="text-xs text-pink-300 mt-1 inline-flex items-center gap-1">
              <HeartHandshake className="w-3.5 h-3.5" />
              已激活道侣双修元阴护持：成功率 +{dualBonus}%
            </p>
          )}
        </div>

        {/* Boost Options */}
        <div className="space-y-2.5 text-xs">
          <label
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
              mainPillCount > 0
                ? 'border-[#c5a059]/30 bg-[#12151b] hover:border-[#c5a059]'
                : 'border-rose-500/30 bg-rose-950/20 opacity-75 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                disabled={mainPillCount <= 0}
                checked={useMainPill && mainPillCount > 0}
                onChange={(e) => setUseMainPill(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <div>
                <p className="font-semibold text-stone-200">
                  投入本阶专属破境丹【{recPill.pillName}】（库存：{mainPillCount}）
                </p>
                <p className="text-stone-400">
                  {mainPillCount > 0
                    ? `对症丹药，大幅提升 ${recPill.bonus}% 成功率`
                    : `缺少【${recPill.pillName}】！可在丹器造化炉炼制、坊市购入或助女修夺宝获取`}
                </p>
              </div>
            </div>
            <span className="text-emerald-400 font-semibold shrink-0">
              +{recPill.bonus}%
            </span>
          </label>

          <label
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
              heartGuardCount > 0
                ? 'border-[#c5a059]/30 bg-[#12151b] hover:border-[#c5a059]'
                : 'border-stone-800 bg-stone-900/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                disabled={heartGuardCount <= 0}
                checked={useHeartGuard}
                onChange={(e) => setUseHeartGuard(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <div>
                <p className="font-semibold text-stone-200">
                  投入【护心丹】（库存：{heartGuardCount}）
                </p>
                <p className="text-stone-400">成功率 +12%，且冲关失败时反噬减半</p>
              </div>
            </div>
            <span className="text-emerald-400 font-semibold">+12%</span>
          </label>

          <label
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
              player.luck >= 9
                ? 'border-[#c5a059]/30 bg-[#12151b] hover:border-[#c5a059]'
                : 'border-stone-800 bg-stone-900/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                disabled={player.luck < 9}
                checked={spendLuck}
                onChange={(e) => setSpendLuck(e.target.checked)}
                className="accent-[#c5a059]"
              />
              <div>
                <p className="font-semibold text-stone-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  燃烧 8 点气运强行逆天（当前：{player.luck}）
                </p>
                <p className="text-stone-400">成功率 +14%</p>
              </div>
            </div>
            <span className="text-yellow-300 font-semibold">+14%</span>
          </label>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-300/85 bg-amber-950/30 border border-amber-500/25 rounded-lg p-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            若冲关失败，将损失 {Math.round(currentRealm.failureHpPenaltyPct * 100)}% 最大气血、增加 22% 内伤并折损 {currentRealm.failureLifespanPenaltyYears} 年寿元（服护心丹可减半）。
          </span>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-stone-700 text-xs text-stone-300 hover:bg-stone-800"
          >
            再蓄灵力
          </button>
          <button
            type="button"
            disabled={!nextRealm}
            onClick={() =>
              onAttempt(
                useMainPill && mainPillCount > 0,
                useHeartGuard && heartGuardCount > 0,
                spendLuck && player.luck >= 9
              )
            }
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs hover:brightness-110 transition"
          >
            引动灵潮 · 冲击瓶颈
          </button>
        </div>
      </div>
    </div>
  );
};
