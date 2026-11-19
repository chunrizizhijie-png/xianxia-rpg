import type { NpcChatMessage } from '../types/journey';
import {
  applyCraftAction, craftItemName, craftRegionName, craftTalent, craftTraining, isCraftMaster, materialName, RECIPES,
  type Craft, type CraftContext,
} from './crafting';

export interface WorkshopReply {
  reply: string;
  offer?: NpcChatMessage['workshopOffer'];
  settlement?: ReturnType<typeof applyCraftAction>;
}

const agree = /^(?:好[的啊呀]?[，,、 ]*)?(?:行|好[的啊呀]?|可以|成交|就这么办|按这个价|按你说的办|请开炉|开炉吧|材料给你|交给你了)[吧了啊嗯。！!\s]*$/u;
const askingForWork = /代[炼制打锻工]|开炉|委托|工钱|加工|手工费|(?:能|可|请|劳|帮|替|托|想|求|要|会).{0,12}(?:炼|制|打[造制]|锻|配[一副制药]|做)/u;
const askingForGoods = /取(?:货|件|药|丹|器|回|走|了)|来(?:领|取|拿)|领(?:取|回|走)|交货/u;
const askingAboutOrder = /做好|炼好|打好|好了|到期|能.{0,3}[领取拿]|(?:几时|几天|哪[天日]|什[么麼]时候).{0,5}(?:好|取|交)|订单|那[炉件单]/u;
// Asking about a pickup can mention the same product and day as collecting it.
// Only a present-tense instruction addressed to this maker can transfer the item.
const collectNow = /^(?:(?:师傅|师父|道友|姑娘|好|麻烦了)[，, ]*)?(?:我(?:现在|这就|今天)?(?:来|要|想)(?:领|取|拿)|(?:请|劳烦|麻烦)(?:把|将).+?给我|(?:取件|取货|取药|取丹|领取)(?:[。！!]|$))/u;
const notCollectingNow = /[?？吗么]|何时|哪[天日]|几时|几天|如何|怎么|明[早晚天日]|后[天日]|改[天日]|过几天|下[周月次]|(?:第\s*[\d零一二两三四五六七八九十]+\s*[天日])|(?:说|想好|考虑)过/u;

function reasonInSpeech(message: string) {
  if (message.startsWith('须由本人')) return '这活儿我接不了。你得去找懂这门手艺的师傅。';
  return message.replace(/对方/gu, '我').replace(/需要当面商量/u, '带材料来，当面交接');
}

function describeTrade(ctx: CraftContext, maker: string, craft: Craft): WorkshopReply {
  if (!isCraftMaster(maker, craft) && !ctx.charStates[maker].isSoulmate) {
    return { reply: craft === 'alchemy' ? '丹药代炼，你得找谷里的药师问问。' : '炼器的活儿，去太虚剑巅找器师打听吧。' };
  }
  const training = craftTraining(ctx, maker, craft);
  const talent = craftTalent(ctx, maker, craft);
  if (!talent) return { reply: craft === 'alchemy' ? '我辨不清炉里的药气，做不来这门手艺。' : '锻器的火候我掌握不了，交给我怕是白白折了材料。' };
  if (!training) return { reply: '这门手艺我还没学。等我入了门，学了方子，再替你做吧。' };
  const known = RECIPES.filter(recipe => recipe.craft === craft && recipe.talent <= talent &&
    recipe.xp <= training.xp && training.known.includes(recipe.id));
  if (!known.length) return { reply: '我刚学会掌炉，手里还没有练熟的方子。' };
  return { reply: `我会做${known.map(recipe => craftItemName(recipe.id)).join('、')}。你想做哪一件？` };
}

export function workshopConversation(
  ctx: CraftContext, maker: string, line: string, history: NpcChatMessage[],
): WorkshopReply | undefined {
  if (!ctx.charStates[maker]?.met) return;
  const text = line.normalize('NFKC').trim();
  const last = history[history.length - 1];
  const offer = last?.role === 'assistant' ? last.workshopOffer : undefined;
  if (offer && agree.test(text)) {
    if (offer.maker !== maker || offer.regionId !== ctx.journey.regionId || offer.day !== ctx.journey.day) {
      return { reply: '上次说的工期得重新算。你这回要做哪一件？' };
    }
    const settlement = applyCraftAction(ctx, { type: 'make', maker, recipeId: offer.recipeId });
    if (!settlement.ok) return { reply: reasonInSpeech(settlement.message) };
    const order = settlement.journey.craft!.orders[settlement.journey.craft!.orders.length - 1];
    return { settlement, reply: `材料我收下了。第${order.dueDay}日，你到${craftRegionName(order.regionId)}取${craftItemName(order.recipeId)}。` };
  }
  if (offer && /^(?:算了|先不了|不做了|暂时不做|不用了|下次吧)[。！!]?$/u.test(text)) {
    return { reply: '好，材料你先收着。' };
  }
  if (/假如|如果|要是|不用|不要|不想|先别|不必|别再|不[领取]|没说要|上回你说|你记得|教我|我自己|我想学/u.test(text)) return;
  const named = RECIPES.filter(recipe => text.includes(craftItemName(recipe.id)));
  if (!named.length && /^(?:请问|敢问)?(?:你|师傅|师父|道友|能不能|可以|能|想请你|帮我|请你).{0,10}(?:代炼|炼丹|炼器|打铁|锻器|锻造|炼.{0,4}丹(?:药)?|打.{0,4}法器)[吗么呢啊呀?？。]*$/u.test(text)) {
    return describeTrade(ctx, maker, /器|打铁|锻造/u.test(text) ? 'smithing' : 'alchemy');
  }
  const namesOnly = named.length === 1 && text.replace(/[。！!?？]/gu, '') === craftItemName(named[0].id);
  const answeringWhichOrder = namesOnly && last?.role === 'assistant' && last.content.startsWith('你问的是哪件？');
  const orders = (ctx.journey.craft?.orders ?? []).filter(order => order.maker === maker &&
    (!named.length || named.some(recipe => recipe.id === order.recipeId)));
  const collectionTarget = named.length > 0 || /取[件货药丹器]|交货|订单|成品|那[炉件份单]/u.test(text);
  const pickup = collectionTarget && (collectNow.test(text) || askingForGoods.test(text));
  const multipleItems = named.length > 1 || /(?:两|二|三|四|五|六|七|八|九|十|百|千|[2-9]|\d{2,})\s*[份件炉枚副]/u.test(text);
  if ((pickup || answeringWhichOrder || askingAboutOrder.test(text)) && (named.length || orders.length || /订单|取件/u.test(text))) {
    if (!orders.length) return { reply: '我这里没有这张待取的单子。' };
    if (multipleItems || new Set(orders.map(entry => entry.recipeId)).size > 1) {
      return { reply: `你问的是哪件？手里有${[...new Set(orders.map(entry => craftItemName(entry.recipeId)))].join('、')}的单子。` };
    }
    const order = orders.find(entry => entry.regionId === ctx.journey.regionId && entry.dueDay <= ctx.journey.day) ?? orders[0];
    const product = craftItemName(order.recipeId);
    const location = craftRegionName(order.regionId);
    const status = order.dueDay > ctx.journey.day
      ? `${product}还没好。第${order.dueDay}日起，到${location}取。` : `${product}已经做好，收在${location}的工坊里了。`;
    if (!collectNow.test(text) || notCollectingNow.test(text)) return { reply: status };
    if (ctx.journey.npcStatuses[maker]?.regionId !== ctx.journey.regionId) {
      return { reply: `${status}你到那里的工坊凭单领取就好。` };
    }
    const settlement = applyCraftAction(ctx, { type: 'collect', orderId: order.id });
    return settlement.ok ? { reply: `这份${craftItemName(order.recipeId)}是你的，收好。`, settlement }
      : { reply: reasonInSpeech(settlement.message) };
  }
  const answeringWhichRecipe = namesOnly && last?.role === 'assistant' && /你想做哪一件？|先说好要做哪一件/u.test(last.content);
  if (!named.length || (!answeringWhichRecipe && !askingForWork.test(text))) return;
  if (multipleItems) {
    return { reply: '我一次只议一件。先说好要做哪一件，再交材料。' };
  }
  const recipe = named[0];
  const work = applyCraftAction(ctx, { type: 'make', maker, recipeId: recipe.id });
  const cost = ctx.charStates[maker].isSoulmate ? '工钱就免了' : `工钱${recipe.fee}灵石`;
  const materials = Object.entries(recipe.materials).map(([id, count]) => `${materialName(id)}×${count}`).join('、');
  const quote = `${craftItemName(recipe.id)}要${materials}，${cost}，用${recipe.days}日。`;
  if (!work.ok) return { reply: (/还缺|还需备齐/u.test(work.message) ? quote : '') + reasonInSpeech(work.message) };
  return { reply: quote + '你若定了，把材料交给我。', offer: { maker, recipeId: recipe.id, regionId: ctx.journey.regionId, day: ctx.journey.day } };
}
