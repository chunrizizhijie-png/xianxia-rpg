const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENTS } = require('../src/data/events.ts');
const { REALMS } = require('../src/data/realms.ts');
const { ENEMIES, SKILLS } = require('../src/data/itemsAndSkills.ts');
const { ALL_CHARACTERS: cast, initializeJourney, findRetreatInterruption } = require('../src/engine/livingWorldEngine.ts');
const { createInitialPlayer, createInitialCharacters, filterAvailableEvents, attemptBreakthrough,
  breakthroughSetback, pendingEnemyStrike, initBattle, executeBattleTurn, FOCUS_BREATH } = require('../src/engine/gameEngine.ts');
const { encounterCharacter, openConversation, chooseDialogue } = require('../src/engine/npcDialogue.ts');
const { restoreCharacters, restoreCraftTalents, parseLife } = require('../src/engine/lifeSave.ts');
const { hasOrigin } = require('../src/data/destinies.ts');

function newLife() {
  const player = createInitialPlayer('云岫', 'five_elements', [], { alchemy: 0, smithing: 2 });
  return { player, characters: createInitialCharacters(cast), journey: initializeJourney(cast, 42), logs: [] };
}

test('a first meeting grants a name, and contact requires a shared experience', () => {
  const { player, characters, journey } = newLife();
  const character = cast[0];
  const runtime = characters[character.id];
  assert.ok(Object.values(characters).every(c => !c.met && !c.hasContact && c.affection === 0));
  assert.equal(findRetreatInterruption(journey, cast, player, 90, characters), undefined);
  const local = { ...journey, regionId: journey.npcStatuses[character.id].regionId };
  const remote = { ...journey, regionId: 'somewhere-else' };
  assert.equal(encounterCharacter(character, runtime, remote), undefined);
  const meeting = encounterCharacter(character, runtime, local);
  assert.ok(meeting.runtime.met);
  assert.equal(meeting.runtime.affection, 0);
  const context = { player, character, runtime: meeting.runtime, journey: meeting.journey };
  assert.ok(!chooseDialogue(context, { action: 'exchange' }).runtime.hasContact);
  assert.deepEqual(openConversation({ ...context, journey: remote }).choices, []);
  const withHistory = { ...meeting.journey, memories: { [character.id]: [{ id: 'aid', kind: 'help', day: 1, detail: '一起护送药材。' }] } };
  const exchange = chooseDialogue({ ...context, journey: withHistory }, { action: 'exchange' });
  assert.ok(exchange.runtime.hasContact);
  assert.ok(openConversation({ ...context, runtime: exchange.runtime, journey: remote }).choices.length);
});

test('legacy saves recover genuine bonds and stable aptitudes without treating the starting 18 as a meeting', () => {
  const save = newLife();
  delete save.player.craftTalents;
  for (const state of Object.values(save.characters)) {
    delete state.hasContact;
    Object.assign(state, { met: true, affection: 18 });
  }
  const [partner, stranger, friend] = cast;
  save.characters[partner.id].isSoulmate = true;
  save.characters[friend.id].interactionCount = 1;
  const loaded = parseLife(JSON.parse(JSON.stringify(save)));
  assert.ok(loaded);
  const restored = restoreCharacters(loaded, cast);
  assert.ok(restored[partner.id].isSoulmate && restored[partner.id].hasContact);
  assert.ok(restored[friend.id].met);
  assert.equal(restored[stranger.id].affection, 0);
  assert.equal(restored[stranger.id].met, false);
  assert.deepEqual(restoreCraftTalents(loaded, loaded.journey), restoreCraftTalents(save, save.journey));
  assert.equal(parseLife({ ...save, journey: { ...save.journey, craft: { orders: 'broken' } } }), null);
});

test('treasures, local markets and background choices respect their requirements', () => {
  const { player, characters } = newLife();
  const accessible = (region, sites) => filterAvailableEvents(EVENTS, player, characters, region, sites).map(e => e.id);
  assert.ok(!accessible('yaowang_valley').includes('evt_market_rusty_sword'));
  assert.ok(accessible('heishan_market').includes('evt_market_rusty_sword'));
  assert.ok(accessible('qingming_wild').includes('evt_secret_sword_tomb'));
  assert.ok(!accessible('qingming_wild', ['evt_secret_sword_tomb']).includes('evt_secret_sword_tomb'));
  assert.ok(!accessible('taixu_peak').some(id => id.startsWith('evt_shura')));
  assert.ok(hasOrigin(['birth:abc:clinic:shy'], 'clinic'));
  assert.ok(!hasOrigin(['birth:abc:swordshop:shy'], 'clinic'));
});

test('a failed breakthrough near the end of life cannot increase lifespan', () => {
  const { player } = newLife();
  const elder = { ...player, ageMonths: 1199, lifespanCapYears: 100, exp: REALMS[0].maxExp };
  const expected = breakthroughSetback(elder, REALMS[0], false);
  const result = attemptBreakthrough(elder, REALMS, false, false, false, 100);
  assert.equal(result.nextPlayer.lifespanCapYears, elder.lifespanCapYears - expected.lifespanLoss);
  assert.equal(result.nextPlayer.exp, expected.exp);
  assert.equal(result.nextPlayer.isDead, true);
});

test('a golem telegraphs its heavy attack and focusing restores spirit and absorbs damage', () => {
  const golem = ENEMIES.find(enemy => enemy.id === 'realm_golem');
  const turn = golem.skills.find(s => s.windup).windup.everyTurns;
  assert.equal(pendingEnemyStrike(golem, turn - 1), undefined);
  assert.ok(pendingEnemyStrike(golem, turn));
  const player = { ...newLife().player, hp: 5000, maxHp: 5000, mp: 0 };
  const result = executeBattleTurn({ ...initBattle(golem), turn }, player, SKILLS, FOCUS_BREATH.id);
  assert.equal(result.nextBattle.enemyHp, golem.hp);
  assert.ok(result.nextPlayer.mp > 0);
  assert.ok(result.nextBattle.logs.some(entry => entry.text.includes('护体化去')));
});
