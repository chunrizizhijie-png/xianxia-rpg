const assert = require('node:assert/strict');
const test = require('node:test');
const { ALL_CHARACTERS, initializeJourney, refreshNpcAgendas } = require('../src/engine/livingWorldEngine.ts');
const { attendNpcMeeting, settleStoryFollowups } = require('../src/engine/openStory.ts');
const { relationshipFor } = require('../src/engine/relationships.ts');
const { openConversation, chooseDialogue, matchDialogueInput } = require('../src/engine/npcDialogue.ts');
const { createInitialPlayer, createInitialCharacters } = require('../src/engine/gameEngine.ts');
const { parseLife, restoreJourney } = require('../src/engine/lifeSave.ts');

const character = ALL_CHARACTERS.find(npc => npc.id === 'shen_qingqiu');
const place = 'yaowang_valley';
const appointment = {
  id: 'story:1', day: 4, regionId: place, charId: character.id,
  npcTask: { kind: 'meet', subject: '商量剑冢的事' }, text: '沈清秋已经到了药谷。',
};
const inquiry = { ...appointment, id: 'story:2', day: 5,
  npcTask: { kind: 'inquire', subject: '药谷的货期' }, text: '货已到药庐。' };

function plans(...pending) {
  return {
    ...initializeJourney(ALL_CHARACTERS, 11),
    openStory: { turns: 2, history: [], pending },
    npcChats: { [character.id]: { day: 1, regionId: 'taixu_peak', messages: [] } },
  };
}
function advance(journey, day, regionId = journey.regionId) {
  return settleStoryFollowups(refreshNpcAgendas({ ...journey, day, regionId }), ALL_CHARACTERS);
}
function reload(journey) {
  const saved = {
    version: 1, player: createInitialPlayer('云岫', 'five_elements', []),
    characters: createInitialCharacters(ALL_CHARACTERS), journey, logs: [],
  };
  const restored = parseLife(JSON.parse(JSON.stringify(saved)));
  assert.ok(restored);
  return restored.journey;
}

test('a legacy save opened while the NPC is waiting can finish its meeting exactly once', () => {
  const prior = advance(plans(appointment), 4, place).journey;
  prior.openStory = { ...prior.openStory, history: [appointment], pending: [] };
  const save = { journey: prior, player: createInitialPlayer('旧游', 'five_elements', []) };
  const migrated = restoreJourney(save, ALL_CHARACTERS);
  assert.equal(migrated.openStory.pending[0].npcTask.arrived, true);
  assert.deepEqual(settleStoryFollowups(migrated, ALL_CHARACTERS).due, []);
  const kept = attendNpcMeeting(migrated, character);
  assert.ok(kept.entry);
  assert.equal(restoreJourney({ ...save, journey: kept.journey }, ALL_CHARACTERS).openStory.pending.length, 0);
  assert.equal(restoreJourney({ ...save, journey: { ...prior, day: 9 } }, ALL_CHARACTERS).openStory.pending.length, 0);
});

test('attending requires the agreed NPC, place, dates and actual conversation', () => {
  const scheduled = plans(appointment);
  assert.equal(attendNpcMeeting(scheduled, character).entry, undefined);
  const waiting = advance(scheduled, 4);
  assert.deepEqual(waiting.due.map(e => e.id), ['story:1:arrived']);
  assert.equal(waiting.journey.openStory.pending[0].npcTask.arrived, true);
  assert.equal(waiting.journey.npcStatuses[character.id].regionId, place);
  assert.equal(attendNpcMeeting(waiting.journey, character).entry, undefined);
  const local = advance(reload(waiting.journey), 5, place);
  assert.deepEqual(local.due, []);
  assert.equal(attendNpcMeeting(local.journey, ALL_CHARACTERS.find(c => c.id !== character.id)).entry, undefined);
  const result = attendNpcMeeting(local.journey, character);
  assert.equal(result.entry.day, 5);
  assert.match(result.entry.text, /药王百草谷.+沈清秋.+剑冢/);
  assert.equal(result.journey.openStory.pending.length, 0);
  assert.equal(relationshipFor(result.journey, character.id, { met: true }).label, '渐渐相熟');
  assert.equal(attendNpcMeeting(reload(result.journey), character).entry, undefined);
  assert.deepEqual(advance(result.journey, 30).due, []);
});

test('closing a retreat accounts for every event in date order and cannot repeat a loss of trust', () => {
  const result = advance(plans(appointment, inquiry), 91, place);
  assert.deepEqual(result.due.map(e => [e.id, e.day]), [
    ['story:1:arrived', 4], ['story:2', 5], ['story:1:missed', 6],
  ]);
  assert.equal(result.journey.memories[character.id].filter(m => m.kind === 'absence').length, 1);
  assert.equal(relationshipFor(result.journey, character.id, { met: true }).label, '有隔阂');
  assert.deepEqual(result.journey.npcChats[character.id].messages.map(m => m.day), [4, 5, 6]);
  assert.deepEqual(advance(reload(result.journey), 92).due, []);
});

test('NPC unavailability releases an appointment without blaming the player; canceled history stays closed', () => {
  const initial = plans(appointment);
  initial.npcStatuses[character.id].recoverUntilDay = 7;
  const blocked = advance(initial, 6, place);
  assert.deepEqual(blocked.due.map(e => e.id), ['story:1:interrupted']);
  assert.ok(!blocked.journey.memories[character.id].some(m => m.kind === 'absence'));
  const released = { ...initial, openStory: { turns: 2, history: [appointment], pending: [] } };
  assert.deepEqual(advance(released, 20).due, []);
});

test('an apology settles the missed appointment once and restores the ability to arrange another meeting', () => {
  const { npcDecisionOptions } = require('../src/engine/npcPlans.ts');
  const journey = advance(plans(appointment), 8).journey;
  const runtime = { ...createInitialCharacters([character])[character.id], met: true, hasContact: true };
  const player = createInitialPlayer('云岫', 'five_elements', []);
  const context = { character, player, runtime, journey };
  const node = openConversation(context);
  assert.match(node.line, /剑冢/);
  assert.equal(npcDecisionOptions(character, runtime, player, journey, '明天见面吗？').meet, undefined);
  for (const online of [false, true]) {
    const apology = matchDialogueInput('没能赶到，让你白等了，是我的错。', node, online);
    assert.equal(apology?.action, 'apology');
    assert.notEqual(matchDialogueInput('如果我为失约道歉，你会原谅我吗？', node, online)?.action, 'apology');
    const next = chooseDialogue(context, apology);
    assert.equal(next.runtime.affection, runtime.affection);
    const restored = { ...context, journey: reload(next.journey) };
    assert.equal(relationshipFor(restored.journey, character.id, runtime).label, '初识');
    assert.ok(npcDecisionOptions(character, runtime, player, restored.journey, '明天见面吗？').meet);
    assert.ok(!openConversation(restored).choices.some(c => c.action === 'apology'));
    assert.equal(chooseDialogue(restored, apology).journey, restored.journey);
    assert.ok(next.journey.memories[character.id].some(m => m.id === appointment.id + ':missed:apology' && m.detail.includes('剑冢')));
  }
});

test('a long retreat honors work and travel commitments on both days of the meeting window', () => {
  const working = { ...plans(appointment), craft: { training: {}, nextOrder: 2, orders: [
    { id: 1, maker: character.id, regionId: place, recipeId: 'handmade_wrist_guard', dueDay: 5 },
  ] } };
  const occupied = advance(working, 32);
  assert.deepEqual(occupied.due.map(e => e.id), ['story:1:interrupted']);
  assert.equal(occupied.due[0].day, 4);
  const returned = { ...plans(appointment), herb: {
    phase: 'declined', meetingDay: 4, resolvedDay: 5, helperId: character.id,
  } };
  const twoDays = advance(advance(returned, 4).journey, 5);
  const longRetreat = advance(returned, 90);
  assert.deepEqual(longRetreat.journey.openStory.history, twoDays.journey.openStory.history);
  assert.deepEqual(longRetreat.due.map(e => [e.id, e.day]), [['story:1:arrived', 4], ['story:1:interrupted', 5]]);
  assert.ok(!longRetreat.journey.memories[character.id].some(m => m.kind === 'absence'));
});

test('keeping an appointment and respecting a private boundary are separate shared experiences', () => {
  const waiting = advance(plans(appointment), 4, place);
  const journey = attendNpcMeeting(waiting.journey, character).journey;
  const player = createInitialPlayer('云岫', 'five_elements', []);
  const runtime = { ...createInitialCharacters([character])[character.id], met: true };
  const context = { character, player, runtime, journey };
  const conversation = openConversation(context);
  const personal = chooseDialogue(context, conversation.choices.find(c => c.action === 'private')).node;
  const respect = matchDialogueInput('等你愿意讲时，我再来听。', personal);
  assert.equal(respect.action, 'respect');
  const first = chooseDialogue(context, respect);
  const after = { ...context, journey: reload(first.journey), runtime: first.runtime };
  const repeated = chooseDialogue(after, respect);
  assert.equal(repeated.runtime.affection, first.runtime.affection);
  assert.equal(repeated.journey, after.journey);
});
