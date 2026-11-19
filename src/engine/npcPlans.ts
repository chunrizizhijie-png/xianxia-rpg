import { activeCraftOrder } from './crafting';
import { NPC_PROFILES } from '../data/npcProfiles';
import { CRAFT_MATERIALS, WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, StoryRecord } from '../types/journey';
import { HERBALIST } from './herbJourney';
import { relationshipFor } from './relationships';
import { dayForPlan, dayReferences, mentionedRegions } from './npcCalendar';

export interface NpcDecision {
  action: 'talk' | 'inquire' | 'meet' | 'reschedule' | 'cancel';
  subject: string;
  days: number;
  news: string;
}

export const NPC_DECISIONS: Record<NpcDecision['action'], string> = {
  talk: '继续交谈', inquire: '答应查访', meet: '答应见面', reschedule: '更改约见', cancel: '取消安排',
};

export interface DecisionResult {
  journey: JourneyState;
  direction: string;
  note?: string;
  spoken?: { cue: RegExp; fallback: string };
  confirmed?: { day: number; regionId?: string };
}

export function pendingNpcTask(journey: JourneyState, charId: string): StoryRecord | undefined {
  return journey.openStory?.pending.find(entry => entry.charId === charId && entry.npcTask);
}

export function npcMeetingAt(journey: JourneyState, charId: string): StoryRecord | undefined {
  return journey.openStory?.pending.find(entry => entry.charId === charId && entry.npcTask?.kind === 'meet' &&
    entry.day <= journey.day && journey.day <= entry.day + 1);
}

export function canKeepNpcMeeting(journey: JourneyState, charId: string, day: number): boolean {
  const status = journey.npcStatuses[charId];
  // The day being settled may fall inside a retreat that ended after the furnace cooled.
  const tendingOrder = journey.craft?.orders.some(order => order.maker === charId && day < order.dueDay);
  const herbTrip = journey.herb;
  const preparingHerbs = charId === HERBALIST && (herbTrip.phase === 'promised' || herbTrip.phase === 'missed' || herbTrip.phase === 'fulfilled') &&
    day <= (herbTrip.meetingDay ?? 0) + 1;
  return Boolean(status && !status.isCompanion && (status.recoverUntilDay ?? 0) < day &&
    !tendingOrder && !preparingHerbs &&
    !(journey.herb.resolvedDay !== undefined && day >= journey.herb.resolvedDay && day <= journey.herb.resolvedDay + 2 &&
      (charId === HERBALIST || charId === journey.herb.helperId)));
}

const dateRecall = /还?记得|记不记得|还记不记|上次|上回|之前.{0,8}(说|提|约)|(?:为什么|为何|是不是|是否|已经|当时|刚才).{0,12}(?:取消|约好|约过|改期)|约的是|约了.{0,12}(?:吗|么|哪|没)|约好.{0,18}(?:吗|么|没|对吧)|见过面|见过.{0,6}吗/u;
const notAnOrder = /假[如使]|如果|要是|听说|听闻|不想|没想|别(?:再)?帮|不用(?:再)?帮|不必|不要|别取消|不(?:必|用)?取消|不方便见|不见面|不想见|别见面|不用查|别(?:再)?查|不用打听|不打听|别打听|无需|不用改|不改期|别改|改不了/u;
const cancel = /取消|撤(?:掉|了|下|销).{0,5}(?:约|安排|查访)|作罢|不(?:能|去|再)赴约|去不了|不赴约|不来赴约|不能到场|别等我|不用等我|不查了|不用再查|不约了|先不见了|不见了/u;
const shift = /改期|改约|改(?:在|到|成|为)|推迟|延期|延后|提前|另约|换(?:个|一[个下])?(?:日子|时间|地点)|改个(?:日子|时间|地点)/u;
const meeting = /见(?:个|一)?面|碰(?:个|一)?面|会合|碰头|相会|赴约|(?:我们|咱们).{0,14}聚一聚|约你|约个时间|一起(?:论道|喝茶|切磋)|(?:[天日早晚谷巅峰宫市庐山墟里儿]|此处|那里|这边|那边)见(?:吧|如何|好吗|呀|嘛|[，。！？?!\s]|$)/u;
const inquiry = /(?:帮我|帮忙|替我|劳烦|麻烦你|能否|请你|可否|请|去)(?:再|去|顺便|向.{1,8})?(?:打听|查证|查一下|查查|查访|问问|问一下|查明)|(?:查证|查访|打听一下|帮我查|帮忙查|替我查)/u;

function planIntent(line: string, hasPending: boolean): NpcDecision['action'] | undefined {
  if (dateRecall.test(line) || /[“「].*(?:约见|见面|打听|取消).*?[”」]/u.test(line)) return;
  if (/(?:别|不要|不用|不想|不必|不会|没有|没说).{0,4}(?:取消|改期|改到|改成|撤销)/u.test(line)) return;
  if (/假[如使]|如果|要是|听说|听闻|并没有|没说要|谁说要|没让你/u.test(line)) return;
  if (hasPending && cancel.test(line)) return 'cancel';
  if (notAnOrder.test(line)) return;
  if (shift.test(line)) return 'reschedule';
  if (inquiry.test(line)) return 'inquire';
  if (meeting.test(line) || /(?:来|到|去|在).{0,12}(?:等我|等你|找我|找你)|(?:一起|一道|结伴)(?:去|到).{1,10}(?:采药|采矿|修炼|探访)/u.test(line)) return 'meet';
}

function subjectOf(line: string, action: NpcDecision['action']) {
  const request = line.match(inquiry);
  const topic = action === 'inquire' ? line.slice((request?.index ?? 0) + (request?.[0].length ?? 0))
    : line.match(/(?:谈谈|讨论|商量|想谈|聊聊|给你看|想问|请教)([^。？！!?]{1,36})/u)?.[1];
  return (topic ?? '').replace(/^(?:一下|一查|一下子|查)/u, '').split(/[，,。！？!?；;]/u)[0]
    .replace(/(?:好吗|好么|可以吗|行吗|能吗|吧|吗|么|呢|呀)$/u, '').trim().slice(0, 32);
}

const asksForDay = /想约在哪一日|另约一个之后的日子|是哪一日|再挑个日子/u;
const asksForPlace = /在哪里碰面|换个我们都能到的地方/u;
const asksForSubject = /要查的是哪件事/u;

function answerClarification(previous: string, reply: string, line: string, today: number, pending: boolean): string {
  if (dateRecall.test(line) || notAnOrder.test(line) || cancel.test(line) || /换个话题|聊点别的|不约/u.test(line)) return line;
  const action = planIntent(previous, pending);
  if (!action || (action !== 'meet' && action !== 'reschedule' && action !== 'inquire')) return line;
  const newAction = planIntent(line, pending);
  if (newAction && newAction !== action && !(newAction === 'meet' && action === 'reschedule')) return line;
  const verb = action === 'reschedule' ? '把约见改到' : '我们见面吧，';
  const newDates = dayReferences(line, today);
  const newPlaces = mentionedRegions(line);
  const topic = subjectOf(previous, action);
  const originalTopic = topic && !subjectOf(line, 'meet') ? '，谈谈' + topic : '';
  if (asksForDay.test(reply) && newDates.length) {
    const oldPlaces = mentionedRegions(previous);
    const place = newPlaces.length || oldPlaces.length !== 1 ? '' : oldPlaces[0].name;
    return action === 'inquire' ? '帮我查查' + topic + '，' + line : verb + place + line + originalTopic;
  }
  if (asksForPlace.test(reply) && newPlaces.length) {
    const oldDates = dayReferences(previous, today);
    const date = !newDates.length && oldDates.length === 1 ? '第' + oldDates[0] + '日，' : '';
    return verb + date + line + originalTopic;
  }
  if (action === 'inquire' && asksForSubject.test(reply) && line.length <= 60 && !newAction) {
    return '帮我查查' + line;
  }
  return line;
}

function proposalLine(line: string, journey: JourneyState, charId: string): string {
  const turns = journey.npcChats?.[charId]?.messages ?? [];
  let start = turns.length;
  while (start >= 2) {
    const reply = turns[start - 1];
    if (turns[start - 2].role !== 'user' || reply.role !== 'assistant' || reply.day !== journey.day ||
      !(asksForDay.test(reply.content) || asksForPlace.test(reply.content) || asksForSubject.test(reply.content))) break;
    start -= 2;
  }
  if (start === turns.length) return line;
  const pending = Boolean(pendingNpcTask(journey, charId));
  let proposal = turns[start].content;
  for (let i = start + 1; i < turns.length; i += 2) {
    proposal = answerClarification(proposal, turns[i].content, turns[i + 1]?.content ?? line, journey.day, pending);
  }
  return proposal;
}

export function deriveNpcPlan(input: string, journey: JourneyState, charId: string): NpcDecision | undefined {
  const line = proposalLine(input.trim(), journey, charId);
  const pending = pendingNpcTask(journey, charId);
  const action = planIntent(line.trim(), Boolean(pending));
  if (!action) return;
  return { action, subject: subjectOf(line, action) || (action === 'meet' ? '当面叙谈' : ''), days: 2, news: '' };
}

function answer(journey: JourneyState, text: string): DecisionResult {
  return { journey, direction: text, spoken: { cue: /(?!)/u, fallback: text } };
}

function meetingPlace(line: string, journey: JourneyState, npcRegionId: string, previous?: StoryRecord) {
  const regions = mentionedRegions(line);
  if (regions.length > 1 || /还是|或者|或是/u.test(line)) return;
  if (regions.length) return regions[0];
  if (/你那(?:里|边|儿)|你所在/u.test(line)) return WORLD_REGIONS.find(r => r.id === npcRegionId);
  if (/(?:[去到在](?!这里|这儿|此处|我这里|我这儿|我这边|原地)[\p{Script=Han}]{1,16}(?:见|碰头|会合)|[\p{Script=Han}]{1,6}(?:城|镇|楼|谷|巷|街|门|亭|寺|桥|庄|村|铺|山)见)/u.test(line)) return;
  const samePlace = /这里|这儿|此处|我这边|原地/u.test(line);
  const id = samePlace ? journey.regionId : previous?.regionId ?? (npcRegionId === journey.regionId ? journey.regionId : undefined);
  return WORLD_REGIONS.find(region => region.id === id);
}

export function npcDecisionOptions(
  character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState, journey: JourneyState, line: string,
): Partial<Record<NpcDecision['action'], string>> {
  const options: Partial<Record<NpcDecision['action'], string>> = { talk: '照你的意思回应，也可以拒绝或追问。' };
  const intent = deriveNpcPlan(line, journey, character.id);
  if (!intent || !runtime.met || player.isDead) return options;
  const pending = pendingNpcTask(journey, character.id);
  if (intent.action === 'cancel' && pending) options.cancel = '明确撤销此前的安排。';
  if (!runtime.hasContact || relationshipFor(journey, character.id, runtime).label === '有隔阂') return options;
  if (intent.action === 'reschedule' && pending?.npcTask?.kind === 'meet') options.reschedule = '愿意改动已经谈妥的约见。';
  if (intent.action === 'meet' && !pending) options.meet = '愿意赴对方刚提出的约。';
  if (intent.action === 'inquire' && !pending) options.inquire = '愿意去查证对方提出的那件事。';
  return options;
}

// Report what this NPC can learn in the simulated world. A generated future letter cannot grant items or invent events.
function inquiryFinding(subject: string, character: CharacterData, journey: JourneyState) {
  const material = CRAFT_MATERIALS.find(item => subject.includes(item.name));
  if (material) {
    const sources = WORLD_REGIONS.filter(r => r.specialtyMaterials.includes(material.id));
    const region = sources.find(r => r.id === journey.regionId) ?? sources[0];
    if (region) return `问到采过${material.name}的人了。他说在${region.name}寻得到。留出一日去采，能碰着哪一味还得看运气。`;
  }
  const names = mentionedRegions(subject);
  if (names.length === 1) {
    const region = names[0];
    const item = CRAFT_MATERIALS.find(m => region.specialtyMaterials.includes(m.id));
    return `我查过${region.name}的行路记录。${region.dangerLevel}。${item ? '那里有人采到过' + item.name + '。' : ''}`;
  }
  const local = WORLD_REGIONS.find(r => r.id === journey.npcStatuses[character.id]?.regionId);
  return `我替你问过${local?.name ?? '附近'}的行人了。「${subject}」还没找到能作证的人，我暂且不下定论。`;
}

export function applyNpcDecision(
  decision: NpcDecision, character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState,
  journey: JourneyState, input: string,
): DecisionResult {
  const charId = character.id;
  const noPlan = { journey, direction: '这轮只交谈。没有产生新的约定或物品。' };
  const line = proposalLine(input.trim(), journey, charId);
  const intent = deriveNpcPlan(input, journey, charId);
  if (!intent) return noPlan;
  const story = journey.openStory ?? { history: [], pending: [], turns: 0 };
  const previous = pendingNpcTask(journey, charId);
  const status = journey.npcStatuses[charId];
  if (!runtime.met || !status || player.isDead) return answer(journey, '眼下无法递上这句话。');
  const turns = story.turns + 1;
  const id = `story:${turns}`;
  const reject = (text: string) => answer(journey, text);

  if (intent.action === 'cancel' && previous && decision.action === 'cancel') {
    const text = `${character.name}撤下了「${previous.npcTask?.subject}」的安排。`;
    return { ...answer(journey, '好，我把这件事划去了。以后要约，再留信给我。'), note: text,
      journey: { ...journey, openStory: { turns, pending: story.pending.filter(e => e.id !== previous.id),
        history: [...story.history, { id, charId, day: journey.day, regionId: previous.regionId, text }] } } };
  }
  if (intent.action === 'cancel') return reject('这件事先照原定的安排。');
  if (!runtime.hasContact) return reject('我们还没互留传音印记。先认下彼此的玉简，往后才好约日子。');
  if (relationshipFor(journey, charId, runtime).label === '有隔阂') return reject('那件事我还没放下。这阵子先别替我排日程了。');
  if (intent.action === 'reschedule' && previous?.npcTask?.kind !== 'meet') return reject('我们还没有定下能改期的约见。你想什么时候、在哪里碰面？');
  if (previous && intent.action !== 'reschedule') return reject(`之前的「${previous.npcTask?.subject}」定在第 ${previous.day} 日。先办完，或告诉我想怎样改约。`);
  const dates = dayForPlan(line, journey.day);
  if (dates.error) return reject(dates.error);
  const meet = intent.action === 'meet' || intent.action === 'reschedule';
  const place = meet ? meetingPlace(line, journey, status.regionId, previous)
    : WORLD_REGIONS.find(r => r.id === status.regionId);
  if (!place) return reject('在哪里碰面？说一个舆图上能找到的地方，我们再把这件事定下来。');
  if (meet && Math.min(player.realmIndex, status.realmIndex) < place.minRealmIndex) return reject(`${place.name}的路一时去不得。换个我们都能到的地方吧。`);
  if (!dates.day && meet && (!previous || previous.day <= journey.day || place.id === previous.regionId)) return reject('是哪一日？你定个日子，我看看能否腾出时间。');
  const day = dates.day ?? (meet && previous ? previous.day : journey.day + Math.max(1, Math.min(7, decision.days || 2)));
  const lifeLeft = (player.lifespanCapYears * 12 - player.ageMonths) * 30 - ((journey.day - 1) % 30);
  if (day - journey.day >= lifeLeft) return reject('这个日子太远。还是先办眼前的事吧。');
  if (meet && !canKeepNpcMeeting(journey, charId, day)) return reject('那日已有要事，我不能答应你再去一处。再挑个日子吧。');
  if ((!meet && (status.recoverUntilDay ?? 0) >= journey.day) || (status.canIntervene && status.interveneType === 'rescue') ||
    (!meet && activeCraftOrder(journey, charId))) return reject('我眼下有事走不开，等忙过这阵再来问我。');
  const subject = meet && previous ? previous.npcTask!.subject :
    (intent.subject || (decision.action === 'inquire' ? decision.subject : '')).trim().replace(/[「」\r\n]/gu, '').slice(0, 32);
  if (!subject) return reject('要查的是哪件事？把人、地方或物件说得具体些，我才好去问。');
  if (decision.action !== intent.action) return reject('这件事我还不想应下。容我再想想。');
  const note = meet
    ? `${character.name}${previous ? '把旧约改到' : '约在'}第 ${day} 日，到${place.name}见面，留到第 ${day + 1} 日。`
    : `${character.name}接下「${subject}」的查访，第 ${day} 日传回消息。`;
  const text = meet ? `${character.name}已到${place.name}，依约等你谈「${subject}」，留到第 ${day + 1} 日。`
    : `${character.name}为「${subject}」传回消息。「${inquiryFinding(subject, character, journey)}」`;
  const kind = meet ? 'meet' : 'inquire';
  const task: StoryRecord = { id, day, regionId: place.id, charId, text, npcTask: { kind, subject } };
  const history = previous ? [...story.history, { id: `${id}:change`, day: journey.day, regionId: previous.regionId, charId, text: note }] : story.history;
  const fallback = meet ? `好，第 ${day} 日我在${place.name}等你。若临时有变，给我留个口信。`
    : `我去${NPC_PROFILES[charId]?.inquiry ?? '找当地人查问'}。第 ${day} 日给你回信。`;
  return { journey: { ...journey, openStory: { turns, history, pending: [...story.pending.filter(e => e.id !== previous?.id), task] } },
    note, direction: note, spoken: { cue: meet ? /见|等你|赴约|碰头/u : /查|打听|回信|传音/u, fallback },
    confirmed: { day, regionId: meet ? place.id : undefined } };
}

export function npcPlanReply(result: DecisionResult, generated?: string): string {
  const speech = result.spoken;
  if (!speech) return generated ?? '';
  if (!generated || !result.confirmed || !speech.cue.test(generated)) return speech.fallback;
  const dates = dayReferences(generated, result.journey.day);
  const regions = mentionedRegions(generated);
  const { day, regionId } = result.confirmed;
  if (dates.length !== 1 || dates[0] !== day || (regionId && (regions.length !== 1 || regions[0].id !== regionId)) ||
      /改天|有空再|再说|不去|不能|不会去|没空|不见|没答应|不一定|不方便|改期|取消|送你|给你.{0,4}(?:灵石|丹药|法宝)/u.test(generated)) return speech.fallback;
  return generated;
}
