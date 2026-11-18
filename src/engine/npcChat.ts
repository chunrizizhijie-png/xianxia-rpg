import type { ChatCompletionMessage } from '@wllama/wllama';
import { NPC_PROFILES } from '../data/npcProfiles';
import { WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, NpcChatMessage, NpcChatRecollection, StoryRecord } from '../types/journey';
import { HERBALIST, herbJournalLine } from './herbJourney';
import { NPC_DECISIONS, type NpcDecision, pendingNpcTask } from './npcPlans';
import { relationshipFor } from './relationships';

const CHAT_HISTORY_LIMIT = 24;
const REMEMBER_REQUEST = /记住|牢牢记|别忘|别告诉|别对旁人说|只告诉你|替我保密/u;
const RECALL_REQUEST = /记得|记不记得|有没有印象|想得起|想不想得起|方才|刚才|上次|上回|之前|先前|上句话|提过|说过|提到过/u;

export function isMemoryTurn(line: string): boolean {
  return (REMEMBER_REQUEST.test(line) || RECALL_REQUEST.test(line)) &&
    !/查访|打听|查查|去查|帮.{0,8}查|问一问|见面|赴约|约见|取消|改期|再约/u.test(line);
}

function regionName(regionId: string) {
  return WORLD_REGIONS.find((region) => region.id === regionId)?.name ?? '九州';
}

function spokenLines(text: string): string {
  const lines = [...text.matchAll(/「([^」]+)」/gu)].map((match) => match[1]);
  return lines.length ? lines.join('') : text;
}

function recentTurns(history: NpcChatMessage[]): ChatCompletionMessage[] {
  let remaining = 1000;
  const turns: ChatCompletionMessage[] = [];
  for (const { role, content, scripted } of history.slice(-8).reverse()) {
    const text = role === 'assistant' && scripted ? spokenLines(content) : content;
    if (text.length > remaining && turns.length > 0) break;
    const excerpt = text.slice(0, remaining);
    turns.push({ role, content: excerpt });
    remaining -= excerpt.length;
  }
  return turns.reverse();
}

function memoryKey(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function conversationMemories(saved: NpcChatRecollection[], turns: NpcChatMessage[]): NpcChatRecollection[] {
  const known = new Map(saved.map((entry) => [memoryKey(entry.quote), entry]));
  for (const [index, message] of turns.entries()) {
    if (message.role !== 'user' || message.scripted) continue;
    const quote = message.content.trim().slice(0, 500);
    const key = memoryKey(quote);
    const next = turns[index + 1];
    const reply = next?.role === 'assistant' && !next.scripted ? next.content.slice(0, 140) : undefined;
    if (key.length >= 4 && !known.has(key)) known.set(key, { quote, reply, day: message.day });
  }
  return [...known.values()];
}

function relatedMemories<T>(line: string, memories: T[], textOf: (entry: T) => string, limit: number): T[] {
  const query = memoryKey(line);
  const terms = new Set(Array.from({ length: Math.max(0, query.length - 1) }, (_, index) => query.slice(index, index + 2)));
  const ranked = memories.map((entry, index) => {
    const text = memoryKey(textOf(entry));
    const score = [...terms].reduce((sum, term) => sum + Number(text.includes(term)), 0);
    return { entry, index, score };
  });
  const recalling = RECALL_REQUEST.test(line);
  return ranked.sort((left, right) => right.score - left.score || right.index - left.index)
    .filter((match) => match.score >= 2 || recalling)
    .slice(0, limit).map(({ entry }) => entry);
}

function recalledLines(journey: JourneyState, charId: string, line: string, history: NpcChatMessage[]): string | undefined {
  const notes = conversationMemories(journey.npcChats?.[charId]?.recollections ?? [], history);
  const remembered = relatedMemories(line, notes, (entry) => `${entry.quote} ${entry.reply ?? ''}`, 3);
  if (!remembered.length) return;
  const excerpts = remembered.map(({ quote, reply }) =>
    `对方曾说：${quote.slice(0, 205)}${reply ? `\n你当时回答：${reply.slice(0, 90)}` : ''}`);
  const namedDetails = [...remembered[0].quote.matchAll(/[「“『]([^」”』]{1,24})[」”』]/gu)].map((match) => match[1]);
  const anchor = RECALL_REQUEST.test(line) && namedDetails.length
    ? `最相关原话里明确给过的字样：${namedDetails.join('、')}。按原样说。` : '';
  return [...excerpts, anchor].filter(Boolean).join('\n');
}

export function npcPlanLabel(task: StoryRecord | undefined): string | undefined {
  if (!task?.npcTask) return;
  return task.npcTask.kind === 'meet'
    ? `第 ${task.day} 日在${regionName(task.regionId)}见，留到第 ${task.day + 1} 日。`
    : `第 ${task.day} 日回信 · ${task.npcTask.subject}`;
}

export function npcDecisionMessages(
  character: CharacterData, runtime: CharacterRuntimeState, journey: JourneyState, history: NpcChatMessage[],
  line: string, options: Partial<Record<NpcDecision['action'], string>>,
): ChatCompletionMessage[] {
  const status = journey.npcStatuses[character.id];
  const setting = [
    `你替修仙世界的${character.name}安排下一步。性情：${character.personalityTags.join('、')}。`,
    `今天第${journey.day}日。在${regionName(status?.regionId ?? journey.regionId)}${status?.activityText ?? ''}。与对方关系：${relationshipFor(journey, character.id, runtime).label}。`,
    '你能做的事：',
    ...Object.entries(NPC_DECISIONS).flatMap(([action, label]) => {
      const meaning = options[action as NpcDecision['action']];
      return meaning ? [`${label}：${meaning}`] : [];
    }),
    '同意力所能及的具体请求，也可以因时机不合或不信任而推辞。对方只是问记不记得、见没见过时，继续交谈。只从上面列出的事中选。',
    '输出 JSON。action 是中文选择，subject 是这轮谈的具体事情，days 是从今日起的天数。只有答应查访时，news 写日后一两句传音，比如谁看过、哪里留有记录，或因何查无所获。坊间传闻只能当作待查的线索。其他选择的 news 留空。',
    options.inquire && '例：“请问渡工那张旧票的来历，后日回我。” → {"action":"答应查访","subject":"旧船票来历","days":2,"news":"问过渡工了，这是上游旧渡口的票，那条船早停了。"}',
    options.meet && '例：“明日在这里见面吧，我想给你看图。” → {"action":"答应见面","subject":"看图","days":1,"news":""}',
  ].filter(Boolean).join('\n');
  const prior = recentTurns(history.slice(-3)).map((turn) =>
    `${turn.role === 'user' ? '对方' : '你'}：${String(turn.content ?? '').slice(0, 180)}`).join('\n');
  return [
    { role: 'system', content: setting },
    { role: 'user', content: `先前说过的话：\n${prior}\n\n对方现在说：\n${line}\n\n选定你接下来做什么，用 JSON 记录。` },
  ];
}

export function npcChatMessages(
  character: CharacterData,
  runtime: CharacterRuntimeState,
  player: PlayerState,
  journey: JourneyState,
  history: NpcChatMessage[],
  line: string,
  direction: string,
): ChatCompletionMessage[] {
  const status = journey.npcStatuses[character.id];
  const location = status?.regionId ?? journey.regionId;
  const nearby = location === journey.regionId;
  const relation = relationshipFor(journey, character.id, runtime);
  const ownEvents = journey.memories[character.id] ?? [];
  const related = relatedMemories(line, ownEvents, (entry) => entry.detail, 2);
  const memories = [...new Set([...related, ...ownEvents.slice(-2)])].slice(0, 3).map(({ day, detail }) =>
    `第${day}日：${detail.slice(0, 100)}`);
  const plan = npcPlanLabel(pendingNpcTask(journey, character.id));
  const earlier = recentTurns(history).map((turn) =>
    `${turn.role === 'assistant' ? character.name : player.daoName}：${turn.content}`).join('\n');
  const notes = [
    `你叫${character.name}，身份是${character.title}。性情：${character.personalityTags.join('、')}。`,
    NPC_PROFILES[character.id]?.voice,
    typeof character.bio === 'string' && `身世：${character.bio.slice(0, 100)}`,
    nearby ? `现在是第${journey.day}日，${player.daoName}与你在${regionName(location)}当面说话。`
      : `现在是第${journey.day}日，你在${regionName(location)}，${player.daoName}从${regionName(journey.regionId)}用玉简与你传音。`,
    status && `你眼下的行程：${status.activityText}`,
    `你与对方的关系：${relation.label}。${relation.label === '有隔阂' ? relation.inviteReason ?? '' : ''}`,
    character.id === HERBALIST && herbJournalLine(journey),
    memories.length > 0 && `你亲历过的事：${memories.join('；')}`,
    plan && `你已经定好的安排：${plan}`,
    earlier && `刚才的对话：\n${earlier}`,
    recalledLines(journey, character.id, line, history),
    direction,
    `用${character.name}的身份接对方最后一句，“我”指${character.name}，“你”指${player.daoName}。只输出${character.name}说的一两句中文对白，省去旁白、姓名标签和外层引号。`,
    '答到对方问的细节再说别的。可以反问、推辞或提条件，拿不准的事可以直说。',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: notes },
    { role: 'user', content: `${player.daoName}对${character.name}说：\n${line}` },
  ];
}

export function saveNpcChat(journey: JourneyState, charId: string, messages: NpcChatMessage[], greeting: string): JourneyState {
  const stored = journey.npcChats?.[charId];
  const notes = conversationMemories(stored?.recollections ?? [], messages);
  const retained = new Set([...notes.slice(-100), ...notes.filter(({ quote }) => REMEMBER_REQUEST.test(quote)).slice(-24)]);
  return {
    ...journey,
    npcChats: {
      ...journey.npcChats,
      [charId]: {
        day: journey.day, regionId: journey.regionId, greeting,
        messages: messages.slice(-CHAT_HISTORY_LIMIT), recollections: notes.filter((entry) => retained.has(entry)),
      },
    },
  };
}

export function deliverNpcLetter(journey: JourneyState, charId: string, record: StoryRecord): JourneyState {
  const thread = journey.npcChats?.[charId];
  if (!thread) return journey;
  const message: NpcChatMessage = { role: 'assistant', content: record.text, scripted: true, day: record.day };
  return {
    ...journey, npcChats: {
      ...journey.npcChats,
      [charId]: { ...thread, messages: [...thread.messages, message].slice(-CHAT_HISTORY_LIMIT) },
    },
  };
}
