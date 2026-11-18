import { findDestinyTrait, rollDestiny } from '../data/destinies';
import { DESTINY_TRAITS, SPIRIT_ROOTS } from '../data/realms';
import type { DestinyTrait, SpiritRootType } from '../types/game';

export const MAX_BIRTH_TRAITS = 3;
export const MAX_BIRTH_DRAWS = 3;
export const BIRTH_DRAFT_KEY = 'xianxia_rpg_birth_session_v2';

export interface BirthDraft {
  root: SpiritRootType;
  candidates: string[];
}

export interface BirthSession {
  used: number;
  draft: BirthDraft | null;
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

export function rollBirthDraft(random = Math.random, previous?: BirthDraft): BirthDraft {
  const roots = SPIRIT_ROOTS.filter(({ id }) => id !== previous?.root);
  const root = chooseWeighted(roots, (entry) => ROOT_WEIGHTS[entry.id], random).id;
  const previousArchetypes = new Set(previous?.candidates.map((id) => id.startsWith('birth:') ? id.split(':')[1] : id));
  let available = ARCHETYPES.filter(({ trait }) => !previousArchetypes.has(trait.id));
  const candidates = Array.from({ length: 5 }, () => {
    const picked = chooseWeighted(available, ({ weight }) => weight, random);
    available = available.filter((entry) => entry !== picked);
    return rollDestiny(picked.trait, random);
  });
  return { root, candidates };
}

export function loadBirthSession(): BirthSession {
  try {
    const saved: BirthSession | null = JSON.parse(sessionStorage.getItem(BIRTH_DRAFT_KEY) ?? 'null');
    const draft = saved?.draft;
    if (saved && Number.isInteger(saved.used) && saved.used >= 1 && saved.used <= MAX_BIRTH_DRAWS &&
        draft && SPIRIT_ROOTS.some((root) => root.id === draft.root) &&
        Array.isArray(draft.candidates) && draft.candidates.length === 5 &&
        new Set(draft.candidates).size === 5 && draft.candidates.every(findDestinyTrait)) {
      return saved;
    }
  } catch {}
  return { used: 0, draft: null };
}

export function drawBirth(session: BirthSession, random = Math.random): BirthSession {
  if (session.used >= MAX_BIRTH_DRAWS) return session;
  return { used: session.used + 1, draft: rollBirthDraft(random, session.draft ?? undefined) };
}

export function saveBirthSession(session: BirthSession) {
  try {
    sessionStorage.setItem(BIRTH_DRAFT_KEY, JSON.stringify(session));
  } catch {}
}
