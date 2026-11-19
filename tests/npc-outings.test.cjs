const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialCharacters, createInitialPlayer } = require('../src/engine/gameEngine.ts');
const { ALL_CHARACTERS, initializeJourney, refreshNpcAgendas } = require('../src/engine/livingWorldEngine.ts');
const { attendNpcMeeting, createStoryPrompt, settleStoryFollowups } = require('../src/engine/openStory.ts');
const { pendingNpcTask } = require('../src/engine/npcPlans.ts');
const { relationshipFor } = require('../src/engine/relationships.ts');
const { parseLife } = require('../src/engine/lifeSave.ts');
const { startNpcOuting, npcOutingScene, chooseNpcOuting, isNpcOuting } = require('../src/engine/npcOuting.ts');

const companion = ALL_CHARACTERS[0];
const charId = companion.id;
const player = createInitialPlayer('归舟', 'five_elements', []);
const cast = createInitialCharacters(ALL_CHARACTERS);
const runtime = { ...cast[charId], met: true, hasContact: true, affection: 0 };

function arrival(seed = 0, person = companion, prior) {
  const world = prior ?? initializeJourney(ALL_CHARACTERS, seed);
  const day = world.day + 3;
  const turns = (world.openStory?.turns ?? 0) + 1;
  const plan = { id: 'story:' + turns, day, charId: person.id, regionId: world.regionId, text: '相约叙谈',
    npcTask: { kind: 'meet', subject: '一同散散步' } };
  const arrived = attendNpcMeeting(refreshNpcAgendas({
    ...world, day, openStory: { turns, pending: [plan], history: world.openStory?.history ?? [] },
  }), person);
  assert.ok(arrived.entry);
  return arrived;
}

function start(seed = 0, person = companion, prior) {
  const arrived = arrival(seed, person, prior);
  const journey = startNpcOuting(arrived.journey, person, runtime, arrived.entry);
  return { journey, kept: arrived.entry };
}

function saved(world) {
  const file = JSON.parse(JSON.stringify({ version: 1, journey: world, characters: cast, player, logs: [] }));
  const parsed = parseLife(file);
  assert.ok(parsed);
  return parsed.journey;
}

function firstOfEachStory() {
  const examples = new Map();
  for (let seed = 0; seed < 50 && examples.size < 3; seed++) {
    const example = start(seed);
    examples.set(example.journey.outings[charId].story, example);
  }
  assert.equal(examples.size, 3);
  return examples;
}

function select(world, id, person = companion) {
  const choice = npcOutingScene(world, person).choices.find(c => c.id.split('/').at(-1) === id);
  assert.ok(choice, id);
  const result = chooseNpcOuting(world, person, choice.id);
  assert.ok(result);
  return result;
}

test('every complete outing route has four or more actual decisions, an elapsed-day gate, and a non-repeatable ending', () => {
  const stories = firstOfEachStory();
  const endings = new Set();
  for (const [story, { journey, kept }] of stories) {
    function visit(world, previous, waited = false) {
      const restored = saved(world);
      const scene = npcOutingScene(restored, companion);
      assert.deepEqual(scene, npcOutingScene(world, companion));
      if (previous) assert.equal(chooseNpcOuting(restored, companion, previous), undefined);
      if (scene.waitingUntil) {
        assert.deepEqual(scene.choices, []);
        assert.ok(scene.waitingUntil > world.day);
        return visit({ ...restored, day: scene.waitingUntil }, previous, true);
      }
      assert.ok(scene.choices.length >= 2);
      for (const choice of scene.choices) {
        const stepped = chooseNpcOuting(restored, companion, choice.id);
        assert.ok(stepped);
        if (!stepped.finished) {
          assert.equal(stepped.line, npcOutingScene(stepped.journey, companion).line);
          visit(stepped.journey, choice.id, waited);
          continue;
        }
        assert.ok(waited);
        assert.ok(world.outings[charId].path.length >= 3);
        const final = saved(stepped.journey);
        assert.equal(npcOutingScene(final, companion), undefined);
        assert.equal(chooseNpcOuting(final, companion, choice.id), undefined);
        const memory = final.memories[charId].find(m => m.id === 'outing:' + story + ':' + kept.id);
        assert.ok(memory.detail.includes(choice.label));
        assert.equal(memory.day, final.day);
        assert.equal(startNpcOuting(final, companion, runtime, kept), final);
        endings.add(story + '/' + choice.id);
      }
    }
    visit(journey);
  }
  assert.ok(endings.size >= 60);
});

test('retrieved evidence changes the resolutions and relationship, and a distant NPC cannot act at the scene', () => {
  const opening = firstOfEachStory().get('letter').journey;
  const visitor = opening.npcStatuses[charId];
  const apart = { ...opening, npcStatuses: { ...opening.npcStatuses, [charId]: { ...visitor, regionId: 'other' } } };
  assert.deepEqual(npcOutingScene(apart, companion).choices, []);
  const oldChoice = npcOutingScene(opening, companion).choices[0];
  assert.equal(chooseNpcOuting(apart, companion, oldChoice.id), undefined);
  assert.equal(npcOutingScene(opening, ALL_CHARACTERS[1]), undefined);
  function traced(a, b) {
    const proof = select(select(opening, a).journey, b);
    const pending = select(proof.journey, 'sealed').journey;
    return { ...pending, day: pending.outings[charId].returnDay };
  }
  const kiln = traced('potter', 'mark');
  const ledger = traced('courier', 'copy');
  const finish = select(kiln, 'kiln');
  assert.equal(relationshipFor(finish.journey, charId, runtime).label, '愿意相托');
  const kilnChoice = npcOutingScene(kiln, companion).choices.find(c => c.id.endsWith('/kiln'));
  assert.equal(chooseNpcOuting(ledger, companion, kilnChoice.id), undefined);
  assert.equal(npcOutingScene(ledger, companion).choices.some(c => c.id.endsWith('/ledger')), true);
  assert.equal(relationshipFor(select(ledger, 'answeronly').journey, charId, runtime).label, '渐渐相熟');
});

test('seeded stories survive reload, vary with intimacy, and rotate when the same companion meets again', () => {
  const example = firstOfEachStory().get('tea');
  const opening = example.journey;
  const warmer = startNpcOuting({ ...opening, outings: {} }, companion, { ...runtime, affection: 46 }, example.kept);
  assert.deepEqual(opening.outings[charId].story, warmer.outings[charId].story);
  function ask(world) { return select(select(world, 'taste').journey, 'cups'); }
  assert.notEqual(ask(opening).line, ask(warmer).line);
  assert.match(ask(warmer).line, /续了水/u);
  const waiting = select(ask(opening).journey, 'blank').journey;
  const final = select({ ...waiting, day: waiting.day + 3 }, 'recipe');
  const another = start(0, companion, final.journey);
  assert.notEqual(another.journey.outings[charId].story, 'tea');
});

test('legacy saves without an outing remain valid; malformed paths cannot unlock a scene or bypass its date', () => {
  assert.equal(saved(initializeJourney(ALL_CHARACTERS, 2)).outings, undefined);
  const entry = firstOfEachStory().get('letter').journey.outings[charId];
  assert.ok(isNpcOuting(entry));
  assert.equal(isNpcOuting({ ...entry, story: 'imaginary' }), false);
  assert.equal(isNpcOuting({ ...entry, path: ['courier', 'mark'] }), false);
  assert.equal(isNpcOuting({ ...entry, path: ['courier', 'copy', 'sealed'] }), false);
  assert.equal(isNpcOuting({ ...entry, returnDay: -1 }), false);
  assert.equal(isNpcOuting({ ...entry, path: ['courier', 'copy', 'sealed'], returnDay: entry.startedDay }), false);
});

test('the bill agreed on together gets its own letter exactly seven days later, without taking the appointment slot', () => {
  let world = firstOfEachStory().get('bell').journey;
  world = select(select(select(world, 'boat').journey, 'knot').journey, 'ontime').journey;
  world = { ...world, day: world.outings[charId].returnDay };
  world = select(select(world, 'double').journey, 'trialweek').journey;
  const later = world.openStory.pending.find(entry => entry.action === 'outing-letter');
  assert.equal(later.day, world.day + 7);
  assert.equal(pendingNpcTask(world, charId), undefined);
  assert.doesNotMatch(createStoryPrompt('打听渡口情况', player, world, [], companion, runtime), /六根白筹/);
  assert.deepEqual(settleStoryFollowups({ ...world, day: later.day - 1 }).due, []);
  const delivered = settleStoryFollowups({ ...saved(world), day: later.day + 2 });
  assert.deepEqual(delivered.due.map(record => record.id), [later.id]);
  assert.equal(delivered.journey.npcChats[charId].messages.at(-1).day, later.day);
  assert.match(delivered.journey.npcChats[charId].messages.at(-1).content, /六根白筹/);
  assert.deepEqual(settleStoryFollowups(saved(delivered.journey)).due, []);
});
