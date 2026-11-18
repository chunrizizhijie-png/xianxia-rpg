const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CRAFT_ITEMS, RECIPES, activeCraftOrder, applyCraftAction, craftTalent, isCraftState,
} = require('../src/engine/crafting.ts');
const { ITEMS } = require('../src/data/itemsAndSkills.ts');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');
const { createInitialPlayer, createInitialCharacters } = require('../src/engine/gameEngine.ts');

function context() {
  const talents = { alchemy: 1, smithing: 0 };
  const journey = initializeJourney(ALL_CHARACTERS, 10);
  return {
    journey: { ...journey, regionId: 'yaowang_valley' },
    player: { ...createInitialPlayer('云游', 'five_elements', [], talents), spiritStones: 1000 },
    talents, materials: { blood_ginseng: 10, corpse_grass: 10, snow_lotus: 10 },
    charStates: createInitialCharacters(ALL_CHARACTERS), characters: ALL_CHARACTERS,
  };
}
// The App advances the entire world through its normal time engine after applying a craft action.
function complete(ctx, action) {
  const result = applyCraftAction(ctx, action);
  assert.equal(result.ok, true, result.message);
  return { ...ctx, ...result, journey: { ...result.journey, day: ctx.journey.day + result.days } };
}
const craft = (type, recipeId, maker = 'player') => ({ type, recipeId, maker });
const train = (type, maker = 'player', craft = 'alchemy') => ({ type, maker, craft });

test('learning requires a talent, an apprenticeship and the particular recipe', () => {
  let ctx = context();
  assert.equal(applyCraftAction({ ...ctx, journey: { ...ctx.journey, regionId: 'taixu_peak' } }, train('study')).ok, false);
  const gifted = { ...ctx, talents: { alchemy: 3, smithing: 0 } };
  assert.ok(applyCraftAction(gifted, train('study')).days < applyCraftAction(ctx, train('study')).days);
  assert.equal(applyCraftAction(ctx, train('study', 'player', 'smithing')).ok, false);
  assert.equal(applyCraftAction(ctx, craft('make', 'handmade_wound_powder')).ok, false);
  ctx = complete(ctx, train('study'));
  assert.equal(ctx.days, 3);
  assert.equal(applyCraftAction(ctx, craft('make', 'handmade_wound_powder')).ok, false);
  assert.equal(applyCraftAction(ctx, craft('learn', 'heart_guard_pill')).ok, false);
  ctx = complete(ctx, craft('learn', 'handmade_wound_powder'));
  ctx = complete(ctx, craft('make', 'handmade_wound_powder'));
  assert.equal(ctx.materials.blood_ginseng, 9);
  ctx = complete(ctx, train('practice'));
  ctx = complete(ctx, craft('learn', 'heart_guard_pill'));
  assert.equal(applyCraftAction(ctx, craft('learn', 'foundation_pill')).ok, false);
  for (const recipe of RECIPES) assert.ok([...CRAFT_ITEMS, ...ITEMS].some(item => item.id === recipe.id));
});

test('a specialist takes one paid order and the workshop stores one finished item at its original location', () => {
  let ctx = context();
  const order = craft('make', 'heart_guard_pill', 'lin_waner');
  ctx = complete(ctx, order);
  assert.equal(ctx.days, 0);
  assert.equal(ctx.player.spiritStones, 982);
  assert.equal(ctx.materials.snow_lotus, 9);
  assert.equal(ctx.materials.corpse_grass, 9);
  assert.ok(activeCraftOrder(ctx.journey, 'lin_waner'));
  assert.equal(applyCraftAction(ctx, order).ok, false);
  const collect = { type: 'collect', orderId: 1 };
  assert.equal(applyCraftAction(ctx, collect).ok, false);
  ctx.journey = JSON.parse(JSON.stringify(ctx.journey));
  assert.ok(isCraftState(ctx.journey.craft));
  ctx.journey.day += 2;
  ctx.journey.regionId = 'taixu_peak';
  assert.equal(applyCraftAction(ctx, collect).ok, false);
  ctx.journey.regionId = 'yaowang_valley';
  const initialInventory = ctx.player.inventory.heart_guard_pill ?? 0;
  ctx = complete(ctx, collect);
  assert.equal(ctx.player.inventory.heart_guard_pill, initialInventory + 1);
  assert.equal(applyCraftAction(ctx, collect).ok, false);
  assert.equal(activeCraftOrder(ctx.journey, 'lin_waner'), undefined);
  assert.equal(isCraftState({ ...ctx.journey.craft, orders: [{}] }), false);
});

test('an untrained partner can learn their own trade and formula and charges no fee', () => {
  let ctx = context();
  const id = 'mu_qingge';
  while (craftTalent(ctx, id, 'alchemy') === 0) ctx.journey.seed++;
  const talent = craftTalent(ctx, id, 'alchemy');
  ctx.journey.npcStatuses[id] = { ...ctx.journey.npcStatuses[id], isCompanion: true, regionId: 'yaowang_valley' };
  assert.equal(applyCraftAction(ctx, train('study', id)).ok, false);
  ctx.charStates[id] = { ...ctx.charStates[id], isSoulmate: true };
  assert.equal(applyCraftAction(ctx, craft('make', 'handmade_wound_powder', id)).ok, false);
  ctx = complete(ctx, train('study', id));
  ctx = complete(ctx, craft('learn', 'handmade_wound_powder', id));
  ctx = complete(ctx, craft('make', 'handmade_wound_powder', id));
  assert.equal(ctx.player.spiritStones, 1000);
  assert.equal(ctx.materials.blood_ginseng, 9);
  assert.equal(craftTalent(ctx, id, 'alchemy'), talent);
});

test('a commission is declined without spending anything when time, supplies or payment are missing', () => {
  const ctx = context();
  const order = craft('make', 'heart_guard_pill', 'lin_waner');
  const unavailable = [
    { ...ctx, materials: {} },
    { ...ctx, player: { ...ctx.player, spiritStones: 0 } },
    { ...ctx, journey: { ...ctx.journey, regionId: 'taixu_peak' } },
    { ...ctx, journey: { ...ctx.journey, herb: { phase: 'promised', meetingDay: ctx.journey.day + 1 } } },
    { ...ctx, journey: { ...ctx.journey, openStory: { pending: [{ charId: 'lin_waner', day: ctx.journey.day + 1, npcTask: { kind: 'meet' } }] } } },
    ...[{ recoverUntilDay: 5 }, { availableUntilDay: ctx.journey.day }].map(change => ({ ...ctx, journey: {
      ...ctx.journey, npcStatuses: { ...ctx.journey.npcStatuses, lin_waner: { ...ctx.journey.npcStatuses.lin_waner, ...change } },
    } })),
  ];
  for (const input of unavailable) {
    const rejected = applyCraftAction(input, order);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.player, input.player);
    assert.equal(rejected.journey, input.journey);
    assert.equal(rejected.materials, input.materials);
  }
});
