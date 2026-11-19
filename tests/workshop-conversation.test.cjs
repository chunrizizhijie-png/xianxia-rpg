const assert = require('node:assert/strict');
const test = require('node:test');
const { workshopConversation } = require('../src/engine/workshopConversation.ts');
const { craftTalent } = require('../src/engine/crafting.ts');
const { initializeJourney, ALL_CHARACTERS } = require('../src/engine/livingWorldEngine.ts');
const { createInitialCharacters, createInitialPlayer } = require('../src/engine/gameEngine.ts');

const maker = 'lin_waner';
const recipe = 'handmade_wound_powder';

function context() {
  const talents = { alchemy: 0, smithing: 0 };
  const journey = initializeJourney(ALL_CHARACTERS, 10);
  const charStates = createInitialCharacters(ALL_CHARACTERS);
  for (const runtime of Object.values(charStates)) runtime.met = true;
  return {
    journey: { ...journey, regionId: 'yaowang_valley' },
    talents, charStates, characters: ALL_CHARACTERS,
    player: { ...createInitialPlayer('游方', 'five_elements', [], talents), spiritStones: 30 },
    materials: { blood_ginseng: 3 },
  };
}

function offerFrom(ctx, person = maker) {
  const quote = workshopConversation(ctx, person, '劳烦帮我配一副止血散，可以吗？', []);
  assert.ok(quote.offer, quote.reply);
  assert.equal(quote.settlement, undefined);
  return [{ role: 'assistant', content: quote.reply, workshopOffer: quote.offer }];
}

test('conversation quotes a single item, confirms payment once, and delivers the due item once', () => {
  let ctx = context();
  const history = offerFrom(ctx);
  assert.match(history[0].content, /工钱6灵石/);
  assert.match(history[0].content, /用1日/);
  assert.equal(ctx.journey.craft?.orders.length ?? 0, 0);
  assert.equal(ctx.materials.blood_ginseng, 3);
  const confirm = workshopConversation(ctx, maker, '好，材料给你。', history);
  assert.match(confirm.reply, /第2日/);
  assert.equal(confirm.settlement.days, 0);
  ctx = { ...ctx, ...confirm.settlement };
  assert.equal(ctx.player.spiritStones, 24);
  assert.equal(ctx.materials.blood_ginseng, 2);
  assert.equal(ctx.journey.craft.orders.length, 1);
  assert.equal(workshopConversation(ctx, maker, '成交', history).settlement, undefined);
  assert.equal(workshopConversation(ctx, maker, '成交', [{ role: 'assistant', content: confirm.reply }]), undefined);
  assert.equal(workshopConversation(ctx, maker, '我来取止血散', []).settlement, undefined);
  assert.match(workshopConversation(ctx, maker, '止血散现在能取了吗？', []).reply, /第2日/);

  ctx.journey = { ...ctx.journey, day: 2 };
  assert.match(workshopConversation(ctx, maker, '止血散好了吗？', []).reply, /已经做好/);
  for (const line of ['明天我来取件', '我明天来取止血散', '我来取件行吗？', '我不要取件', '听说有人来取止血散', '我要拿那把伞']) {
    assert.equal(workshopConversation(ctx, maker, line, [])?.settlement, undefined, line);
  }
  assert.equal(workshopConversation(ctx, 'mu_qingge', '我来取止血散', []).settlement, undefined);
  const remote = { ...ctx, journey: { ...ctx.journey, regionId: 'taixu_peak' } };
  assert.equal(workshopConversation(remote, maker, '我来取止血散', []).settlement, undefined);
  const inventoryBefore = ctx.player.inventory[recipe] ?? 0;
  const collected = workshopConversation(ctx, maker, '我来取止血散', []).settlement;
  assert.equal(collected.ok, true);
  assert.equal(collected.player.inventory[recipe], inventoryBefore + 1);
  assert.equal(collected.journey.craft.orders.length, 0);
  assert.equal(workshopConversation({ ...ctx, ...collected }, maker, '我来取止血散', []).settlement, undefined);
});

test('a quote binds the conversation, day, region and available resources', () => {
  const ctx = context();
  const history = offerFrom(ctx);
  for (const [changed, person] of [
    [ctx, 'ao_shuanghua'],
    [{ ...ctx, journey: { ...ctx.journey, day: 2 } }, maker],
    [{ ...ctx, journey: { ...ctx.journey, regionId: 'taixu_peak' } }, maker],
    [{ ...ctx, materials: {} }, maker],
    [{ ...ctx, player: { ...ctx.player, spiritStones: 0 } }, maker],
  ]) assert.equal(workshopConversation(changed, person, '成交', history).settlement, undefined);

  for (const line of ['可以便宜一点吗？', '算了', '开炉吧？', '好，等明天再做']) {
    assert.equal(workshopConversation(ctx, maker, line, history)?.settlement, undefined);
  }
  assert.equal(workshopConversation(ctx, maker, '成交', [...history, { role: 'user', content: '再想想' }]), undefined);
  for (const line of ['帮我炼三份止血散', '请帮我炼止血散和筑基丹']) {
    const answer = workshopConversation(ctx, maker, line, []);
    assert.equal(answer.offer, undefined);
    assert.match(answer.reply, /一次只议一件/);
  }
});

test('asking a maker what they can make accepts the chosen recipe on the next turn', () => {
  const ctx = context();
  const reply = workshopConversation(ctx, maker, '你会炼什么丹药？', []);
  assert.match(reply.reply, /止血散/);
  assert.equal(reply.offer, undefined);
  const choice = [{ role: 'assistant', content: reply.reply }];
  const quote = workshopConversation(ctx, maker, '止血散。', choice);
  assert.equal(quote.offer.recipeId, recipe);
  assert.equal(quote.settlement, undefined);
  assert.equal(workshopConversation(ctx, maker, '止血散。', []), undefined);
  assert.equal(workshopConversation(ctx, maker, '能教我炼止血散吗？', []), undefined);
  const wrongTrade = workshopConversation(ctx, maker, '你会炼器吗？', []);
  assert.match(wrongTrade.reply, /找器师/);
  assert.equal(wrongTrade.offer, undefined);
});

test('chat checks partner training and talent and waives fees for a qualified partner', () => {
  const ctx = context();
  const id = 'mu_qingge';
  ctx.charStates[id].isSoulmate = true;
  ctx.journey.npcStatuses[id] = { ...ctx.journey.npcStatuses[id], regionId: 'yaowang_valley', isCompanion: true };
  while (craftTalent(ctx, id, 'alchemy') === 0) ctx.journey.seed++;
  const request = '帮我炼一份止血散';
  assert.equal(workshopConversation(ctx, id, request, []).offer, undefined);
  ctx.journey.craft = { nextOrder: 1, orders: [], training: { [id]: { alchemy: { xp: 6, known: [recipe] } } } };
  const history = offerFrom(ctx, id);
  assert.match(history[0].content, /工钱就免了/);
  const placed = workshopConversation(ctx, id, '好的，交给你了。', history).settlement;
  assert.equal(placed.player.spiritStones, 30);
  assert.equal(placed.materials.blood_ginseng, 2);
  while (craftTalent(ctx, id, 'alchemy') > 0) ctx.journey.seed++;
  assert.equal(workshopConversation(ctx, id, request, []).offer, undefined);
});
