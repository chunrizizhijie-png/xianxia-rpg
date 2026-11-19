import type { CharacterData, CharacterRuntimeState } from '../types/game';
import type { JourneyState } from '../types/journey';
import { rememberNpc } from './herbJourney';
import { relationshipFor } from './relationships';

export const SOCIAL_ATTITUDES = ['闲谈', '分享见闻', '倾诉', '关怀', '玩笑', '施压', '致歉'] as const;
export type SocialAttitude = typeof SOCIAL_ATTITUDES[number];

// Offline we only infer an attitude from an explicit statement by the speaker.
export function classifyOffline(line: string): SocialAttitude {
  if (/假如|如果|要是|听说|据说|[「“"]|是不是|(?:他|她|旁人|有人)(?:说|问)/u.test(line)) return '闲谈';
  if (/我(?:向你|跟你|得)?(?:赔个不是|道歉)|对不[起住]|是我(?:话重了|说重了|不对|失言)|刚才是我不好/u.test(line)) return '致歉';
  if (/(?:你|你今天).{0,4}(?:必须|非得|一定得).{0,8}(?:告诉|答应|听我的|说清楚)|休想瞒我|少废话|别逼我|由不得你/u.test(line) &&
      !/没说|不必|不用|别觉得|不是说/u.test(line)) return '施压';
  if (/(?:你|身子|伤口|伤势|歇息).{0,6}(?:好些|还疼|累坏|还好吗)|别太累|早点歇|照顾好自己|辛苦你了|我(?:只想|有些)?担心你/u.test(line)) return '关怀';
  if (/我.{0,8}(?:害怕|难过|有点怕|有点慌|心里没底|放不下|睡不着|心烦|撑不住|孤单|想家|有些累|心里堵|心事)/u.test(line)) return '倾诉';
  if (/逗你(?:呢|的)|开个玩笑|说个笑话|跟你开玩笑/u.test(line)) return '玩笑';
  if (/我(?:今天|今日|这几日|之前|刚才|方才|一路上|路上|昨晚|昨天|从前|小时候).{0,10}(?:遇到|看见|听见|碰上|见到|见过|学会|种了|养过|住过|捡到|拾到)/u.test(line)) return '分享见闻';
  return '闲谈';
}

const responses: Record<string, { listen: string; tease: string }> = {
  shen_qingqiu: { listen: '先把最难说的那句讲出来。我收剑，听你说。', tease: '胆子渐长。下一回，看看你能不能把我也逗笑。' },
  ye_liuli: { listen: '今日这段话不记在账上。慢慢讲，后来呢？', tease: '这句我收下了，回头借我逗别人一次。' },
  lin_waner: { listen: '这回我先不问脉。你自己最放不下的是哪一件？', tease: '好啦，这下我可真让你逗乐了。' },
  mu_qingge: { listen: '你停下的那一处，我还想听。说得慢一些也无妨。', tease: '倒像支小曲的收尾。前半段也编给我听听？' },
  ao_shuanghua: { listen: '我嘴笨。你把最烦的那件挑出来，我替你一道想。', tease: '哈，下回轮到我，你可别先认输。' },
  su_xinghe: { listen: '我有时也会把一件事情想上整夜。你是从什么时候开始在意的？', tease: '却叫我认真算了一回。下次该你来猜。' },
};

const actions: Record<SocialAttitude, string> = {
  闲谈: '闲聊', 分享见闻: '分享见闻', 倾诉: '谈起心事', 关怀: '出言关怀', 玩笑: '说笑', 施压: '言语施压', 致歉: '向她致歉',
};

/** Independent of text generation: only commit the returned state after the turn succeeds. */
export function reactToNpcLine(character: CharacterData, runtime: CharacterRuntimeState, journey: JourneyState,
  line: string, attitude: SocialAttitude) {
  const own = (journey.memories[character.id] ?? []).filter(entry => entry.day <= journey.day);
  const relationship = relationshipFor(journey, character.id, runtime);
  const status = journey.npcStatuses[character.id];
  const hurt = (status?.recoverUntilDay ?? 0) >= journey.day;
  const emergency = status?.canIntervene && status.interveneType === 'rescue';
  const social = own.filter(entry => entry.id.startsWith('social:'));
  const pressure = [...social].reverse().find(m => m.id.startsWith('social:施压:'));
  const openHurt = pressure && !social.some(m => m.id === 'social:致歉:' + pressure.id);
  const wary = relationship.label === '有隔阂' || Boolean(openHurt && journey.day - pressure.day <= 3);
  const close = !wary && (runtime.isSoulmate || runtime.affection >= 25 || relationship.label === '愿意相托');
  const voice = responses[character.id] ?? { listen: '我听着呢。你最在意的是哪一处？', tease: '原来是在逗我。再说一个？' };
  let fallback = wary ? '我在听。只是先前的事还横在心里，你把想说的说清楚些。'
    : emergency ? '我手边还有桩急事。挑你最要紧的那句说，我听着。'
    : close ? '你说吧。是哪一点让你特地想起跟我讲？' : '你说的这件事，我还不大熟。你是怎么想的？';
  let delta = 0;
  let remember = false;
  switch (attitude) {
    case '关怀':
      fallback = hurt ? '伤还在养。你肯记着，我心里很受用。'
        : wary ? '我会顾好自己。谢你这一句，余下的事容我缓缓。'
        : close ? '你总能留意这些。我会歇一歇，你自己呢？' : '多谢惦记。我这边还应付得来。';
      delta = wary ? 0 : 1;
      remember = !wary;
      break;
    case '分享见闻':
      fallback = close ? '你讲得我也想亲眼看看。那一幕里，你记得最清楚的是什么？'
        : '这我倒是头一回听说。你当时也在场么？';
      remember = !wary;
      break;
    case '倾诉':
      fallback = wary ? '我知道你心里不好过。只是眼下有些话，我还没法像从前那样接。'
        : close ? voice.listen : '你肯跟我提这件事，我听着。你想让我陪你听一会儿，还是替你拿个主意？';
      delta = close ? 1 : 0;
      remember = !wary;
      break;
    case '玩笑':
      fallback = hurt || emergency || wary ? '今儿我实在没这份心思。改天再逗我吧。' : close ? voice.tease : '原是句玩笑。我们才说了几回话，我差点当真了。';
      break;
    case '施压':
      fallback = close ? '换作旁人我早已收声了。正因为是你，这句话才格外伤人。' : '你若一定要我照你的意思答，我就先不答了。';
      delta = -2;
      remember = true;
      break;
    case '致歉':
      fallback = openHurt ? '你肯把刚才那份逼迫收回去，我听到了。往后给彼此留点余地吧。'
        : wary ? '我听到了。你能说说你指的是哪件事么？' : '我听见了。你在意的是哪句话？';
      remember = Boolean(openHurt);
      break;
  }
  const instruction = [
    '对方此刻在' + actions[attitude] + '。',
    wary ? '旧事尚有芥蒂；态度留有余地。' : close ? '彼此熟悉，可以亲近地回应，想起旧话时说清是哪件事。' : '还在相识中，由你决定愿意说到哪一步。',
    hurt ? '眼下仍在养伤。' : emergency ? '眼下有急事，先判断是否方便细聊。' : '',
    '接住对方这一次说的具体细节。可以顺着问一句，或讲你自己的看法。',
  ].join('');
  const unchanged = { journey, runtime, direction: instruction, fallback, note: undefined as string | undefined };
  if (!runtime.met || !remember) return unchanged;
  const normalized = line.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 120);
  const prefix = 'social:' + attitude + ':';
  const id = attitude === '致歉' && pressure ? prefix + pressure.id : prefix + normalized;
  const recentSame = social.some(m => m.id.startsWith(prefix) && journey.day - m.day < (attitude === '施压' ? 1 : 7));
  if (!normalized || social.some(m => m.id === id) || (attitude !== '致歉' && recentSame)) return unchanged;
  if (delta > 0 && attitude !== '致歉' && (runtime.affection >= 45 || social.some(m => m.day === journey.day))) delta = 0;
  const affection = Math.max(0, Math.min(150, runtime.affection + delta));
  const detail = '你' + actions[attitude] + '：「' + line.trim().slice(0, 110) + '」';
  const next = rememberNpc(journey, character.id, { id, kind: 'story', detail });
  const emotion = hurt ? runtime.emotion : attitude === '施压' ? 'angry' : attitude === '致歉' ? 'normal'
    : close && delta > 0 ? 'smile' : runtime.emotion;
  const note = attitude === '施压' ? character.name + '记住了你逼她表态的那句话。'
    : attitude === '致歉' ? character.name + '接受了你为那句话道的歉。'
    : attitude === '倾诉' ? character.name + '记住了你提起的心事。' : undefined;
  return { journey: next, runtime: { ...runtime, affection, emotion }, direction: instruction + (note ?? ''), fallback, note };
}
