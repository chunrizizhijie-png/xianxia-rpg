import { OUTINGS, OUTING_VOICES, type OutingContext, type OutingText } from '../data/npcOutings';
import { WORLD_REGIONS } from '../data/worldSandbox';
import type { CharacterData, CharacterRuntimeState } from '../types/game';
import type { JourneyState, NpcOuting, OutingId, StoryRecord } from '../types/journey';
import { rememberNpc } from './herbJourney';
import { relationshipFor } from './relationships';

const stories: OutingId[] = ['letter', 'tea', 'bell'];
const regionName = (id: string) => WORLD_REGIONS.find(region => region.id === id)?.name ?? '来时的路口';
const doneId = (story: OutingId, meetingId: string) => 'outing:' + story + ':' + meetingId;

function chapterAt(story: OutingId, path: string[]) {
  const chapters = OUTINGS[story].chapters;
  let chapter = chapters.start;
  let hasWait = false;
  const decisions: string[] = [];
  for (const [index, id] of path.entries()) {
    const choice = chapter.choices.find(c => c.id === id);
    if (!choice || !('to' in choice) || (choice.requires && !path.slice(0, index).includes(choice.requires))) return;
    decisions.push(choice.label);
    chapter = chapters[choice.to];
    if (!chapter) return;
    if (choice.wait) hasWait = true;
  }
  return { chapter, hasWait, decisions };
}

export function isNpcOuting(value: unknown): value is NpcOuting {
  if (!value || typeof value !== 'object') return false;
  const outing = value as Partial<NpcOuting>;
  if (!outing.story || !stories.includes(outing.story) ||
      typeof outing.meetingId !== 'string' || !outing.meetingId ||
      typeof outing.regionId !== 'string' || typeof outing.familiar !== 'boolean' ||
      !Number.isSafeInteger(outing.startedDay) || outing.startedDay! < 1 ||
      !Array.isArray(outing.path) || outing.path.length > 8 || !outing.path.every(id => typeof id === 'string')) return false;
  const state = chapterAt(outing.story, outing.path);
  if (!state) return false;
  return state.hasWait ? Number.isSafeInteger(outing.returnDay) && outing.returnDay! > outing.startedDay!
    : outing.returnDay === undefined;
}

function textOf(text: OutingText, context: OutingContext) {
  return typeof text === 'string' ? text : text(context);
}

function contextOf(outing: NpcOuting, character: CharacterData): OutingContext {
  return { name: character.name, region: regionName(outing.regionId), familiar: outing.familiar, path: outing.path };
}

function suggestedStory(journey: JourneyState, charId: string, meetingId: string): OutingId {
  const recentlyPlayed = (journey.memories[charId] ?? []).flatMap(memory => {
    const story = stories.find(story => memory.id.startsWith('outing:' + story + ':'));
    return story ? [story] : [];
  }).slice(-2);
  const pool = stories.filter(story => !recentlyPlayed.includes(story));
  let hash = journey.seed >>> 0;
  for (const char of charId + '/' + meetingId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return pool[hash % pool.length];
}

/** A meeting record is consumed only after its in-person attendance has actually been recorded. */
export function startNpcOuting(journey: JourneyState, character: CharacterData, runtime: CharacterRuntimeState, kept: StoryRecord): JourneyState {
  const charId = character.id;
  if (journey.outings?.[charId] || kept.charId !== charId || !kept.id.endsWith(':kept') || kept.day !== journey.day ||
      kept.regionId !== journey.regionId || journey.npcStatuses[charId]?.regionId !== journey.regionId ||
      !journey.openStory?.history.some(entry => entry.id === kept.id && entry.charId === charId) ||
      (journey.memories[charId] ?? []).some(memory => stories.some(story => memory.id === doneId(story, kept.id)))) return journey;
  const standing = relationshipFor(journey, charId, runtime).label;
  const outing: NpcOuting = {
    meetingId: kept.id, story: suggestedStory(journey, charId, kept.id), startedDay: journey.day,
    regionId: journey.regionId, path: [],
    familiar: standing !== '有隔阂' && (standing === '愿意相托' || runtime.affection >= 30 || runtime.isSoulmate),
  };
  return { ...journey, outings: { ...journey.outings, [charId]: outing } };
}

export interface OutingScene {
  title: string;
  line: string;
  choices: { id: string; label: string }[];
  waitingUntil?: number;
}

function choiceKey(outing: NpcOuting, id: string): string {
  return [outing.meetingId, ...outing.path, id].join('/');
}

export function npcOutingScene(journey: JourneyState, character: CharacterData): OutingScene | undefined {
  const outing = journey.outings?.[character.id];
  if (!outing) return;
  const state = chapterAt(outing.story, outing.path);
  if (!state) return;
  const title = OUTINGS[outing.story].title;
  if (outing.returnDay !== undefined && journey.day < outing.returnDay) {
    return { title, line: `「${title}」还在等消息。第 ${outing.returnDay} 日起再当面找${character.name}，听听后来怎样了。`,
      waitingUntil: outing.returnDay, choices: [] };
  }
  if (journey.regionId !== journey.npcStatuses[character.id]?.regionId) {
    return { title, line: `「${title}」说到一半。下次和${character.name}碰面，可以接着办。`, choices: [] };
  }
  if (!state.hasWait && journey.regionId !== outing.regionId) {
    return { title, line: `人和物证都在${regionName(outing.regionId)}。约${character.name}在那里碰面，还能继续「${title}」。`, choices: [] };
  }
  const context = contextOf(outing, character);
  const voice = outing.path.length === 0 && OUTING_VOICES[character.id]?.[outing.story];
  const line = [textOf(state.chapter.line, context), voice].filter(Boolean).join('\n');
  const choices = state.chapter.choices.filter(choice => !choice.requires || outing.path.includes(choice.requires))
    .map(choice => ({ id: choiceKey(outing, choice.id), label: choice.label }));
  return { title, line, choices };
}

export function chooseNpcOuting(journey: JourneyState, character: CharacterData, choiceId: string):
  { journey: JourneyState; line: string; finished: boolean } | undefined {
  const charId = character.id;
  const outing = journey.outings?.[charId];
  if (!outing || !npcOutingScene(journey, character)?.choices.some(c => c.id === choiceId)) return;
  const state = chapterAt(outing.story, outing.path);
  const choice = state?.chapter.choices.find(c => choiceKey(outing, c.id) === choiceId);
  if (!choice || !state) return;
  if ('end' in choice) {
    const line = textOf(choice.end, contextOf(outing, character));
    const title = OUTINGS[outing.story].title;
    const outings = { ...journey.outings };
    delete outings[charId];
    const detail = `「${title}」一事，你先${state.decisions[0]}，最后${choice.label}。${line}`;
    const id = doneId(outing.story, outing.meetingId);
    const letter: StoryRecord = { id: 'after:' + id, charId, regionId: outing.regionId, day: journey.day + choice.delay,
      action: 'outing-letter', text: `${character.name}给你捎来「${title}」的后信：「${choice.letter}」` };
    const story = journey.openStory ?? { turns: 0, pending: [], history: [] };
    const next = rememberNpc({ ...journey, outings, openStory: { ...story, pending: [...story.pending, letter] } }, charId, {
      id, kind: choice.memory, detail,
    });
    return { journey: next, line, finished: true };
  }
  const step: NpcOuting = { ...outing, path: [...outing.path, choice.id] };
  if (choice.wait) step.returnDay = journey.day + choice.wait;
  const next = { ...journey, outings: { ...journey.outings, [charId]: step } };
  const line = npcOutingScene(next, character)!.line;
  return { journey: next, line, finished: false };
}
