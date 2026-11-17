import { DESTINY_TRAITS, SPIRIT_ROOTS } from '../data/realms';
import type { SpiritRootType } from '../types/game';

export const MAX_BIRTH_TRAITS = 2;
export const BIRTH_DRAFT_KEY = 'xianxia_rpg_birth_draft_v1';

export interface BirthDraft {
  root: SpiritRootType;
  candidates: string[];
}

export function rollBirthDraft(random = Math.random): BirthDraft {
  const aptitude = random();
  const root = aptitude < 0.05 ? 'heavenly' : aptitude < 0.25 ? 'thunder_variant' : 'five_elements';
  const quality = random();
  const lastRarity = quality < 0.05 ? '天命' : quality < 0.30 ? '灵品' : '凡品';
  const available = [...DESTINY_TRAITS];
  const candidates = (['凡品', '缺憾', '凡品', '缺憾', lastRarity] as const).map((rarity) => {
    const pool = available.filter((trait) => trait.rarity === rarity);
    const picked = pool[Math.floor(random() * pool.length)];
    available.splice(available.indexOf(picked), 1);
    return picked.id;
  });
  return { root, candidates };
}

export function loadBirthDraft(): BirthDraft {
  try {
    const draft: BirthDraft = JSON.parse(localStorage.getItem(BIRTH_DRAFT_KEY) ?? 'null');
    if (draft && SPIRIT_ROOTS.some((root) => root.id === draft.root) &&
        Array.isArray(draft.candidates) && new Set(draft.candidates).size === 5 &&
        draft.candidates.length === 5 &&
        draft.candidates.every((id) => DESTINY_TRAITS.some((trait) => trait.id === id))) {
      return draft;
    }
  } catch {
    // The character creation screen also works with storage disabled.
  }
  return rollBirthDraft();
}
