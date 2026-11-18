import React, { useState } from 'react';
import { ArrowRight, Dices } from 'lucide-react';
import { SPIRIT_ROOTS } from '../data/realms';
import { findDestinyTrait } from '../data/destinies';
import { loadBirthDraft, type BirthDraft } from '../engine/birth';
import { TALENT_NAMES } from '../engine/crafting';

interface CharacterCreationModalProps {
  onStart: (daoName: string, birth: BirthDraft) => void;
  children?: React.ReactNode;
}

const RANDOM_NAMES = ['林玄', '顾长歌', '陆沉舟', '萧无尘', '叶知秋', '苏墨白'];

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({ onStart, children }) => {
  const [daoName, setDaoName] = useState('林玄');
  const [birth] = useState(loadBirthDraft);
  const root = SPIRIT_ROOTS.find((entry) => entry.id === birth.root)!;
  const traits = birth.traits.map(findDestinyTrait).filter((trait) => trait !== undefined);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-5 animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#e2c488]">玄霄问道录 · 因果初定</h1>
        {children}
        <div>
          <label htmlFor="dao-name" className="block text-sm text-[#e2c488] mb-2">立下道号</label>
          <div className="flex flex-wrap gap-2">
            <input id="dao-name" type="text" maxLength={12} value={daoName}
              onChange={(event) => setDaoName(event.target.value)} placeholder="输入道号"
              className="w-full sm:w-72 px-4 py-2.5 rounded-lg bg-[#0f1115] border border-[#c5a059]/35 text-stone-100" />
            <button type="button"
              onClick={() => setDaoName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#c5a059]/40 text-xs text-[#e2c488]">
              <Dices className="w-4 h-4" /> 随机道号
            </button>
          </div>
        </div>
        <section>
          <h2 className="text-sm text-[#e2c488] mb-2">先天灵根</h2>
          <div className="xuan-panel rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <strong style={{ color: root.color }}>{root.name}</strong>
              <span className="text-xs text-stone-400">吐纳倍率 ×{root.cultivationMult}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone-300">{root.description}</p>
          </div>
        </section>
        <section>
          <h2 className="text-sm text-[#e2c488] mb-2">此生命格</h2>
          <ul className="grid gap-2">
            {traits.map((trait) => (
              <li key={trait.id} className="rounded-lg border border-stone-800 bg-[#12151b] p-3">
                <strong className="text-sm text-stone-100">{trait.name}</strong>
                <span className={`ml-2 text-xs ${trait.rarity === '缺憾' ? 'text-rose-300' : 'text-[#e2c488]'}`}>{trait.rarity}</span>
                <p className="text-xs text-stone-400 mt-1">{trait.description}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm text-[#e2c488] mb-2">百工天资</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {([['丹道', birth.craftTalents.alchemy], ['器道', birth.craftTalents.smithing]] as const).map(([name, grade]) => (
              <div key={name} className="xuan-panel rounded-lg p-3">
                <dt className="text-stone-400">{name}资质</dt>
                <dd className="mt-1 text-[#e2c488]">{TALENT_NAMES[grade]} · {grade}/3</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="flex justify-end">
          <button type="button" onClick={() => onStart(daoName, birth)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-sm">
            踏入仙途 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
