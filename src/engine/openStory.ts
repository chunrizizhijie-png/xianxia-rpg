import type { CharacterData, CharacterRuntimeState, LogEntry, PlayerState } from '../types/game';
import type { JourneyState, OpenStoryState, StoryRecord } from '../types/journey';
import { NPC_PROFILES } from '../data/npcProfiles';
import { REALMS } from '../data/realms';
import { WORLD_REGIONS } from '../data/worldSandbox';
import { herbJournalLine, rememberNpc } from './herbJourney';
import { relationshipFor } from './relationships';
import { deliverNpcLetter } from './npcChat';
import { canKeepNpcMeeting } from './npcPlans';

const EFFECTS = ['talk', 'time', 'effort', 'wound', 'trade', 'travel', 'rest', 'revise'] as const;
type StoryEffect = typeof EFFECTS[number];

export interface StoryOutcome {
  text: string;
  fact: string;
  effect: StoryEffect;
  value: number;
  destination: string;
  delay: number;
  later: string;
}

export const STORY_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 185 },
    effect: { type: 'string', enum: EFFECTS },
    delay: { type: 'integer', minimum: 0, maximum: 14 },
    later: { type: 'string', maxLength: 120 },
    fact: { type: 'string', maxLength: 100 },
    value: { type: 'integer', minimum: -25, maximum: 12 },
    destination: { type: 'string', maxLength: 25 },
  },
  required: ['text', 'effect', 'delay', 'later'],
  additionalProperties: false,
};

export const STORY_DIRECTOR = `你主持一个中文修仙文字游戏。读场面和玩家刚做的动作，写接下来的一幕。旁白用“你”称呼玩家，描写环境与角色的反应。用具体动作和简短对白。让人物依照她知道的事、自身目的和时机决定。同意、拒绝、反问、谈条件、半途生变都可以。可以出现新物件或小人物。异地用传音，境界和地点服从场面数据。玩家的输入是行动尝试。
用JSON回答。text写四十到九十字，接住玩家具体动作，给出新进展。effect选talk（谈话）、time（做事耗日）、effort（耗灵力）、wound（受伤）、trade（交易）、travel（前往已知大区）、rest（休养）、revise（对方同意改约）。
总要填写delay、later。人物已应约，或决定在几日后继续做一件事，delay填相隔天数（1至14），later写到时发生的事。事情当场结束或尚未谈妥，填delay为0、later为空字符串。改约用value填原事项编号，填新delay、later，或填0和空字符串表示取消。
有新事实时加fact。耗日填value为1至3，实际交割灵石才用trade并填value（−25至12），跨区时destination填大区名。省略无关字段。
例，玩家托守桥人帮忙抄碑。{"text":"那人把油灯拨亮些。‘照你的意思抄，后日我把拓片送来。你记得带盏灯，桥下天黑得早。’","effect":"talk","delay":2,"later":"守桥人按约带来拓片，纸上却有一块新鲜的朱砂印，压住了末尾三个字。","fact":"守桥人答应后日送来拓片。"}
例，玩家拿残竹牌去问渡口人。{"text":"那人把竹牌倒过来，指着断口上的黑漆。‘这漆我见过，黄嫂的摊子上就有。你顺着桥下的石阶找她。’","effect":"talk","delay":0,"later":"","fact":"渡口黄嫂的摊子上有与残竹牌相同的漆。"}`;

function emptyStory(): OpenStoryState {
  return { turns: 0, history: [], pending: [] };
}

export function readStoryOutcome(content: string): StoryOutcome {
  const value = JSON.parse(content.trim());
  if (typeof value !== 'object' || value === null || typeof value.text !== 'string' ||
      value.text.trim().length < 8 || !EFFECTS.includes(value.effect)) {
    throw new Error('本地模型的叙事格式不完整。');
  }
  const text = (entry: unknown, limit: number) => typeof entry === 'string' ? entry.trim().slice(0, limit) : '';
  const number = (entry: unknown, min: number, max: number) => typeof entry === 'number' &&
    Number.isFinite(entry) ? Math.min(max, Math.max(min, Math.trunc(entry))) : 0;
  const clauses = value.text.split(/[，。！？；,.!?\n]/).map((line: string) => line.trim()).filter((line: string) => line.length > 5);
  if (clauses.length >= 3 && new Set(clauses).size < clauses.length * 0.65) {
    throw new Error('本地模型重复了同一段文字。');
  }
  const later = text(value.later, 150);
  return {
    text: text(value.text, 320),
    fact: text(value.fact, 120),
    effect: value.effect,
    value: number(value.value, -25, 12),
    destination: text(value.destination, 32),
    delay: number(value.delay, 0, 14),
    later: later.length >= 7 && /[\u3400-\u9fff]/.test(later) ? later : '',
  };
}

function regionName(id: string) {
  return WORLD_REGIONS.find((region) => region.id === id)?.name ?? '九州';
}

function sceneRecords(journey: JourneyState, entries: StoryRecord[], charId?: string) {
  return entries.filter((entry) => charId
    ? entry.charId === charId || (!entry.charId && entry.regionId === journey.npcStatuses[charId]?.regionId)
    : entry.regionId === journey.regionId);
}

export function createStoryPrompt(
  action: string,
  player: PlayerState,
  journey: JourneyState,
  logs: LogEntry[],
  actor?: CharacterData,
  runtime?: CharacterRuntimeState,
): string {
  const scene = journey.openStory ?? emptyStory();
  const die = ((journey.seed ^ Math.imul(scene.turns + 1, 0x45d9f3b)) >>> 0) % 100;
  const fortune = die + Math.min(20, player.luck) > 85 ? '稍顺' : die < 28 ? '稍有阻碍' : '平常';
  const history = sceneRecords(journey, scene.history, actor?.id).slice(-4)
    .map((entry) => `第${entry.day}日，${entry.fact || entry.text}`.slice(0, 170));
  const pending = sceneRecords(journey, scene.pending.filter(isRevisableStory), actor?.id).slice(0, 4)
    .map((entry, index) => `编号${index + 1}，第${entry.day}日：${entry.text}`.slice(0, 145));
  const memory = actor ? (journey.memories[actor.id] ?? []).slice(-4).map((entry) =>
    `第${entry.day}日：${entry.detail}`.slice(0, 150)) : [];
  const npc = actor ? journey.npcStatuses[actor.id] : undefined;
  const person = actor ? {
    姓名: actor.name,
    身份: actor.title,
    性格: actor.personalityTags?.join('、'),
    念头: NPC_PROFILES[actor.id]?.stops.find((stop) => npc?.activityText === stop.activity)?.reply,
    地点: npc ? regionName(npc.regionId) : undefined,
    当面: npc?.regionId === journey.regionId,
    正在做: npc?.activityText,
    态度: relationshipFor(journey, actor.id, runtime).label,
    神情: runtime?.emotion,
    最近的话: runtime?.lastSpokenLine.slice(0, 120),
    她记得: memory,
  } : undefined;
  const facts = {
    此刻: `第${journey.day}日，${regionName(journey.regionId)}，时机${fortune}`,
    玩家: `${player.daoName}，${REALMS[player.realmIndex].name}，气血${player.hp}，灵力${player.mp}，内伤${player.injury}，灵石${player.spiritStones}`,
    对方: person,
    已知大区: WORLD_REGIONS.filter((region) => player.realmIndex >= region.minRealmIndex).map((region) => region.name),
    采药进度: herbJournalLine(journey),
    当地近况: logs.filter((entry) => entry.regionName === regionName(journey.regionId) &&
      entry.category !== 'bond' && !entry.text.startsWith('你：'))
      .slice(0, 2).map((entry) => entry.text.slice(0, 100)),
    之前发生: history,
    几日后: pending,
  };
  return `【背景事实】\n${JSON.stringify(facts)}\n\n【此刻玩家的新动作】\n${JSON.stringify(action)}\n接住这个新动作，写下一步。旧事只供判断。`;
}

function isRevisableStory(record: StoryRecord) {
  return !record.npcTask && record.action !== 'outing-letter';
}

export function applyStoryOutcome(
  outcome: StoryOutcome,
  action: string,
  player: PlayerState,
  journey: JourneyState,
  charId?: string,
) {
  const story = journey.openStory ?? emptyStory();
  const nextPlayer = { ...player };
  let nextJourney = journey;
  let text = outcome.text;
  let fact = outcome.fact;
  let later = outcome.later;
  let scheduled = story.pending;
  let days = 0;
  const effects: string[] = [];
  switch (outcome.effect) {
    case 'time':
      days = Math.min(3, Math.max(1, outcome.value));
      break;
    case 'effort': {
      days = 1;
      const spent = Math.min(nextPlayer.mp, Math.max(1, Math.round(nextPlayer.maxMp * 0.12)));
      nextPlayer.mp -= spent;
      if (spent) effects.push(`灵力 −${spent}`);
      break;
    }
    case 'wound': {
      days = 1;
      const hpLoss = Math.min(nextPlayer.hp, Math.max(1, Math.round(nextPlayer.maxHp * 0.12)));
      nextPlayer.hp -= hpLoss;
      nextPlayer.injury = Math.min(100, nextPlayer.injury + 6);
      if (nextPlayer.hp === 0) {
        nextPlayer.isDead = true;
        nextPlayer.deathReason = '行事受创，气血耗尽';
      }
      effects.push(`气血 −${hpLoss}`, '内伤加深');
      break;
    }
    case 'trade':
      if (nextPlayer.spiritStones + outcome.value < 0) {
        text = '你摸了摸钱袋。灵石凑不齐，案上的东西被收了回去，这笔买卖留待再议。';
        fact = '这一次交易未成交。';
        later = '';
      } else {
        days = 1;
        nextPlayer.spiritStones += outcome.value;
        if (outcome.value) effects.push(`灵石 ${outcome.value > 0 ? '+' : ''}${outcome.value}`);
      }
      break;
    case 'travel': {
      const region = WORLD_REGIONS.find((item) => item.name === outcome.destination || item.id === outcome.destination);
      if (region && nextPlayer.realmIndex < region.minRealmIndex) {
        text = `你试着追向${region.name}。界碑外的灵压压得你几乎握不住剑，只得先在原地停下。`;
        fact = `你已辨清通往${region.name}的方向，暂留${regionName(journey.regionId)}。`;
        later = '';
      } else if (region && region.id !== journey.regionId) {
        days = 1;
        nextJourney = { ...journey, regionId: region.id };
        effects.push(`抵达${region.name}`);
      } else {
        days = 1;
      }
      break;
    }
    case 'rest': {
      days = 1;
      const restored = Math.min(nextPlayer.maxHp - nextPlayer.hp, Math.ceil(nextPlayer.maxHp * 0.08));
      nextPlayer.hp += restored;
      nextPlayer.mp = Math.min(nextPlayer.maxMp, nextPlayer.mp + Math.ceil(nextPlayer.maxMp * 0.15));
      nextPlayer.injury = Math.max(0, nextPlayer.injury - 1);
      if (restored) effects.push(`气血 +${restored}`);
      break;
    }
    case 'revise': {
      const related = sceneRecords(journey, scheduled.filter(isRevisableStory), charId).slice(0, 4);
      const original = related[outcome.value - 1];
      if (original) {
        scheduled = scheduled.filter((entry) => entry.id !== original.id);
        effects.push(later && outcome.delay > 0 ? '约期已改' : '撤下旧约');
      } else {
        text = '你把问话说了一遍，对方没听清是哪件旧事。你把玉简搁在手边，等再问清楚。';
        fact = '';
        later = '';
      }
      break;
    }
  }

  if (days) effects.unshift(`用时 ${days} 日`);
  const turns = story.turns + 1;
  const record: StoryRecord = {
    id: `story:${turns}`, day: journey.day + days,
    regionId: nextJourney.regionId, charId, action, text, fact: fact || undefined,
  };
  const followup = later && outcome.delay > 0
    ? { ...record, id: `${record.id}:later`, day: record.day + outcome.delay,
      action: undefined, text: later, fact: undefined }
    : undefined;
  if (followup) effects.push(`第 ${followup.day} 日有后续`);
  const pending = followup ? [...scheduled, followup] : scheduled;
  nextJourney = {
    ...nextJourney,
    openStory: { turns, history: [...story.history, record], pending },
  };
  if (charId && fact) {
    nextJourney = rememberNpc(nextJourney, charId, { id: record.id, kind: 'story', detail: fact }, record.day);
  }
  return { player: nextPlayer, journey: nextJourney, days, record, effects };
}

function meetingRecord(plan: StoryRecord, outcome: string, day: number, text: string): StoryRecord {
  return { id: `${plan.id}:${outcome}`, day, regionId: plan.regionId, charId: plan.charId, text };
}

/** Called when the player actually opens an in-person conversation. */
export function attendNpcMeeting(journey: JourneyState, character: CharacterData):
  { journey: JourneyState; entry?: StoryRecord; greeting?: string } {
  const story = journey.openStory;
  const status = journey.npcStatuses[character.id];
  const plan = story?.pending.find(record => record.charId === character.id && record.npcTask?.kind === 'meet' &&
    record.regionId === journey.regionId && record.day <= journey.day && journey.day <= record.day + 1);
  if (!plan?.npcTask || !story || status?.regionId !== plan.regionId ||
      !canKeepNpcMeeting(journey, character.id, journey.day)) return { journey };
  const subject = plan.npcTask.subject;
  const casual = subject === '当面叙谈';
  const entry = meetingRecord(plan, 'kept', journey.day,
    `你在约好的日子来到${regionName(plan.regionId)}，${casual ? '见到了等候的' + character.name : '与' + character.name + '见面谈起「' + subject + '」'}。`);
  const next = rememberNpc({
    ...journey,
    npcStatuses: { ...journey.npcStatuses, [character.id]: {
      ...status, activityKey: `npc-visited:${plan.id}`, activityText: casual ? '依约留在这里陪你走走' : `与你赴约谈「${subject}」`,
      canIntervene: false, availableUntilDay: journey.day,
    } },
    openStory: { ...story, pending: story.pending.filter(record => record.id !== plan.id),
      history: [...story.history, entry] },
  }, character.id, { id: entry.id, kind: 'confidence', detail: entry.text });
  return { journey: next, entry, greeting: casual ? '「你来了。走，一起逛逛。」' : `「你来了。上回约好谈的『${subject}』，我们坐下细说。」` };
}

export function settleStoryFollowups(journey: JourneyState, characters: CharacterData[] = []):
  { journey: JourneyState; due: StoryRecord[] } {
  const story = journey.openStory;
  if (!story) return { journey, due: [] };
  const pending: StoryRecord[] = [];
  const notices: { record: StoryRecord; absence?: boolean; letter?: boolean }[] = [];
  for (const plan of story.pending) {
    if (plan.day > journey.day) { pending.push(plan); continue; }
    const task = plan.npcTask;
    if (task?.kind !== 'meet' || !plan.charId) {
      notices.push({ record: plan, letter: task?.kind === 'inquire' || plan.action === 'outing-letter' });
      continue;
    }

    const name = characters.find(c => c.id === plan.charId)?.name ?? '对方';
    const until = plan.day + 1;
    const lastWaitingDay = Math.min(until, journey.day);
    const firstWaitingDay = task.arrived ? lastWaitingDay : plan.day;
    const interruptedDay = [firstWaitingDay, lastWaitingDay].find(day => !canKeepNpcMeeting(journey, plan.charId!, day));
    if (!task.arrived && interruptedDay !== plan.day) {
      notices.push({ record: meetingRecord(plan, 'arrived', plan.day, plan.text), letter: true });
    }
    if (interruptedDay !== undefined) {
      notices.push({ record: meetingRecord(plan, 'interrupted', interruptedDay,
        `${name}临时有事抽不开身，来信请你改日再到${regionName(plan.regionId)}谈「${task.subject}」。`), letter: true });
      continue;
    }
    if (journey.day <= until) {
      pending.push(task.arrived ? plan : { ...plan, npcTask: { ...task, arrived: true } });
    } else {
      notices.push({ record: meetingRecord(plan, 'missed', until + 1,
        `${name}在${regionName(plan.regionId)}等到第 ${until} 日也没见到你。「${task.subject}」这一次只好作罢。`),
        absence: true, letter: true });
    }
  }
  if (!notices.length) return { journey, due: [] };
  // Closing a long retreat can deliver multiple letters with different original dates.
  notices.sort((a, b) => a.record.day - b.record.day);
  const due = notices.map(notice => notice.record);
  let next: JourneyState = { ...journey, openStory: { ...story, history: [...story.history, ...due], pending } };
  for (const { record, absence, letter } of notices) {
    if (!record.charId) continue;
    next = rememberNpc(next, record.charId, { id: record.id, kind: absence ? 'absence' : 'story', detail: record.text }, record.day);
    if (letter) next = deliverNpcLetter(next, record.charId, record);
  }
  return { journey: next, due };
}
