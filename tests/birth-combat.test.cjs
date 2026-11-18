const assert = require('node:assert/strict');
const test = require('node:test');
const { rollBirthDraft, rollCraftTalents, loadBirthDraft, finishBirthDraft } = require('../src/engine/birth.ts');
const { createInitialPlayer, getEffectiveCombatStats, getEffectiveCultivationMult, initBattle,
  executeBattleTurn, BASIC_STRIKE, grantBattleRewards } = require('../src/engine/gameEngine.ts');
const { SKILLS, ENEMIES } = require('../src/data/itemsAndSkills.ts');
const { equippedSchools } = require('../src/data/worldSandbox.ts');

test('birth assigns three distinct archetypes and independent, persisted craft talents', () => {
  const birth = rollBirthDraft(() => 0);
  assert.equal(new Set(birth.traits.map((id) => id.split(':')[1] ?? id)).size, 3);
  assert.equal(birth.traits.filter(id => id.startsWith('birth:')).length, 1);
  const rolls = [0, 0.99];
  assert.deepEqual(rollCraftTalents(() => rolls.shift()), { alchemy: 0, smithing: 3 });
  const player = createInitialPlayer('林玄', birth.root, birth.traits, { alchemy: 0, smithing: 3 });
  assert.deepEqual(player.destinyTraits, birth.traits);
  assert.deepEqual(JSON.parse(JSON.stringify(player)).craftTalents, { alchemy: 0, smithing: 3 });
});

test('pending birth survives a reload and starting another life rolls fresh attributes', (t) => {
  const values = new Map();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    finishBirthDraft();
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  });
  const random = t.mock.method(Math, 'random', () => 0);
  const first = loadBirthDraft();
  random.mock.mockImplementation(() => 0.999);
  const birthModule = require.resolve('../src/engine/birth.ts');
  delete require.cache[birthModule];
  const afterReload = require(birthModule);
  assert.deepEqual(afterReload.loadBirthDraft(), first);
  afterReload.finishBirthDraft();
  assert.notDeepEqual(afterReload.loadBirthDraft(), first);
  afterReload.finishBirthDraft();
});

test('starting sword bond grants the displayed stats and extra sword intent, even on the basic fallback', () => {
  const player = createInitialPlayer('林玄', 'five_elements', []);
  const basicOnly = { ...player, equippedSkills: ['basic_sword'] };
  const stats = getEffectiveCombatStats(player, SKILLS);
  assert.equal(stats.atk, Math.round(player.atk * 1.16));
  assert.equal(stats.critRate, getEffectiveCombatStats(basicOnly, SKILLS).critRate + 0.1);
  const battle = { ...initBattle(ENEMIES[0]), skillCooldowns: { green_lotus_sword: 1 } };
  const cast = executeBattleTurn(battle, { ...player, mp: 0 }, SKILLS, BASIC_STRIKE.id);
  assert.equal(cast.nextBattle.playerSwordIntent, 2);
  assert.equal(cast.nextBattle.skillCooldowns.green_lotus_sword ?? 0, 0);
  assert.equal(cast.nextPlayer.mp, 8);
  assert.ok(cast.nextBattle.logs.some((line) => line.text.includes(BASIC_STRIKE.name)));
});

test('higher sword tier replaces lower tier and delivers a logged follow-up strike', () => {
  const player = createInitialPlayer('林玄', 'five_elements', []);
  player.equippedSkills.push('sword_intent_sky');
  assert.deepEqual(equippedSchools(player.equippedSkills, SKILLS).active.map((bond) => bond.id), ['syn_sword_3']);
  const battle = executeBattleTurn(initBattle(ENEMIES[4]), player, SKILLS, 'basic_sword');
  assert.ok(battle.nextBattle.logs.some((line) => line.text.includes('剑罡追斩')));
  assert.equal(battle.nextBattle.playerSwordIntent, 2);
  assert.ok(getEffectiveCultivationMult(player, SKILLS) > getEffectiveCultivationMult({ ...player, equippedSkills: [] }, SKILLS));
});

test('victory rewards include the enemy drop and a single win', () => {
  const player = createInitialPlayer('林玄', 'five_elements', []);
  const enemy = ENEMIES.find(entry => entry.id === 'realm_golem');
  const rewarded = grantBattleRewards(player, enemy);
  assert.equal(rewarded.inventory.golden_core_pill, 1);
  assert.equal(rewarded.stats.battlesWon, 1);
  assert.equal(rewarded.exp, player.exp + enemy.rewardExp);
  assert.equal(rewarded.spiritStones, player.spiritStones + enemy.rewardStones);
  assert.equal(player.inventory.golden_core_pill, undefined);
});
