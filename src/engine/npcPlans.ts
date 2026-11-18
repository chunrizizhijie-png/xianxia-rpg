import { activeCraftOrder } from './crafting';
import { NPC_PROFILES } from '../data/npcProfiles';
import { WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, StoryRecord } from '../types/journey';
import { HERBALIST } from './herbJourney';
import { relationshipFor } from './relationships';

export interface NpcDecision {
  action: 'talk' | 'inquire' | 'meet' | 'cancel';
  subject: string;
  days: number;
  news: string;
}

export const NPC_DECISIONS: Record<NpcDecision['action'], string> = {
  talk: '继续交谈', inquire: '答应查访', meet: '答应见面', cancel: '取消安排',
};

interface DecisionResult {
  journey: JourneyState;
  direction: string;
  note?: string;
  spoken?: { cue: RegExp; fallback: string };
}

export function pendingNpcTask(journey: JourneyState, charId: string): StoryRecord | undefined {
  return journey.openStory?.pending.find((entry) => entry.charId === charId && entry.npcTask);
}

export function npcMeetingAt(journey: JourneyState, charId: string): StoryRecord | undefined {
  const onThisDay = (entry: StoryRecord) => entry.charId === charId && entry.npcTask?.kind === 'meet' &&
    entry.day <= journey.day && journey.day <= entry.day + 1;
  return journey.openStory?.pending.find(onThisDay) ?? journey.openStory?.history.find(onThisDay);
}

export function canKeepNpcMeeting(journey: JourneyState, charId: string, day: number): boolean {
  const status = journey.npcStatuses[charId];
  return Boolean(status && !status.isCompanion && (status.recoverUntilDay ?? 0) < day &&
    !(charId === HERBALIST && journey.herb.phase === 'promised' && day <= (journey.herb.meetingDay ?? 0) + 1) &&
    !(journey.herb.resolvedDay !== undefined && day >= journey.herb.resolvedDay && day <= journey.herb.resolvedDay + 2 &&
      (charId === HERBALIST || charId === journey.herb.helperId)));
}

function meetingRegion(journey: JourneyState, line: string) {
  const named = WORLD_REGIONS.filter((region) => line.includes(region.name));
  if (named.length > 1) return;
  return named[0] ?? WORLD_REGIONS.find((entry) => entry.id === journey.regionId);
}

export function npcDecisionOptions(
  character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState, journey: JourneyState, line: string,
): Partial<Record<NpcDecision['action'], string>> {
  const options: Partial<Record<NpcDecision['action'], string>> = {
    talk: '闲聊、回忆、追问，或你暂不愿意答应。',
  };
  const status = journey.npcStatuses[character.id];
  const pending = pendingNpcTask(journey, character.id);
  if (pending) {
    options.cancel = `取消已安排的「${pending.npcTask?.subject}」。只有双方明确说要取消、或你因当前谈话有理由收回承诺时才选。`;
    return options;
  }
  if (!runtime.met || !runtime.hasContact || activeCraftOrder(journey, character.id) || !status || status.canIntervene && status.interveneType === 'rescue' ||
      (status.recoverUntilDay ?? 0) >= journey.day ||
      relationshipFor(journey, character.id, runtime).label === '有隔阂') return options;
  options.inquire = `有人请你查证一件具体的事，或你发现线索值得查。你可以${NPC_PROFILES[character.id]?.inquiry ?? '向熟悉当地的人打听'}，查后传音。`;
  const region = meetingRegion(journey, line);
  if (region && Math.min(player.realmIndex, status.realmIndex) >= region.minRealmIndex && !npcMeetingAt(journey, character.id) &&
      canKeepNpcMeeting(journey, character.id, journey.day + 1)) {
    options.meet = `答应在${region.name}见面商量一件具体的事。只有对方提议日后见面、你也愿意赴约时才选。`;
  }
  return options;
}

export function applyNpcDecision(
  decision: NpcDecision,
  character: CharacterData,
  runtime: CharacterRuntimeState,
  player: PlayerState,
  journey: JourneyState,
  line: string,
): DecisionResult {
  const noPlan = { journey, direction: '这轮只说话。可以推辞或问清，先别许下还没谈妥的行程。' };
  if (decision.action === 'talk' || !npcDecisionOptions(character, runtime, player, journey, line)[decision.action]) return noPlan;
  const story = journey.openStory ?? { history: [], pending: [], turns: 0 };
  const turns = story.turns + 1;
  const id = `story:${turns}`;
  const { name, id: charId } = character;

  if (decision.action === 'cancel') {
    const previous = pendingNpcTask(journey, charId);
    if (!previous) return noPlan;
    const text = `${name}撤下了「${previous.npcTask?.subject}」的安排。`;
    return {
      journey: { ...journey, openStory: {
        turns, pending: story.pending.filter((entry) => entry.id !== previous.id),
        history: [...story.history, { id, day: journey.day, regionId: previous.regionId, charId, text }],
      } },
      note: text,
      direction: `你已取消「${previous.npcTask?.subject}」的安排。`,
      spoken: { cue: /取消|先不|改日|作罢|撤下|搁[下着]|暂缓/u, fallback: '好，那件事先搁下。改日再说。' },
    };
  }

  const subject = decision.subject.replace(/[\r\n「」]/gu, '').trim().slice(0, 32);
  const region = decision.action === 'meet' ? meetingRegion(journey, line)
    : WORLD_REGIONS.find((entry) => entry.id === journey.npcStatuses[charId].regionId);
  if (!subject || !region || !/[\p{L}\p{N}]/u.test(subject)) return noPlan;
  const day = journey.day + Math.max(1, Math.min(7, decision.days || 2));
  if (decision.action === 'meet' && !canKeepNpcMeeting(journey, charId, day)) return noPlan;
  const news = decision.news.trim().replace(/[\r\n]/gu, ' ').slice(0, 120);
  if (decision.action === 'inquire' && !/[\u3400-\u9fff]/u.test(news)) return noPlan;

  const note = decision.action === 'meet'
    ? `${name}约在第 ${day} 日去${region.name}，会留到第 ${day + 1} 日。`
    : `${name}会查访「${subject}」，第 ${day} 日传回消息。`;
  const text = decision.action === 'meet'
    ? `${name}依约到了${region.name}，想同你谈谈「${subject}」，会在那里留到第 ${day + 1} 日。`
    : `${name}为「${subject}」带来玉简传音。「${news}」`;
  const entry: StoryRecord = { id, day, regionId: region.id, charId, text, npcTask: { kind: decision.action, subject } };
  const method = NPC_PROFILES[charId]?.inquiry ?? '找当地熟悉此事的人问问';
  return {
    journey: { ...journey, openStory: { ...story, turns, pending: [...story.pending, entry] } },
    note,
    direction: decision.action === 'meet'
      ? `已谈妥：${name}在第${day}日到${region.name}谈「${subject}」，留到次日。`
      : `已谈妥：${name}去查「${subject}」，第${day}日给对方传音。眼下尚未动身。`,
    spoken: decision.action === 'meet' ? {
      cue: new RegExp(`(?:我|等我).{0,18}${region.name}|${region.name}.{0,12}(?:见|等你)`, 'u'),
      fallback: `第 ${day} 日我到${region.name}，会留一天。那件事见面再说。`,
    } : {
      cue: /(?:我|等我).{0,8}(?:查|问|打听)|给你.{0,4}(?:传音|回信|捎信)/u,
      fallback: `我去${method}。第 ${day} 日给你回信。`,
    },
  };
}
