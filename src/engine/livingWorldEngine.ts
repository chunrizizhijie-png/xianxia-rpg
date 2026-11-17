import { CHARACTERS as BASE_CHARACTERS } from '../data/characters';
import { EXTRA_CHARACTERS, NpcWorldStatus, WORLD_REGIONS } from '../data/worldSandbox';
import { REALMS } from '../data/realms';
import { NPC_PROFILES } from '../data/npcProfiles';
import { RETREAT_CALLS } from '../data/retreatCalls';
import type { JourneyState } from '../types/journey';
import { getHerbTrip, HERBALIST, HERB_VALLEY, settleHerbJourney } from './herbJourney';
import {
  CharacterData,
  EnemyConfig,
  GameEvent,
  PlayerState,
} from '../types/game';

export const ALL_CHARACTERS: CharacterData[] = [
  ...BASE_CHARACTERS,
  ...EXTRA_CHARACTERS,
];

export function initNpcWorldStatuses(
  characters: CharacterData[]
): Record<string, NpcWorldStatus> {
  const map: Record<string, NpcWorldStatus> = {};
  characters.forEach((c, idx) => {
    const region = WORLD_REGIONS[idx % WORLD_REGIONS.length];
    const realmIdx = Math.min(REALMS.length - 1, 3 + (idx % 4) * 2);
    const realmName = REALMS[realmIdx].name;
    map[c.id] = {
      charId: c.id,
      realmIndex: realmIdx,
      exp: 40,
      regionId: region.id,
      activityText: `${c.name}正在「${region.name}」演练真元（境界：${realmName}），可前往切磋或结交。`,
      canIntervene: true,
      interveneType: idx % 2 === 0 ? 'spar' : 'co_explore',
      interveneLabel: idx % 2 === 0 ? '切磋论道(实战)' : '结伴夺宝(险境)',
      isCompanion: false,
      jealousy: 0,
      relations: {
        shen_qingqiu: c.id === 'ye_liuli' ? '宿敌对峙' : '道友相敬',
        ye_liuli: c.id === 'shen_qingqiu' ? '正魔不两立' : '暗中提防',
        lin_waner: '丹药往来',
      },
    };
  });
  return map;
}

export function createSparEnemyFromCharacter(
  charData: CharacterData,
  npcRealmIndex: number
): EnemyConfig {
  const realm = REALMS[npcRealmIndex] ?? REALMS[3];
  return {
    id: `spar_${charData.id}`,
    name: `${charData.name}（切磋演武）`,
    realmName: `${charData.sect} · ${realm.name}`,
    hp: Math.round(realm.baseHp * 1.15),
    atk: Math.round(realm.baseAtk * 1.1),
    def: realm.baseDef,
    sense: realm.baseSense,
    skills: [
      {
        name: `${charData.styleTag}起手式`,
        damageMult: 1.15,
        description: `${charData.name}衣袂翻飞，施展${charData.sect}精妙杀招攻来！`,
      },
      {
        name: `${charData.sect}秘传神通`,
        damageMult: 1.45,
        description: `${charData.name}眸光一凝，本命灵光化作漫天杀阵席卷而至！`,
      },
    ],
    rewardExp: Math.round(realm.maxExp * 0.25),
    rewardStones: 80 + npcRealmIndex * 20,
    rewardItemId:
      npcRealmIndex >= 11
        ? 'golden_core_pill'
        : npcRealmIndex >= 8
          ? 'barrier_break_pill'
          : 'foundation_pill',
    description: `与${charData.name}正面切磋印证大道（点到为止，落败不会陨落）。`,
  };
}

export function buildInterveneEvent(
  charData: CharacterData,
  status: NpcWorldStatus,
  player: PlayerState
): GameEvent {
  const regionName =
    WORLD_REGIONS.find((r) => r.id === status.regionId)?.name ?? '九州秘境';
  const npcRealm = REALMS[status.realmIndex] ?? REALMS[3];
  const dangerEnemyId =
    player.realmIndex >= 11
      ? 'inner_demon_shadow'
      : player.realmIndex >= 8
        ? 'realm_golem'
        : player.realmIndex >= 4
          ? 'flame_python'
          : 'puppet_deacon';

  const rewardPillId =
    player.realmIndex >= 11
      ? 'nascent_soul_pill'
      : player.realmIndex >= 8
        ? 'golden_core_pill'
        : player.realmIndex >= 5
          ? 'barrier_break_pill'
          : 'foundation_pill';

  if (status.interveneType === 'rescue') {
    return {
      id: `intervene_rescue_${charData.id}_${Date.now()}`,
      title: `【生死驰援】${charData.name}的血书求救`,
      category: 'encounter',
      description: `你御剑疾驰赶至「${regionName}」，只见${charData.name}（${npcRealm.name}）嘴角溢血，正被强敌死死困在杀阵中央！一旦救援失利，你亦可能身陷重围！`,
      choices: [
        {
          id: 'rescue_fight',
          text: `悍然拔剑杀入阵中，与${charData.name}并肩死战！（高风险实战，胜获重谢）`,
          successOutcome: {
            text: `你长啸一声破开杀阵，挡在${charData.name}身前迎战强敌！`,
            characterAffection: { charId: charData.id, delta: 26, emotion: 'injured' },
            triggerBattleEnemyId: dangerEnemyId,
          },
        },
        {
          id: 'rescue_blood_shield',
          text: `燃烧自身 30% 气血与精元，强行震碎杀阵带她突围（损血增内伤，必定救出）`,
          successOutcome: {
            text: `你一口精血喷在法器之上，硬抗杀阵反噬将${charData.name}拦腰抱出重围！她看着你苍白的面容，眼眶通红，将珍藏的破境丹塞入你怀中！`,
            hpDelta: -Math.round(player.maxHp * 0.3),
            injuryDelta: 18,
            expDelta: Math.round(REALMS[player.realmIndex].maxExp * 0.22),
            itemGainId: rewardPillId,
            characterAffection: { charId: charData.id, delta: 32, emotion: 'shy' },
          },
        },
        {
          id: 'rescue_sense_snipe',
          text: `暗中潜伏，以神识锁定敌首破绽一击必杀（检定：神识 ≥ ${npcRealm.baseSense}）`,
          check: {
            stat: 'sense',
            threshold: npcRealm.baseSense,
            label: `神识 ≥ ${npcRealm.baseSense}`,
          },
          successOutcome: {
            text: `你神识如电洞穿阵眼，一剑重创敌首！${charData.name}趁势反击大获全胜，对你刮目相看！`,
            expDelta: Math.round(REALMS[player.realmIndex].maxExp * 0.25),
            spiritStonesDelta: 150,
            itemGainId: rewardPillId,
            characterAffection: { charId: charData.id, delta: 24, emotion: 'smile' },
          },
          failOutcome: {
            text: `你的神识刺探被敌首察觉，反遭杀阵余波重创，两人狼狈突围，双双负伤！`,
            hpDelta: -Math.round(player.maxHp * 0.38),
            injuryDelta: 24,
            characterAffection: { charId: charData.id, delta: 6, emotion: 'injured' },
          },
        },
      ],
    };
  }

  if (status.interveneType === 'co_explore') {
    return {
      id: `intervene_explore_${charData.id}_${Date.now()}`,
      title: `【秘境同探】与${charData.name}共闯古修丹殿`,
      category: 'secret_realm',
      description: `「${regionName}」深处的古修遗府禁制狂暴闪烁，${charData.name}邀你合力破阵。殿内既有失传的破境金丹，亦埋伏着致命机关与镇殿凶兽！`,
      choices: [
        {
          id: 'co_fight_guardian',
          text: `正面强攻镇殿凶兽，平分殿内秘宝！（触发高危战斗）`,
          successOutcome: {
            text: `禁制轰然破碎，镇殿凶兽咆哮扑出，你与${charData.name}联手迎敌！`,
            characterAffection: { charId: charData.id, delta: 18, emotion: 'smile' },
            triggerBattleEnemyId: dangerEnemyId,
          },
        },
        {
          id: 'co_tank_trap',
          text: `主动替${charData.name}挡下破阵毒雾，助她收取核心丹匣（检定：防御 ≥ ${Math.max(20, Math.round(npcRealm.baseDef * 0.85))}）`,
          check: {
            stat: 'def',
            threshold: Math.max(20, Math.round(npcRealm.baseDef * 0.85)),
            label: `防御 ≥ ${Math.max(20, Math.round(npcRealm.baseDef * 0.85))}`,
          },
          successOutcome: {
            text: `你护体真罡全开硬抗毒雾，${charData.name}深受感动，将丹匣中最珍贵的破境主丹分予你！`,
            hpDelta: -Math.round(player.maxHp * 0.15),
            itemGainId: rewardPillId,
            expDelta: Math.round(REALMS[player.realmIndex].maxExp * 0.2),
            characterAffection: { charId: charData.id, delta: 24, emotion: 'shy' },
          },
          failOutcome: {
            text: `古阵毒火穿透护甲，你口吐鲜血受了不轻的内伤，只勉强抢出少许灵石！`,
            hpDelta: -Math.round(player.maxHp * 0.4),
            injuryDelta: 22,
            spiritStonesDelta: 65,
            characterAffection: { charId: charData.id, delta: 10, emotion: 'injured' },
          },
        },
        {
          id: 'co_snatch_betray',
          text: `【杀人夺宝·魔念】趁${charData.name}全力破阵时突然出手独吞宝匣！（好感暴跌/结仇风险）`,
          successOutcome: {
            text: `你骤然发难夺走整座丹匣与大批灵石！${charData.name}震怒之下剑气暴走将你击伤，从此对你恨之入骨！`,
            hpDelta: -Math.round(player.maxHp * 0.25),
            spiritStonesDelta: 320,
            itemGainId: rewardPillId,
            characterAffection: { charId: charData.id, delta: -45, emotion: 'blackened' },
          },
        },
      ],
    };
  }

  if (status.interveneType === 'aid_breakthrough') {
    return {
      id: `intervene_aid_${charData.id}_${Date.now()}`,
      title: `【护法渡劫】助${charData.name}冲击境界瓶颈`,
      category: 'encounter',
      description: `${charData.name}正在「${regionName}」盘膝渡劫，九天劫云翻滚，周围更有宵小蠢蠢欲动。`,
      choices: [
        {
          id: 'aid_slay_invader',
          text: `守在阵外斩杀前来偷袭的域外心魔/劫修！（触发战斗）`,
          successOutcome: {
            text: `你横剑立于渡劫台前，孤身迎战来袭强敌！`,
            characterAffection: { charId: charData.id, delta: 22, emotion: 'smile' },
            triggerBattleEnemyId: dangerEnemyId,
          },
        },
        {
          id: 'aid_share_mp',
          text: `渡入自身半数灵力与气运助她稳固道基（耗灵力，共悟破境天机）`,
          check: {
            stat: 'mp', threshold: Math.round(player.maxMp * 0.5),
            label: `灵力 ≥ ${Math.round(player.maxMp * 0.5)}`,
          },
          successOutcome: {
            text: `在你的护持下，${charData.name}稳住了经脉。她留下一枚护心丹，叮嘱你也先调息片刻。`,
            mpDelta: -Math.round(player.maxMp * 0.5),
            expDelta: Math.round(REALMS[player.realmIndex].maxExp * 0.25),
            itemGainId: 'heart_guard_pill',
            characterAffection: { charId: charData.id, delta: 24, emotion: 'shy' },
          },
          failOutcome: { text: `你运转了一回经脉，知道灵力不够。你告诉${charData.name}实情，她收势调息，等同门来接替。` },
        },
      ],
    };
  }

  // Default: trade or spar
  return {
    id: `intervene_trade_${charData.id}_${Date.now()}`,
    title: `【仙缘际会】与${charData.name}在「${regionName}」相逢`,
    category: 'encounter',
    description: `${charData.name}正于「${regionName}」驻足，见你御剑而来，眸光微动。`,
    choices: [
      {
        id: 'trade_pill',
        text: `花费 150 灵石向她求购一枚高阶破境灵丹`,
        check: { stat: 'spiritStones', threshold: 150, label: '灵石 ≥ 150' },
        successOutcome: {
          text: `${charData.name}念及旧情，以远低于黑市的价格将一枚珍贵破境丹让予你！`,
          spiritStonesDelta: -150,
          itemGainId: rewardPillId,
          characterAffection: { charId: charData.id, delta: 12, emotion: 'smile' },
        },
        failOutcome: { text: `你数了数灵石。还差一些，${charData.name}收起丹匣，说等下次带齐了再谈。` },
      },
      {
        id: 'spar_now',
        text: `拔剑相邀，与${charData.name}正面切磋印证所学！`,
        successOutcome: {
          text: `“正想领教道友近来进境！”${charData.name}欣然应战！`,
          characterAffection: { charId: charData.id, delta: 14, emotion: 'smile' },
          triggerBattleEnemyId: `spar_${charData.id}`,
        },
      },
    ],
  };
}

const INTERVENTION_LABELS: Record<NpcWorldStatus['interveneType'], string> = {
  spar: '切磋论道',
  trade: '易物求丹',
  co_explore: '结伴探查',
  aid_breakthrough: '护法渡劫',
  rescue: '御剑驰援',
};

function scheduledStop(charId: string, day: number, seed: number) {
  const stops = NPC_PROFILES[charId]?.stops;
  if (!stops) return undefined;
  const period = stops.reduce((sum, stop) => sum + stop.days, 0);
  const offset = charId === HERBALIST ? 0 : seed % 3;
  let withinStop = (day - 1 + offset) % period;
  for (const stop of stops) {
    if (withinStop < stop.days) return { stop, startDay: day - withinStop };
    withinStop -= stop.days;
  }
}

function applyAgenda(journey: JourneyState, status: NpcWorldStatus): NpcWorldStatus {
  if (status.isCompanion) {
    return {
      ...status,
      regionId: journey.regionId,
      activityText: '随你同行',
      activityKey: 'companion',
      canIntervene: false,
      availableUntilDay: undefined,
    };
  }

  if ((status.recoverUntilDay ?? 0) >= journey.day) {
    return {
      ...status,
      activityText: '暂在附近闭门休养',
      canIntervene: false,
      availableUntilDay: status.recoverUntilDay,
    };
  }

  const { herb, day } = journey;
  if (status.charId === HERBALIST && herb.phase === 'promised' && herb.meetingDay !== undefined) {
    return {
      ...status,
      regionId: HERB_VALLEY,
      activityText: day < herb.meetingDay ? '在药庐准备进山的药篓和绳索' : '在药庐等候约好的同行人',
      activityKey: 'herb_meeting',
      canIntervene: false,
      availableUntilDay: herb.meetingDay + 1,
    };
  }

  if (herb.resolvedDay !== undefined && day <= herb.resolvedDay + 2 &&
      (status.charId === HERBALIST ||
        (herb.phase !== 'fulfilled' && status.charId === getHerbTrip(journey).helperId))) {
    return {
      ...status,
      regionId: HERB_VALLEY,
      activityText: status.charId === HERBALIST ? '从山涧采药归来，正在药庐开炉' : '护送药师归谷，暂留药庐歇脚',
      activityKey: `herb_return:${herb.resolvedDay}`,
      canIntervene: false,
      availableUntilDay: herb.resolvedDay + 2,
    };
  }

  const scheduled = scheduledStop(status.charId, day, journey.seed);
  if (!scheduled) return status;
  const { stop, startDay } = scheduled;
  const activityKey = `${stop.regionId}:${startDay}`;
  return {
    ...status,
    regionId: stop.regionId,
    activityText: stop.activity,
    activityKey,
    canIntervene: activityKey !== status.activityKey || status.canIntervene,
    interveneType: stop.type,
    interveneLabel: INTERVENTION_LABELS[stop.type],
    availableUntilDay: startDay + stop.days - 1,
  };
}

export function initializeJourney(
  characters: CharacterData[],
  seed: number,
  day = 1,
): JourneyState {
  const journey: JourneyState = {
    day,
    seed,
    regionId: 'taixu_peak',
    npcStatuses: initNpcWorldStatuses(characters),
    memories: {},
    lastNoticeDay: 0,
    herb: { phase: 'available' },
  };
  return refreshNpcAgendas(journey);
}

export function refreshNpcAgendas(journey: JourneyState): JourneyState {
  return {
    ...journey,
    npcStatuses: Object.fromEntries(Object.entries(journey.npcStatuses)
      .map(([id, status]) => [id, applyAgenda(journey, status)])),
  };
}

export function getNpcAgendaReply(journey: JourneyState, charId: string): string {
  const status = journey.npcStatuses[charId];
  if (!status) return '「我这两日还想多走几处。待定下来再告诉你。」';
  if (status.isCompanion) return '「我今日跟你走。往哪处去，你先说。」';
  if ((status.recoverUntilDay ?? 0) >= journey.day) {
    return '「气还没理顺。门外有一壶茶，你先喝，我过两日再见客。」';
  }
  if (status.activityKey?.startsWith('herb')) {
    return status.activityKey === 'herb_meeting'
      ? '「药篓在门边。在约好的日子到药庐找我，我们一起启程。」'
      : '「昨夜才从山里回来。药炉刚开，今日我在这里歇口气。」';
  }
  return scheduledStop(charId, journey.day, journey.seed)?.stop.reply ??
    `「我今日${status.activityText}。若事情办早了，便多留一会儿。」`;
}

export function buildProactiveVisitEvent(
  character: CharacterData,
  player: PlayerState,
): GameEvent | undefined {
  const visit = character.proactiveVisitEvents?.[0];
  if (!visit) return;
  return {
    id: `visit_${character.id}`,
    requiredCharId: character.id,
    title: visit.title,
    category: 'encounter',
    description: visit.description,
    choices: visit.choices.map((choice, index) => ({
      id: `visit_choice_${index}`,
      text: choice.text,
      successOutcome: {
        text: choice.reply,
        expDelta: Math.min(choice.expDelta ?? 0, Math.round(REALMS[player.realmIndex].maxExp * 0.18)),
        hpDelta: choice.hpDelta,
        itemGainId: choice.itemGainId,
        characterAffection: {
          charId: character.id,
          delta: choice.affectionDelta,
          emotion: choice.emotion,
        },
        triggerBattleEnemyId: choice.triggerSpar ? `spar_${character.id}` : undefined,
      },
    })),
  };
}

export function findRetreatInterruption(
  journey: JourneyState,
  characters: CharacterData[],
  player: PlayerState,
  plannedDays: number,
): { day: number; event: GameEvent } | undefined {
  const seen = journey.retreatNotices ?? [];
  const day = Math.max(journey.day + 18 + (journey.seed % 9),
    journey.lastNoticeDay > 0 ? journey.lastNoticeDay + 30 : 0);
  const end = journey.day + plannedDays;
  if (day >= end) return;

  const pending = RETREAT_CALLS.filter((call) => !seen.includes(call.id) &&
    characters.some((character) => character.id === call.charId));
  const regional = pending.filter((call) => call.regionId === journey.regionId);
  const available = regional.length ? regional : pending;
  const call = available[(journey.seed + journey.day) % available.length];
  if (call) {
    const response = { charId: call.charId, delta: 0, emotion: 'normal' as const };
    return {
      day,
      event: {
        id: call.id,
        title: call.title,
        description: call.message,
        category: 'encounter',
        requiredCharId: call.charId,
        choices: [{
          id: 'lend_help',
          text: call.answer,
          check: call.check,
          successOutcome: {
            ...call.result,
            memoryKind: 'help',
            characterAffection: { ...response, delta: 12, emotion: 'smile' },
          },
          failOutcome: { text: call.setback, memoryKind: 'witness', characterAffection: response },
        }, {
          id: 'keep_retreat',
          text: '回信说明这次无法相助',
          successOutcome: { text: call.decline, memoryKind: 'decline', characterAffection: response },
        }],
      },
    };
  }

  for (let current = day; current < end; current++) {
    const state = refreshNpcAgendas(settleHerbJourney({ ...journey, day: current }).next);
    const candidate = characters.find((character) => {
      const status = state.npcStatuses[character.id];
      return status?.canIntervene && status.regionId === journey.regionId &&
        status.interveneType === 'rescue' && !seen.includes(`intervene_rescue_${character.id}`);
    });
    if (candidate) {
      const event = buildInterveneEvent(candidate, state.npcStatuses[candidate.id], player);
      return {
        day: current,
        event: {
          ...event,
          choices: [...event.choices, {
            id: 'keep_retreat',
            text: '留下回信，致意后继续闭关',
            successOutcome: { text: `${candidate.name}收到了回信，派人去寻能就近相助的同门。` },
          }],
        },
      };
    }
  }
}

export function simulateWorldTick(
  journey: JourneyState,
  characters: CharacterData[],
  player: PlayerState,
  elapsedDays: number,
  allowUrgent = true,
): { nextJourney: JourneyState; worldRumors: string[]; proactiveEvent?: GameEvent } {
  const advanced = settleHerbJourney({ ...journey, day: journey.day + elapsedDays });
  let nextJourney = advanced.next;
  const worldRumors = advanced.rumor ? [advanced.rumor] : [];
  const newActivities: CharacterData[] = [];
  const newStatuses = { ...nextJourney.npcStatuses };

  for (const character of characters) {
    const previous = newStatuses[character.id];
    if (!previous) continue;
    const accumulated = previous.exp + elapsedDays * (previous.isCompanion ? 3 : 2);
    const nextRealmIndex = Math.min(REALMS.length - 1, previous.realmIndex + Math.floor(accumulated / 130));
    if (nextRealmIndex > previous.realmIndex) {
      worldRumors.push(`有道友说，${character.name}已踏入${REALMS[nextRealmIndex].name}。`);
    }

    const next = applyAgenda(nextJourney, { ...previous, exp: accumulated % 130, realmIndex: nextRealmIndex });
    newStatuses[character.id] = next;
    if (next.canIntervene && next.activityKey !== previous.activityKey) {
      newActivities.push(character);
    }
  }

  nextJourney = { ...nextJourney, npcStatuses: newStatuses };
  const pick = newActivities[(nextJourney.seed + nextJourney.day) % newActivities.length];
  if (pick) {
    const status = newStatuses[pick.id];
    const region = WORLD_REGIONS.find((item) => item.id === status.regionId);
    if (status.regionId === nextJourney.regionId && status.interveneType !== 'rescue' &&
        pick.proactiveVisitEvents?.length) {
      worldRumors.push(`有人带来口信，${pick.name}在附近办事，想与你叙谈一会儿。`);
    } else {
      worldRumors.push(`行脚客提起，${pick.name}近日在${region?.name ?? '九州一带'}${status.activityText}。`);
    }
  }

  const roll = (nextJourney.seed ^ Math.imul(nextJourney.day, 1664525)) >>> 0;
  if (!allowUrgent || nextJourney.day - nextJourney.lastNoticeDay < 4 || roll % 100 >= 38) {
    return { nextJourney, worldRumors };
  }

  const urgent = newActivities.find((character) => {
    const status = newStatuses[character.id];
    const region = WORLD_REGIONS.find((item) => item.id === status.regionId);
    return status.regionId === nextJourney.regionId && status.interveneType === 'rescue' &&
      player.realmIndex >= (region?.minRealmIndex ?? 0);
  });
  if (!urgent) return { nextJourney, worldRumors };

  const status = newStatuses[urgent.id];
  const event = buildInterveneEvent(urgent, status, player);
  const privateCrisis = urgent.proactiveVisitEvents?.find((visit) => /求|紧急|追杀|遇险/.test(visit.title));
  return {
    nextJourney: {
      ...nextJourney,
      lastNoticeDay: nextJourney.day,
      npcStatuses: { ...newStatuses, [urgent.id]: { ...status, canIntervene: false } },
    },
    worldRumors,
    proactiveEvent: {
      ...event,
      requiredCharId: urgent.id,
      description: privateCrisis ? `${privateCrisis.description}\n\n${event.description}` : event.description,
    },
  };
}

