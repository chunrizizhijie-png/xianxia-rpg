import { REALMS } from '../data/realms';
import { validCraftTalents } from './birth';
import { isCraftState } from './crafting';
import type { CharacterData, SaveSlotData } from '../types/game';
import type { JourneyState } from '../types/journey';
import { createInitialCharacters } from './gameEngine';
import { initializeJourney } from './livingWorldEngine';

export const SAVE_VERSION = 1;
export const SLOT_STORAGE_KEY = 'xianxia_rpg_saves_v3';
export const RESUME_STORAGE_KEY = 'xianxia_rpg_last_life';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenStory(value: unknown) {
  if (!isRecord(value) || typeof value.turns !== 'number' || !Number.isSafeInteger(value.turns) || value.turns < 0) return false;
  return [value.history, value.pending].every((entries) => Array.isArray(entries) && entries.every((entry) =>
    isRecord(entry) && typeof entry.id === 'string' && typeof entry.regionId === 'string' &&
    typeof entry.day === 'number' && Number.isSafeInteger(entry.day) && entry.day >= 1 &&
    typeof entry.text === 'string' && ['charId', 'action', 'fact'].every((key) =>
      entry[key] === undefined || typeof entry[key] === 'string') &&
    (entry.npcTask === undefined || (isRecord(entry.npcTask) && typeof entry.charId === 'string' &&
      (entry.npcTask.kind === 'inquire' || entry.npcTask.kind === 'meet') && typeof entry.npcTask.subject === 'string'))));
}

function isJourney(value: unknown): value is JourneyState {
  if (!isRecord(value) || !isRecord(value.herb) || !isRecord(value.npcStatuses) ||
      !isRecord(value.memories)) return false;
  return typeof value.day === 'number' && Number.isSafeInteger(value.day) && value.day >= 1 &&
    typeof value.seed === 'number' && Number.isSafeInteger(value.seed) && value.seed >= 0 &&
    typeof value.regionId === 'string' && typeof value.lastNoticeDay === 'number' &&
    (value.retreatNotices === undefined || (Array.isArray(value.retreatNotices) &&
      value.retreatNotices.every((id) => typeof id === 'string'))) &&
    (value.openStory === undefined || isOpenStory(value.openStory)) &&
    (value.clearedSites === undefined || (Array.isArray(value.clearedSites) && value.clearedSites.every(id => typeof id === 'string'))) &&
    (value.craft === undefined || isCraftState(value.craft)) &&
    (value.npcChats === undefined || (isRecord(value.npcChats) && Object.values(value.npcChats).every((thread) =>
      isRecord(thread) && Number.isSafeInteger(thread.day) && typeof thread.regionId === 'string' &&
      (thread.greeting === undefined || typeof thread.greeting === 'string') &&
      (thread.recollections === undefined || (Array.isArray(thread.recollections) &&
        thread.recollections.every((entry) => isRecord(entry) && typeof entry.quote === 'string' &&
          (entry.reply === undefined || typeof entry.reply === 'string') &&
          (entry.day === undefined || Number.isSafeInteger(entry.day))))) &&
      Array.isArray(thread.messages) && thread.messages.every((message) => isRecord(message) &&
        (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' &&
        (message.note === undefined || typeof message.note === 'string') &&
        (message.day === undefined || Number.isSafeInteger(message.day)) &&
        (message.scripted === undefined || typeof message.scripted === 'boolean'))))) &&
    ['available', 'promised', 'declined', 'missed', 'fulfilled'].includes(String(value.herb.phase)) &&
    Object.values(value.memories).every((entries) => Array.isArray(entries) &&
      entries.every((entry) => isRecord(entry) && typeof entry.day === 'number' &&
        typeof entry.detail === 'string' && typeof entry.id === 'string')) &&
    Object.values(value.npcStatuses).every((status) =>
      isRecord(status) && typeof status.charId === 'string' && typeof status.regionId === 'string' &&
      typeof status.exp === 'number' && Number.isFinite(status.exp) && status.exp >= 0 &&
      typeof status.realmIndex === 'number' && Number.isInteger(status.realmIndex) &&
      status.realmIndex >= 0 && status.realmIndex < REALMS.length);
}

export function parseLife(value: unknown): SaveSlotData | null {
  if (!isRecord(value) || !isRecord(value.player) || !isRecord(value.characters)) return null;
  if (value.version !== undefined && value.version !== SAVE_VERSION) return null;
  const player = value.player;
  if (player.craftTalents !== undefined && !validCraftTalents(player.craftTalents)) return null;
  if (typeof player.daoName !== 'string' || typeof player.realmIndex !== 'number' ||
      !Number.isInteger(player.realmIndex) || !REALMS[player.realmIndex] ||
      !isRecord(player.inventory) || !isRecord(player.stats) ||
      !Array.isArray(player.stats.majorRealmsReached) ||
      !Array.isArray(player.destinyTraits) || !Array.isArray(player.unlockedSkills) ||
      !Array.isArray(player.equippedSkills) ||
      !['ageMonths', 'lifespanCapYears', 'hp', 'maxHp', 'mp', 'maxMp', 'exp', 'atk', 'def',
        'sense', 'luck', 'charm', 'critRate', 'spiritStones', 'injury'].every((field) =>
        typeof player[field] === 'number' && Number.isFinite(player[field]))) return null;
  if (value.journey !== undefined && !isJourney(value.journey)) return null;
  if (value.version === SAVE_VERSION && !value.journey) return null;
  if (value.pendingEventMinimized !== undefined && typeof value.pendingEventMinimized !== 'boolean') return null;
  if (value.pendingEvent !== undefined && (!isRecord(value.pendingEvent) ||
      typeof value.pendingEvent.id !== 'string' || typeof value.pendingEvent.title !== 'string' ||
      typeof value.pendingEvent.description !== 'string' || !Array.isArray(value.pendingEvent.choices) ||
      value.pendingEvent.choices.length === 0 || value.pendingEvent.choices.some((choice) =>
        !isRecord(choice) || typeof choice.id !== 'string' || typeof choice.text !== 'string' ||
        !isRecord(choice.successOutcome) || typeof choice.successOutcome.text !== 'string'))) return null;
  if ([value.customSkills, value.customItems, value.customCharacters, value.customEvents].some((entries) =>
    entries !== undefined && (!Array.isArray(entries) || entries.some((entry) =>
      !isRecord(entry) || typeof entry.id !== 'string')))) return null;
  if (value.customCharacters !== undefined && (!Array.isArray(value.customCharacters) ||
      value.customCharacters.some((entry) => !isRecord(entry) || !isRecord(entry.dialogues) ||
        !Array.isArray(entry.dialogues.stranger) || !Array.isArray(entry.personalityTags)))) return null;
  if (Object.values(value.characters).some((character) => !isRecord(character) ||
      (character.hasContact !== undefined && typeof character.hasContact !== 'boolean') ||
      typeof character.affection !== 'number' || typeof character.lastSpokenLine !== 'string')) return null;
  if (Array.isArray(value.logs) && value.logs.some((log) => !isRecord(log) ||
      typeof log.text !== 'string' || typeof log.ageText !== 'string')) return null;
  return { ...value, logs: Array.isArray(value.logs) ? value.logs : [] } as unknown as SaveSlotData;
}

function readLocal(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

export function readSaveSlots(): (SaveSlotData | null)[] {
  const saved = readLocal(SLOT_STORAGE_KEY);
  return [0, 1, 2].map((index) => Array.isArray(saved) ? parseLife(saved[index]) : null);
}

export function readLastLife(): SaveSlotData | null {
  return parseLife(readLocal(RESUME_STORAGE_KEY));
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Older saves have a world seed but predate the two workshop aptitudes.
export function restoreCraftTalents(save: SaveSlotData, journey: JourneyState) {
  if (save.player.craftTalents) return save.player.craftTalents;
  let hash = journey.seed >>> 0;
  for (const letter of save.player.daoName) hash = Math.imul(hash ^ letter.charCodeAt(0), 0x01000193) >>> 0;
  return { alchemy: hash & 3, smithing: (hash >>> 8) & 3 };
}

export function restoreCharacters(save: SaveSlotData, definitions: CharacterData[]) {
  const defaults = createInitialCharacters(definitions);
  for (const definition of definitions) {
    const id = definition.id;
    const saved = save.characters[id];
    if (!saved) continue;
    if (typeof saved.hasContact === 'boolean') {
      defaults[id] = { ...defaults[id], ...saved };
      continue;
    }
    // Older versions gave every character 18 points and marked them as met on day one.
    const history = save.journey;
    const interacted = saved.affection !== 18 || saved.interactionCount > 0 || saved.isSoulmate ||
      (saved.dualCount ?? 0) > 0 || history?.npcStatuses[id]?.isCompanion ||
      history?.npcChats?.[id]?.messages.some((message) => message.role === 'user') ||
      history?.memories[id]?.some((memory) => memory.id !== 'herb-escort') ||
      history?.openStory?.pending.some((entry) => entry.charId === id) ||
      save.logs.some((entry) => entry.category === 'bond' && entry.text.includes(definition.name));
    if (interacted) defaults[id] = { ...defaults[id], ...saved, met: true, hasContact: true };
  }
  return defaults;
}

export function restoreJourney(save: SaveSlotData, characters: CharacterData[]): JourneyState {
  let seed = 0;
  for (const char of save.player.daoName) {
    seed = (Math.imul(seed, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  const defaults = initializeJourney(
    characters,
    seed,
    1 + Math.max(0, Math.floor(save.player.ageMonths) - 16 * 12) * 30,
  );
  return save.journey
    ? {
        ...save.journey,
        npcStatuses: { ...defaults.npcStatuses, ...save.journey.npcStatuses },
      }
    : defaults;
}

export function writeChronicle(save: SaveSlotData, characters: CharacterData[]): string {
  const { daoName, realmName, ageText, logs, journey } = save;
  const lines = [
    `# ${daoName} · 九州修行纪事`,
    '',
    `境界 ${realmName}　寿龄 ${ageText}${journey ? `　九州第 ${journey.day} 日` : ''}`,
    '',
    '## 所见所行',
    '',
  ];
  for (const log of [...logs].reverse()) {
    const when = log.day ? `第 ${log.day} 日` : log.ageText;
    lines.push(`### ${when}${log.regionName ? ` · ${log.regionName}` : ''}`, '', log.text, '');
  }
  if (journey) {
    lines.push('## 人物记下的事', '');
    for (const character of characters) {
      const memories = (journey.memories[character.id] ?? []).filter((memory) => memory.kind !== 'topic');
      if (memories.length === 0) continue;
      lines.push(`### ${character.name}`, '');
      for (const memory of memories) lines.push(`- 第 ${memory.day} 日　${memory.detail}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[<>:"/\\|?*]/g, '_');
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
