import { findDestinyTrait, rollDestiny } from '../data/destinies';
import { DESTINY_TRAITS, SPIRIT_ROOTS } from '../data/realms';
import type { CraftTalents, DestinyTrait, SpiritRootType } from '../types/game';

export const MAX_BIRTH_TRAITS = 3;
const BIRTH_DRAFT_KEY = 'xianxia_rpg_pending_birth_v3';

export interface BirthDraft {
  root: SpiritRootType;
  traits: string[];
  craftTalents: CraftTalents;
}

const ROOT_WEIGHTS: Record<SpiritRootType, number> = { heavenly: 5, thunder_variant: 20, five_elements: 75 };
const TRAIT_WEIGHTS: Record<DestinyTrait['rarity'], number> = { 天命: 2, 灵品: 14, 凡品: 48, 缺憾: 36 };
const ARCHETYPES = DESTINY_TRAITS.map((trait) => ({
  trait,
  weight: TRAIT_WEIGHTS[trait.rarity] / DESTINY_TRAITS.filter((entry) => entry.rarity === trait.rarity).length,
}));

function chooseWeighted<T>(entries: T[], weight: (entry: T) => number, random: () => number): T {
  let roll = random() * entries.reduce((sum, entry) => sum + weight(entry), 0);
  for (const entry of entries) {
    roll -= weight(entry);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

export function rollCraftTalents(random = Math.random): CraftTalents {
  return { alchemy: Math.floor(random() * 4), smithing: Math.floor(random() * 4) };
}

export function validCraftTalents(value: unknown): value is CraftTalents {
  if (!value || typeof value !== 'object') return false;
  const talents = value as Partial<CraftTalents>;
  return [talents.alchemy, talents.smithing].every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 3);
}

export function rollBirthDraft(random = Math.random): BirthDraft {
  const root = chooseWeighted(SPIRIT_ROOTS, (entry) => ROOT_WEIGHTS[entry.id], random).id;
  let available = ARCHETYPES;
  const traits = Array.from({ length: MAX_BIRTH_TRAITS }, (_, index) => {
    const picked = chooseWeighted(available, ({ weight }) => weight, random);
    available = available.filter((entry) => entry !== picked);
    // One upbringing per life. The other two dispositions keep their base modifiers.
    return index === 0 ? rollDestiny(picked.trait, random) : picked.trait.id;
  });
  return { root, traits, craftTalents: rollCraftTalents(random) };
}

let pendingBirth: BirthDraft | undefined;

export function loadBirthDraft(): BirthDraft {
  try {
    const draft: BirthDraft | null = JSON.parse(localStorage.getItem(BIRTH_DRAFT_KEY) ?? 'null');
    if (draft && SPIRIT_ROOTS.some((root) => root.id === draft.root) &&
        Array.isArray(draft.traits) && draft.traits.length === MAX_BIRTH_TRAITS &&
        new Set(draft.traits).size === MAX_BIRTH_TRAITS && draft.traits.every(findDestinyTrait) &&
        validCraftTalents(draft.craftTalents)) {
      pendingBirth = draft;
      return draft;
    }
  } catch {}
  pendingBirth ??= rollBirthDraft();
  try { localStorage.setItem(BIRTH_DRAFT_KEY, JSON.stringify(pendingBirth)); } catch {}
  return pendingBirth;
}

export function finishBirthDraft() {
  pendingBirth = undefined;
  try { localStorage.removeItem(BIRTH_DRAFT_KEY); } catch {}
}
