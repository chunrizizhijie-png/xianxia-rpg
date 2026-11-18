import React, { useState } from 'react';
import { Backpack, BookOpen, ShoppingBag } from 'lucide-react';
import { ItemConfig, PlayerState, SkillTag } from '../types/game';

interface InventoryAndSkillsPanelProps {
  player: PlayerState;
  items: ItemConfig[];
  skills: SkillTag[];
  onUseItem: (item: ItemConfig) => void;
  workshopProducts: ReadonlySet<string>;
  onBuyItem: (item: ItemConfig) => void;
  onToggleEquipSkill: (skillId: string) => void;
}

export const InventoryAndSkillsPanel: React.FC<InventoryAndSkillsPanelProps> = ({
  player,
  items,
  skills,
  onUseItem,
  onBuyItem,
  workshopProducts,
  onToggleEquipSkill,
}) => {
  const [tab, setTab] = useState<'skills' | 'bag' | 'market'>('skills');

  const ownedItems = items.filter((item) => (player.inventory[item.id] ?? 0) > 0);
  const unlockedSkills = skills.filter((s) => player.unlockedSkills.includes(s.id));

  return (
    <div className="xuan-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c5a059]/20 pb-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('skills')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
              tab === 'skills'
                ? 'bg-[#c5a059]/20 text-[#e2c488] border border-[#c5a059]/50 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            功法词条 ({player.equippedSkills.length}/4)
          </button>
          <button
            type="button"
            onClick={() => setTab('bag')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
              tab === 'bag'
                ? 'bg-[#c5a059]/20 text-[#e2c488] border border-[#c5a059]/50 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Backpack className="w-3.5 h-3.5" />
            储物袋 ({ownedItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('market')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
              tab === 'market'
                ? 'bg-[#c5a059]/20 text-[#e2c488] border border-[#c5a059]/50 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            仙宗坊市
          </button>
        </div>
        <span className="text-xs text-teal-300">灵石：{player.spiritStones}</span>
      </div>

      {tab === 'skills' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {unlockedSkills.map((skill) => {
            const equipped = player.equippedSkills.includes(skill.id);
            return (
              <div
                key={skill.id}
                className={`p-3 rounded-lg border transition ${
                  equipped
                    ? 'bg-[#c5a059]/12 border-[#c5a059]/60'
                    : 'bg-[#12151b] border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#e2c488]">
                      {skill.name}
                    </span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                      {skill.rarity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleEquipSkill(skill.id)}
                    className={`text-[11px] px-2.5 py-1 rounded border transition ${
                      equipped
                        ? 'bg-[#c5a059] text-[#0f1115] border-[#c5a059] font-bold'
                        : 'border-stone-700 text-stone-300 hover:border-[#c5a059]/50'
                    }`}
                  >
                    {equipped ? '已装配' : '装配'}
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                  {skill.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'bag' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {ownedItems.length === 0 ? (
            <p className="text-xs text-stone-500 col-span-2 py-6 text-center">
              储物袋空空如也，去坊市或外出历练碰碰机缘吧。
            </p>
          ) : (
            ownedItems.map((item) => {
              const count = player.inventory[item.id] ?? 0;
              const usable = item.type === 'pill' || item.type === 'treasure';
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-[#12151b] border border-stone-800 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-100">
                        {item.name} ×{count}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-[#e2c488]">
                        {item.rarity}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">{item.description}</p>
                  </div>
                  {usable && (
                    <button
                      type="button"
                      onClick={() => onUseItem(item)}
                      className="self-end text-[11px] px-3 py-1 rounded bg-[#c5a059]/20 hover:bg-[#c5a059]/35 border border-[#c5a059]/45 text-[#e2c488]"
                    >
                      {item.type === 'treasure' ? '炼化法宝' : '服用丹药'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'market' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {items.filter(item => !workshopProducts.has(item.id) && !item.id.startsWith('crafted_')).map((item) => {
            const affordable = player.spiritStones >= item.price;
            return (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-[#12151b] border border-stone-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-100">{item.name}</span>
                    <span className="text-[11px] text-teal-300 font-semibold">
                      {item.price} 灵石
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">{item.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => onBuyItem(item)}
                  className="self-end text-[11px] px-3 py-1 rounded bg-[#1f242d] hover:bg-[#2b323e] border border-[#c5a059]/40 text-[#e2c488] disabled:opacity-40"
                >
                  购入
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
