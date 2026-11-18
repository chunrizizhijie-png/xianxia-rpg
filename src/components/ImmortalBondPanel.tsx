import React, { useState } from 'react';
import {
  MessageCircle,
  Gift,
  Sparkles,
  HeartHandshake,
  Swords,
} from 'lucide-react';
import {
  CharacterData,
  CharacterRuntimeState,
  ItemConfig,
  PlayerState,
  SkillTag,
} from '../types/game';
import { getAffectionStage } from '../engine/gameEngine';
import { PORTRAITS } from '../data/portraits';
import type { NpcRelationship } from '../engine/relationships';

interface ImmortalBondPanelProps {
  characters: CharacterData[];
  charStates: Record<string, CharacterRuntimeState>;
  activeCharId: string;
  player: PlayerState;
  items: ItemConfig[];
  skills: SkillTag[];
  onSelectChar: (id: string) => void;
  onInteract: (
    charId: string,
    action: 'gift' | 'dual_cultivate',
    giftItem?: ItemConfig
  ) => void;
  onTalk: (charId: string) => void;
  local: boolean;
  atWork: boolean;
  relationship: NpcRelationship;
  onSparWithChar?: (charId: string) => void;
}

export const ImmortalBondPanel: React.FC<ImmortalBondPanelProps> = ({
  characters,
  charStates,
  activeCharId,
  player,
  items,
  skills,
  onSelectChar,
  onInteract,
  onTalk,
  local,
  atWork,
  relationship,
  onSparWithChar,
}) => {
  const [selectedGiftId, setSelectedGiftId] = useState<string>('jade_slip');

  const activeChar = characters.find((c) => c.id === activeCharId) ?? characters[0];
  const activeState = charStates[activeChar.id];
  const stageInfo = getAffectionStage(activeState?.affection ?? 0);
  const resonanceSkill = skills.find((s) => s.id === activeChar.resonanceSkillId);

  const giftableItems = items.filter(
    (item) =>
      (item.type === 'gift' || item.effect.affectionGain) &&
      (player.inventory[item.id] ?? 0) > 0
  );

  const effectiveGift =
    giftableItems.find((i) => i.id === selectedGiftId) ?? giftableItems[0];

  return (
    <div className="xuan-card rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#e2c488] flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-pink-400" />
          道友名录
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c) => {
            const isActive = c.id === activeChar.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectChar(c.id)}
                className={`px-3 py-1 rounded-lg text-xs border transition ${
                  isActive
                    ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488] font-semibold'
                    : 'bg-[#12151b] border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Character Info */}
      <div className="xuan-panel rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded bg-stone-800 text-stone-300">
              {activeChar.sect}
            </span>
            {activeChar.personalityTags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded border border-[#c5a059]/25 text-[#e2c488]/90"
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ color: stageInfo.color }}>
            {relationship.label}
          </span>
        </div>

        <div className="flex items-start gap-3">
          {PORTRAITS[activeChar.id] && (
            <img src={PORTRAITS[activeChar.id]} alt={`${activeChar.name}立绘`}
              className="h-28 w-20 shrink-0 rounded object-cover object-top lg:hidden" />
          )}
          <div>
            <p className="text-sm leading-relaxed text-stone-300">{activeChar.bio}</p>
            <p className="mt-2 text-xs text-stone-400">{local ? '她此刻在附近' : activeState.hasContact ? '可用玉简传音' : '还没有交换传音印记'}</p>
          </div>
        </div>

        {resonanceSkill && (
          <div className="text-[11px] text-[#e2c488] bg-[#c5a059]/10 border border-[#c5a059]/25 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span>
              道侣共鸣功法 <strong>【{resonanceSkill.name}】</strong>
            </span>
            {activeState?.isSoulmate && (
              <span className="text-emerald-300 shrink-0">
                已双修 {activeState.dualCount ?? 1} 次
              </span>
            )}
          </div>
        )}
        {local && relationship.dualReason && (
          <p className="text-xs text-stone-400">共修 · {relationship.dualReason}</p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          disabled={!local && !activeState.hasContact}
          onClick={() => onTalk(activeChar.id)}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#12151b] hover:bg-[#1d222c] border border-[#c5a059]/35 text-xs text-[#e2c488] font-semibold transition"
        >
          <MessageCircle className="w-4 h-4 text-sky-400" />
          {local ? '当面交谈' : activeState.hasContact ? '玉简传音' : '尚无传音印记'}
        </button>

        <div className="flex gap-1.5">
          <select
            value={effectiveGift?.id ?? ''}
            onChange={(e) => setSelectedGiftId(e.target.value)}
            disabled={!local || giftableItems.length === 0}
            className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-[#0f1115] border border-stone-700 text-xs text-stone-200"
          >
            {giftableItems.length === 0 ? (
              <option value="">无可用礼物</option>
            ) : (
              giftableItems.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (x{player.inventory[g.id] ?? 0})
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            disabled={!local || !effectiveGift}
            onClick={() =>
              effectiveGift && onInteract(activeChar.id, 'gift', effectiveGift)
            }
            className="px-3 py-2 rounded-lg bg-[#12151b] hover:bg-[#1d222c] border border-[#c5a059]/30 disabled:opacity-40 text-xs text-pink-300 inline-flex items-center gap-1 shrink-0"
          >
            <Gift className="w-3.5 h-3.5" /> 赠礼
          </button>
        </div>

        {onSparWithChar && (
          <button
            type="button"
            disabled={!local || atWork}
            onClick={() => onSparWithChar(activeChar.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#12151b] hover:bg-[#1d222c] border border-amber-500/35 text-xs text-amber-200 disabled:opacity-40 transition"
          >
            <Swords className="w-4 h-4 text-amber-400" />
            邀战切磋 (实战)
          </button>
        )}

        <button
          type="button"
          disabled={!local || Boolean(relationship.dualReason)}
          title={relationship.dualReason}
          onClick={() => onInteract(activeChar.id, 'dual_cultivate')}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#8b5cf6]/25 to-[#ec4899]/25 hover:brightness-125 border border-pink-400/40 disabled:opacity-40 text-xs text-pink-200 font-semibold transition"
        >
          <Sparkles className="w-4 h-4 text-pink-300" />
          {activeState.isSoulmate ? '与道侣共修' : '询问是否愿意结为道侣'}
        </button>
      </div>
    </div>
  );
};
