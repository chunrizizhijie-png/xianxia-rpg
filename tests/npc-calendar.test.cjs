const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyNpcDecision, deriveNpcPlan, npcDecisionOptions, npcPlanReply, npcMeetingAt } = require('../src/engine/npcPlans.ts');
const { dayReferences } = require('../src/engine/npcCalendar.ts');
const { createInitialCharacters, createInitialPlayer } = require('../src/engine/gameEngine.ts');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');

const person = ALL_CHARACTERS[0];
const player = createInitialPlayer('白榆', 'five_elements', []);
const runtime = { ...createInitialCharacters([person])[person.id], met: true, hasContact: true };

function scene() {
  const j = initializeJourney(ALL_CHARACTERS, 0);
  return { ...j, day: 10, npcStatuses: { ...j.npcStatuses, [person.id]: {
    ...j.npcStatuses[person.id], regionId: j.regionId, canIntervene: false,
  } } };
}

function ask(journey, line, overrides = {}) {
  const inferred = deriveNpcPlan(line, journey, person.id);
  assert.ok(inferred, line);
  return applyNpcDecision({ ...inferred, ...overrides }, person, runtime, player, journey, line);
}

test('explicit dates and regional aliases override the model day and prevent conflicting dialogue', () => {
  const j = scene();
  const reply = ask(j, '后天到药王谷见面，谈谈辨药。', { days: 5 });
  const event = reply.journey.openStory.pending[0];
  assert.deepEqual([event.day, event.regionId, event.npcTask.subject], [12, 'yaowang_valley', '辨药']);
  assert.equal(npcPlanReply(reply, '明天我就在药王谷等你。'), reply.spoken.fallback);
  assert.equal(npcPlanReply(reply, '后天我在鬼市等你。'), reply.spoken.fallback);
  assert.equal(npcPlanReply(reply, '后天我在药王谷等你。'), '后天我在药王谷等你。');
  assert.deepEqual(dayReferences('三天后，也就是第十三日', 10), [13]);
  assert.deepEqual(dayReferences('第二百零七日', 199), [207]);
  assert.equal(ask(j, '十五天后在试剑崖碰面吧').journey.openStory.pending[0].day, 25);
});

test('refusals and ambiguous dates or destinations never create an appointment', () => {
  const j = scene();
  for (const line of ['昨天在药庐见面吧', '明天还是后天见面？', '哪天见面？', '明天到清水镇见面',
    '明天在药庐或剑巅见面', '明天去紫霄雷墟见面']) {
    const response = ask(j, line);
    assert.equal(response.journey, j, line);
    assert.equal(npcPlanReply(response, '好，去！'), response.spoken.fallback);
  }
  const delayed = { ...j, craft: { training: {}, orders: [{ id: 1, maker: person.id, dueDay: 13, regionId: j.regionId, recipeId: 'handmade_wrist_guard' }], nextOrder: 2 } };
  assert.equal(ask(delayed, '后天在太虚剑巅见面').journey, delayed);
  assert.equal(ask(delayed, '第十四日到药王谷见面').journey.openStory.pending.length, 1);
});

test('negation, recollection and speculation do not reschedule or invent a plan', () => {
  const j = ask(scene(), '明天在剑巅见面吧').journey;
  for (const line of ['我没说要见面', '不要取消明天的约见', '我们之前约的是明天吗？', '如果我去不了会怎么样？',
    '我只是想问你记不记得我们说过见面', '别帮我打听了', '不想再见面']) {
    assert.equal(deriveNpcPlan(line, j, person.id), undefined, line);
    assert.deepEqual(Object.keys(npcDecisionOptions(person, runtime, player, j, line)), ['talk']);
  }
});

test('rescheduling replaces the old appointment and cancellation never leaves a ghost meeting in history', () => {
  const prior = ask(scene(), '明天到药庐见面，谈谈药方').journey;
  const adjusted = ask(prior, '改到第三十日吧').journey;
  assert.equal(adjusted.openStory.pending.length, 1);
  const task = adjusted.openStory.pending[0];
  assert.equal(task.npcTask.subject, '药方');
  assert.equal(task.regionId, 'yaowang_valley');
  assert.equal(task.day, 30);
  const outdated = { ...adjusted, day: 11, openStory: { ...adjusted.openStory, history: [...adjusted.openStory.history, prior.openStory.pending[0]] } };
  assert.equal(npcMeetingAt(outdated, person.id), undefined);
  const cancelled = ask(adjusted, '取消这次约见').journey;
  assert.equal(cancelled.openStory.pending.length, 0);
  assert.equal(npcMeetingAt({ ...cancelled, day: 30 }, person.id), undefined);
});

test('a player can answer a clarification naturally and the letter reports a real material source', () => {
  const j = scene();
  const question = '在药王谷见面吧';
  const clarification = ask(j, question);
  assert.equal(clarification.journey, j);
  const thread = { day: 10, regionId: j.regionId, messages: [
    { role: 'user', content: question, day: 10 }, { role: 'assistant', content: npcPlanReply(clarification), day: 10 },
  ] };
  const continued = ask({ ...j, npcChats: { [person.id]: thread } }, '那就后天吧');
  assert.equal(continued.journey.openStory.pending[0].day, 12);
  assert.equal(continued.journey.openStory.pending[0].regionId, 'yaowang_valley');
  const inquiry = ask(j, '帮我打听一下千年血参的产地，明天给我回信。', { news: '送你一千灵石。', days: 5 });
  assert.equal(inquiry.journey.openStory.pending[0].day, 11);
  assert.match(inquiry.journey.openStory.pending[0].text, /千年血参.{0,30}寻得到/);
  assert.doesNotMatch(inquiry.journey.openStory.pending[0].text, /一千灵石/);
});

test('consecutive clarifications carry the topic, place and original request across natural short answers', () => {
  const chat = (j, line) => {
    const result = ask(j, line);
    const old = j.npcChats?.[person.id]?.messages ?? [];
    return { ...result.journey, npcChats: { [person.id]: { day: j.day, regionId: j.regionId, messages: [
      ...old, { role: 'user', content: line, day: j.day },
      { role: 'assistant', content: npcPlanReply(result), day: j.day },
    ] } } };
  };
  const j = scene();
  j.npcStatuses[person.id].regionId = 'yaowang_valley';
  const first = chat(j, '我们见面吧，谈谈丹方。');
  const second = chat(first, '就在药王谷。');
  assert.match(second.npcChats[person.id].messages.at(-1).content, /哪一日/);
  const agreed = chat(second, '那就后天。').openStory.pending[0];
  assert.equal(agreed.day, 12);
  assert.equal(agreed.regionId, 'yaowang_valley');
  assert.equal(agreed.npcTask.subject, '丹方');
  assert.equal(deriveNpcPlan('那就后天。', { ...second, day: 11 }, person.id), undefined);
});

test('casual invitations accept or decline with a dated, reproducible answer even when phrased differently', () => {
  const line = '明天你有没有时间出来约一下？';
  const results = Array.from({ length: 10 }, (_, seed) => ask({ ...scene(), seed }, line));
  const accepted = results.find(result => result.confirmed);
  const declined = results.find(result => !result.confirmed);
  assert.equal(accepted.confirmed.day, 11);
  assert.equal(accepted.confirmed.regionId, scene().regionId);
  assert.ok(declined.spoken.fallback.length > 8);
  const repeat = ask(JSON.parse(JSON.stringify(declined.journey)), '明天我们一起去走走吧。');
  assert.equal(repeat.confirmed, undefined);
  assert.equal(repeat.spoken.fallback, declined.spoken.fallback);
  assert.equal(repeat.journey.memories[person.id].filter(m => m.kind === 'decline').length, 1);
});

test('clear semantic proposals still use the player’s words, game calendar and NPC permission', () => {
  const j = scene();
  const line = '明晚药庐的茶席，我多留个座给你，肯赏脸吗？';
  const hint = { action: 'meet', subject: '茶席' };
  assert.equal(deriveNpcPlan(line, j, person.id), undefined);
  const meaning = deriveNpcPlan(line, j, person.id, hint);
  assert.equal(meaning.subject, '茶席');
  const accepted = applyNpcDecision(meaning, person, runtime, player, j, line, hint);
  assert.deepEqual(accepted.confirmed, { day: 11, regionId: 'yaowang_valley' });
  const rejected = applyNpcDecision({ ...meaning, action: 'talk' }, person, runtime, player, j, line, hint);
  assert.equal(rejected.confirmed, undefined);
  assert.equal(applyNpcDecision(meaning, person, runtime, player, rejected.journey, line, hint).confirmed, undefined);
  assert.notEqual(deriveNpcPlan(line, j, person.id, { ...hint, subject: '登仙' }).subject, '登仙');
  for (const hypothetical of ['如果明晚药庐有茶席呢？', '你还记得上次的茶席吗？', '我不想同你喝茶']) {
    assert.equal(deriveNpcPlan(hypothetical, j, person.id, hint), undefined);
  }
});

test('an earlier memory in the same turn cannot overwrite the new proposal date or place', () => {
  const result = ask(scene(), '你还记得上次在鬼市听曲的事吗？明天我们在药王谷见面，聊聊药方。');
  assert.deepEqual(result.confirmed, { day: 11, regionId: 'yaowang_valley' });
  assert.equal(result.journey.openStory.pending[0].npcTask.subject, '药方');
  assert.equal(deriveNpcPlan('上回她问我，明天你有没有时间出来约一下？', scene(), person.id), undefined);
});

test('a familiar face may agree in person without a jade seal; inquiries still require a return channel', () => {
  const j = scene();
  const unlinked = { ...runtime, hasContact: false, affection: 0 };
  const line = '明天在这里见面。';
  const meaning = deriveNpcPlan(line, j, person.id);
  const arrange = (world, rt = unlinked) => applyNpcDecision(meaning, person, rt, player, world, line);
  assert.equal(arrange(j).confirmed, undefined);
  assert.ok(arrange(j, { ...unlinked, affection: 25 }).confirmed);
  const acquainted = { ...j, memories: { [person.id]: [{ id: 'social:倾诉:归乡', day: 9, kind: 'story', detail: '你们聊过归乡的事。' }] } };
  assert.ok(arrange(acquainted).confirmed);
  assert.ok(npcDecisionOptions(person, unlinked, player, acquainted, line).meet);
  const remote = { ...acquainted, regionId: 'heishan_market' };
  assert.equal(arrange(remote).confirmed, undefined);
  const askAround = '帮我打听千年血参的来处。';
  assert.equal(applyNpcDecision(deriveNpcPlan(askAround, acquainted, person.id), person, unlinked, player, acquainted, askAround).confirmed, undefined);
});

test('a polite conditional is an invitation and an unknown place prompts a follow-up before booking', () => {
  const j = scene();
  j.npcStatuses[person.id].regionId = 'yaowang_valley';
  assert.equal(deriveNpcPlan('如果你方便，明天一起去走走吧。', j, person.id).action, 'meet');
  const line = '明晚在梨花镇我多留一只茶杯给你，肯赏脸么？';
  const hint = { action: 'meet', subject: '茶杯' };
  const wait = applyNpcDecision(deriveNpcPlan(line, j, person.id, hint), person, runtime, player, j, line, hint);
  assert.equal(wait.confirmed, undefined);
  assert.match(wait.spoken.fallback, /哪里碰面/u);
  const thread = { day: j.day, regionId: j.regionId, messages: [
    { role: 'user', content: line, day: j.day }, { role: 'assistant', content: wait.spoken.fallback, day: j.day },
  ] };
  const then = ask({ ...j, npcChats: { [person.id]: thread } }, '就在太虚剑巅吧。');
  assert.deepEqual(then.confirmed, { day: 11, regionId: 'taixu_peak' });
  assert.equal(then.journey.openStory.pending[0].npcTask.subject, '茶杯');
});
