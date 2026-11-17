import { DESTINY_TRAITS, REALMS, SPIRIT_ROOTS } from '../data/realms';
import { MAX_BIRTH_TRAITS } from './birth';
import {
  AffectionStage,
  BattleLogLine,
  BattleState,
  CharacterData,
  CharacterRuntimeState,
  EmotionState,
  EnemyConfig,
  EventCheck,
  EventOutcome,
  GameEvent,
  ItemConfig,
  PlayerState,
  RealmConfig,
  SkillTag,
  SpiritRootType,
} from '../types/game';

export function formatAge(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months === 0 ? `${years} 岁` : `${years} 岁 ${months} 月`;
}

export function getAffectionStage(affection: number): {
  stage: AffectionStage;
  label: string;
  color: string;
} {
  if (affection >= 100) {
    return { stage: 'soulmate', label: '生死道侣', color: '#f472b6' };
  }
  if (affection >= 60) {
    return { stage: 'infatuated', label: '倾心相许', color: '#e879f9' };
  }
  if (affection >= 25) {
    return { stage: 'acquainted', label: '相识论道', color: '#7dd3fc' };
  }
  return { stage: 'stranger', label: '初逢陌路', color: '#a8a29e' };
}

export function createInitialPlayer(
  daoName: string,
  spiritRoot: SpiritRootType,
  traitIds: string[]
): PlayerState {
  const root = SPIRIT_ROOTS.find((r) => r.id === spiritRoot) ?? SPIRIT_ROOTS[0];
  const realm = REALMS[0];
  const chosen = new Set(traitIds.slice(0, MAX_BIRTH_TRAITS));
  const traits = DESTINY_TRAITS.filter((t) => chosen.has(t.id));

  let atk = realm.baseAtk + root.atkBonus;
  let def = realm.baseDef;
  let sense = realm.baseSense;
  let luck = 12 + root.luckBonus;
  let charm = 14;
  let critRate = 0.1;
  let lifespanBonus = 0;

  for (const trait of traits) {
    atk += trait.modifiers.atkBonus ?? 0;
    def += trait.modifiers.defBonus ?? 0;
    sense += trait.modifiers.senseBonus ?? 0;
    luck += trait.modifiers.luckBonus ?? 0;
    charm += trait.modifiers.charmBonus ?? 0;
    critRate += trait.modifiers.critRateBonus ?? 0;
    lifespanBonus += trait.modifiers.lifespanBonus ?? 0;
  }

  const maxHp = realm.baseHp;
  const maxMp = realm.baseMp + root.mpBonus;

  return {
    daoName: daoName.trim() || '林玄',
    spiritRoot,
    destinyTraits: traits.map((t) => t.id),
    realmIndex: 0,
    exp: 0,
    ageMonths: 16 * 12,
    lifespanCapYears: realm.lifespanCap + lifespanBonus,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    atk,
    def,
    sense,
    luck: Math.max(1, luck),
    charm: Math.max(1, charm),
    critRate: Math.min(0.75, critRate),
    spiritStones: 120,
    injury: 0,
    nextBreakthroughBonus: 0,
    equippedSkills: ['basic_sword', 'green_lotus_sword'],
    unlockedSkills: ['basic_sword', 'green_lotus_sword'],
    inventory: {
      qi_gathering_pill: 2,
      heart_guard_pill: 1,
      jade_slip: 2,
    },
    stats: {
      battlesWon: 0,
      breakthroughSuccess: 0,
      breakthroughFailed: 0,
      eventsCompleted: 0,
      majorRealmsReached: [realm.majorStage],
    },
    isDead: false,
  };
}

export function createInitialCharacters(
  characters: CharacterData[]
): Record<string, CharacterRuntimeState> {
  const map: Record<string, CharacterRuntimeState> = {};
  for (const c of characters) {
    map[c.id] = {
      id: c.id,
      met: true,
      affection: 18,
      emotion: 'normal',
      isSoulmate: false,
      interactionCount: 0,
      dualCount: 0,
      lastSpokenLine: c.dialogues.stranger[0] ?? '“道友有礼。”',
    };
  }
  return map;
}

export function getEffectiveCultivationMult(
  player: PlayerState,
  skills: SkillTag[]
): number {
  const root = SPIRIT_ROOTS.find((r) => r.id === player.spiritRoot) ?? SPIRIT_ROOTS[0];
  let mult = root.cultivationMult;

  for (const tid of player.destinyTraits) {
    const trait = DESTINY_TRAITS.find((t) => t.id === tid);
    if (trait?.modifiers.cultivationSpeedMult) {
      mult += trait.modifiers.cultivationSpeedMult;
    }
  }

  for (const sid of player.equippedSkills) {
    const skill = skills.find((s) => s.id === sid);
    if (skill?.passiveBonus?.cultivationMult) {
      mult += skill.passiveBonus.cultivationMult;
    }
  }

  return mult;
}

export function getEffectiveCombatStats(
  player: PlayerState,
  skills: SkillTag[]
): { atk: number; def: number; critRate: number } {
  let atkPct = 0;
  let defPct = 0;
  let critBonus = 0;

  for (const sid of player.equippedSkills) {
    const skill = skills.find((s) => s.id === sid);
    if (skill?.passiveBonus?.atkPct) atkPct += skill.passiveBonus.atkPct;
    if (skill?.passiveBonus?.defPct) defPct += skill.passiveBonus.defPct;
    if (skill?.passiveBonus?.critRate) critBonus += skill.passiveBonus.critRate;
  }

  const injuryPenalty = Math.max(0.55, 1 - player.injury * 0.0045);
  return {
    atk: Math.round(player.atk * (1 + atkPct) * injuryPenalty),
    def: Math.round(player.def * (1 + defPct) * injuryPenalty),
    critRate: Math.min(0.9, player.critRate + critBonus),
  };
}

export function advanceTime(player: PlayerState, months: number): PlayerState {
  if (player.isDead) return player;
  const nextAgeMonths = player.ageMonths + months;
  const maxMonths = player.lifespanCapYears * 12;

  if (nextAgeMonths >= maxMonths) {
    return {
      ...player,
      ageMonths: maxMonths,
      hp: 0,
      isDead: true,
      deathReason: '寿元耗尽，灵气枯竭，坐化于洞府之中',
    };
  }

  return {
    ...player,
    ageMonths: nextAgeMonths,
  };
}

export function cultivate(
  player: PlayerState,
  realms: RealmConfig[],
  skills: SkillTag[],
  days: number,
  spiritDensity: number,
): { nextPlayer: PlayerState; expGained: number } {
  const realm = realms[player.realmIndex] ?? realms[realms.length - 1];
  const mult = getEffectiveCultivationMult(player, skills);
  const baseGain = 34 + player.realmIndex * 22;
  const injuryFactor = Math.max(0.5, 1 - player.injury * 0.006);
  const fraction = days / 90;
  const gain = Math.round(baseGain * mult * injuryFactor * fraction * spiritDensity);
  const expGained = Math.max(0, Math.min(gain, realm.maxExp - player.exp));
  const hpHeal = Math.round(player.maxHp * 0.16 * fraction);
  const mpHeal = Math.round(player.maxMp * 0.35 * fraction);

  const nextPlayer: PlayerState = {
    ...player,
    exp: player.exp + expGained,
    hp: Math.min(player.maxHp, player.hp + hpHeal),
    mp: Math.min(player.maxMp, player.mp + mpHeal),
    injury: Math.max(0, player.injury - Math.floor(5 * fraction)),
  };
  return { nextPlayer, expGained };
}

export function getRecommendedBreakthroughPill(realm: RealmConfig): {
  pillId: string;
  pillName: string;
  bonus: number;
} {
  if (realm.requiredPillId === 'golden_core_pill') {
    return { pillId: 'golden_core_pill', pillName: '结金丹', bonus: 36 };
  }
  if (realm.requiredPillId === 'nascent_soul_pill') {
    return { pillId: 'nascent_soul_pill', pillName: '九转化婴丹', bonus: 38 };
  }
  if (realm.requiredPillId === 'barrier_break_pill') {
    return { pillId: 'barrier_break_pill', pillName: '破障丹', bonus: 22 };
  }
  return { pillId: 'foundation_pill', pillName: '筑基丹', bonus: 35 };
}

export function calculateBreakthroughRate(
  player: PlayerState,
  realm: RealmConfig,
  useMainPill: boolean,
  useHeartGuardPill: boolean,
  spendLuck: boolean
): number {
  const root = SPIRIT_ROOTS.find((r) => r.id === player.spiritRoot) ?? SPIRIT_ROOTS[0];
  // Strict relative sense calculation: compares player's sense to the realm's baseline sense requirement
  const senseDiff = player.sense - realm.baseSense;
  const senseMod = Math.max(-15, Math.min(12, Math.floor(senseDiff * 0.25)));
  const rootMod = realm.isMajorBottleneck
    ? Math.floor(root.breakthroughBonus * 0.5)
    : root.breakthroughBonus;

  let rate = realm.baseBreakthroughRate + rootMod + senseMod;
  rate -= Math.floor(player.injury * 0.55);
  rate += player.nextBreakthroughBonus ?? 0;

  if (useMainPill) {
    const rec = getRecommendedBreakthroughPill(realm);
    rate += rec.bonus;
  }
  if (useHeartGuardPill) rate += 12;
  if (spendLuck) rate += 14;

  return Math.max(5, Math.min(96, rate));
}

export function attemptBreakthrough(
  player: PlayerState,
  realms: RealmConfig[],
  useMainPill: boolean,
  useHeartGuardPill: boolean,
  spendLuck: boolean,
  rollOverride?: number
): {
  nextPlayer: PlayerState;
  success: boolean;
  rate: number;
  message: string;
} {
  const currentRealm = realms[player.realmIndex];
  const nextRealm = realms[player.realmIndex + 1];
  if (!currentRealm || !nextRealm) {
    return {
      nextPlayer: player,
      success: false,
      rate: 0,
      message: '已至当前版本至高境界，难以再进一步。',
    };
  }

  const recPill = getRecommendedBreakthroughPill(currentRealm);
  const hasMainPill = (player.inventory[recPill.pillId] ?? 0) > 0;
  const actualUseMain = useMainPill && hasMainPill;

  const rate = calculateBreakthroughRate(
    player,
    currentRealm,
    actualUseMain,
    useHeartGuardPill,
    spendLuck
  );

  const inventory = { ...player.inventory };
  if (actualUseMain) {
    inventory[recPill.pillId] -= 1;
  }
  if (useHeartGuardPill && (inventory.heart_guard_pill ?? 0) > 0) {
    inventory.heart_guard_pill -= 1;
  }

  const nextLuck = spendLuck ? Math.max(1, player.luck - 8) : player.luck;
  const roll = rollOverride ?? Math.random() * 100;
  const success = roll <= rate;

  if (success) {
    const hpGain = nextRealm.baseHp - currentRealm.baseHp;
    const mpGain = nextRealm.baseMp - currentRealm.baseMp;
    const atkGain = nextRealm.baseAtk - currentRealm.baseAtk;
    const defGain = nextRealm.baseDef - currentRealm.baseDef;
    const senseGain = nextRealm.baseSense - currentRealm.baseSense;
    const lifespanGain = Math.max(0, nextRealm.lifespanCap - currentRealm.lifespanCap);

    const majorReached = player.stats.majorRealmsReached.includes(nextRealm.majorStage)
      ? player.stats.majorRealmsReached
      : [...player.stats.majorRealmsReached, nextRealm.majorStage];

    let updated: PlayerState = {
      ...player,
      realmIndex: nextRealm.index,
      exp: 0,
      maxHp: player.maxHp + hpGain,
      hp: player.maxHp + hpGain,
      maxMp: player.maxMp + mpGain,
      mp: player.maxMp + mpGain,
      atk: player.atk + atkGain,
      def: player.def + defGain,
      sense: player.sense + senseGain,
      lifespanCapYears: player.lifespanCapYears + lifespanGain,
      luck: nextLuck,
      injury: 0,
      nextBreakthroughBonus: 0,
      inventory,
      stats: {
        ...player.stats,
        breakthroughSuccess: player.stats.breakthroughSuccess + 1,
        majorRealmsReached: majorReached,
      },
    };
    updated = advanceTime(updated, 2);

    return {
      nextPlayer: updated,
      success: true,
      rate,
      message: `天降灵雨，瓶颈应声而破！你以 ${rate}% 机率成功踏入【${nextRealm.name}】，寿元上限增至 ${updated.lifespanCapYears} 年！`,
    };
  }

  const penaltyMult = useHeartGuardPill ? 0.5 : 1;
  const hpLoss = Math.round(player.maxHp * currentRealm.failureHpPenaltyPct * penaltyMult);
  const lifespanLoss = Math.max(
    1,
    Math.round(currentRealm.failureLifespanPenaltyYears * penaltyMult)
  );
  const nextHp = Math.max(1, player.hp - hpLoss);
  const nextLifespan = Math.max(
    Math.ceil(player.ageMonths / 12) + 1,
    player.lifespanCapYears - lifespanLoss
  );

  let updated: PlayerState = {
    ...player,
    exp: Math.round(currentRealm.maxExp * 0.55),
    hp: nextHp,
    injury: Math.min(85, player.injury + Math.round(22 * penaltyMult)),
    lifespanCapYears: nextLifespan,
    luck: nextLuck,
    nextBreakthroughBonus: 0,
    inventory,
    stats: {
      ...player.stats,
      breakthroughFailed: player.stats.breakthroughFailed + 1,
    },
  };
  updated = advanceTime(updated, 3);

  return {
    nextPlayer: updated,
    success: false,
    rate,
    message: `冲击【${nextRealm.name}】失败（成功率仅 ${rate}%）！天威反噬之下气血受损 ${hpLoss} 点，折损寿元 ${lifespanLoss} 年！建议炼制或搜寻【${recPill.pillName}】并邀道侣双修护法后再试。`,
  };
}

export function filterAvailableEvents(
  events: GameEvent[],
  player: PlayerState,
  charStates: Record<string, CharacterRuntimeState>
): GameEvent[] {
  return events.filter((evt) => {
    if (evt.minRealmIndex !== undefined && player.realmIndex < evt.minRealmIndex) {
      return false;
    }
    if (evt.maxRealmIndex !== undefined && player.realmIndex > evt.maxRealmIndex) {
      return false;
    }
    if (evt.requiredCharId) {
      const cState = charStates[evt.requiredCharId];
      if (!cState || !cState.met) return false;
      if (evt.minAffection !== undefined && cState.affection < evt.minAffection) {
        return false;
      }
    }
    return true;
  });
}

export function checkEventStat(player: PlayerState, check?: EventCheck): boolean {
  if (!check) return true;
  const val = player[check.stat];
  return val >= check.threshold;
}

export function resolveEventOutcome(
  player: PlayerState,
  charStates: Record<string, CharacterRuntimeState>,
  outcome: EventOutcome,
  realms: RealmConfig[],
  months = 2,
): {
  nextPlayer: PlayerState;
  nextCharacters: Record<string, CharacterRuntimeState>;
} {
  const realm = realms[player.realmIndex] ?? realms[realms.length - 1];
  const nextInventory = { ...player.inventory };
  if (outcome.itemGainId) {
    nextInventory[outcome.itemGainId] = (nextInventory[outcome.itemGainId] ?? 0) + 1;
  }

  const nextUnlocked = [...player.unlockedSkills];
  const nextEquipped = [...player.equippedSkills];
  if (outcome.skillGainId && !nextUnlocked.includes(outcome.skillGainId)) {
    nextUnlocked.push(outcome.skillGainId);
    if (nextEquipped.length < 4) {
      nextEquipped.push(outcome.skillGainId);
    }
  }

  const nextHp = Math.max(0, Math.min(player.maxHp, player.hp + (outcome.hpDelta ?? 0)));
  let nextPlayer: PlayerState = {
    ...player,
    exp: Math.max(0, Math.min(realm.maxExp, player.exp + (outcome.expDelta ?? 0))),
    hp: nextHp,
    mp: Math.max(0, Math.min(player.maxMp, player.mp + (outcome.mpDelta ?? 0))),
    spiritStones: Math.max(0, player.spiritStones + (outcome.spiritStonesDelta ?? 0)),
    luck: Math.max(1, player.luck + (outcome.luckDelta ?? 0)),
    sense: Math.max(1, player.sense + (outcome.senseDelta ?? 0)),
    charm: Math.max(1, player.charm + (outcome.charmDelta ?? 0)),
    atk: Math.max(5, player.atk + (outcome.atkDelta ?? 0)),
    def: Math.max(1, player.def + (outcome.defDelta ?? 0)),
    lifespanCapYears: Math.max(20, player.lifespanCapYears + (outcome.lifespanDelta ?? 0)),
    injury: Math.max(0, Math.min(90, player.injury + (outcome.injuryDelta ?? 0))),
    inventory: nextInventory,
    unlockedSkills: nextUnlocked,
    equippedSkills: nextEquipped,
    stats: {
      ...player.stats,
      eventsCompleted: player.stats.eventsCompleted + 1,
    },
  };

  if (nextHp <= 0) {
    nextPlayer.isDead = true;
    nextPlayer.deathReason = '历练途中遭遇凶险，气血枯竭而亡';
  }

  const nextCharacters = { ...charStates };
  if (outcome.characterAffection) {
    const { charId, delta, emotion } = outcome.characterAffection;
    const prev = nextCharacters[charId];
    if (prev) {
      nextCharacters[charId] = {
        ...prev,
        met: true,
        affection: Math.max(0, Math.min(150, prev.affection + delta)),
        emotion: emotion ?? (delta >= 0 ? 'smile' : 'angry'),
      };
    }
  }

  if (months > 0) nextPlayer = advanceTime(nextPlayer, months);
  return { nextPlayer, nextCharacters };
}

export function initBattle(
  enemy: EnemyConfig,
  contextTag?: BattleState['contextTag']
): BattleState {
  return {
    enemy,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    turn: 1,
    playerShield: 0,
    playerSwordIntent: 0,
    enemyPoisonStacks: 0,
    enemyStunned: false,
    skillCooldowns: {},
    logs: [
      {
        id: 'battle_start',
        turn: 1,
        actor: 'system',
        text: `遭遇【${enemy.name}】（${enemy.realmName}）！杀机锁定，大战一触即发！`,
        tone: 'info',
      },
    ],
    finished: false,
    victory: false,
    autoMode: false,
    contextTag,
  };
}

export function executeBattleTurn(
  battle: BattleState,
  player: PlayerState,
  skills: SkillTag[],
  selectedSkillId: string
): {
  nextBattle: BattleState;
  nextPlayer: PlayerState;
} {
  if (battle.finished || player.isDead) {
    return { nextBattle: battle, nextPlayer: player };
  }

  const skill =
    skills.find((s) => s.id === selectedSkillId) ??
    skills.find((s) => s.id === 'basic_sword') ??
    skills[0];

  const combatStats = getEffectiveCombatStats(player, skills);
  const newLogs: BattleLogLine[] = [...battle.logs];
  let nextPlayerHp = player.hp;
  let nextPlayerMp = player.mp;
  let nextShield = battle.playerShield;
  let nextSwordIntent = battle.playerSwordIntent;
  let nextEnemyHp = battle.enemyHp;
  let nextPoison = battle.enemyPoisonStacks;
  let nextStunned = false;

  // Reduce existing cooldowns
  const nextCooldowns: Record<string, number> = {};
  for (const [sid, cd] of Object.entries(battle.skillCooldowns)) {
    if (cd > 1) nextCooldowns[sid] = cd - 1;
  }

  // Player action
  const canCast = nextPlayerMp >= skill.mpCost && (battle.skillCooldowns[skill.id] ?? 0) === 0;
  const activeSkill = canCast
    ? skill
    : ({
        id: 'basic_strike',
        name: '平砍剑气',
        mpCost: 0,
        cooldown: 0,
        damageMult: 0.95,
        swordIntentGain: 1,
      } as SkillTag);

  if (canCast) {
    nextPlayerMp -= activeSkill.mpCost;
    if (activeSkill.cooldown > 0) {
      nextCooldowns[activeSkill.id] = activeSkill.cooldown;
    }
  }

  if (activeSkill.selfHpCostPct) {
    const costHp = Math.max(1, Math.round(nextPlayerHp * activeSkill.selfHpCostPct));
    nextPlayerHp = Math.max(1, nextPlayerHp - costHp);
  }

  // Tactical Mechanics Calculation
  const hits = activeSkill.hitCount ?? 1;
  const pierce = activeSkill.armorPiercePct ?? 0;
  const effectiveEnemyDef = battle.enemy.def * (1 - pierce);

  // Berserk low HP scaling
  let berserkMult = 1;
  if (activeSkill.lowHpBerserk) {
    const missingPct = Math.max(0, (player.maxHp - nextPlayerHp) / player.maxHp);
    berserkMult = 1 + missingPct * 1.1;
  }

  const intentCritBonus = nextSwordIntent * 0.06;
  const isCrit =
    Math.random() <
    combatStats.critRate + (activeSkill.critBonus ?? 0) + intentCritBonus;

  const rawDmg =
    combatStats.atk * activeSkill.damageMult * berserkMult - effectiveEnemyDef * 0.45;
  const variance = 0.94 + Math.random() * 0.14;
  let finalDmg = Math.max(
    6,
    Math.round(rawDmg * variance * (isCrit ? 1.68 : 1))
  );

  // Consume Sword Intent Finisher
  let intentTrueDmg = 0;
  if (activeSkill.consumeSwordIntent && nextSwordIntent > 0) {
    intentTrueDmg = Math.round(combatStats.atk * 0.38 * nextSwordIntent);
    finalDmg += intentTrueDmg;
  }

  nextEnemyHp = Math.max(0, nextEnemyHp - finalDmg);
  const hitNote = hits > 1 ? `（${hits}段连斩）` : '';
  const pierceNote = pierce > 0 ? `（破甲${Math.round(pierce * 100)}%）` : '';
  const intentNote =
    intentTrueDmg > 0 ? `（引爆${nextSwordIntent}层剑意追加 ${intentTrueDmg} 真伤！）` : '';

  if (activeSkill.consumeSwordIntent) {
    nextSwordIntent = 0;
  } else if (activeSkill.swordIntentGain) {
    nextSwordIntent = Math.min(8, nextSwordIntent + activeSkill.swordIntentGain);
  }

  newLogs.push({
    id: `t${battle.turn}_p_${Date.now()}`,
    turn: battle.turn,
    actor: 'player',
    text: `你催动【${activeSkill.name}】${hitNote}${pierceNote}${
      isCrit ? '触发会心暴击！' : '，'
    }对${battle.enemy.name}造成 ${finalDmg} 点伤害！${intentNote}`,
    tone: isCrit ? 'crit' : 'damage',
  });

  if (activeSkill.healPct) {
    const heal = Math.round(player.maxHp * activeSkill.healPct);
    nextPlayerHp = Math.min(player.maxHp, nextPlayerHp + heal);
    newLogs.push({
      id: `t${battle.turn}_pheal`,
      turn: battle.turn,
      actor: 'player',
      text: `灵气回春，恢复自身 ${heal} 点气血。`,
      tone: 'heal',
    });
  }

  if (activeSkill.lifestealPct) {
    const steal = Math.round(finalDmg * activeSkill.lifestealPct);
    nextPlayerHp = Math.min(player.maxHp, nextPlayerHp + steal);
    newLogs.push({
      id: `t${battle.turn}_psteal`,
      turn: battle.turn,
      actor: 'player',
      text: `噬血秘法汲取生机，恢复 ${steal} 点气血！`,
      tone: 'heal',
    });
  }

  if (activeSkill.shieldPct) {
    const shieldAdd = Math.round(player.maxHp * activeSkill.shieldPct);
    nextShield += shieldAdd;
    newLogs.push({
      id: `t${battle.turn}_pshield`,
      turn: battle.turn,
      actor: 'player',
      text: `周身灵罡凝聚，获得 ${shieldAdd} 点护盾。`,
      tone: 'info',
    });
  }

  if (activeSkill.poisonStacks) {
    nextPoison += activeSkill.poisonStacks;
    newLogs.push({
      id: `t${battle.turn}_ppoison`,
      turn: battle.turn,
      actor: 'player',
      text: `敌方身中 ${activeSkill.poisonStacks} 层丹毒（当前共 ${nextPoison} 层）！`,
      tone: 'info',
    });
  }

  // Poison Detonation Mechanic
  if (activeSkill.detonatePoison && nextPoison >= 5 && nextEnemyHp > 0) {
    const detonateDmg = Math.round(nextPoison * (24 + combatStats.atk * 0.32));
    nextEnemyHp = Math.max(0, nextEnemyHp - detonateDmg);
    newLogs.push({
      id: `t${battle.turn}_detonate`,
      turn: battle.turn,
      actor: 'player',
      text: `【厄难毒爆】引爆敌方体内 ${nextPoison} 层丹毒，瞬间炸出 ${detonateDmg} 点毁灭毒伤！`,
      tone: 'crit',
    });
    nextPoison = 0;
  }

  // Stun / Paralyze Mechanic
  if (activeSkill.stunChance && Math.random() < activeSkill.stunChance && nextEnemyHp > 0) {
    nextStunned = true;
    newLogs.push({
      id: `t${battle.turn}_stun`,
      turn: battle.turn,
      actor: 'player',
      text: `天威震慑！【${battle.enemy.name}】陷入麻痹/冰封状态，本回合无法出手！`,
      tone: 'info',
    });
  }

  // Poison tick
  if (nextEnemyHp > 0 && nextPoison > 0) {
    const poisonDmg = Math.max(8, Math.round(nextPoison * (12 + combatStats.atk * 0.15)));
    nextEnemyHp = Math.max(0, nextEnemyHp - poisonDmg);
    newLogs.push({
      id: `t${battle.turn}_poison`,
      turn: battle.turn,
      actor: 'system',
      text: `丹毒蚀心！${battle.enemy.name}损失 ${poisonDmg} 点气血。`,
      tone: 'damage',
    });
  }

  // Check enemy defeat
  if (nextEnemyHp <= 0) {
    newLogs.push({
      id: `t${battle.turn}_win`,
      turn: battle.turn,
      actor: 'system',
      text: `剑光落定！【${battle.enemy.name}】败亡，获得修为 +${battle.enemy.rewardExp}、灵石 +${battle.enemy.rewardStones}！`,
      tone: 'victory',
    });

    const inv = { ...player.inventory };
    if (battle.enemy.rewardItemId) {
      inv[battle.enemy.rewardItemId] = (inv[battle.enemy.rewardItemId] ?? 0) + 1;
    }

    const nextPlayer: PlayerState = {
      ...player,
      hp: nextPlayerHp,
      mp: Math.min(player.maxMp, nextPlayerMp + 18),
      exp: player.exp + battle.enemy.rewardExp,
      spiritStones: player.spiritStones + battle.enemy.rewardStones,
      inventory: inv,
      stats: {
        ...player.stats,
        battlesWon: player.stats.battlesWon + 1,
      },
    };

    return {
      nextBattle: {
        ...battle,
        enemyHp: 0,
        playerShield: nextShield,
        playerSwordIntent: nextSwordIntent,
        enemyPoisonStacks: nextPoison,
        enemyStunned: false,
        skillCooldowns: nextCooldowns,
        logs: newLogs,
        finished: true,
        victory: true,
      },
      nextPlayer,
    };
  }

  // Enemy turn (Skipped if Stunned!)
  if (!nextStunned) {
    const enemySkill =
      battle.enemy.skills[Math.floor(Math.random() * battle.enemy.skills.length)] ??
      battle.enemy.skills[0];
    const rawEnemyDmg = battle.enemy.atk * enemySkill.damageMult - combatStats.def * 0.5;
    let enemyDmg = Math.max(5, Math.round(rawEnemyDmg * (0.9 + Math.random() * 0.2)));

    let absorbed = 0;
    if (nextShield > 0) {
      absorbed = Math.min(nextShield, enemyDmg);
      nextShield -= absorbed;
      enemyDmg -= absorbed;
    }

    nextPlayerHp = Math.max(0, nextPlayerHp - enemyDmg);
    newLogs.push({
      id: `t${battle.turn}_e`,
      turn: battle.turn,
      actor: 'enemy',
      text: `${enemySkill.description} 造成 ${enemyDmg} 点伤害${
        absorbed > 0 ? `（护盾抵消 ${absorbed}）` : ''
      }。`,
      tone: 'damage',
    });

    if (nextPlayerHp <= 0) {
      // If it's a friendly spar, don't kill the player—leave at 1 HP with minor injury!
      if (battle.contextTag?.type === 'spar') {
        newLogs.push({
          id: `t${battle.turn}_spar_lose`,
          turn: battle.turn,
          actor: 'system',
          text: `【点到为止】对方及时收招未伤你性命，你虽败犹荣，对自身破绽亦有明悟。`,
          tone: 'defeat',
        });
        return {
          nextBattle: {
            ...battle,
            enemyHp: nextEnemyHp,
            playerShield: 0,
            playerSwordIntent: nextSwordIntent,
            enemyPoisonStacks: nextPoison,
            enemyStunned: false,
            skillCooldowns: nextCooldowns,
            logs: newLogs,
            finished: true,
            victory: false,
          },
          nextPlayer: {
            ...player,
            hp: Math.max(15, Math.round(player.maxHp * 0.15)),
            mp: nextPlayerMp,
            injury: Math.min(80, player.injury + 10),
          },
        };
      }

      newLogs.push({
        id: `t${battle.turn}_lose`,
        turn: battle.turn,
        actor: 'system',
        text: `气血耗尽，你不敌【${battle.enemy.name}】，道消身陨……`,
        tone: 'defeat',
      });

      return {
        nextBattle: {
          ...battle,
          enemyHp: nextEnemyHp,
          playerShield: nextShield,
          playerSwordIntent: nextSwordIntent,
          enemyPoisonStacks: nextPoison,
          enemyStunned: false,
          skillCooldowns: nextCooldowns,
          logs: newLogs,
          finished: true,
          victory: false,
        },
        nextPlayer: {
          ...player,
          hp: 0,
          mp: nextPlayerMp,
          isDead: true,
          deathReason: `斗法落败，陨落于【${battle.enemy.name}】之手`,
        },
      };
    }
  }

  return {
    nextBattle: {
      ...battle,
      enemyHp: nextEnemyHp,
      turn: battle.turn + 1,
      playerShield: nextShield,
      playerSwordIntent: nextSwordIntent,
      enemyPoisonStacks: nextPoison,
      enemyStunned: false,
      skillCooldowns: nextCooldowns,
      logs: newLogs,
    },
    nextPlayer: {
      ...player,
      hp: nextPlayerHp,
      mp: Math.min(player.maxMp, nextPlayerMp + 8),
    },
  };
}

export function useInventoryItem(
  player: PlayerState,
  item: ItemConfig,
  realms: RealmConfig[]
): { nextPlayer: PlayerState; message: string } {
  const count = player.inventory[item.id] ?? 0;
  if (count <= 0) {
    return { nextPlayer: player, message: '背包中已无此物。' };
  }

  const realm = realms[player.realmIndex] ?? realms[realms.length - 1];
  const inv = { ...player.inventory, [item.id]: count - 1 };
  const eff = item.effect;

  const nextPlayer: PlayerState = {
    ...player,
    hp: Math.min(player.maxHp, player.hp + (eff.hpRestore ?? 0)),
    mp: Math.min(player.maxMp, player.mp + (eff.mpRestore ?? 0)),
    exp: Math.min(realm.maxExp, player.exp + (eff.expGain ?? 0)),
    injury: Math.max(0, player.injury - (eff.injuryHeal ?? 0)),
    atk: player.atk + (eff.atkBonus ?? 0),
    def: player.def + (eff.defBonus ?? 0),
    sense: player.sense + (eff.senseBonus ?? 0),
    lifespanCapYears: player.lifespanCapYears + (eff.lifespanGain ?? 0),
    inventory: inv,
  };

  return {
    nextPlayer,
    message: `服用/炼化了【${item.name}】，灵力与体魄皆有所增益。`,
  };
}

export function interactWithCharacter(
  charData: CharacterData,
  charState: CharacterRuntimeState,
  allCharacters: Record<string, CharacterRuntimeState>,
  player: PlayerState,
  action: 'chat' | 'gift' | 'dual_cultivate',
  giftItem?: ItemConfig,
  npcRealmIndex = 4
): {
  nextCharacters: Record<string, CharacterRuntimeState>;
  nextPlayer: PlayerState;
  message: string;
  dualSceneText?: string;
  shuraTriggered: boolean;
} {
  let nextPlayer = { ...player };
  const nextCharacters = { ...allCharacters };
  let message = '';
  let dualSceneText: string | undefined;
  let shuraTriggered = false;

  const currentRealm = REALMS[player.realmIndex] ?? REALMS[0];

  if (action === 'chat') {
    const stage = getAffectionStage(charState.affection).stage;
    const pool = charData.dialogues[stage];
    const line = pool[Math.floor(Math.random() * pool.length)] ?? '“道友近来安好？”';
    const gain = 0;
    const nextAff = Math.min(150, charState.affection + gain);
    const nextEmotion: EmotionState =
      nextAff >= 60 ? (Math.random() > 0.5 ? 'shy' : 'smile') : 'smile';

    nextCharacters[charData.id] = {
      ...charState,
      affection: nextAff,
      emotion: nextEmotion,
      interactionCount: charState.interactionCount + 1,
      lastSpokenLine: line,
    };
    message = `与${charData.name}传音交谈，好感度 +${gain}。`;
  } else if (action === 'gift' && giftItem) {
    const invCount = nextPlayer.inventory[giftItem.id] ?? 0;
    if (invCount <= 0) {
      return { nextCharacters, nextPlayer, message: '储物袋中无此礼物。', shuraTriggered: false };
    }
    nextPlayer.inventory = { ...nextPlayer.inventory, [giftItem.id]: invCount - 1 };
    const isFav = charData.favoriteGifts.includes(giftItem.id);
    const gain = isFav ? 5 : 2;
    const nextAff = Math.min(150, charState.affection + gain);
    const line = isFav ? `「我用得上${giftItem.name}。有心了，我记下了。」` : '「费心了，我收下。下回人来就好。」';

    nextCharacters[charData.id] = {
      ...charState,
      affection: nextAff,
      emotion: isFav ? 'shy' : 'smile',
      interactionCount: charState.interactionCount + 1,
      lastSpokenLine: line,
    };
    message = `你将${giftItem.name}递给${charData.name}。\n${line}`;
  } else if (action === 'dual_cultivate') {
    if (charState.affection < 80) {
      return {
        nextCharacters,
        nextPlayer,
        message: '好感度未达 80，尚未建立生死道侣之契。',
        shuraTriggered: false,
      };
    }
    const unlocked = [...nextPlayer.unlockedSkills];
    const equipped = [...nextPlayer.equippedSkills];
    if (!unlocked.includes(charData.resonanceSkillId)) {
      unlocked.push(charData.resonanceSkillId);
      if (equipped.length < 4) equipped.push(charData.resonanceSkillId);
    }

    // Dynamic Realm-Scaled Dual Cultivation Exp & Stat Gains!
    const basePctExp = Math.round(currentRealm.maxExp * 0.28);
    const higherRealmBonus =
      npcRealmIndex > player.realmIndex
        ? Math.round(currentRealm.maxExp * 0.14)
        : 0;
    const totalDualExp = Math.max(160, basePctExp + higherRealmBonus);

    const scenes = charData.dualCultivationScenes?.length
      ? charData.dualCultivationScenes
      : charData.dialogues.soulmate;
    const dualIdx = (charState.dualCount ?? 0) % scenes.length;
    const chosenScene = scenes[dualIdx];
    dualSceneText = chosenScene;

    nextPlayer = {
      ...nextPlayer,
      exp: Math.min(currentRealm.maxExp, nextPlayer.exp + totalDualExp),
      hp: nextPlayer.maxHp,
      mp: nextPlayer.maxMp,
      injury: Math.max(0, nextPlayer.injury - 25),
      sense: nextPlayer.sense + 2,
      nextBreakthroughBonus: Math.min(20, (nextPlayer.nextBreakthroughBonus ?? 0) + 10),
      unlockedSkills: unlocked,
      equippedSkills: equipped,
    };
    nextPlayer = advanceTime(nextPlayer, 2);

    nextCharacters[charData.id] = {
      ...charState,
      isSoulmate: true,
      emotion: 'shy',
      interactionCount: charState.interactionCount + 1,
      dualCount: (charState.dualCount ?? 0) + 1,
      lastSpokenLine: chosenScene,
    };
    message = `【双修共鸣】与${charData.name}灵肉交融！获得修为 +${totalDualExp}${
      higherRealmBonus > 0 ? '（含高境元阴反哺加成！）' : ''
    }、神识 +2，且下次突破成功率 +10%！`;
  }

  // Check jealousy / Shura field trigger if multiple high-affection heroines exist
  const otherHighAff = Object.values(nextCharacters).filter(
    (c) => c.id !== charData.id && c.affection >= 60
  );
  if (nextCharacters[charData.id].isSoulmate && otherHighAff.some((c) => c.isSoulmate) && Math.random() < 0.28) {
    shuraTriggered = true;
    const jealousOne = otherHighAff[0];
    nextCharacters[jealousOne.id] = {
      ...jealousOne,
      emotion: 'angry',
    };
  }

  return { nextCharacters, nextPlayer, message, dualSceneText, shuraTriggered };
}

export function generateEpitaph(
  player: PlayerState,
  realms: RealmConfig[],
  charStates: Record<string, CharacterRuntimeState>
): { title: string; inscription: string } {
  const realm = realms[player.realmIndex] ?? realms[0];
  const soulmates = Object.values(charStates).filter((c) => c.isSoulmate).length;

  return {
    title: `${player.daoName}道友仙逝碑文`,
    inscription: `生于微末，怀${
      SPIRIT_ROOTS.find((r) => r.id === player.spiritRoot)?.name ?? '灵根'
    }踏入仙途。历春秋 ${Math.floor(player.ageMonths / 12)} 载，终修至【${
      realm.name
    }】。平生历奇遇 ${player.stats.eventsCompleted} 桩，斩妖除魔 ${
      player.stats.battlesWon
    } 场，突破 ${player.stats.breakthroughSuccess} 次${
      soulmates > 0 ? `，曾与 ${soulmates} 位佳人结为生死道侣` : ''
    }。终因「${player.deathReason ?? '大道无常'}」，化道而去。`,
  };
}
