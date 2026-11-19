import type { ChatCompletionMessage } from '@wllama/wllama';
import { NPC_PROFILES } from '../data/npcProfiles';
import { WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, NpcChatMessage, NpcChatRecollection, StoryRecord } from '../types/journey';
import { craftItemName } from './crafting';
import { HERBALIST, herbJournalLine } from './herbJourney';
import { NPC_DECISIONS, type NpcDecision, pendingNpcTask } from './npcPlans';
import { relationshipFor } from './relationships';

const CHAT_HISTORY_LIMIT = 24;
const REMEMBER_REQUEST = /记住|记下|别忘|别告诉|别对旁人说|只告诉你|替我保密/u;
const EXPLICIT_RECALL = /记得[吗么]|记得.{1,40}(?:吗|么|[？?])|还记得|记不记得|还记着|记住了[吗么]|有没有印象|想得起|想不想得起|(?:方才|刚才|上[一次回句]|之前|先前|提过|说过).{0,25}(?:什么|哪|谁|怎|为何|叫啥|[吗么？?])/u;

export function isMemoryTurn(line: string): boolean {
  // Recalling an experience aloud is a contribution to the conversation.
  if (/^(?:其实|唉[，, ]*|说起来[，, ]*)?我(?:一直|也|现在|到现在)?还?记得/u.test(line) &&
      !/你.{0,2}记得|记不记得|帮我记住|请记住/u.test(line)) return false;
  if (EXPLICIT_RECALL.test(line)) return true;
  return REMEMBER_REQUEST.test(line) && !/见面|赴约|约见|取消|改期|查访|帮.{0,8}查/u.test(line);
}

function regionName(regionId: string) {
  return WORLD_REGIONS.find((region) => region.id === regionId)?.name ?? '九州';
}

function spokenLines(text: string): string {
  const dialogue = [...text.matchAll(/「([^」]+)」/gu)].map((match) => match[1]);
  return dialogue.length ? dialogue.join('') : text;
}

function memoryKey(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

// Drop the scaffolding of a recall question before matching its subject.
function topicText(text: string): string {
  return memoryKey(text.replace(/记不记得|有没有印象|还记得|记得|帮我记住|替我记住|请记住|记住|记下|别忘了|请问|刚才|上一次|上次|上回|之前|先前|那时候|有没有|只告诉你|告诉过你|告诉你|提到过|提过|说过|叫(?:什么|啥)(?:名字|名儿)?|名叫|名为|名字|什么|怎样|怎么|是不是|[这那一][个把柄匹只张枚件本条]|我[的们]?|你[的们]?|[的是吗么呀呢啊]/gu, ' ')
    .replace(/故乡|老家/gu, '家乡').replace(/小名|绰号/gu, '外号').replace(/口令|暗语/gu, '暗号'));
}

function related<T>(query: string, entries: T[], textOf: (entry: T) => string, limit: number): T[] {
  const q = topicText(query);
  if (!q) return [];
  if (q.length === 1) {
    // A name question such as “我的剑叫什么” has only one meaningful character.
    // Match the named object so a later “我去练剑” doesn't overwrite the name.
    const nameQuestion = /叫什么|叫啥|名字|名儿/u.test(query);
    const namedObject = new RegExp(q + '(?:的)?(?:名字|名儿|名叫|名为|名唤|改名|取名|起名|叫|唤)', 'u');
    return entries.filter(entry => {
      const text = textOf(entry);
      return nameQuestion ? namedObject.test(text) : topicText(text).includes(q);
    }).slice(-limit).reverse();
  }
  const terms = new Set(Array.from({ length: q.length - 1 }, (_, i) => q.slice(i, i + 2)));
  return entries.map((entry, index) => {
    const candidate = topicText(textOf(entry));
    const score = [...terms].reduce((sum, term) => sum + Number(candidate.includes(term)), 0);
    return { entry, score, index };
  }).filter(item => item.score >= Math.min(3, Math.ceil(terms.size / 3)))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit).map(item => item.entry);
}

function keepQuote(quote: string) {
  return memoryKey(quote).length >= 3 && !EXPLICIT_RECALL.test(quote) &&
    (REMEMBER_REQUEST.test(quote) || !/(?:[？?]|叫(?:什么|啥)(?:名字|名儿)?[呢啊。]?)\s*$/u.test(quote)) &&
    !/^(?:你好|多谢|谢谢|告辞|我先走了|再见|嗯嗯|知道了|好的)[！!。.…]*$/u.test(quote);
}

function conversationMemories(saved: NpcChatRecollection[], turns: NpcChatMessage[]): NpcChatRecollection[] {
  const known = new Map<string, NpcChatRecollection>();
  function record(entry: NpcChatRecollection) {
    const key = memoryKey(entry.quote);
    const previous = known.get(key);
    if (previous && (previous.day ?? 0) > (entry.day ?? 0)) return;
    known.delete(key);
    known.set(key, entry);
  }
  for (const entry of saved) if (keepQuote(entry.quote)) record(entry);
  const recent = turns.slice(-CHAT_HISTORY_LIMIT);
  for (const [index, message] of recent.entries()) {
    if (message.role !== 'user' || message.scripted || !keepQuote(message.content)) continue;
    const response = recent[index + 1];
    record({
      quote: message.content.trim().slice(0, 500), day: message.day,
      reply: response?.role === 'assistant' && !response.scripted ? response.content.slice(0, 140) : undefined,
    });
  }
  const all = [...known.values()];
  const important = all.filter(({ quote }) => REMEMBER_REQUEST.test(quote)).slice(-16);
  const retained = new Set([...important, ...all.slice(-48)]);
  return all.filter(entry => retained.has(entry));
}

function matchingRecollections(journey: JourneyState, charId: string, history: NpcChatMessage[], line: string) {
  const visible = (entry: { day?: number }) => entry.day === undefined || entry.day <= journey.day;
  const notes = conversationMemories((journey.npcChats?.[charId]?.recollections ?? []).filter(visible), history.filter(visible));
  const recentQuestion = /^(?:你还记得|你记得|还记得|我|我们|咱们)?(?:刚才|方才|上一句|上句话|上回|上次)(?:我|跟你|和你|对你|咱们|我们|都|到底|让你|说过|说了|说|聊了|聊过|聊|讲过|讲|提过|谈过|谈了|提了|过|的|些|什么|哪件事|哪句话|啥|呢|吗|[？?。 ，,])*$/u;
  if (recentQuestion.test(line)) return notes.slice(-1);
  // A general "What did I ask you to remember?" should recall the entrusted words.
  if (/让你记住(?:的)?(?:什么|哪句话)|(?:记得|记住了).{0,9}(?:嘱咐|托付|交代).{0,5}(?:什么|事[吗么？?])/u.test(line))
    return notes.filter(note => REMEMBER_REQUEST.test(note.quote)).slice(-1);
  return related(line, notes, entry => entry.quote, 2);
}

export function groundedMemoryReply(journey: JourneyState, charId: string, history: NpcChatMessage[], line: string): string | undefined {
  if (!isMemoryTurn(line)) return;
  const remember = REMEMBER_REQUEST.test(line) && !EXPLICIT_RECALL.test(line);
  if (remember) {
    const detail = line.replace(/^(?:请|你|帮我|替我|这件事)?(?:牢牢记住|记住|记下|别忘了?)[：:，,\s]*/u, '').trim();
    if (!detail || detail === '。') return '你想让我记住哪句话？';
    return /保密|别告诉|别对旁人说|只告诉你/u.test(line) ? '我记住了。你托我收着的话，到我这里为止。'
      : '好，我记下了。下回你问，我还认得这句话。';
  }
  if (/(?:你刚才|刚才你|方才你|你上一句|你上次|上次你).{0,8}(?:说|答|讲|回)(?:的|了|是|过)*(?:什么|啥|哪句)/u.test(line)) {
    const previous = [...history].reverse().find(m => m.role === 'assistant' && (m.day === undefined || m.day <= journey.day));
    if (previous) return '我当时说的是：「' + spokenLines(previous.content).slice(0, 160) + '」';
  }
  const task = pendingNpcTask(journey, charId);
  if (task?.npcTask?.kind === 'meet' && /约(?:定|好|在|了|到|见|期)|见面|碰头/u.test(line)) {
    return '我记着呢。我们说好第' + task.day + '日在' + regionName(task.regionId) + '谈「' + task.npcTask.subject + '」。';
  }
  if (task?.npcTask?.kind === 'inquire' && /打听|查访|查的事/u.test(line)) {
    return '你托我查「' + task.npcTask.subject + '」。约的是第' + task.day + '日回信。';
  }
  const note = matchingRecollections(journey, charId, history, line)[0];
  if (note) return '你' + (note.day ? '第' + note.day + '日' : '先前') + '跟我说过：「' + note.quote + '」';
  const event = related(line, (journey.memories[charId] ?? []).filter(m => m.day <= journey.day), m => m.detail, 1)[0];
  if (event) return '我记得第' + event.day + '日的事。' + event.detail;
  return '我一下对不上你问的哪件事。给我提个地名，或者提两个当时说过的字？';
}

export function npcPlanLabel(task: StoryRecord | undefined): string | undefined {
  if (!task?.npcTask) return;
  return task.npcTask.kind === 'meet'
    ? (task.npcTask.arrived ? '已依约到场 · ' : '') + '第 ' + task.day + ' 日在' + regionName(task.regionId) + '见，留到第 ' + (task.day + 1) + ' 日 · ' + task.npcTask.subject
    : '第 ' + task.day + ' 日回信 · ' + task.npcTask.subject;
}

export function continueOfflineChat(history: NpcChatMessage[], line: string, fallback: string, familiar: boolean): string {
  const last = history[history.length - 1];
  if (!last || last.role !== 'assistant' || last.scripted) return fallback;
  if (last.content.includes('陪你听一会儿，还是替你拿个主意')) {
    if (/听|陪|不用.{0,4}(?:想|说)|不必/u.test(line)) return '好。你照自己的意思慢慢说，我先不打断。';
    if (/主意|怎么|想想|办法|你觉得/u.test(line)) return '那我们一件件来。眼下最让你为难的，是还没发生的事，还是已经发生的那件？';
  }
  const previous = history.slice(-6).filter(turn => turn.role === 'assistant');
  if (!previous.some(turn => turn.content === fallback)) return fallback;
  const alternatives = familiar ? ['原来你是这么想的。接着说，我想听完。', '这回我倒想知道，你自己最想怎么做？', '嗯。你想从哪儿讲起都成。']
    : ['原来如此。我先前没想到这一层。', '这里我还没弄清。能再说得细些么？', '你再往下讲讲，我想听完。'];
  return alternatives.find(reply => !previous.some(turn => turn.content === reply)) ?? fallback;
}

function currentScene(character: CharacterData, runtime: CharacterRuntimeState, journey: JourneyState, line: string): string {
  const status = journey.npcStatuses[character.id];
  const location = status?.regionId ?? journey.regionId;
  const mode = location === journey.regionId ? '当面交谈' : '对方在' + regionName(journey.regionId) + '，以玉简传音';
  const relation = relationshipFor(journey, character.id, runtime);
  const ourOrders = journey.craft?.orders.filter(order => order.maker === character.id) ?? [];
  const orders = ourOrders.slice().sort((a, b) => Number(line.includes(craftItemName(b.recipeId))) - Number(line.includes(craftItemName(a.recipeId))) || b.id - a.id).slice(0, 2);
  const plan = npcPlanLabel(pendingNpcTask(journey, character.id));
  const mood = { normal: '平静', smile: '高兴', shy: '羞涩', angry: '生气', injured: '带伤', blackened: '戒备' }[runtime.emotion];
  return [
    '今天第' + journey.day + '日，明日第' + (journey.day + 1) + '日。你在' + regionName(location) + '；' + mode + '。',
    status?.activityText && '眼下：' + status.activityText + (status.availableUntilDay !== undefined ? '（此行至第' + status.availableUntilDay + '日）' : ''),
    '交情：' + relation.label + '，好感' + runtime.affection + '，此刻' + (mood ?? '平静') +
      (runtime.isSoulmate ? '，彼此已结契' : '') + (relation.label === '有隔阂' ? '。' + relation.inviteReason : ''),
    plan && '已约定：' + plan.slice(0, 105),
    character.id === HERBALIST && herbJournalLine(journey),
    ...orders.map(order => '受托制作' + craftItemName(order.recipeId) + '：' + (order.dueDay <= journey.day ? '成品正待领取' : '尚未交付')
      + '，第' + order.dueDay + '日起到' + regionName(order.regionId) + '取件。'),
    !orders.length && /炼|锻|取件|委托|交货|丹炉/u.test(line) && '你手里没有此人的待交付订单。',
  ].filter(Boolean).join('\n');
}

// Prior turns use the chat template's speaker roles. Never put player-supplied
// dialogue into the character instruction as if the player wrote game rules.
function recentTurns(history: NpcChatMessage[], today: number, maxChars: number): ChatCompletionMessage[] {
  const recent: ChatCompletionMessage[] = [];
  let remaining = maxChars;
  for (const message of history.slice(-8).reverse()) {
    if (message.day !== undefined && message.day !== today) continue;
    if (remaining < 20) break;
    const raw = message.role === 'assistant' && message.scripted ? spokenLines(message.content) : message.content;
    const text = raw.trim().slice(0, Math.min(135, remaining));
    if (!text) continue;
    const first = recent[0];
    if (first?.role === message.role) first.content = text + '\n' + first.content;
    else recent.unshift({ role: message.role, content: text });
    remaining -= text.length;
  }
  if (recent[0]?.role === 'assistant') recent.unshift({ role: 'user', content: '（接续交谈）' });
  if (recent[recent.length - 1]?.role === 'user') recent.pop();
  return recent;
}

// At the first exchange on a later day, a short answer may refer to the other
// person's last question. Carry both voices, with the original date attached.
function previousExchange(history: NpcChatMessage[], today: number): ChatCompletionMessage[] {
  const newTurns = history.filter(turn => turn.role === 'user' && turn.day === today).length;
  if (newTurns >= 3) return [];
  for (let index = history.length - 2; index >= 0; index--) {
    const said = history[index];
    const heard = history[index + 1];
    if (said.role !== 'user' || said.scripted || said.day === undefined || said.day >= today ||
        (newTurns > 0 && today - said.day > 3) || heard.role !== 'assistant' || heard.day !== said.day) continue;
    return [{ role: 'user', content: `（第${said.day}日的旧话）${said.content.slice(0, 95)}` },
      { role: 'assistant', content: spokenLines(heard.content).slice(0, 100) }];
  }
  return [];
}

export function npcDecisionMessages(
  character: CharacterData, runtime: CharacterRuntimeState, journey: JourneyState, history: NpcChatMessage[],
  line: string, options: Partial<Record<NpcDecision['action'], string>>,
  topics: { label: string; meaning: string }[] = [], currentQuestion?: string,
): ChatCompletionMessage[] {
  const actions = Object.entries(options).map(([key, rule]) => NPC_DECISIONS[key as NpcDecision['action']] + '：' + rule);
  const setting = [
    '替' + character.name + '决定此刻如何回应。' + (NPC_PROFILES[character.id]?.voice ?? character.personalityTags.join('、')),
    currentScene(character, runtime, journey, line),
    currentQuestion && '当前话题起点：' + currentQuestion.slice(0, 170),
    ...actions,
    ...topics.map(topic => topic.label + '：对方的意思是「' + topic.meaning + '」。'),
    '读懂最后一句的意思。能用自己的话表达，不必和选项用词相同。话题只在对方确实选了这一做法时用。',
    'attitude 是这句话对你的态度。向你倾吐烦恼选倾诉，留意你的身心选关怀，转述别人说的话不算逼你。',
    'proposal 是对方当下真的想发起的邀约或查访，其余填无。只要有提议或特殊态度，subject 摘录对方这句话中能体现它的原文（最多32字），其余留空。',
    'action 是你愿意做什么。根据性情、交情和日程决定。同意才选答应见面或答应查访，婉拒就继续交谈；回顾和假设不算提议。难以判断填不确定。',
  ].filter(Boolean).join('\n');
  const prior = [...previousExchange(history, journey.day), ...recentTurns(history, journey.day, 230)];
  const recalled = matchingRecollections(journey, character.id, history, line).find(note =>
    !prior.some(turn => turn.role === 'user' && typeof turn.content === 'string' && turn.content.includes(note.quote)));
  const current = recalled ? '较早的原话（仅作背景）：「' + recalled.quote.slice(0, 95) + '」\n现在：' + line.slice(0, 500) : line.slice(0, 500);
  return [{ role: 'system', content: setting }, ...prior, { role: 'user', content: current }];
}

export function npcChatMessages(
  character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState, journey: JourneyState,
  history: NpcChatMessage[], line: string, direction: string, unfolding?: string,
): ChatCompletionMessage[] {
  const scene = currentScene(character, runtime, journey, line);
  const events = (journey.memories[character.id] ?? []).filter(m => m.day <= journey.day);
  const significant = events.filter(m => ['help', 'harm', 'absence', 'apology', 'confidence'].includes(m.kind));
  const salient = [...new Set([...related(line, events, entry => entry.detail, 2), ...significant.slice(-1), ...events.slice(-1)])].slice(0, 3);
  const profile = NPC_PROFILES[character.id];
  const system = [
    '你是' + character.name + '，' + character.title + '。对面是' + player.daoName + '。' + (profile?.voice ?? character.personalityTags.join('、')),
    scene,
    unfolding && '眼前这件事还未决定：' + unfolding.slice(0, 240),
    ...salient.map(entry => '共同经历（第' + entry.day + '日）：' + entry.detail.slice(0, 85)),
    '本轮定下的事：' + direction.slice(0, 190),
    '用自己的口气接着谈，对方回答了你的问题就顺着答。依据交情决定说到哪一步；旧话只在相关时提起。无需每句都反问。履约和物品以本轮记录为准。',
  ].filter(Boolean).join('\n');
  const prior = [...previousExchange(history, journey.day), ...recentTurns(history, journey.day, 380)];
  const notes = matchingRecollections(journey, character.id, history, line)
    .filter(note => !prior.some(turn => turn.role === 'user' && turn.content === note.quote));
  const excerpts = notes.map(note => '我' + (note.day ? '第' + note.day + '日' : '先前') + '曾对你说过：「' + note.quote.slice(0, 110) + '」' +
    (note.reply ? ' 当时你回答：「' + note.reply.slice(0, 64) + '」' : ''));
  const content = excerpts.length ? '旧话摘录（只作回忆）：\n' + excerpts.join('\n') + '\n我现在问：' + line.slice(0, 500) : line.slice(0, 500);
  return [{ role: 'system', content: system }, ...prior, { role: 'user', content }];
}

export function saveNpcChat(journey: JourneyState, charId: string, messages: NpcChatMessage[], greeting: string): JourneyState {
  const saved = journey.npcChats?.[charId]?.recollections ?? [];
  return { ...journey, npcChats: { ...journey.npcChats, [charId]: {
    day: journey.day, regionId: journey.regionId, greeting, messages: messages.slice(-CHAT_HISTORY_LIMIT),
    recollections: conversationMemories(saved, messages),
  } } };
}

export function deliverNpcLetter(journey: JourneyState, charId: string, record: StoryRecord): JourneyState {
  const thread = journey.npcChats?.[charId] ?? { day: record.day, regionId: journey.regionId, messages: [] };
  const message: NpcChatMessage = { role: 'assistant', content: record.text, scripted: true, day: record.day };
  return { ...journey, npcChats: { ...journey.npcChats,
    [charId]: { ...thread, messages: [...thread.messages, message].slice(-CHAT_HISTORY_LIMIT) } } };
}
