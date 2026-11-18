import React, { useState } from 'react';
import { strangerTitle } from '../engine/npcDialogue';
import {
  Sparkles,
  Flame,
  Compass,
  Users,
  Wand2,
  Hammer,
  ShieldCheck,
} from 'lucide-react';
import {
  CRAFT_MATERIALS,
  CraftMaterial,
  NpcWorldStatus,
  SYNERGY_BONDS,
  equippedSchools,
  WORLD_REGIONS,
  WorldRegion,
} from '../data/worldSandbox';
import { REALMS } from '../data/realms';
import type { NpcRelationship } from '../engine/relationships';
import {
  CharacterData,
  CharacterRuntimeState,
  PlayerState,
  SkillCategory,
  SkillTag,
} from '../types/game';

interface SandboxHubPanelProps {
  player: PlayerState;
  skills: SkillTag[];
  characters: CharacterData[];
  charStates: Record<string, CharacterRuntimeState>;
  npcStatuses: Record<string, NpcWorldStatus>;
  relationships: Record<string, NpcRelationship>;
  currentRegionId: string;
  materials: Record<string, number>;
  onTravelRegion: (region: WorldRegion) => void;
  onGatherMaterial: (region: WorldRegion) => void;
  onBuyMaterial: (mat: CraftMaterial) => void;
  onCreateProceduralSkill: (name: string, category: SkillCategory) => void;
  onFuseSkills: (idA: string, idB: string) => void;
  workshop: React.ReactNode;
  onInterveneNpc: (charId: string) => void;
  onTalk: (charId: string) => void;
  onToggleCompanion: (charId: string) => void;
}

export const SandboxHubPanel: React.FC<SandboxHubPanelProps> = ({
  player,
  skills,
  characters,
  charStates,
  npcStatuses,
  relationships,
  currentRegionId,
  materials,
  onTravelRegion,
  onGatherMaterial,
  onBuyMaterial,
  onCreateProceduralSkill,
  onFuseSkills,
  workshop,
  onInterveneNpc,
  onTalk,
  onToggleCompanion,
}) => {
  const [subTab, setSubTab] = useState<'world' | 'npc_eco' | 'sutra' | 'forge'>('npc_eco');
  const [customSkillName, setCustomSkillName] = useState('');
  const [customCategory, setCustomCategory] = useState<SkillCategory>('sword');
  const [fuseA, setFuseA] = useState(player.unlockedSkills[0] ?? 'basic_sword');
  const [fuseB, setFuseB] = useState(player.unlockedSkills[1] ?? 'basic_sword');

  // Count active school tags for Synergy Matrix
  const schools = equippedSchools(player.equippedSkills, skills);

  const currentRegion =
    WORLD_REGIONS.find((r) => r.id === currentRegionId) ?? WORLD_REGIONS[0];

  return (
    <div className="xuan-card rounded-xl p-4 space-y-4">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c5a059]/25 pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('npc_eco')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
              subTab === 'npc_eco'
                ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488] font-bold'
                : 'bg-[#12151b] border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-pink-400" />
            当地见闻 · 道友行踪
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sutra')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
              subTab === 'sutra'
                ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488] font-bold'
                : 'bg-[#12151b] border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            藏经阁 · 自创功法与羁绊
          </button>

          <button
            type="button"
            onClick={() => setSubTab('forge')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
              subTab === 'forge'
                ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488] font-bold'
                : 'bg-[#12151b] border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-amber-400" />
            丹器工坊 · 学艺与委托
          </button>

          <button
            type="button"
            onClick={() => setSubTab('world')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
              subTab === 'world'
                ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488] font-bold'
                : 'bg-[#12151b] border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            九州舆图 · 游历采集
          </button>
        </div>

        <span className="text-[11px] text-[#e2c488] bg-[#c5a059]/10 px-2.5 py-1 rounded border border-[#c5a059]/30">
          当前驻地：{currentRegion.name} (灵气 x{currentRegion.spiritDensity})
        </span>
      </div>

      {/* 1. Living NPC Ecosystem */}
      {subTab === 'npc_eco' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {!characters.some((character) => charStates[character.id]?.met || npcStatuses[character.id]?.regionId === currentRegionId) &&
              <p className="text-xs text-stone-400">今日此地少有行人。可到药王谷的药庐看看。</p>}
            {characters.map((c) => {
              const st = npcStatuses[c.id];
              const known = charStates[c.id]?.met;
              const canWrite = charStates[c.id]?.hasContact;
              const relation = relationships[c.id];
              const realmName = REALMS[st?.realmIndex ?? 0]?.name ?? '炼气期';
              const region = WORLD_REGIONS.find((r) => r.id === st?.regionId);
              const local = st?.regionId === currentRegionId;
              const regionName = region?.name ?? '行踪未明';
              if (!known && !local) return null;
              if (!known) return (
                <div key={c.id} className="xuan-panel rounded-xl p-3.5 space-y-2">
                  <p className="text-sm text-stone-200">{strangerTitle(c)}</p>
                  <p className="text-xs text-stone-400">{regionName} · {st?.activityText?.includes(c.name) ? '在此稍作停留' : st?.activityText}</p>
                  <button type="button" disabled={!local && !canWrite} onClick={() => onTalk(c.id)} aria-label={`向${strangerTitle(c)}见礼`}
                    className="rounded border border-[#c5a059]/40 px-3 py-2 text-xs text-[#e2c488]">上前见礼</button>
                </div>
              );

              return (
                <div
                  key={c.id}
                  className="xuan-panel rounded-xl p-3.5 flex flex-col justify-between gap-2.5 border border-[#c5a059]/25"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-bold text-sm"
                          style={{ color: c.themeColor }}
                        >
                          {c.name}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-800 text-[#e2c488]">
                          {realmName}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        📍 {regionName}
                      </span>
                    </div>

                    <p className="text-xs text-stone-200 leading-relaxed bg-[#0f1115]/80 p-2.5 rounded-lg border border-stone-800">
                      {st?.activityText}
                      {st?.availableUntilDay !== undefined && (
                        <span className="block mt-1 text-stone-400">预计停留至第 {st.availableUntilDay} 日</span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-pink-300">
                      {st?.isCompanion ? '已结伴同行' : relation?.label}
                    </span>

                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => onTalk(c.id)}
                        aria-label={`与${c.name}${local ? '交谈' : '传音'}`}
                        className="rounded border border-[#c5a059]/40 px-2.5 py-1 text-xs text-[#e2c488]">
                        {local ? '交谈' : canWrite ? '传音' : '尚无传音印记'}
                      </button>
                      {!local && region && player.realmIndex >= region.minRealmIndex && (
                        <button type="button" onClick={() => onTravelRegion(region)}
                          className="rounded border border-stone-700 px-2.5 py-1 text-xs text-stone-200">
                          前往（1 日）
                        </button>
                      )}
                      {local && st?.canIntervene && (
                        <button
                          type="button"
                          onClick={() => onInterveneNpc(c.id)}
                          className="px-2.5 py-1 rounded bg-[#c5a059]/20 hover:bg-[#c5a059]/35 border border-[#c5a059]/50 text-[11px] text-[#e2c488] font-semibold"
                        >
                          ⚡ {st.interveneLabel}
                        </button>
                      )}
                      {local && <button
                        type="button"
                        disabled={st?.activityKey === 'craft-order' || (Boolean(relation?.inviteReason) && !st?.isCompanion)}
                        title={st?.isCompanion ? undefined : relation?.inviteReason}
                        onClick={() => onToggleCompanion(c.id)}
                        className={`px-2.5 py-1 rounded text-[11px] border transition ${
                          st?.isCompanion
                            ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
                            : 'bg-[#12151b] border-stone-700 text-stone-300 disabled:opacity-40'
                        }`}
                      >
                        {st?.isCompanion ? '解除同行' : '邀约同行'}
                      </button>}
                    </div>
                  </div>
                  {local && !st?.isCompanion && relation?.inviteReason && (
                    <p className="text-xs text-stone-400">同行 · {relation.inviteReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Sutra Pavilion: Procedural Skill Creation, Fusion & Synergy Matrix */}
      {subTab === 'sutra' && (
        <div className="space-y-4">
          {/* Synergy Matrix */}
          <div className="xuan-panel rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e2c488] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#c5a059]" />
                流派羁绊 · 同流派取最高阶
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SYNERGY_BONDS.map((bond) => {
                const count = schools.counts[bond.category] ?? 0;
                const active = schools.active.includes(bond);
                return (
                  <div
                    key={bond.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      active
                        ? 'bg-[#c5a059]/15 border-[#c5a059] text-[#e2c488]'
                        : 'bg-[#0f1115]/60 border-stone-800 text-stone-500'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>{bond.name}</span>
                      <span>
                        {count}/{bond.requiredCount} {active ? '✓已激活' : ''}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1 leading-snug opacity-90">
                      {bond.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Procedural Creation */}
            <div className="xuan-panel rounded-xl p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-[#e2c488] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                灵台推演 · 自创独门神通（耗 60 灵石）
              </h4>
              <p className="text-[11px] text-stone-400">
                结合自身神识（当前 {player.sense}）与天地法则，随机抽取暴击、吸血、丹毒、护盾等词缀生成独一无二的功法。
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={customSkillName}
                  onChange={(e) => setCustomSkillName(e.target.value)}
                  placeholder="自定功法名（留空则天机赐名）"
                  className="flex-1 px-2.5 py-1.5 rounded bg-[#0f1115] border border-stone-700 text-xs text-stone-100"
                />
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as SkillCategory)}
                  className="px-2 py-1.5 rounded bg-[#0f1115] border border-[#c5a059]/40 text-xs text-[#e2c488]"
                >
                  <option value="sword">剑道法则</option>
                  <option value="thunder">雷法法则</option>
                  <option value="blood">血道法则</option>
                  <option value="alchemy">丹毒法则</option>
                  <option value="yin_yang">阴阳法则</option>
                  <option value="defense">玄冰护体</option>
                </select>
              </div>
              <button
                type="button"
                disabled={player.spiritStones < 60}
                onClick={() => {
                  onCreateProceduralSkill(customSkillName, customCategory);
                  setCustomSkillName('');
                }}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs disabled:opacity-40"
              >
                感悟天地 · 推演新功法 (60灵石)
              </button>
            </div>

            {/* Skill Fusion */}
            <div className="xuan-panel rounded-xl p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-[#e2c488] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-400" />
                万法熔炉 · 双功法合成进阶（耗 100 灵石）
              </h4>
              <p className="text-[11px] text-stone-400">
                任选两门已领悟功法融会贯通，完美继承双方核心词条（吸血/叠毒/护盾/暴击）并晋升为天阶绝学！
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={fuseA}
                  onChange={(e) => setFuseA(e.target.value)}
                  className="px-2 py-1.5 rounded bg-[#0f1115] border border-stone-700 text-xs text-stone-200"
                >
                  {player.unlockedSkills.map((sid) => {
                    const sk = skills.find((s) => s.id === sid);
                    return (
                      <option key={sid} value={sid}>
                        {sk?.name ?? sid}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={fuseB}
                  onChange={(e) => setFuseB(e.target.value)}
                  className="px-2 py-1.5 rounded bg-[#0f1115] border border-stone-700 text-xs text-stone-200"
                >
                  {player.unlockedSkills.map((sid) => {
                    const sk = skills.find((s) => s.id === sid);
                    return (
                      <option key={sid} value={sid}>
                        {sk?.name ?? sid}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                type="button"
                disabled={
                  player.spiritStones < 100 ||
                  player.unlockedSkills.length < 2 ||
                  fuseA === fuseB
                }
                onClick={() => onFuseSkills(fuseA, fuseB)}
                className="w-full py-2 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-400/50 text-purple-200 font-bold text-xs disabled:opacity-40"
              >
                融会贯通 · 合成天阶神通 (100灵石)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Alchemy & Artifact Forge */}
      {subTab === 'forge' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workshop}
            <div className="xuan-panel rounded-xl p-3.5 space-y-2 max-h-56 overflow-y-auto">
              <h4 className="text-xs font-bold text-[#e2c488]">
                当地灵材铺
              </h4>
              {CRAFT_MATERIALS.filter(m => currentRegion.specialtyMaterials.includes(m.id)).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-stone-800/80"
                >
                  <div>
                    <span className="font-semibold text-stone-200">{m.name}</span>
                    <span className="text-[11px] text-stone-400 ml-2">
                      库存：{materials[m.id] ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={player.spiritStones < m.price}
                    onClick={() => onBuyMaterial(m)}
                    className="px-2.5 py-1 rounded bg-[#1f242d] border border-[#c5a059]/35 text-[11px] text-[#e2c488] disabled:opacity-40"
                  >
                    {m.price} 灵石购入
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Nine Provinces Map */}
      {subTab === 'world' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORLD_REGIONS.map((reg) => {
            const isHere = reg.id === currentRegionId;
            const locked = player.realmIndex < reg.minRealmIndex;
            return (
              <div
                key={reg.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                  isHere
                    ? 'bg-[#c5a059]/12 border-[#c5a059]'
                    : 'bg-[#12151b] border-stone-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-sm"
                      style={{ color: reg.themeColor }}
                    >
                      {reg.name}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      灵气 x{reg.spiritDensity}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#e2c488]/80 mt-0.5">
                    {reg.subtitle} · {reg.dangerLevel}
                  </p>
                  <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                    {reg.description}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  {isHere ? (
                    <button
                      type="button"
                      onClick={() => onGatherMaterial(reg)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-400/50 text-xs text-emerald-200 font-semibold"
                    >
                      采集灵材（1 日）
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onTravelRegion(reg)}
                      className="px-3 py-1.5 rounded-lg bg-[#1f242d] hover:bg-[#2a313d] border border-[#c5a059]/40 text-xs text-[#e2c488] disabled:opacity-40"
                    >
                      {locked ? `需 ${REALMS[reg.minRealmIndex].name}` : '御剑前往（1 日）'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
