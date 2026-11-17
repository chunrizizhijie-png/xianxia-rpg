import type { JourneyState, NpcMemory } from '../types/journey';

export const HERB_VALLEY = 'yaowang_valley';
export const HERBALIST = 'lin_waner';

const TRIPS = [
  {
    helperId: 'shen_qingqiu',
    helperName: '沈清秋',
    obstacle: '夜雨涨水，谷口木桥被封住了。',
    discovery: '你与林婉儿蹲在桥下查看水痕，摸到一道被水冲脱的桥扣。你们用藤绳重系桥扣，等水势低下去才一前一后过桥。',
    detour: '你走遗落药筐的背坡。林婉儿把药篓绑在腰间，教你踩芦苇根旁的硬泥。你俩沿着旧炭道绕回山涧。',
  },
  {
    helperId: 'mu_qingge',
    helperName: '慕清歌',
    obstacle: '山涧石道封了，巡山人只在入口留了一盏红灯。',
    discovery: '你与林婉儿顺着第二盏灯找到巡山人。原是受伤的药鹿横在狭路上。她蹲下给它敷了药，你们等它走稳才穿过石道。',
    detour: '你和林婉儿绕开亮灯的石道，沿旧药田背后的浅渠涉水。她认得石壁刻着的两个药锄印，循着它们找到雪莲。',
  },
  {
    helperId: 'ao_shuanghua',
    helperName: '敖霜华',
    obstacle: '崖边落石冲断了栈道，谷口挂起了止行的绳结。',
    discovery: '你用断木拨开新堆的碎石，露出一串通往猎户旧梯的凿痕。林婉儿试了两块石阶，回头招手让你跟上。',
    detour: '你们往东绕过栈道。林婉儿从药篓里扯出布带缠住鞋底，两人踩着竹根斜上崖坡，赶在雾起前采到雪莲。',
  },
];

export function getHerbTrip(journey: JourneyState) {
  const trip = TRIPS[journey.seed % TRIPS.length];
  if (journey.herb.helperId === 'apothecary') {
    return { ...trip, helperId: 'apothecary', helperName: '药庐的两名药童' };
  }
  const helper = TRIPS.find((entry) => entry.helperId === journey.herb.helperId);
  return helper === undefined ? trip : { ...trip, helperId: helper.helperId, helperName: helper.helperName };
}

export function rememberNpc(
  journey: JourneyState,
  charId: string,
  memory: Omit<NpcMemory, 'day'>,
  day = journey.day,
): JourneyState {
  const ownMemories = journey.memories[charId] ?? [];
  if (ownMemories.some((entry) => entry.id === memory.id)) return journey;
  return {
    ...journey,
    memories: { ...journey.memories, [charId]: [...ownMemories, { ...memory, day }] },
  };
}

export function isHerbMeetingOpen(journey: JourneyState) {
  const { phase, meetingDay } = journey.herb;
  return journey.regionId === HERB_VALLEY && phase === 'promised' &&
    meetingDay !== undefined && journey.day >= meetingDay && journey.day <= meetingDay + 1;
}

export function replyToHerbInvite(journey: JourneyState, accept: boolean): JourneyState {
  const changedPlans = !accept && journey.herb.phase === 'promised' &&
    journey.herb.meetingDay !== undefined && journey.day <= journey.herb.meetingDay;
  const invited = journey.herb.phase === 'available' && journey.regionId === HERB_VALLEY;
  if (!changedPlans && !invited) return journey;
  const meetingDay = changedPlans ? journey.herb.meetingDay : journey.day + 2;
  return rememberNpc({
    ...journey,
    herb: { phase: accept ? 'promised' : 'declined', meetingDay },
  }, HERBALIST, {
    id: changedPlans ? 'herb-cancel' : 'herb-invite',
    kind: accept ? 'promise' : 'decline',
    detail: accept
      ? `与林婉儿约好第 ${meetingDay} 日在药庐相见，一同去采雪莲。`
      : changedPlans
        ? '你提前传信改了约。林婉儿放下第二只药篓，另去找人护送。'
        : '提前告诉林婉儿这趟无暇同行，她决定托其他人护送。',
  });
}

export function awaitsHerbApology(journey: JourneyState) {
  return journey.herb.phase === 'missed' &&
    !journey.memories[HERBALIST]?.some((memory) => memory.id === 'herb-apology');
}

export function completeHerbTrip(journey: JourneyState, route: 'investigate' | 'detour'): JourneyState {
  if (!isHerbMeetingOpen(journey)) return journey;
  return rememberNpc({
    ...journey,
    herb: { ...journey.herb, phase: 'fulfilled', route, resolvedDay: journey.day },
  }, HERBALIST, {
    id: 'herb-outing',
    kind: 'help',
    detail: route === 'investigate' ? getHerbTrip(journey).discovery : getHerbTrip(journey).detour,
  });
}

export function settleHerbJourney(journey: JourneyState): { next: JourneyState; rumor?: string } {
  const { phase, meetingDay, resolvedDay } = journey.herb;
  if (resolvedDay !== undefined || meetingDay === undefined ||
      (phase !== 'promised' && phase !== 'declined')) return { next: journey };
  const completedOn = meetingDay + (phase === 'promised' ? 2 : 1);
  if (journey.day < completedOn) return { next: journey };

  const firstChoice = journey.seed % TRIPS.length;
  const ordered = [...TRIPS.slice(firstChoice), ...TRIPS.slice(0, firstChoice)];
  const available = ordered.find((entry) => {
    const npc = journey.npcStatuses[entry.helperId];
    return npc && !npc.isCompanion && (npc.recoverUntilDay ?? 0) < completedOn;
  });
  const helperId = available?.helperId;
  const helperName = available?.helperName ?? '药庐的两名药童';
  const missed = phase === 'promised';
  const next = rememberNpc({
    ...journey,
    herb: { ...journey.herb, phase: missed ? 'missed' : 'declined', resolvedDay: completedOn, helperId: helperId ?? 'apothecary' },
  }, HERBALIST, {
    id: 'herb-outing',
    kind: missed ? 'absence' : 'witness',
    detail: missed
      ? `你没到药庐赴约。第 ${completedOn} 日，${helperName}陪林婉儿采药归来。`
      : `你已提前推辞。第 ${completedOn} 日，${helperName}陪林婉儿采药归来。`,
  }, completedOn);

  return {
    next: helperId ? rememberNpc(next, helperId, {
      id: 'herb-escort',
      kind: 'witness',
      detail: `${helperName}陪林婉儿去山涧采回雪莲。`,
    }, completedOn) : next,
    rumor: `从药王谷来的药商说，${helperName}陪林婉儿采回了雪莲，谷里这两日已重新开炉。`,
  };
}

export function herbJournalLine(journey: JourneyState): string | undefined {
  const { phase, meetingDay, resolvedDay } = journey.herb;
  if (phase === 'available') return '药王谷的药庐正在找人进山采一味药。';
  if (phase === 'promised' && meetingDay !== undefined) {
    return journey.day < meetingDay
      ? `第 ${meetingDay} 日去药王谷药庐与林婉儿碰面。`
      : `林婉儿在药庐候你。最迟第 ${meetingDay + 1} 日可以赴约。`;
  }
  if (resolvedDay === undefined && phase === 'declined') {
    return '你已提前推辞，林婉儿正另找帮手。';
  }
  return undefined;
}
