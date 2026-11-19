import { activeCraftOrder } from './crafting';
import { NPC_PROFILES } from '../data/npcProfiles';
import { CRAFT_MATERIALS, WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, StoryRecord } from '../types/journey';
import { HERBALIST, rememberNpc } from './herbJourney';
import { relationshipFor } from './relationships';
import { dayForPlan, dayReferences, mentionedRegions } from './npcCalendar';

export interface NpcDecision {
  action: 'talk' | 'inquire' | 'meet' | 'reschedule' | 'cancel';
  subject: string;
  days: number;
  news: string;
}

/** The model may identify an invitation without supplying a date, place or permission. */
export interface NpcPlanHint {
  action: 'meet' | 'inquire';
  subject?: string;
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
const leisurely = /约(?:一?下|个会|会)|(?:出来|一起|一道|陪我|同我|跟我)(?:去|来)?(?:走走|走一走|坐坐|坐一坐|散[个步]|喝(?:杯|盏|点)?茶|吃(?:顿|个)?饭|逛逛|看[花灯]|听曲|赏[花月])/u;
const inquiry = /(?:帮我|帮忙|替我|劳烦|麻烦你|能否|请你|可否|请|去)(?:再|去|顺便|向.{1,8})?(?:打听|查证|查一下|查查|查访|问问|问一下|查明)|(?:查证|查访|打听一下|帮我查|帮忙查|替我查)/u;

// A reminiscence can lead into a new invitation. Ignore the old date and place
// only when the following clause makes a distinct request in the present.
function currentProposal(input: string, today: number, hint?: NpcPlanHint): string {
  if (!dateRecall.test(input)) return input;
  const clauses = input.split(/(?<=[。！？?!，,；;])/u);
  for (let i = 1; i < clauses.length; i++) {
    const prefix = clauses.slice(0, i).join('');
    const next = clauses.slice(i).join('').trim();
    if (!dateRecall.test(prefix) || /[「“"]|(?:问我|问你|说过|说的是|如果|要是)[，,：:]$/u.test(prefix)) continue;
    if (!dayReferences(next, today).some(day => day > today) && !/^(?:现在|这回|这次|我想|请你|能不能|帮我|咱们)/u.test(next)) continue;
    if (planIntent(next, false, hint)) return next;
  }
  return input;
}

function planIntent(line: string, hasPending: boolean, hint?: NpcPlanHint): NpcDecision['action'] | undefined {
  // “如果你方便，咱们…” is a real request, while speculating about an
  // invitation or its consequences does not book anything.
  line = line.replace(/^(?:如果|要是|若是?)(?=(?:你)?(?:明[天日晚早]|后[天日])?(?:有空|方便|愿意|得闲)(?:的话)?[，, ]+(?:我[们想]|咱们|一起|出来|明[天日晚早]|后[天日]|能否|要不要))/u, '');
  if (!line || dateRecall.test(line) || /[“「"].*(?:约见|约一下|见面|打听|取消).*?[”」"]/u.test(line)) return;
  if (/(?:别|不要|不用|不想|不必|不会|没有|没说).{0,4}(?:取消|改期|改到|改成|撤销)/u.test(line)) return;
  if (/假[如使]|如果|要是|听说|听闻|并没有|没说要|谁说要|没让你/u.test(line)) return;
  if (hasPending && cancel.test(line)) return 'cancel';
  if (notAnOrder.test(line) || /没(?:打算|准备)|(?:没|别|不)(?:跟|和|跟你|和你)?约|(?:他|她|别人|有人|朋友)(?:们)?(?:说|想|要|让|打算|约)|(?:你和|你跟|你约|我和|我跟)(?:他|她|别人|朋友)/u.test(line)) return;
  if (shift.test(line)) return 'reschedule';
  if (inquiry.test(line)) return 'inquire';
  if (meeting.test(line) || leisurely.test(line) || /(?:来|到|去|在).{0,12}(?:等我|等你|找我|找你)|(?:一起|一道|结伴)(?:去|到).{1,10}(?:采药|采矿|修炼|探访)/u.test(line)) return 'meet';
  if (hint && !/[「」“”"]|还记着|有没有印象|先前|之前|上回|原来|当时|曾经|取消|改期|撤销|不去|不来|不必|不打算|没空去/u.test(line)) return hint.action;
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
  const action = planIntent(currentProposal(previous, today), pending) ??
    (asksForSubject.test(reply) ? 'inquire' :
      asksForDay.test(reply) || asksForPlace.test(reply) ? (pending ? 'reschedule' : 'meet') : undefined);
  if (!action || (action !== 'meet' && action !== 'reschedule' && action !== 'inquire')) return line;
  const newAction = planIntent(line, pending);
  if (newAction && newAction !== action && !(newAction === 'meet' && action === 'reschedule')) return line;
  const verb = action === 'reschedule' ? '把约见改到' : '我们见面吧，';
  const newDates = dayReferences(line, today);
  const newPlaces = mentionedRegions(line);
  const topic = subjectOf(previous, action) || reply.match(/你提的「([^」]+)」我记着/u)?.[1] || '';
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

export function deriveNpcPlan(input: string, journey: JourneyState, charId: string, hint?: NpcPlanHint): NpcDecision | undefined {
  const line = proposalLine(currentProposal(input.trim(), journey.day, hint), journey, charId);
  const pending = pendingNpcTask(journey, charId);
  const action = planIntent(line.trim(), Boolean(pending), hint);
  if (!action) return;
  const excerpt = hint?.action === action && hint.subject && line.includes(hint.subject) ? hint.subject.slice(0, 32) : '';
  return { action, subject: excerpt || subjectOf(line, action) || (action === 'meet' ? '当面叙谈' : ''), days: 2, news: '' };
}

function answer(journey: JourneyState, text: string): DecisionResult {
  return { journey, direction: text, spoken: { cue: /(?!)/u, fallback: text } };
}

function meetingPlace(line: string, journey: JourneyState, npcRegionId: string, previous?: StoryRecord, suggested?: string) {
  const regions = mentionedRegions(line);
  if (regions.length > 1 || /还是|或者|或是/u.test(line)) return;
  if (regions.length) return regions[0];
  if (/你那(?:里|边|儿)|你所在/u.test(line)) return WORLD_REGIONS.find(r => r.id === npcRegionId);
  if (/(?:[去到在](?!这里|这儿|此处|我这里|我这儿|我这边|原地)[\p{Script=Han}]{1,16}(?:见|碰头|会合|镇|巷|亭|村)|[\p{Script=Han}]{1,6}(?:城|镇|楼|谷|巷|街|门|亭|寺|桥|庄|村|铺|山)见)/u.test(line)) return;
  const samePlace = /这里|这儿|此处|我这边|原地/u.test(line);
  const id = samePlace ? journey.regionId : previous?.regionId ?? (npcRegionId === journey.regionId ? journey.regionId : suggested);
  return WORLD_REGIONS.find(region => region.id === id);
}

function canArrange(journey: JourneyState, charId: string, runtime: CharacterRuntimeState, action: NpcDecision['action']) {
  if (runtime.hasContact) return true;
  if (action === 'inquire' || journey.npcStatuses[charId]?.regionId !== journey.regionId) return false;
  return runtime.isSoulmate || runtime.affection >= 10 || !!journey.memories[charId]?.some(memory =>
    ['help', 'promise', 'confidence', 'spar', 'topic'].includes(memory.kind) ||
    /^social:(?:倾诉|关怀|分享见闻):/u.test(memory.id));
}

export function npcDecisionOptions(
  character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState, journey: JourneyState, line: string, hint?: NpcPlanHint,
): Partial<Record<NpcDecision['action'], string>> {
  const options: Partial<Record<NpcDecision['action'], string>> = { talk: '照你的意思回应，也可以拒绝或追问。' };
  const intent = deriveNpcPlan(line, journey, character.id, hint);
  if (!intent || !runtime.met || player.isDead) return options;
  const pending = pendingNpcTask(journey, character.id);
  if (!canArrange(journey, character.id, runtime, intent.action)) return options;
  if (intent.action === 'cancel' && pending) options.cancel = '明确撤销此前的安排。';
  if (relationshipFor(journey, character.id, runtime).label === '有隔阂') return options;
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

const quietDayReply: Record<string, string> = {
  shen_qingqiu: '那一天我想独自练剑。有人在旁边，我总忍不住去看她的招。换个日子吧。',
  ye_liuli: '那日留给我自己吧。难得有一盏茶能从热喝到凉，不必招呼谁。',
  lin_waner: '我想把那日留在药庐试一味方子。上回就是半途出了门，回来才发现火候过了。',
  mu_qingge: '我有半阕旧曲想自己弹完。等我把收尾想通了，再来邀你听。',
  ao_shuanghua: '那日我想一个人走走。我平时总得顾着队伍，偶尔也想挑自己喜欢的路。',
  su_xinghe: '那日我想一个人校一遍星历。有你说话，我怕是抄到半夜还没抄完。',
};

function casualRefusal(character: CharacterData, runtime: CharacterRuntimeState, journey: JourneyState, day: number) {
  if (runtime.emotion === 'angry') return '我还有些气，眼下约着出去，我怕说出伤人的话。让我缓一缓。';
  // A quiet day belongs to the character's calendar, even across reloads and paraphrases.
  // Close friends are welcome more often. The world's random sequence stays untouched.
  const close = runtime.isSoulmate || runtime.affection >= 25 || relationshipFor(journey, character.id, runtime).label === '愿意相托';
  const offset = [...character.id].reduce((sum, c) => sum + c.codePointAt(0)!, journey.seed);
  if ((offset + day) % (close ? 9 : 5) === 0) return quietDayReply[character.id] ?? '我那日想留些独处的工夫。下次吧。';
}

export function applyNpcDecision(
  decision: NpcDecision, character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState,
  journey: JourneyState, input: string, hint?: NpcPlanHint,
): DecisionResult {
  const charId = character.id;
  const noPlan = { journey, direction: '这轮只交谈。没有产生新的约定或物品。' };
  const line = proposalLine(currentProposal(input.trim(), journey.day, hint), journey, charId);
  const intent = deriveNpcPlan(input, journey, charId, hint);
  if (!intent) return noPlan;
  const story = journey.openStory ?? { history: [], pending: [], turns: 0 };
  const previous = pendingNpcTask(journey, charId);
  const status = journey.npcStatuses[charId];
  if (!runtime.met || !status || player.isDead) return answer(journey, '眼下无法递上这句话。');
  const turns = story.turns + 1;
  const id = `story:${turns}`;
  const reject = (text: string) => answer(journey, text);

  if (!canArrange(journey, charId, runtime, intent.action)) {
    if (intent.action === 'inquire' || status.regionId !== journey.regionId)
      return reject('我们还没互留传音印记，走远了要怎么给你捎回音呢？');
    return reject('我们才刚认识。我今日愿意在这里和你聊聊，往后的日子，等熟一些再约吧。');
  }
  if (intent.action === 'cancel' && previous && decision.action === 'cancel') {
    const text = `${character.name}撤下了「${previous.npcTask?.subject}」的安排。`;
    return { ...answer(journey, '好，我把这件事划去了。以后要约，再留信给我。'), note: text,
      journey: { ...journey, openStory: { turns, pending: story.pending.filter(e => e.id !== previous.id),
        history: [...story.history, { id, charId, day: journey.day, regionId: previous.regionId, text }] } } };
  }
  if (intent.action === 'cancel') return reject('这件事先照原定的安排。');
  if (relationshipFor(journey, charId, runtime).label === '有隔阂') return reject('那件事我还没放下。这阵子先别替我排日程了。');
  if (intent.action === 'reschedule' && previous?.npcTask?.kind !== 'meet') return reject('我们还没有定下能改期的约见。你想什么时候、在哪里碰面？');
  if (previous && intent.action !== 'reschedule') return reject(`之前的「${previous.npcTask?.subject}」定在第 ${previous.day} 日。先办完，或告诉我想怎样改约。`);
  const dates = dayForPlan(line, journey.day);
  if (dates.error) return reject(dates.error);
  const meet = intent.action === 'meet' || intent.action === 'reschedule';
  const casual = intent.action === 'meet' && (leisurely.test(line) || (hint?.action === 'meet' && !subjectOf(line, 'meet')));
  const localStop = WORLD_REGIONS.find(r => r.id === status.regionId);
  const sharedRealm = Math.min(player.realmIndex, status.realmIndex);
  const suggested = casual && dates.day ? (localStop && localStop.minRealmIndex <= sharedRealm ? localStop.id : journey.regionId) : undefined;
  const place = meet ? meetingPlace(line, journey, status.regionId, previous, suggested)
    : WORLD_REGIONS.find(r => r.id === status.regionId);
  const topicReminder = hint?.subject && line.includes(hint.subject) ? `你提的「${intent.subject}」我记着。` : '';
  if (!place) return reject(topicReminder + '在哪里碰面？说一个舆图上能找到的地方，我们再把这件事定下来。');
  if (meet && sharedRealm < place.minRealmIndex) return reject(`${place.name}的路一时去不得。换个我们都能到的地方吧。`);
  if (!dates.day && meet && (!previous || previous.day <= journey.day || place.id === previous.regionId)) return reject(topicReminder + '是哪一日？你定个日子，我看看能否腾出时间。');
  const day = dates.day ?? (meet && previous ? previous.day : journey.day + Math.max(1, Math.min(7, decision.days || 2)));
  const lifeLeft = (player.lifespanCapYears * 12 - player.ageMonths) * 30 - ((journey.day - 1) % 30);
  if (day - journey.day >= lifeLeft) return reject('这个日子太远。还是先办眼前的事吧。');
  if (meet && !canKeepNpcMeeting(journey, charId, day)) {
    if (status.isCompanion) return reject('我就在你身边。想去哪里，如今一道走就是。');
    if ((status.recoverUntilDay ?? 0) >= day) return reject(`伤还没养好，我得歇到第 ${status.recoverUntilDay} 日。再挑个日子吧。`);
    const order = activeCraftOrder(journey, charId);
    if (order && day < order.dueDay) return reject(`那天我得守炉，到第 ${order.dueDay} 日才交货。再挑个日子吧。`);
    return reject('那日已有要事，我不能答应你再去一处。再挑个日子吧。');
  }
  if ((!meet && (status.recoverUntilDay ?? 0) >= journey.day) || (status.canIntervene && status.interveneType === 'rescue') ||
    (!meet && activeCraftOrder(journey, charId))) return reject('我眼下有事走不开，等忙过这阵再来问我。');
  const subject = meet && previous ? previous.npcTask!.subject :
    (intent.subject || (decision.action === 'inquire' ? decision.subject : '')).trim().replace(/[「」\r\n]/gu, '').slice(0, 32);
  if (!subject) return reject('要查的是哪件事？把人、地方或物件说得具体些，我才好去问。');
  if (intent.action === 'meet') {
    const refusalId = 'declined-meeting:' + day;
    const previousRefusal = journey.memories[charId]?.find(m => m.id === refusalId);
    if (previousRefusal) return reject(previousRefusal.detail);
    // A failed or uncertain reading is not the NPC deciding to decline that date.
    if (decision.action !== 'meet' && hint?.action !== 'meet') {
      return reject('我还没拿准你的意思。你是想定下那天一起出门吗？');
    }
    const reason = decision.action !== 'meet' ? '谢谢你来问。那日我想留点时间给自己，这回就不一道去了。'
      : casual && !hint ? casualRefusal(character, runtime, journey, day) : undefined;
    if (reason) return answer(rememberNpc(journey, charId, { id: refusalId, kind: 'decline', detail: reason }), reason);
  }
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
