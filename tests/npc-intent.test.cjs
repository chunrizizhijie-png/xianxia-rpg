const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readNpcMove, routeNpcLine } = require('../src/engine/npcIntent.ts');
const { chooseDialogue, openConversation } = require('../src/engine/npcDialogue.ts');
const { createInitialCharacters, createInitialPlayer } = require('../src/engine/gameEngine.ts');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');
const { applyNpcDecision } = require('../src/engine/npcPlans.ts');

const character = ALL_CHARACTERS[0];
const player = createInitialPlayer('白榆', 'five_elements', []);
const runtime = { ...createInitialCharacters([character])[character.id], met: true, hasContact: true };
const journey = initializeJourney(ALL_CHARACTERS, 0);
journey.npcStatuses[character.id] = { ...journey.npcStatuses[character.id], regionId: journey.regionId, canIntervene: false };
const context = { character, runtime, journey, player };
const signal = new AbortController().signal;
const route = (model, node, line, world = journey) => routeNpcLine(
  model, character, runtime, player, world, { node, turns: [] }, line, signal,
);

test('a paraphrased response to a private question uses the live choice and records a boundary', async () => {
  const greeting = openConversation(context);
  const node = chooseDialogue(context, greeting.choices.find(c => c.action === 'private')).node;
  const model = { async selectNpcMove(messages, labels) {
    assert.match(messages[0].content, /话题1：对方的意思是「点头，等她愿意说时再听」/u);
    assert.match(messages.at(-1).content, /等你开口/u);
    return readNpcMove('{"action":"话题1","confidence":"明确"}', labels);
  } };
  const result = await route(model, node, '这话还是等你开口，我才听。');
  assert.equal(result.choice, node.choices.find(c => c.action === 'respect'));
  const turn = chooseDialogue(context, result.choice);
  assert.equal(turn.runtime.affection, runtime.affection + 3);
  assert.ok(turn.journey.memories[character.id].some(m => m.kind === 'confidence'));
});

test('guesses, out-of-menu output, and locked or binding script actions cannot trigger a choice', async () => {
  const node = { line: '要出发么？', choices: [
    { action: 'promise', label: '允诺同行' }, { action: 'decline', label: '拒绝同行' }, { action: 'detour', label: '绕过山口' },
    { action: 'topic', label: '请教秘法', lockReason: '尚未相熟' }, { action: 'agenda', label: '问问近况' },
  ] };
  for (const output of ['{}', 'broken', 'null', '{"action":"话题1","confidence":"不确定"}',
    '{"action":"允诺同行","confidence":"明确"}', '{"action":"话题2","confidence":"明确"}']) {
    const result = await route({ async selectNpcMove(messages, labels) {
      assert.deepEqual(labels, ['继续交谈', '话题1']);
      assert.doesNotMatch(messages[0].content, /允诺同行|拒绝同行|绕过山口|请教秘法/u);
      return readNpcMove(output, labels);
    } }, node, '你怎么看？');
    assert.equal(result.choice, undefined);
    assert.equal(result.decision.action, 'talk');
  }
  for (const line of ['听说你以前喜欢别人追问？', '上次我托你记住的话是什么？']) {
    const result = await route({ selectNpcMove: () => assert.fail('语义含混时无须分类') }, node, line);
    assert.equal(result.choice, undefined);
  }
});

test('scheduling classifies willingness only; the engine owns the date, place and cancellation', async () => {
  const greeting = openConversation(context);
  const line = '后天去药庐见面吧，谈谈辨药。';
  const result = await route({ async selectNpcMove(_messages, labels) {
    assert.deepEqual(labels, ['继续交谈', '答应见面']);
    return '答应见面';
  } }, greeting, line);
  assert.equal(result.choice, undefined);
  const booked = applyNpcDecision(result.decision, character, runtime, player, journey, line).journey;
  assert.equal(booked.openStory.pending[0].day, journey.day + 2);
  assert.equal(booked.openStory.pending[0].regionId, 'yaowang_valley');
  const cancelled = await route({ selectNpcMove: () => assert.fail('玩家取消无需等待模型同意') }, greeting, '取消约见', booked);
  assert.equal(cancelled.decision.action, 'cancel');
  const abort = new AbortController();
  await assert.rejects(() => routeNpcLine({ async selectNpcMove() { abort.abort(); return '答应见面'; } },
    character, runtime, player, journey, { node: greeting, turns: [] }, line, abort.signal), { name: 'AbortError' });
});
