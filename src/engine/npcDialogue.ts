import { NPC_PROFILES } from '../data/npcProfiles';
import { REALMS } from '../data/realms';
import { RETREAT_CALLS } from '../data/retreatCalls';
import type {
  CharacterChatOption,
  CharacterData,
  CharacterRuntimeState,
  PlayerState,
} from '../types/game';
import type { JourneyState, NpcMemory } from '../types/journey';
import { getAffectionStage } from './gameEngine';
import {
  awaitsHerbApology,
  completeHerbTrip,
  getHerbTrip,
  HERBALIST,
  isHerbMeetingOpen,
  rememberNpc,
  replyToHerbInvite,
} from './herbJourney';
import { getNpcAgendaReply, refreshNpcAgendas } from './livingWorldEngine';

export type DialogueChoice = {
  label: string;
  action:
    | 'greet' | 'agenda' | 'past' | 'private' | 'respect' | 'press' | 'topics'
    | 'herb' | 'promise' | 'decline' | 'apology' | 'investigate' | 'detour' | 'visit' | 'topic';
  topic?: CharacterChatOption;
  lockReason?: string;
};

export interface DialogueNode {
  line: string;
  choices: DialogueChoice[];
}

interface DialogueContext {
  character: CharacterData;
  runtime: CharacterRuntimeState;
  player: PlayerState;
  journey: JourneyState;
}

const back: DialogueChoice = { action: 'greet', label: '换个话题' };

function rememberedReply(character: CharacterData, memory?: NpcMemory): string | undefined {
  if (!memory) return;
  const profile = NPC_PROFILES[character.id];
  if (memory.kind === 'help') {
    const call = RETREAT_CALLS.find((entry) => entry.charId === character.id &&
      memory.id === `event:${entry.id}:help`);
    if (call) return call.recall;
    return profile?.rememberedHelp;
  }
  if (memory.kind === 'harm') return profile?.rememberedHarm;
  if (memory.id === 'herb-escort') {
    return '「那日随林婉儿进山走了一趟。雪莲送到药庐了，你若有事可以去问她。」';
  }
}

function herbGreeting(journey: JourneyState, nearby: boolean): string | undefined {
  const { phase, meetingDay, resolvedDay, route } = journey.herb;
  const { helperName } = getHerbTrip(journey);
  if (phase === 'missed') {
    if (!awaitsHerbApology(journey)) return '「上回的话我收到了。下回若有变动，记得早一点传信。药庐还留着你那把椅子。」';
    const opening = nearby ? '林婉儿把空药筐倒扣在门边。' : '玉简那头静了一会儿。';
    return `${opening}「我那天等到天黑，后来是${helperName}陪我进的山。下回若来不了，你能先传个信么？」`;
  }
  if (phase === 'declined') {
    return resolvedDay === undefined
      ? '「你先去忙你的。我还来得及问旁人，药篓也只带一只便够。」'
      : `「雪莲已经采回来了。${helperName}陪我走了一趟。多亏你那日早说了一声，我也好早作安排。」`;
  }
  if (phase === 'fulfilled') {
    return route === 'investigate'
      ? '「那日亏你肯停下来查路。方才我给巡山人留了两丸药，余下的才好分。」'
      : '「那条旧路我已经画进药图了。下次春雨前，还可以一起去看看。」';
  }
  if (phase === 'promised') {
    return isHerbMeetingOpen(journey)
      ? '林婉儿听见脚步，提起门边的药篓。「你来了。绳子和药都在这里，路上再说。」'
      : `「药篓我备好了。我们约在第 ${meetingDay} 日，你那天到药庐来。」`;
  }
}

export function openConversation({ character, runtime, player, journey }: DialogueContext): DialogueNode {
  const profile = NPC_PROFILES[character.id];
  const status = journey.npcStatuses[character.id];
  const nearby = status?.regionId === journey.regionId;
  const memories = journey.memories[character.id] ?? [];
  const recentPressure = memories.find((memory) => memory.kind === 'pressure');
  if (recentPressure && journey.day <= recentPressure.day + 1 &&
      !(character.id === HERBALIST && isHerbMeetingOpen(journey))) {
    return { line: profile?.privateTopic.press ?? '对方收起玉简，今日不再多谈。', choices: [] };
  }
  const personalHistory = [...memories].reverse()
    .find((memory) => memory.kind === 'help' || memory.kind === 'harm' || memory.kind === 'witness');
  let line = (nearby ? profile?.greeting : profile?.letter) ??
    character.dialogues[getAffectionStage(runtime.affection).stage]?.[0] ??
    runtime.lastSpokenLine;
  line = rememberedReply(character, personalHistory) ?? line;
  if (character.id === HERBALIST) {
    line = herbGreeting(journey, nearby) ?? (player.injury >= 15 && nearby
      ? '林婉儿看见你搭在膝上的手一直没松开。「先别说话。哪里疼，你指给我看。」'
      : line);
  }

  const choices: DialogueChoice[] = [];
  if (nearby && character.id === HERBALIST && journey.herb.phase === 'available') {
    choices.push({ action: 'herb', label: '问她药庐为何在找人进山' });
  }
  if (nearby && character.id === HERBALIST && isHerbMeetingOpen(journey)) {
    choices.push({ action: 'herb', label: '按约赴会，随她进山采药' });
  }
  if (character.id === HERBALIST && journey.herb.phase === 'promised' &&
      journey.day <= (journey.herb.meetingDay ?? 0)) {
    choices.push({ action: 'decline', label: '提前告诉她，你有事赶不过去' });
  }
  const owesApology = character.id === HERBALIST && awaitsHerbApology(journey);
  if (owesApology) choices.push({ action: 'apology', label: '为那日失约向她道歉' });
  choices.push({ action: 'agenda', label: '问她最近在忙什么' });
  if (profile) choices.push({ action: 'private', label: profile.privateTopic.question });
  if (character.chatOptions?.length) choices.push({ action: 'topics', label: '聊聊她擅长的道法' });
  if (memories.some((memory) => memory.kind !== 'topic')) {
    choices.push({ action: 'past', label: '说起你们从前的事' });
  }
  const visitedBefore = memories.some((memory) => memory.id.startsWith(`event:visit_${character.id}:`));
  if (nearby && !owesApology && !visitedBefore && status?.canIntervene && status.interveneType !== 'rescue' &&
      character.proactiveVisitEvents?.length) {
    choices.push({ action: 'visit', label: '应她的邀请，坐下来叙谈' });
  }
  return { line, choices };
}

export function chooseDialogue(
  context: DialogueContext,
  choice: DialogueChoice,
): {
  node: DialogueNode;
  player: PlayerState;
  runtime: CharacterRuntimeState;
  journey: JourneyState;
  visit?: boolean;
} {
  const { character, runtime, player, journey } = context;
  const profile = NPC_PROFILES[character.id];
  const memories = journey.memories[character.id] ?? [];
  const status = journey.npcStatuses[character.id];
  const result = (line: string, choices = [back]) => ({
    node: { line, choices },
    player,
    runtime: { ...runtime, lastSpokenLine: line },
    journey,
  });

  switch (choice.action) {
    case 'greet':
      return { ...result(''), node: openConversation(context), runtime };
    case 'agenda': {
      const until = status?.availableUntilDay;
      return result(
        getNpcAgendaReply(journey, character.id) +
        (until === undefined ? '' : `\n她预计在此留到第 ${until} 日。`),
        profile ? [{ action: 'private', label: profile.privateTopic.question }, back] : [back],
      );
    }
    case 'past': {
      const known = [...memories].reverse().find((memory) => memory.kind !== 'topic');
      const recall = rememberedReply(character, known);
      return result(recall ?? (known ? `她记得第 ${known.day} 日发生的那件事。\n${known.detail}` : runtime.lastSpokenLine));
    }
    case 'private': {
      if (!profile) return result(runtime.lastSpokenLine);
      const confidence = memories.find((memory) => memory.kind === 'confidence');
      if (confidence) {
        return result(journey.day > confidence.day ? profile.privateTopic.trusted : profile.privateTopic.respect);
      }
      if (memories.some((memory) => memory.kind === 'pressure')) {
        return result('她把话头轻轻拨开，看向别处。你可以另起一个话题。');
      }
      return result(profile.privateTopic.answer, [
        { action: 'respect', label: '点头，等她愿意说时再听' },
        { action: 'press', label: '继续追问，要她现在答复' },
      ]);
    }
    case 'respect':
    case 'press': {
      if (!profile) return result(runtime.lastSpokenLine);
      const respect = choice.action === 'respect';
      const next = result(respect ? profile.privateTopic.respect : profile.privateTopic.press, respect ? [back] : []);
      return {
        ...next,
        journey: rememberNpc(journey, character.id, {
          id: 'private-boundary',
          kind: respect ? 'confidence' : 'pressure',
          detail: `${profile.privateTopic.question}。你${respect ? '点头收住了话头，留她自己做决定' : '在她提出顾虑后仍要求她开口'}。`,
        }),
        runtime: {
          ...next.runtime,
          affection: Math.max(0, Math.min(150, runtime.affection + (respect ? 3 : -5))),
          emotion: respect ? 'normal' : 'angry',
        },
      };
    }
    case 'topics': {
      const choices: DialogueChoice[] = character.chatOptions.map((topic) => ({
        action: 'topic',
        label: topic.label,
        topic,
        lockReason: runtime.affection < (topic.minAffection ?? 0) ? `需好感 ${topic.minAffection}` : undefined,
      }));
      return result('她停下手里的事，等你把话说完。', [...choices, back]);
    }
    case 'topic': {
      const topic = choice.topic;
      if (!topic || runtime.affection < (topic.minAffection ?? 0)) return result(runtime.lastSpokenLine);
      const key = `topic:${topic.id}`;
      if (memories.some((memory) => memory.id === key)) {
        return result('她听完你重提的话题，指了指出门的路。「上次谈的那一式，你可以自己找地方试了。」');
      }
      const passed = !topic.checkStat || player[topic.checkStat] >= (topic.checkThreshold ?? 0);
      if (!passed) return result(topic.failReplyText ?? topic.replyText);
      const next = result(topic.replyText);
      const maxExp = REALMS[player.realmIndex].maxExp;
      const rewardExp = Math.min(Math.floor(maxExp * 0.12),
        Math.round((topic.expBonus ?? 0) * (1 + player.realmIndex * 0.25)));
      const item = topic.itemRewardId;
      return {
        ...next,
        journey: rememberNpc(journey, character.id, { id: key, kind: 'topic', detail: topic.replyText }),
        runtime: {
          ...next.runtime,
          affection: Math.max(0, Math.min(150, runtime.affection + Math.ceil(topic.affectionDelta / 2))),
          emotion: topic.emotion,
          interactionCount: runtime.interactionCount + 1,
        },
        player: {
          ...player,
          exp: Math.min(maxExp, player.exp + rewardExp),
          sense: player.sense + (topic.senseBonus ?? 0),
          atk: player.atk + (topic.atkBonus ?? 0),
          inventory: item ? { ...player.inventory, [item]: (player.inventory[item] ?? 0) + 1 } : player.inventory,
        },
      };
    }
    case 'herb': {
      if (isHerbMeetingOpen(journey)) {
        return result(
          `山涧扑来一股生冷水气。林婉儿停在路口，把药篓从左肩换到右肩。${getHerbTrip(journey).obstacle}「前面走不通。你想留下看看，还是随我从后坡绕过去？」`,
          [{ action: 'investigate', label: '留下查清封路的缘故' },
            { action: 'detour', label: '从后坡绕行，护她先采到药' }],
        );
      }
      return result(
        `林婉儿把炉门合拢。「血参已经炮好，只缺山涧的鲜雪莲了。那段路得有个人帮我照应。第 ${journey.day + 2} 日到药庐来，你有空么？」`,
        [{ action: 'promise', label: `应下第 ${journey.day + 2} 日的约` },
          { action: 'decline', label: '现在说清这趟去不了' }, back],
      );
    }
    case 'promise':
    case 'decline': {
      const accept = choice.action === 'promise';
      const next = replyToHerbInvite(journey, accept);
      const changedPlans = journey.herb.phase === 'promised';
      return {
        ...result(accept
          ? '「我会在药庐留一盏灯。要是耽搁了，先传个信给我。」她把两只药篓并到门边。'
          : changedPlans
            ? '「听见了。既提前告诉我，我就赶在出发前去找人。」'
            : '「那我今日就去问旁人。早点说好，大家都省等。」她收起了给你的那只杯子。'),
        journey: refreshNpcAgendas(next),
      };
    }
    case 'apology':
      return {
        ...result('她听到一半才轻轻应了一声。「我在意的是白白等了一天。你肯说清楚，这件事就放过去吧。」'),
        journey: rememberNpc(journey, character.id, {
          id: 'herb-apology', kind: 'apology', detail: '你为采药失约道歉，并答应再有变动会事先传信。',
        }),
      };
    case 'investigate':
    case 'detour': {
      const next = completeHerbTrip(journey, choice.action);
      if (next === journey) return result('约好的时辰已经过了。林婉儿不在山道边。');
      const trip = getHerbTrip(journey);
      const story = choice.action === 'investigate' ? trip.discovery : trip.detour;
      const nextReply = result(`${story}\n入夜时，你们带着雪莲回到药庐。林婉儿从炉边拿出一枚护心丹。「带上。那一路我欠你的，记在我这里。」`);
      return {
        ...nextReply,
        journey: refreshNpcAgendas(next),
        runtime: { ...nextReply.runtime, affection: Math.min(150, runtime.affection + 14), emotion: 'smile' },
        player: {
          ...player,
          inventory: { ...player.inventory, heart_guard_pill: (player.inventory.heart_guard_pill ?? 0) + 1 },
        },
      };
    }
    case 'visit':
      return { ...result(runtime.lastSpokenLine), visit: true };
  }
}

const spokenIntents: [DialogueChoice['action'], RegExp][] = [
  ['apology', /抱歉|对不起|赔个不是|失约.{0,6}错|我来道歉/],
  ['decline', /去不了|来不了|赶不过|没空|不便前往|不能.{0,5}(去|同[行去]|赴约|作陪)|不想(去|答应)|不赴约/],
  ['respect', /不追问|不多问|你愿意.{0,6}(说|讲)|想说.{0,5}(再说|告诉)|等你.{0,6}(愿意|想说)/],
  ['press', /非说不可|你必须说|现在.{0,3}(告诉我|给我答复)|非要.{0,4}(知道|听清)/],
  ['detour', /绕[行路道]|后坡.{0,5}(走|去)/],
  ['investigate', /查清|查查|查一查|封路.{0,5}(缘故|原因)|先去看看|留下看看/],
  ['promise', /我(答应|会赴约|愿意同行|会去|定会去|可以同行|一定来)|到时.{0,4}(见|来)|我来陪你/],
  ['past', /还记得|记不记得|上回|上次|说起旧事|过去的事/],
  ['agenda', /在忙|做什么|做些啥|忙什么|打算|住哪|在哪|在哪里|何时走|留到哪天|行程/],
  ['herb', /雪莲|采药|进山|药庐.{0,4}找人|赴会/],
  ['private', /剑符|留.{0,3}座|座牌|药柜|空着.{0,3}拍|旧龙鳞|卦签/],
  ['topics', /论道|功法|道法|招式|术法/],
  ['visit', /坐.{0,4}(聊|叙谈)|喝.{0,3}茶/],
  ['greet', /换.{0,3}(话题|个事)|聊点别的/],
];

export function matchDialogueInput(text: string, node: DialogueNode): DialogueChoice | undefined {
  const written = text.normalize('NFKC').replace(/\s/g, '');
  const unlocked = node.choices.filter((choice) => !choice.lockReason);
  const exact = unlocked.find((choice) => choice.label.normalize('NFKC').replace(/\s/g, '') === written);
  if (exact) return exact;
  const intent = spokenIntents.find(([action, match]) =>
    unlocked.some((choice) => choice.action === action) && match.test(written) &&
    (action !== 'promise' || !/不(?:会|能|想|敢)|去不了|来不了|赶不过|没空/.test(written)))?.[0];
  return unlocked.find((choice) => choice.action === intent);
}

const greetings: Record<string, string> = {
  shen_qingqiu: '「还好。今晨风小，剑走得比昨日顺。」',
  ye_liuli: '「早些时候有人欠我一壶茶。方才还了，我眼下心情不错。」',
  lin_waner: '「这炉药的火候还好。我忙完它，再去吃点热的。」',
  mu_qingge: '「今日弦不涩，手也暖了。劳你惦念。」',
  ao_shuanghua: '「挺好。就是这双鞋该换，走石路总进水。」',
  su_xinghe: '「精神比昨夜好。今日若下雨，我就少抄半卷星历。」',
};

export function answerSmallTalk(text: string, character: CharacterData, journey: JourneyState): string | undefined {
  if (/^(多谢|谢谢|谢过|辛苦你了)[^！？!?]{0,20}[。！？!?]?$/.test(text)) {
    return '「我听见了。下次见面再慢慢说。」';
  }
  if (/^(你好|道友好|早安|今天还好|你还好|你?近来可好|你?近来还好|你?近来怎样|你可好|你受伤了|伤势好些)/.test(text)) {
    const recovery = journey.npcStatuses[character.id]?.recoverUntilDay ?? 0;
    if (recovery >= journey.day) return `「还在调息，到第 ${recovery} 日再走动。劳你记挂。」`;
    return greetings[character.id] ?? '「一切照常。道友请坐，有事可以直说。」';
  }
}
