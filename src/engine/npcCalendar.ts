import { WORLD_REGIONS } from '../data/worldSandbox';

const places: Record<string, string[]> = {
  taixu_peak: ['太虚剑巅', '太虚峰', '剑巅', '试剑崖', '剑峰'],
  qingming_wild: ['青冥十万大山', '青冥山', '青冥大山', '青冥山脉', '十万大山'],
  heishan_market: ['黑山鬼市', '黑山', '鬼市'],
  yaowang_valley: ['药王百草谷', '药王谷', '百草谷', '药庐'],
  feiyue_palace: ['绯月合欢宫', '绯月宫', '合欢宫', '绯月阁'],
  zixiao_thunder: ['紫霄雷墟', '雷墟', '紫霄雷泽', '雷泽'],
};

export function mentionedRegions(line: string) {
  return WORLD_REGIONS.filter(region => places[region.id]?.some(alias => line.includes(alias)));
}

function numberInChinese(source: string): number {
  if (/^[0-9]+$/.test(source)) return Number(source);
  const digits = '零一二三四五六七八九';
  const normalized = source.replace(/两/gu, '二').replace(/〇/gu, '零');
  if (!/[十百千万]/u.test(normalized)) return Number([...normalized].map(c => digits.indexOf(c)).join(''));
  let thousands = 0, total = 0, digit = 0;
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  for (const part of normalized) {
    if (part === '万') { thousands = (total + digit || 1) * 10000; total = 0; digit = 0; }
    else if (units[part]) { total += (digit || 1) * units[part]; digit = 0; }
    else digit = digits.indexOf(part);
  }
  return thousands + total + digit;
}

const relativeDays: Record<string, number> = {
  今晚: 0, 今天: 0, 今日: 0, 今夜: 0,
  明天: 1, 明日: 1, 明晚: 1, 明早: 1,
  后天: 2, 后日: 2, 大后天: 3, 大后日: 3,
  昨天: -1, 昨日: -1, 前天: -2, 前日: -2,
};
const calendarWords = /大后[天日]|后[天日]|明[天日晚早]|今[天日晚夜]|昨[天日]|前[天日]|第\s*([0-9零〇一二两三四五六七八九十百千万]+)\s*[日天]|([0-9零〇一二两三四五六七八九十百千万]+)\s*[天日]\s*(?:之|以)?([后前])/gu;

export function dayReferences(line: string, today: number): number[] {
  const text = line.normalize('NFKC');
  return [...new Set([...text.matchAll(calendarWords)].map(match => {
    if (match[1]) return numberInChinese(match[1]);
    if (match[2]) return today + numberInChinese(match[2]) * (match[3] === '后' ? 1 : -1);
    return today + relativeDays[match[0]];
  }))];
}

export function dayForPlan(line: string, today: number): { day?: number; error?: string } {
  const days = dayReferences(line, today);
  if (days.length > 1 || /[几某][天日]|改天|改日|过些[天日]|下(?:周|个?月)|下旬|月底|周[一二三四五六日天]|[天日]左右|[天日]之?内|[两二三四五六七八九][三四五六七八九][天日]后/u.test(line)) {
    return { error: '我怕记岔，你想约在哪一日？可以告诉我第几日。' };
  }
  if (days.some(day => !Number.isSafeInteger(day) || day <= today)) {
    return { error: '这日子已经到了。另约一个之后的日子吧。' };
  }
  return { day: days[0] };
}
