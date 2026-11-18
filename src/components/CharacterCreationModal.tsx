import React, { useState } from 'react';
import { Dices, Sparkles, ArrowRight } from 'lucide-react';
import { SPIRIT_ROOTS } from '../data/realms';
import { findDestinyTrait } from '../data/destinies';
import { SpiritRootType } from '../types/game';
import { drawBirth, loadBirthSession, MAX_BIRTH_DRAWS, MAX_BIRTH_TRAITS, saveBirthSession } from '../engine/birth';

interface CharacterCreationModalProps {
  onStart: (daoName: string, root: SpiritRootType, traits: string[]) => void;
  children?: React.ReactNode;
}

const RANDOM_NAMES = ['林玄', '顾长歌', '陆沉舟', '萧无尘', '叶知秋', '苏墨白'];

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({
  onStart,
  children,
}) => {
  const [daoName, setDaoName] = useState('林玄');
  const [session, setSession] = useState(loadBirthSession);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const root = SPIRIT_ROOTS.find((entry) => entry.id === session.draft?.root);
  const choices = (session.draft?.candidates ?? []).map(findDestinyTrait).filter((trait) => trait !== undefined);
  const remaining = MAX_BIRTH_DRAWS - session.used;

  const handleDraw = () => {
    if (!remaining) return;
    const next = drawBirth(session);
    saveBirthSession(next);
    setSession(next);
    setSelectedTraits([]);
  };

  const toggleTrait = (id: string) => {
    if (selectedTraits.includes(id)) {
      setSelectedTraits(selectedTraits.filter((t) => t !== id));
    } else if (selectedTraits.length < MAX_BIRTH_TRAITS) {
      setSelectedTraits([...selectedTraits, id]);
    }
  };

  const handleBegin = () => {
    if (root) onStart(daoName, root.id, selectedTraits);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.25em] text-[#c5a059] uppercase">
              XUANXIAO DAO CHRONICLES
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#e2c488] mt-1">
              玄霄问道录 · 因果初定
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setDaoName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1f242d] hover:bg-[#2a313d] border border-[#c5a059]/40 text-xs text-[#e2c488] transition"
          >
            <Dices className="w-4 h-4" /> 随机道号
          </button>
        </div>

        <div className="gold-divider" />

        {children}

        {/* Dao Name */}
        <div>
          <label className="block text-sm text-[#e2c488] mb-2">一、立下道号</label>
          <input
            type="text"
            maxLength={12}
            value={daoName}
            onChange={(e) => setDaoName(e.target.value)}
            placeholder="请输入你的修仙道号..."
            className="w-full sm:w-72 px-4 py-2.5 rounded-lg bg-[#0f1115] border border-[#c5a059]/35 text-stone-100 focus:outline-none focus:border-[#c5a059]"
          />
        </div>

        {/* Spirit Root */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#e2c488]">二、抽取灵根与命格</p>
            <div className="flex items-center gap-2">
              <span role="status" className="text-xs text-stone-300">剩余 {remaining} / {MAX_BIRTH_DRAWS} 抽</span>
              <button type="button" onClick={handleDraw} disabled={remaining === 0}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#c5a059]/50 px-3 text-sm text-[#e2c488] hover:bg-[#c5a059]/15 disabled:opacity-40">
                <Dices aria-hidden="true" className="h-4 w-4" /> {root ? '重新抽签' : '抽签'}
              </button>
            </div>
          </div>
          <p className="mb-2 text-xs text-stone-400">每次启动有三抽。重抽会替换灵根和整组命格。</p>
          {root && (
            <div className="xuan-panel rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: root.color }}>{root.name}</span>
                <span className="text-xs text-stone-400">吐纳倍率 ×{root.cultivationMult}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-300">{root.description}</p>
            </div>
          )}
        </div>

        {/* Destiny Traits */}
        {root && <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#e2c488]">
              三、筛选命格 · 已选 {selectedTraits.length}/{MAX_BIRTH_TRAITS}
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {choices.map((trait) => {
              const active = selectedTraits.includes(trait.id);
              return (
                <button
                  key={trait.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!active && selectedTraits.length >= MAX_BIRTH_TRAITS}
                  onClick={() => toggleTrait(trait.id)}
                  className={`text-left p-3 rounded-lg border transition disabled:opacity-55 ${
                    active
                      ? 'bg-[#c5a059]/15 border-[#c5a059]'
                      : 'bg-[#12151b] border-stone-800 hover:border-[#c5a059]/35'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-stone-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
                      {trait.name}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded bg-stone-800 ${trait.rarity === '缺憾' ? 'text-rose-300' : 'text-[#e2c488]'}`}>
                      {trait.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{trait.description}</p>
                </button>
              );
            })}
          </div>
        </div>}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleBegin}
            disabled={!root}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-sm hover:brightness-110 disabled:opacity-40 transition shadow-lg"
          >
            <span>踏入仙途</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
