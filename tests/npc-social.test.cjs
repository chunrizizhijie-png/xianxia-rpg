const test = require('node:test');
const assert = require('node:assert/strict');
const { reactToNpcLine, classifyOffline } = require('../src/engine/npcSocial.ts');
const { createInitialCharacters } = require('../src/engine/gameEngine.ts');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');
const { relationshipFor } = require('../src/engine/relationships.ts');

const character = ALL_CHARACTERS.find(c => c.id === 'lin_waner');
const other = ALL_CHARACTERS.find(c => c.id === 'shen_qingqiu');
const runtime = { ...createInitialCharacters(ALL_CHARACTERS)[character.id], met: true, hasContact: true };
const journey = initializeJourney(ALL_CHARACTERS, 11);

test('the same confidence is received differently by strangers, a familiar listener, and an offended friend', () => {
  const line = '我昨夜一宿没睡，怕那封信里是坏消息。';
  const answer = (person, state, world) => reactToNpcLine(person, state, world, line, '倾诉');
  const first = answer(character, runtime, journey);
  const familiar = { ...runtime, affection: 50 };
  const next = answer(character, familiar, journey);
  assert.notEqual(first.fallback, next.fallback);
  assert.notEqual(next.fallback, answer(other, familiar, journey).fallback);
  const demand = reactToNpcLine(character, familiar, journey, '你必须告诉我。', '施压');
  assert.equal(relationshipFor(demand.journey, character.id, demand.runtime).label, '有隔阂');
  assert.notEqual(answer(character, demand.runtime, demand.journey).fallback, next.fallback);
  const repair = reactToNpcLine(character, demand.runtime, demand.journey, '刚才是我话重了。', '致歉');
  assert.notEqual(relationshipFor(repair.journey, character.id, repair.runtime).label, '有隔阂');
  assert.equal(reactToNpcLine(character, repair.runtime, repair.journey, '是我话重了。', '致歉').journey, repair.journey);
  assert.ok(repair.runtime.affection < familiar.affection);
});

test('care is remembered across save/load but repeats, same-day synonyms and uncertain speech grant no extra affection', () => {
  const line = '伤口还疼吗？';
  assert.equal(classifyOffline(line), '关怀');
  assert.equal(classifyOffline('她问我伤口还疼吗？'), '闲谈');
  const result = reactToNpcLine(character, runtime, journey, line, '关怀');
  assert.equal(result.runtime.affection, runtime.affection + 1);
  assert.ok(result.journey.memories[character.id].some(m => m.detail.includes(line)));
  const restored = JSON.parse(JSON.stringify(result.journey));
  for (const phrase of [line, '你别太累了。']) {
    const repeated = reactToNpcLine(character, result.runtime, restored, phrase, '关怀');
    assert.equal(repeated.runtime, result.runtime);
    assert.equal(repeated.journey, restored);
  }
  const later = { ...restored, day: restored.day + 9 };
  assert.equal(reactToNpcLine(character, result.runtime, later, line, '关怀').runtime, result.runtime);
  assert.equal(reactToNpcLine(character, runtime, journey, '嗯。', '闲谈').journey, journey);
});
