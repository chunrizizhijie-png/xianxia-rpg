import { useState } from 'react';
import {
  CRAFT_NAMES, RECIPES, TALENT_NAMES, applyCraftAction, craftItemName, craftRegionName, craftState,
  craftTalent, craftTraining, isCraftMaster, learningDays, makerName, materialName,
} from '../engine/crafting';
import type { Craft, CraftAction, CraftContext } from '../engine/crafting';

interface Props {
  context: CraftContext;
  onAction: (action: CraftAction) => void;
}

const field = 'w-full rounded border border-[#d5bb78]/25 bg-[#15151b] px-2 py-2 text-sm text-stone-100';
const button = 'rounded border border-[#c5a059]/40 bg-[#30291d] px-3 py-2 text-sm text-[#edcf89] disabled:opacity-45';

export function CraftingPanel({ context, onAction }: Props) {
  const [craft, setCraft] = useState<Craft>('alchemy');
  const [makerChoice, setMakerChoice] = useState('player');
  const [recipeChoice, setRecipeChoice] = useState('');
  const { journey, charStates, characters, materials } = context;
  const makers = characters.filter(character => charStates[character.id]?.isSoulmate ||
    (isCraftMaster(character.id, craft) && journey.npcStatuses[character.id]?.regionId === journey.regionId));
  const maker = makers.some(character => character.id === makerChoice) ? makerChoice : 'player';
  const recipes = RECIPES.filter(recipe => recipe.craft === craft);
  const recipe = recipes.find(entry => entry.id === recipeChoice) ?? recipes[0];
  const talent = craftTalent(context, maker, craft);
  const training = craftTraining(context, maker, craft);
  const isPaid = maker !== 'player' && !charStates[maker]?.isSoulmate;
  const orders = craftState(journey).orders;

  function control(action: CraftAction, label: string) {
    const result = applyCraftAction(context, action);
    return <div className="min-w-0">
      <button type="button" className={button} disabled={!result.ok} onClick={() => onAction(action)}>{label}</button>
      {!result.ok && <p className="mt-1 text-xs text-stone-400">{result.message}</p>}
    </div>;
  }

  return <section aria-label="丹器工坊" className="space-y-4 px-1 text-stone-200">
    <div className="flex gap-2" aria-label="选择技艺">
      {(['alchemy', 'smithing'] as const).map(entry => <button type="button" key={entry} aria-pressed={entry === craft}
        className={entry === craft ? button + ' ring-1 ring-[#c5a059]' : button}
        onClick={() => { setCraft(entry); setRecipeChoice(''); setMakerChoice('player'); }}>{CRAFT_NAMES[entry]}</button>)}
    </div>
    <label className="block text-xs text-stone-400">掌炉人
      <select className={field + ' mt-1'} value={maker} onChange={event => setMakerChoice(event.target.value)}>
        <option value="player">自行研制</option>
        {makers.map(character => <option key={character.id} value={character.id}>
          {charStates[character.id]?.isSoulmate ? '道侣' : '当地师傅'} · {makerName(context, character.id)}
        </option>)}
      </select>
    </label>
    <p className="text-sm">{makerName(context, maker)}的{CRAFT_NAMES[craft]}资质 · {TALENT_NAMES[talent]}
      <span className="ml-3 text-stone-400">{training ? '已入门 · 熟练 ' + training.xp : '尚未入门'}</span>
    </p>
    {!makers.some(person => isCraftMaster(person.id, craft)) && <p className="text-xs text-stone-400">
      {craft === 'alchemy' ? '药王百草谷的药师常替人开炉，可带药材到谷中询问。' : '一位披霜纹斗篷的器师，常在青冥大山与太虚剑巅之间往来。'}
    </p>}
    {!isPaid && (training
      ? control({ type: 'practice', maker, craft }, '温习手艺 · ' + learningDays(talent, 2) + ' 日')
      : control({ type: 'study', maker, craft }, '研习入门 · ' + learningDays(talent, 3) + ' 日'))}
    <div className="xuan-panel space-y-3 rounded-xl p-3">
      <label className="block text-xs text-stone-400">{craft === 'alchemy' ? '丹方' : '器谱'}
        <select className={field + ' mt-1'} value={recipe.id} onChange={event => setRecipeChoice(event.target.value)}>
          {recipes.map(entry => <option key={entry.id} value={entry.id}>{craftItemName(entry.id)}{training?.known.includes(entry.id) ? ' · 已学' : ''}</option>)}
        </select>
      </label>
      <p className="text-xs text-stone-300">所需资质 {TALENT_NAMES[recipe.talent]} · 熟练 {recipe.xp} · 炼制 {recipe.days} 日{isPaid ? ' · 工钱 ' + recipe.fee + ' 灵石' : ''}</p>
      <ul className="space-y-1 text-sm">{Object.entries(recipe.materials).map(([id, count]) =>
        <li key={id} className={(materials[id] ?? 0) < count ? 'text-orange-300' : 'text-stone-300'}>
          {materialName(id)} ×{count} <span className="text-xs text-stone-400">（持有 {materials[id] ?? 0}）</span>
        </li>)}</ul>
      {!isPaid && !training?.known.includes(recipe.id)
        ? control({ type: 'learn', maker, recipeId: recipe.id }, '研读制法 · ' + learningDays(talent, recipe.talent + 1) + ' 日')
        : control({ type: 'make', maker, recipeId: recipe.id }, maker === 'player' ? '亲自开炉' : '交付材料')}
    </div>
    {orders.length > 0 && <div className="space-y-2"><h4 className="font-semibold text-[#e2c488]">取件凭据</h4>
      {orders.map(order => <div key={order.id} className="xuan-panel space-y-2 rounded-xl p-3">
        <p className="text-sm">{craftItemName(order.recipeId)} · {makerName(context, order.maker)}掌炉</p>
        <p className="text-xs text-stone-400">第 {order.dueDay} 日起 · {craftRegionName(order.regionId)}取件</p>
        {control({ type: 'collect', orderId: order.id }, '领取成品')}
      </div>)}
    </div>}
  </section>;
}
