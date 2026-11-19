import type { CharacterData, CharacterRuntimeState, ItemConfig } from '../types/game';
import type { JourneyState, MemoryKind } from '../types/journey';
import { awaitsHerbApology, HERBALIST } from './herbJourney';

const trustWeight: Partial<Record<MemoryKind, number>> = {
  help: 2, confidence: 1, absence: -2, harm: -3, pressure: -1,
};

export interface NpcRelationship {
  label: string;
  inviteReason?: string;
  dualReason?: string;
}

export function unresolvedMeetingAbsence(journey: JourneyState, charId: string) {
  const memories = journey.memories[charId] ?? [];
  const answered = new Set(memories.filter(m => m.kind === 'apology').map(m => m.id));
  return [...memories].reverse().find(m =>
    m.kind === 'absence' && m.id.endsWith(':missed') && !answered.has(m.id + ':apology'));
}

export function relationshipFor(journey: JourneyState, charId: string, runtime?: CharacterRuntimeState): NpcRelationship {
  if (!runtime?.met) return { label: '素未谋面', inviteReason: '先当面结识', dualReason: '先当面结识' };
  const memories = journey.memories[charId] ?? [];
  const apologies = new Set(memories.filter(m => m.kind === 'apology').map(m => m.id));
  const trust = memories.reduce((sum, memory) => {
    // An accepted apology settles just the appointment that prompted it.
    if (memory.kind === 'absence' && memory.id.endsWith(':missed') && apologies.has(memory.id + ':apology')) return sum;
    return sum + (trustWeight[memory.kind] ?? 0);
  }, 0);
  const explainedAbsence = memories.some((memory) => memory.id === 'herb-apology');
  const standing = trust + (explainedAbsence ? 1 : 0);
  const hurt = charId === HERBALIST && awaitsHerbApology(journey);
  const pressure = memories.some((memory) => memory.kind === 'pressure' && journey.day <= memory.day + 1);
  const lastDemand = [...memories].reverse().find(memory => memory.id.startsWith('social:施压:') && memory.day <= journey.day);
  const unresolvedDemand = lastDemand && journey.day - lastDemand.day <= 3 &&
    !memories.some(memory => memory.id === 'social:致歉:' + lastDemand.id);
  const reservations = hurt ? '她想先谈谈你失约的那天'
    : pressure ? '她想先独处一阵'
    : unresolvedDemand ? '她还介意你上次逼她表态'
    : standing < 0 ? '她对你还存着戒心' : undefined;
  const affection = runtime?.affection ?? 0;
  const established = runtime?.isSoulmate ?? false;
  return {
    label: reservations ? '有隔阂' : established ? '已结道侣'
      : standing >= 2 ? '愿意相托' : standing > 0 || affection >= 25 ? '渐渐相熟' : '初识',
    inviteReason: reservations ?? (standing < 2 && !established ? '还需要共同经历一件要紧的事'
      : affection < 35 ? '彼此还不够熟悉' : undefined),
    dualReason: reservations ?? (standing < 3 && !established ? '她还需要更多信任'
      : affection < 80 ? '还没熟悉到结契的地步' : undefined),
  };
}

export function giftRefusal(
  journey: JourneyState,
  character: CharacterData,
  runtime: CharacterRuntimeState,
  gift: ItemConfig,
): string | undefined {
  const memories = journey.memories[character.id] ?? [];
  const gifts = memories.filter((memory) => memory.kind === 'gift');
  if (relationshipFor(journey, character.id, runtime).label === '有隔阂') {
    return '「这会儿礼物先收回去。我们还有一件事没说清。」';
  }
  if (gifts.some((memory) => memory.id === `gift:${gift.id}` || memory.id.endsWith(`:${gift.id}`))) {
    return `「上回那件${gift.name}还在我这里。这一份你留着。」`;
  }
  if (gifts.some((memory) => journey.day - memory.day < 7)) {
    return '「上次才收了你的礼。这回我们就坐一会儿。」';
  }
  if (runtime.affection < 25 && !character.favoriteGifts.includes(gift.id)) {
    return `「你有心了。${gift.name}我暂时用不上，留在你那里更合适。」`;
  }
}

export function storyEventId(id: string): string {
  return id.replace(/_\d{10,}$/, '');
}
