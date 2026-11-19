const test = require('node:test');
const assert = require('node:assert/strict');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');
const { createInitialCharacters, createInitialPlayer } = require('../src/engine/gameEngine.ts');
const { openConversation } = require('../src/engine/npcDialogue.ts');
const { relationshipFor } = require('../src/engine/relationships.ts');
const { reactToNpcLine } = require('../src/engine/npcSocial.ts');
const { saveNpcChat } = require('../src/engine/npcChat.ts');

const character = ALL_CHARACTERS[0];
const runtime = { ...createInitialCharacters([character])[character.id], met: true, hasContact: true, affection: 32 };
const journey = initializeJourney(ALL_CHARACTERS, 11);
const player = createInitialPlayer('松风', 'five_elements', []);

test('a remembered confidence can start tomorrow’s conversation without repeating the question', () => {
  const { journey: shared } = reactToNpcLine(character, runtime, journey, '我怕再见不到渡口的老船工。', '倾诉');
  const tomorrow = { ...shared, day: shared.day + 1 };
  const context = { character, player, runtime, journey: tomorrow };
  const greeting = openConversation(context).line;
  assert.match(greeting, /老船工/u);
  const saved = saveNpcChat(tomorrow, character.id, [{ role: 'assistant', content: greeting, scripted: true, day: tomorrow.day }], greeting);
  assert.notEqual(openConversation({ ...context, journey: saved }).line, greeting);
  assert.doesNotMatch(openConversation({ ...context, character: ALL_CHARACTERS[1] }).line, /老船工/u);
});

test('a demand changes willingness despite high affection and repairing this demand restores it', () => {
  const pressure = reactToNpcLine(character, runtime, journey, '你今天必须把它告诉我。', '施压');
  assert.ok(pressure.runtime.affection < runtime.affection);
  assert.equal(relationshipFor(pressure.journey, character.id, pressure.runtime).label, '有隔阂');
  const apology = reactToNpcLine(character, pressure.runtime, pressure.journey, '刚才逼你开口，是我的错。', '致歉');
  assert.notEqual(relationshipFor(apology.journey, character.id, apology.runtime).label, '有隔阂');
  const again = reactToNpcLine(character, apology.runtime, apology.journey, '我再向你赔个不是。', '致歉');
  assert.equal(again.runtime.affection, apology.runtime.affection);
});
