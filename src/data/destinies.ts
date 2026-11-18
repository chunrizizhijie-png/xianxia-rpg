import type { DestinyTrait } from '../types/game';
import { DESTINY_TRAITS } from './realms';

type Attribute = keyof DestinyTrait['modifiers'];
type Facet = readonly [id: string, name: string, stat: Attribute, value: number];

const ORIGINS: readonly Facet[] = [
  ['clinic', '药庐长大', 'senseBonus', 2],
  ['swordshop', '剑坊学艺', 'atkBonus', 2],
  ['garrison', '军户之后', 'defBonus', 2],
  ['posthouse', '驿站长大', 'charmBonus', 2],
  ['boat', '舟家出身', 'luckBonus', 2],
  ['hills', '山居采气', 'cultivationSpeedMult', 0.03],
  ['orchard', '果林农户', 'lifespanBonus', 2],
  ['hunters', '猎户之后', 'critRateBonus', 0.02],
  ['ledger', '账房学徒', 'senseBonus', 1],
  ['forge', '铁铺学徒', 'atkBonus', 1],
  ['itinerant', '走乡行脚', 'charmBonus', 1],
  ['fields', '田户之后', 'defBonus', 1],
];

const HABITS: readonly Facet[] = [
  ['fatigue', '易倦', 'cultivationSpeedMult', -0.04],
  ['shy', '认生', 'charmBonus', -2],
  ['cold', '手寒', 'atkBonus', -2],
  ['frail', '畏寒', 'defBonus', -2],
  ['night', '夜盲', 'senseBonus', -1],
  ['jinxed', '遇事偏迟', 'luckBonus', -2],
  ['hesitant', '出手迟疑', 'critRateBonus', -0.02],
  ['ailing', '幼有旧疾', 'lifespanBonus', -2],
  ['still', '耐得枯坐', 'cultivationSpeedMult', 0.03],
  ['observant', '善观神色', 'charmBonus', 1],
  ['quiet', '静时心细', 'senseBonus', 1],
  ['footwork', '下盘稳', 'defBonus', 1],
];

const ATTRIBUTES: Record<Attribute, string> = {
  atkBonus: '攻击', defBonus: '防御', senseBonus: '神识', charmBonus: '魅力',
  luckBonus: '气运', critRateBonus: '暴击率', lifespanBonus: '寿元', cultivationSpeedMult: '吐纳倍率',
};

function facetEffect([, name, stat, value]: Facet): string {
  const amount = stat === 'critRateBonus' ? `${Math.round(Math.abs(value) * 100)}%`
    : stat === 'lifespanBonus' ? `${Math.abs(value)} 年` : Math.abs(value);
  return `${name}（${ATTRIBUTES[stat]} ${value > 0 ? '+' : '−'}${amount}）`;
}

function compatible(base: DestinyTrait, origin: Facet, habit: Facet): boolean {
  return origin[2] !== habit[2] && base.modifiers[origin[2]] === undefined && base.modifiers[habit[2]] === undefined;
}

export function rollDestiny(base: DestinyTrait, random: () => number): string {
  const origins = ORIGINS.filter((origin) => base.modifiers[origin[2]] === undefined);
  const origin = origins[Math.floor(random() * origins.length)];
  const habits = HABITS.filter((habit) => compatible(base, origin, habit));
  const habit = habits[Math.floor(random() * habits.length)];
  return `birth:${base.id}:${origin[0]}:${habit[0]}`;
}

export function findDestinyTrait(id: string): DestinyTrait | undefined {
  if (typeof id !== 'string') return;
  if (!id.startsWith('birth:')) return DESTINY_TRAITS.find((trait) => trait.id === id);
  const [, baseId, originId, habitId, extra] = id.split(':');
  const base = DESTINY_TRAITS.find((trait) => trait.id === baseId);
  const origin = ORIGINS.find(([key]) => key === originId);
  const habit = HABITS.find(([key]) => key === habitId);
  if (extra !== undefined || !base || !origin || !habit || !compatible(base, origin, habit)) return;
  return {
    id,
    name: `${base.name} · ${origin[1]}`,
    rarity: base.rarity,
    description: `${base.description} ${facetEffect(origin)}，${facetEffect(habit)}。`,
    modifiers: { ...base.modifiers, [origin[2]]: origin[3], [habit[2]]: habit[3] },
  };
}

export function hasOrigin(traits: string[], origin?: string): boolean {
  return !origin || traits.some(id => id.startsWith('birth:') && id.split(':')[2] === origin);
}
