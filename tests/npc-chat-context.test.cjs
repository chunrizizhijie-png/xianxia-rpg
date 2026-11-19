const test = require('node:test');
const assert = require('node:assert/strict');
const { ALL_CHARACTERS, initializeJourney } = require('../src/engine/livingWorldEngine.ts');
const { createInitialPlayer, createInitialCharacters } = require('../src/engine/gameEngine.ts');
const { groundedMemoryReply, npcChatMessages, npcDecisionMessages, saveNpcChat } = require('../src/engine/npcChat.ts');

const person = ALL_CHARACTERS.find(c => c.id === 'lin_waner');
const player = createInitialPlayer('白芷', 'five_elements', []);
const runtime = { ...createInitialCharacters(ALL_CHARACTERS)[person.id], met: true, hasContact: true };
const base = () => ({ ...initializeJourney(ALL_CHARACTERS, 11), day: 30 });
const line = (content, day = 30, role = 'user') => ({ role, day, content });

test('entrusted words outlive routine conversation, stay private and return as attributed statements', () => {
  let world = saveNpcChat(base(), person.id, [line('请记住，我的家乡叫「远帆渡」。', 1), line('我记着。', 1, 'assistant')], '');
  for (let i = 2; i < 95; i++)
    world = saveNpcChat(world, person.id, [line('我在石上刻下第' + i + '道痕迹。', i)], '');
  world = JSON.parse(JSON.stringify(world));
  const notes = world.npcChats[person.id].recollections;
  assert.ok(notes.length <= 64);
  assert.ok(notes.find(entry => entry.quote.includes('远帆渡')));
  assert.match(groundedMemoryReply(world, person.id, [], '还记得我的故乡叫什么吗？'), /第1日.*你|你第1日.*远帆渡/u);
  assert.doesNotMatch(groundedMemoryReply(world, 'shen_qingqiu', [], '还记得我的故乡叫什么吗？'), /远帆渡/u);
  assert.doesNotMatch(groundedMemoryReply(world, person.id, [], '你记得我师父的姓氏吗？'), /远帆渡|石上刻/u);
  assert.equal(groundedMemoryReply(world, person.id, [], '今日山里可下雨了？'), undefined);
});

test('recall matches the speaker and prioritizes the latest matching personal detail', () => {
  const lines = [line('我的暗号是松烟。', 8), line('收到了。', 8, 'assistant'),
    line('我的暗号换成了白露。', 10), line('那就用白露。', 10, 'assistant')];
  assert.match(groundedMemoryReply(base(), person.id, lines, '你还记得暗号是什么吗？'), /白露/u);
  const answer = groundedMemoryReply(base(), person.id, lines, '你刚才说了什么？');
  assert.match(answer, /那就用白露/u);
  assert.doesNotMatch(answer, /暗号换成/u);
  assert.match(groundedMemoryReply(base(), person.id, lines, '我上一句说了什么？'), /暗号换成了白露/u);
});

test('a single-character subject recalls its given name across days and ignores questions and later time lines', () => {
  const history = [
    line('请记住，我的剑名叫听雨。', 8),
    line('好，我记下了。', 8, 'assistant'),
    line('我的马名叫乘风。', 9),
    line('好，我记下了。', 9, 'assistant'),
    line('今早我练剑了。', 10),
    line('我的剑叫什么？', 11),
    line('我那柄剑叫什么名字', 11),
    line('你的剑名叫落月。', 12, 'assistant'),
    line('我的剑改名叫秋水。', 32),
  ];
  const world = saveNpcChat(base(), person.id, history, '');
  const query = '你还记得我的剑叫什么吗？';
  for (const ask of [query, '你还记得我那柄剑叫什么名字吗？']) {
    const answer = groundedMemoryReply(world, person.id, [], ask);
    assert.match(answer, /你第8日.*我的剑名叫听雨/u);
    assert.doesNotMatch(answer, /乘风|练剑|秋水|落月/u);
    assert.match(npcChatMessages(person, runtime, player, world, [], ask, '依旧话回答。').at(-1).content, /听雨/u);
  }
  assert.doesNotMatch(groundedMemoryReply(world, person.id, [], '你记得我的刀叫什么吗？'), /听雨|乘风/u);
  assert.doesNotMatch(groundedMemoryReply(world, 'shen_qingqiu', [], query), /听雨/u);
  assert.match(groundedMemoryReply({ ...world, day: 33 }, person.id, [], query), /秋水/u);
});

test('the model sees only this NPC’s orders, calendar, memories and permitted acts', () => {
  const world = base();
  world.npcStatuses[person.id] = { ...world.npcStatuses[person.id], regionId: 'yaowang_valley' };
  world.craft = { training: {}, nextOrder: 3, orders: [
    { id: 1, maker: person.id, recipeId: 'handmade_wound_powder', regionId: 'yaowang_valley', dueDay: 32 },
    { id: 2, maker: 'shen_qingqiu', recipeId: 'bronze_mirror', regionId: 'taixu_peak', dueDay: 31 },
  ] };
  world.openStory = { turns: 1, history: [], pending: [{ id: 'story:1', day: 35, charId: person.id,
    regionId: 'yaowang_valley', text: '尚未发生的查访结果密文', npcTask: { kind: 'inquire', subject: '河上药船' } }] };
  world.memories[person.id] = [{ id: 'absence:17', kind: 'absence', day: 17, detail: '你错过了上次的约见。' }];
  world.memories.shen_qingqiu = [{ id: 'secret', kind: 'confidence', day: 5, detail: '旁人的秘密' }];
  const messages = npcChatMessages(person, runtime, player, world, [], '丹炉可以取件了吗？', '只聊近况，不交货。');
  const content = messages[0].content;
  assert.match(content, /今天第30日，明日第31日/u);
  assert.match(content, /以玉简传音/u);
  assert.match(content, /止血散.*尚未交付.*第32日.*药王百草谷/u);
  assert.match(content, /第 35 日回信 · 河上药船/u);
  assert.match(content, /错过了上次的约见/u);
  assert.doesNotMatch(content, /青铜古镜|旁人的秘密|尚未发生的查访结果密文/u);
  const ready = npcChatMessages(person, runtime, player, { ...world, day: 33 }, [], '可以取件了吗？', '只聊天。');
  assert.match(ready[0].content, /成品正待领取/u);
  const decision = npcDecisionMessages(person, runtime, world, [], '说个笑话。', { talk: '可以闲聊。' });
  assert.match(decision[0].content, /继续交谈：可以闲聊。/u);
  assert.doesNotMatch(decision[0].content, /答应见面：|取消安排：/u);
});

test('today’s conversation keeps the original speakers and stays short even with long imported history', () => {
  const history = [line('前年的传闻', 1), line('前年的原话', 1, 'assistant'),
    line('刚才石桥为什么封了？'), line('下游有人修桩，不能过桥。', 30, 'assistant')];
  const world = saveNpcChat(base(), person.id, history, '');
  const messages = npcChatMessages(person, runtime, player, world, history, '修到什么时候？', '还没有确定日期。');
  assert.deepEqual(messages.slice(1), [
    { role: 'user', content: history[2].content }, { role: 'assistant', content: history[3].content },
    { role: 'user', content: '修到什么时候？' },
  ]);
  assert.doesNotMatch(messages[0].content, /前年的原话|不能过桥/u);
  const long = Array.from({ length: 80 }, (_, i) => line('山'.repeat(490), 30, i % 2 ? 'assistant' : 'user'));
  const bounded = npcChatMessages(person, runtime, player, world, long, '山'.repeat(500), '日程保持原样。');
  assert.ok(bounded.map(message => message.content).join('').length < 2000);
});

test('a question about an existing appointment recalls the agreed day without creating another plan', () => {
  const world = base();
  world.openStory = { turns: 1, history: [], pending: [{ id: 'story:1', day: 35, charId: person.id,
    regionId: 'heishan_market', text: '尚未发生', npcTask: { kind: 'meet', subject: '交还旧账册' } }] };
  assert.match(groundedMemoryReply(world, person.id, [], '还记得我们约在哪里见面吗？'), /第35日.*黑山鬼市.*交还旧账册/u);
  assert.equal(world.openStory.turns, 1);
});

test('the opening question reaches the model, and generated speech stops when another speaker takes over', () => {
  const { spokenReply } = require('../src/engine/npcSpeech.ts');
  const opener = [{ role: 'assistant', scripted: true, content: '她停下药杵。「你哪里疼？」' }];
  const messages = npcChatMessages(person, runtime, player, base(), opener, '是左脚。', '问清伤处。');
  assert.deepEqual(messages.slice(-2), [{ role: 'assistant', content: '你哪里疼？' }, { role: 'user', content: '是左脚。' }]);
  assert.equal(spokenReply('<think>先猜对方会怎么说', person.name), '');
  assert.equal(spokenReply('<think>措辞</think>林婉儿：「先坐下来。」\n玩家：谢谢。', person.name), '先坐下来。');
  assert.equal(spokenReply('她转过头：「你先等一等。」', person.name), '你先等一等。');
  assert.equal(spokenReply('我在药庐。\n我在药庐。', person.name), '我在药庐。');
  assert.equal(spokenReply('用户：下一句我来说。', person.name), '');
});

test('a new day carries the last actual exchange into both model calls, with speakers and date', () => {
  const history = [line('我一直没敢拆那封家书。', 29), line('你怕信里写了什么？', 29, 'assistant'),
    line('今天也来了。', 30, 'assistant')];
  const messages = npcChatMessages(person, runtime, player, base(), history, '怕他们让我回去。', '接续她上次的问题。');
  const decision = npcDecisionMessages(person, runtime, base(), history, '怕他们让我回去。', { talk: '交谈' });
  for (const prompt of [messages, decision]) {
    assert.ok(prompt.some(m => m.role === 'user' && /第29日.*家书/u.test(m.content)));
    assert.ok(prompt.some(m => m.role === 'assistant' && /怕信里写了什么/u.test(m.content)));
  }
  assert.equal(groundedMemoryReply(base(), person.id, history, '我还记得那天我们坐在雨里。'), undefined);
});
