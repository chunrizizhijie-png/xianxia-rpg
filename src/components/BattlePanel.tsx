import React, { useEffect, useRef } from 'react';
import { Swords, Shield, Play, Pause, Sparkles, Flame } from 'lucide-react';
import { BattleState, PlayerState, SkillTag } from '../types/game';

interface BattlePanelProps {
  battle: BattleState;
  player: PlayerState;
  skills: SkillTag[];
  onCastSkill: (skillId: string) => void;
  onToggleAuto: () => void;
  onFinishBattle: () => void;
}

export const BattlePanel: React.FC<BattlePanelProps> = ({
  battle,
  player,
  skills,
  onCastSkill,
  onToggleAuto,
  onFinishBattle,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battle.logs.length]);

  useEffect(() => {
    if (!battle.autoMode || battle.finished) return;
    const timer = setTimeout(() => {
      const equipped = player.equippedSkills
        .map((id) => skills.find((s) => s.id === id))
        .filter((s): s is SkillTag => Boolean(s));

      // Smart tactical AI: if sword intent >= 3, prioritize finisher; otherwise highest usable skill
      const finisher = equipped.find(
        (s) =>
          s.consumeSwordIntent &&
          battle.playerSwordIntent >= 2 &&
          player.mp >= s.mpCost &&
          (battle.skillCooldowns[s.id] ?? 0) === 0
      );

      const usable =
        finisher ??
        equipped.find(
          (s) =>
            s.id !== 'basic_sword' &&
            player.mp >= s.mpCost &&
            (battle.skillCooldowns[s.id] ?? 0) === 0
        ) ??
        equipped[0] ??
        skills[0];

      if (usable) onCastSkill(usable.id);
    }, 650);
    return () => clearTimeout(timer);
  }, [
    battle.autoMode,
    battle.turn,
    battle.finished,
    player.mp,
    battle.skillCooldowns,
    battle.playerSwordIntent,
    player.equippedSkills,
    skills,
    onCastSkill,
  ]);

  const enemyHpPct = Math.max(
    0,
    Math.min(100, (battle.enemyHp / battle.enemyMaxHp) * 100)
  );
  const playerHpPct = Math.max(
    0,
    Math.min(100, (player.hp / player.maxHp) * 100)
  );

  return (
    <div className="xuan-card rounded-xl p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-rose-400" />
          <h3 className="font-bold text-base text-[#e2c488]">
            斗法演武 · 第 {battle.turn} 回合
          </h3>
        </div>
        {!battle.finished && (
          <button
            type="button"
            onClick={onToggleAuto}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border transition ${
              battle.autoMode
                ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488]'
                : 'bg-[#12151b] border-stone-700 text-stone-300'
            }`}
          >
            {battle.autoMode ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {battle.autoMode ? '暂停自动斗法' : '自动施法'}
          </button>
        )}
      </div>

      {/* Combatants Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="xuan-panel rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-stone-100">{player.daoName}</span>
            <span className="text-rose-300">
              {player.hp} / {player.maxHp}
            </span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-300"
              style={{ width: `${playerHpPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
            <span>
              灵力 {player.mp}/{player.maxMp}
            </span>
            <div className="flex items-center gap-2">
              {battle.playerSwordIntent > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                  <Flame className="w-3 h-3" /> 剑意 x{battle.playerSwordIntent}
                </span>
              )}
              {battle.playerShield > 0 && (
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <Shield className="w-3 h-3" /> 护盾 {battle.playerShield}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="xuan-panel rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-amber-200">{battle.enemy.name}</span>
            <span className="text-amber-300">
              {battle.enemyHp} / {battle.enemyMaxHp}
            </span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-red-500 transition-all duration-300"
              style={{ width: `${enemyHpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{battle.enemy.realmName}</span>
            <div className="flex items-center gap-2">
              {battle.enemyPoisonStacks > 0 && (
                <span className="text-emerald-400 font-semibold">
                  丹毒 x{battle.enemyPoisonStacks}
                </span>
              )}
              {battle.enemyStunned && (
                <span className="text-purple-300 font-semibold">⚡麻痹中</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Battle Log */}
      <div className="xuan-panel rounded-xl p-3 h-52 overflow-y-auto space-y-2 text-xs">
        {battle.logs.map((line) => (
          <div
            key={line.id}
            className={`leading-relaxed ${
              line.tone === 'crit'
                ? 'text-amber-300 font-semibold'
                : line.tone === 'heal'
                  ? 'text-emerald-300'
                  : line.tone === 'victory'
                    ? 'text-[#e2c488] font-bold'
                    : line.tone === 'defeat'
                      ? 'text-rose-400 font-bold'
                      : line.actor === 'enemy'
                        ? 'text-rose-300/90'
                        : 'text-stone-300'
            }`}
          >
            <span className="text-stone-500 mr-1.5">[第{line.turn}合]</span>
            {line.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Skill Controls */}
      {battle.finished ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onFinishBattle}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs"
          >
            {battle.victory
              ? '打扫战场 · 凯旋而归'
              : battle.contextTag?.type === 'spar'
                ? '拱手言谢 · 结束切磋'
                : '查看本世碑文'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {player.equippedSkills.map((sid) => {
            const skill = skills.find((s) => s.id === sid);
            if (!skill) return null;
            const cd = battle.skillCooldowns[skill.id] ?? 0;
            const noMp = player.mp < skill.mpCost;
            const disabled = cd > 0 || noMp;

            return (
              <button
                key={skill.id}
                type="button"
                disabled={disabled}
                onClick={() => onCastSkill(skill.id)}
                className="text-left p-2.5 rounded-lg bg-[#12151b] hover:bg-[#1e232e] border border-[#c5a059]/30 disabled:opacity-40 transition"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-[#e2c488]">
                  <span className="truncate">{skill.name}</span>
                  <Sparkles className="w-3 h-3 shrink-0" />
                </div>
                <div className="text-[10px] text-stone-400 mt-1 flex justify-between">
                  <span>耗灵 {skill.mpCost}</span>
                  <span>{cd > 0 ? `冷却 ${cd}` : `${skill.damageMult}x 伤`}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
