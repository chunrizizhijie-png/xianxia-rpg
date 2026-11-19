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
