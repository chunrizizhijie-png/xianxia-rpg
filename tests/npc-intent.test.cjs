const { test } = require('node:test');
const assert = require('node:assert/strict');
const { understandNpcLine } = require('../src/engine/npcIntent.ts');
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
const route = (model, node, line, world = journey) => understandNpcLine(
  model, character, runtime, player, world, { node, turns: [] }, line, signal,
);
const answer = (action, detail = {}) => JSON.stringify({ action, confidence: '明确', attitude: '闲谈', proposal: '无', subject: '', ...detail });

test('a paraphrased response to a private question uses the live choice and records a boundary', async () => {
  const greeting = openConversation(context);
  const node = chooseDialogue(context, greeting.choices.find(c => c.action === 'private')).node;
  const model = { async selectNpcMove(messages, labels) {
    assert.match(messages[0].content, /话题1：对方的意思是「点头，等她愿意说时再听」/u);
    assert.match(messages.at(-1).content, /等你开口/u);
    assert.ok(labels.includes('话题1'));
    return answer('话题1');
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
  for (const output of ['{}', 'broken', 'null', answer('话题1', { confidence: '不确定' }),
    answer('允诺同行'), answer('话题2'), answer('话题1', { attitude: '施压', subject: '马上交出丹药' })]) {
    const result = await route({ async selectNpcMove(messages, labels) {
      assert.deepEqual(labels.filter(key => key.startsWith('话题')), ['话题1']);
      assert.doesNotMatch(messages[0].content, /允诺同行|拒绝同行|绕过山口|请教秘法/u);
      return output;
    } }, node, '你怎么看？');
    assert.equal(result.choice, undefined);
    assert.equal(result.decision.action, 'talk');
  }
  for (const line of ['听说你以前喜欢别人追问？', '上次我托你记住的话是什么？']) {
    const result = await route({ selectNpcMove: () => answer('话题1') }, node, line);
    assert.equal(result.choice, undefined);
  }
});

test('scheduling classifies willingness only; the engine owns the date, place and cancellation', async () => {
  const greeting = openConversation(context);
  const line = '后天去药庐见面吧，谈谈辨药。';
  const result = await route({ async selectNpcMove(_messages, labels) {
    assert.deepEqual(labels, ['继续交谈', '答应见面']);
    return answer('答应见面', { proposal: '邀约', subject: '去药庐见面' });
  } }, greeting, line);
  assert.equal(result.choice, undefined);
  const booked = applyNpcDecision(result.decision, character, runtime, player, journey, line).journey;
  assert.equal(booked.openStory.pending[0].day, journey.day + 2);
  assert.equal(booked.openStory.pending[0].regionId, 'yaowang_valley');
  const cancelled = await route({ selectNpcMove: () => assert.fail('玩家取消无需等待模型同意') }, greeting, '取消约见', booked);
  assert.equal(cancelled.decision.action, 'cancel');
  const abort = new AbortController();
  await assert.rejects(() => understandNpcLine({ async selectNpcMove() { abort.abort(); return answer('答应见面'); } },
    character, runtime, player, journey, { node: greeting, turns: [] }, line, abort.signal), { name: 'AbortError' });
});

test('the model can recognize an unwritten invitation or request and the engine verifies the subject, schedule and consent', async () => {
  const node = openConversation(context);
  for (const [line, proposal, action, subject] of [
    ['明晚药庐的蒲团我给你留一张，肯赏光么？', '邀约', '答应见面', '蒲团我给你留一张'],
    ['千年血参的来路，劳你向识货的人探个究竟。', '查访', '答应查访', '千年血参的来路'],
  ]) {
    let requests = 0;
    const turn = await route({ selectNpcMove() { requests++; return answer(action, { proposal, subject }); } }, node, line);
    assert.equal(requests, 1);
    const applied = applyNpcDecision(turn.decision, character, runtime, player, journey, line, turn.hint);
    assert.equal(applied.journey.openStory.pending.length, 1);
    assert.equal(applied.journey.openStory.pending[0].npcTask.subject, subject);
    const refusal = await route({ selectNpcMove: () => answer('继续交谈', { proposal, subject }) }, node, line);
    assert.equal(refusal.decision.action, 'talk');
    const declined = applyNpcDecision(refusal.decision, character, runtime, player, journey, line, refusal.hint);
    assert.equal(declined.journey.openStory?.pending?.length ?? 0, 0);
  }
});

test('free chat receives a social interpretation even with no menu topics and keeps the current dilemma in the prompt', async () => {
  const scene = '她把印泥和旧信放在桌上，等你决定该给谁看。';
  const node = { line: scene, choices: [{ action: 'detour', label: '绕过山口' }] };
  const line = '这一路我其实都在硬撑。';
  const turn = await route({ async selectNpcMove(messages) {
    assert.match(messages[0].content, /印泥和旧信/);
    assert.match(messages[0].content, /好感/);
    return answer('继续交谈', { attitude: '倾诉', subject: '我其实都在硬撑' });
  } }, node, line);
  assert.equal(turn.attitude, '倾诉');
  assert.equal(turn.choice, undefined);
  assert.equal(turn.hint, undefined);
});

test('an unclear or truncated classification cannot write a refusal to the calendar', async () => {
  const line = '后天在药庐见面，谈谈辨药吧。';
  const node = openConversation(context);
  for (const response of ['{', answer('继续交谈', { confidence: '不确定', proposal: '邀约', subject: '在药庐见面' })]) {
    const turn = await route({ selectNpcMove: () => response }, node, line);
    const paused = applyNpcDecision(turn.decision, character, runtime, player, journey, line, turn.hint);
    assert.equal(paused.journey, journey);
    assert.doesNotMatch(paused.spoken.fallback, /这回就不一道去了/u);
  }
  const sure = await route({ selectNpcMove: () => answer('继续交谈', { proposal: '邀约', subject: '在药庐见面' }) }, node, line);
  const decided = applyNpcDecision(sure.decision, character, runtime, player, journey, line, sure.hint);
  assert.ok(decided.journey.memories[character.id].some(m => m.id.startsWith('declined-meeting:')));
});
