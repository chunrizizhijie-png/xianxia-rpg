import { CRAFT_MATERIALS, WORLD_REGIONS } from '../data/worldSandbox';
import { ITEMS } from '../data/itemsAndSkills';
import type { CharacterData, CharacterRuntimeState, CraftTalents, ItemConfig, PlayerState } from '../types/game';
import type { JourneyState } from '../types/journey';

export type Craft = 'alchemy' | 'smithing';
export const CRAFT_NAMES: Record<Craft, string> = { alchemy: '炼丹', smithing: '炼器' };
export const TALENT_NAMES = ['无缘', '平资', '良才', '上资'];
const TRAINING_SITES: Record<Craft, string> = { alchemy: 'yaowang_valley', smithing: 'taixu_peak' };
export const CRAFT_ITEMS: ItemConfig[] = [
  { id: 'handmade_wound_powder', name: '止血散', type: 'pill', rarity: '凡品', price: 20,
    description: '以血参末敷在创处，回复 35 气血，消除 4 点内伤。', effect: { hpRestore: 35, injuryHeal: 4 } },
  { id: 'handmade_wrist_guard', name: '玄纹护腕', type: 'treasure', rarity: '凡品', price: 32,
    description: '以太白玄金打薄编成的护腕。炼化后永久提升防御 1 点。', effect: { defBonus: 1 } },
];

interface Recipe {
  id: string;
  craft: Craft;
  talent: number;
  xp: number;
  materials: Record<string, number>;
  days: number;
  fee: number;
}

export const RECIPES: Recipe[] = [
  { id: 'handmade_wound_powder', craft: 'alchemy', talent: 1, xp: 0, materials: { blood_ginseng: 1 }, days: 1, fee: 6 },
  { id: 'heart_guard_pill', craft: 'alchemy', talent: 1, xp: 3, materials: { snow_lotus: 1, corpse_grass: 1 }, days: 2, fee: 18 },
  { id: 'foundation_pill', craft: 'alchemy', talent: 2, xp: 6, materials: { blood_ginseng: 2, corpse_grass: 1 }, days: 3, fee: 32 },
  { id: 'barrier_break_pill', craft: 'alchemy', talent: 2, xp: 9, materials: { blood_ginseng: 2, snow_lotus: 2 }, days: 3, fee: 45 },
  { id: 'golden_core_pill', craft: 'alchemy', talent: 3, xp: 15, materials: { fox_core: 3, snow_lotus: 3 }, days: 4, fee: 110 },
  { id: 'nascent_soul_pill', craft: 'alchemy', talent: 3, xp: 24, materials: { fox_core: 4, star_sand: 3 }, days: 5, fee: 210 },
  { id: 'handmade_wrist_guard', craft: 'smithing', talent: 1, xp: 0, materials: { taibai_metal: 1 }, days: 1, fee: 8 },
  { id: 'black_iron_sword', craft: 'smithing', talent: 2, xp: 6, materials: { nether_iron: 2, taibai_metal: 1 }, days: 3, fee: 30 },
  { id: 'bronze_mirror', craft: 'smithing', talent: 3, xp: 12, materials: { nether_iron: 2, star_sand: 1 }, days: 3, fee: 56 },
];

export const craftItemName = (id: string) => [...CRAFT_ITEMS, ...ITEMS].find(item => item.id === id)?.name ?? id;
export const materialName = (id: string) => CRAFT_MATERIALS.find(item => item.id === id)?.name ?? id;
export const craftRegionName = (id: string) => WORLD_REGIONS.find(region => region.id === id)?.name ?? id;

interface Training { xp: number; known: string[] }
export interface CraftOrder {
  id: number; maker: string; recipeId: string; regionId: string; dueDay: number;
}
export interface CraftState {
  training: Record<string, Partial<Record<Craft, Training>>>;
  orders: CraftOrder[];
  nextOrder: number;
}
export interface CraftContext {
  journey: JourneyState;
  player: PlayerState;
  materials: Record<string, number>;
  charStates: Record<string, CharacterRuntimeState>;
  characters: CharacterData[];
  talents: CraftTalents;
}
export type CraftAction =
  | { type: 'study' | 'practice'; maker: string; craft: Craft }
  | { type: 'learn' | 'make'; maker: string; recipeId: string }
  | { type: 'collect'; orderId: number };

const PROFESSIONALS: Record<string, Craft> = { lin_waner: 'alchemy', ao_shuanghua: 'smithing' };

export function craftState(journey: JourneyState): CraftState {
  return journey.craft ?? { training: {}, orders: [], nextOrder: 1 };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isCraftState(value: unknown): value is CraftState {
  if (!record(value) || !record(value.training) || !Array.isArray(value.orders) || !natural(value.nextOrder) || value.nextOrder < 1) return false;
  const maximumId = value.nextOrder;
  const seen = new Set<number>();
  for (const order of value.orders) {
    if (!record(order) || !natural(order.id) || order.id < 1 || order.id >= maximumId || seen.has(order.id) ||
        !natural(order.dueDay) || typeof order.maker !== 'string' ||
        !WORLD_REGIONS.some(region => region.id === order.regionId) || !RECIPES.some(recipe => recipe.id === order.recipeId)) return false;
    seen.add(order.id);
  }
  return Object.values(value.training).every(skills => record(skills) && Object.entries(skills).every(([craft, entry]) =>
    (craft === 'alchemy' || craft === 'smithing') && record(entry) && natural(entry.xp) && Array.isArray(entry.known) &&
    entry.known.every(id => RECIPES.some(recipe => recipe.craft === craft && recipe.id === id))));
}

export function activeCraftOrder(journey: JourneyState, maker: string) {
  return journey.craft?.orders.find(order => order.maker === maker && order.dueDay > journey.day);
}

export function craftTalent(ctx: CraftContext, maker: string, craft: Craft) {
  if (maker === 'player') return ctx.talents[craft];
  if (PROFESSIONALS[maker] === craft) return 3;
  // Hash each discipline separately so talent survives travel and reloading the same life.
  let hash = (ctx.journey.seed ^ 2166136261) >>> 0;
  for (const char of maker + '/' + craft) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
  return (hash >>> 22) % 4;
}

export function craftTraining(ctx: CraftContext, maker: string, craft: Craft): Training | undefined {
  return craftState(ctx.journey).training[maker]?.[craft] ?? (PROFESSIONALS[maker] === craft
    ? { xp: 24, known: RECIPES.filter(recipe => recipe.craft === craft).map(recipe => recipe.id) }
    : undefined);
}

export const isCraftMaster = (maker: string, craft: Craft) => PROFESSIONALS[maker] === craft;
export function makerName(ctx: CraftContext, maker: string) {
  if (maker === 'player') return '你';
  if (!ctx.charStates[maker]?.met && !ctx.charStates[maker]?.isSoulmate)
    return PROFESSIONALS[maker] === 'alchemy' ? '背药篓的药师' : '披霜纹斗篷的器师';
  return ctx.characters.find(c => c.id === maker)?.name ?? '匠人';
}

export function learningDays(talent: number, baseDays: number) {
  return Math.max(1, baseDays - Math.floor(Math.max(0, talent - 1) * (baseDays + 1) / 4));
}

function unavailable(ctx: CraftContext, maker: string, days: number): string | undefined {
  const { journey } = ctx;
  if (activeCraftOrder(journey, maker)) return '上一炉还未收火。';
  if (maker === 'player') return;
  const status = journey.npcStatuses[maker];
  if (!status || !ctx.characters.some(c => c.id === maker)) return '此人已离开九州。';
  if (status.regionId !== journey.regionId) return '需要当面商量。';
  if ((status.recoverUntilDay ?? 0) >= journey.day) return '对方仍在养伤。';
  const lastWorkDay = journey.day + days - 1;
  const pending = journey.openStory?.pending.some(plan => plan.charId === maker && plan.npcTask &&
    (plan.npcTask.kind === 'inquire' || (plan.day <= lastWorkDay && plan.day + 1 >= journey.day)));
  if (pending || status.activityKey?.startsWith('npc-meeting:') ||
      (maker === 'lin_waner' && journey.herb.phase === 'promised') || status.activityKey?.startsWith('herb_') ||
      (!status.isCompanion && status.canIntervene && status.interveneType === 'rescue')) return '对方另有要事，抽不开身。';
  if (!status.isCompanion && status.availableUntilDay !== undefined && status.availableUntilDay < lastWorkDay)
    return '对方此次停留的日子不够。';
}

export function applyCraftAction(ctx: CraftContext, action: CraftAction) {
  const { journey, player, materials } = ctx;
  const state = craftState(journey);
  const reject = (message: string) => ({ ok: false, message, days: 0, journey, player, materials });
  const accept = (craft: CraftState, message: string, days = 0, nextPlayer = player, nextMaterials = materials) =>
    ({ ok: true, message, days, journey: { ...journey, craft }, player: nextPlayer, materials: nextMaterials });
  if (player.isDead) return reject('此生已尽。');
  if (action.type === 'collect') {
    const order = state.orders.find(entry => entry.id === action.orderId);
    if (!order) return reject('这份成品已领走。');
    if (order.dueDay > journey.day) return reject(`第 ${order.dueDay} 日才可领取。`);
    if (order.regionId !== journey.regionId) return reject(`成品寄存在${craftRegionName(order.regionId)}。`);
    const inventory = { ...player.inventory, [order.recipeId]: (player.inventory[order.recipeId] ?? 0) + 1 };
    return accept({ ...state, orders: state.orders.filter(entry => entry.id !== order.id) },
      `你领回了${craftItemName(order.recipeId)}。`, 0, { ...player, inventory });
  }
  const maker = action.maker;
  const recipe = 'recipeId' in action ? RECIPES.find(entry => entry.id === action.recipeId) : undefined;
  const craft = 'craft' in action ? action.craft : recipe?.craft;
  if (!craft) return reject('这张方子尚未收录。');
  const name = makerName(ctx, maker);
  const skill = CRAFT_NAMES[craft];
  const talent = craftTalent(ctx, maker, craft);
  const learned = craftTraining(ctx, maker, craft);
  const partner = Boolean(ctx.charStates[maker]?.isSoulmate);
  if (maker !== 'player' && !partner && (action.type !== 'make' || !isCraftMaster(maker, craft))) return reject('须由本人、已结契的道侣或该行师傅动手。');
  if (talent < 1) return reject(`${name}没有${skill}资质。`);
  const days = action.type === 'make' && recipe ? recipe.days : learningDays(talent,
    action.type === 'learn' && recipe ? recipe.talent + 1 : action.type === 'study' ? 3 : 2);
  const reason = unavailable(ctx, maker, days);
  if (reason) return reject(reason);
  const timeCost = action.type === 'make' && maker !== 'player' ? 0 : days;
  const lifeDays = (player.lifespanCapYears * 12 - player.ageMonths) * 30 - ((journey.day - 1) % 30);
  if (timeCost > lifeDays) return reject('余下寿元不足以完成此事。');
  const withTraining = (entry: Training) => ({ ...state, training: {
    ...state.training, [maker]: { ...state.training[maker], [craft]: entry },
  } });
  if (action.type === 'study') {
    if (learned) return reject('已经入门。');
    if (journey.regionId !== TRAINING_SITES[craft]) return reject(`请到${craftRegionName(TRAINING_SITES[craft])}借炉入门。`);
    return accept(withTraining({ xp: 0, known: [] }),
      `${name}借炉练了 ${days} 日${craft === 'alchemy' ? '辨药、控火' : '识矿、锻坯'}，${skill}入门了。`, days);
  }
  if (!learned) return reject(`须先研习${skill}入门。`);
  if (action.type === 'practice') {
    return accept(withTraining({ ...learned, xp: learned.xp + 2 }), `${name}温习${skill} ${days} 日，熟练增长 2。`, days);
  }
  if (!recipe) return reject('这张方子尚未收录。');
  if (talent < recipe.talent) return reject(`研习此方至少需要${TALENT_NAMES[recipe.talent]}。`);
  if (learned.xp < recipe.xp) return reject(`这张方子需要${skill}熟练 ${recipe.xp}。`);
  const knows = learned.known.includes(recipe.id);
  const product = craftItemName(recipe.id);
  if (action.type === 'learn') {
    if (knows) return reject('已学会此方。');
    return accept(withTraining({ ...learned, known: [...learned.known, recipe.id] }),
      `${name}花了 ${days} 日研读${product}的制法，记下了火候与成品的样子。`, days);
  }
  if (!knows) return reject(`${name}尚未学会${product}的制法。`);
  const fee = maker === 'player' || partner ? 0 : recipe.fee;
  if (player.spiritStones < fee) return reject(`还需备齐 ${fee} 灵石工钱。`);
  const missing = Object.entries(recipe.materials).filter(([id, amount]) => (materials[id] ?? 0) < amount);
  if (missing.length) return reject(`还缺${missing.map(([id, amount]) => materialName(id) + ' ×' + (amount - (materials[id] ?? 0))).join('、')}。`);
  const spent = { ...materials };
  for (const [id, amount] of Object.entries(recipe.materials)) spent[id] -= amount;
  const order = { id: state.nextOrder, maker, recipeId: recipe.id, regionId: journey.regionId, dueDay: journey.day + days };
  const next = withTraining({ ...learned, xp: learned.xp + recipe.days });
  return accept({ ...next, orders: [...state.orders, order], nextOrder: state.nextOrder + 1 },
    `${name}接下材料开炉炼制${product}。${fee ? '付了 ' + fee + ' 灵石工钱。' : ''}第 ${order.dueDay} 日可在${craftRegionName(order.regionId)}取件。`,
    timeCost, { ...player, spiritStones: player.spiritStones - fee }, spent);
}
