import type { ChatCompletionMessage } from '@wllama/wllama';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, NpcChatMessage } from '../types/journey';
import { isMemoryTurn, npcDecisionMessages } from './npcChat';
import type { DialogueChoice, DialogueNode } from './npcDialogue';
import { deriveNpcPlan, NPC_DECISIONS, npcDecisionOptions, type NpcDecision } from './npcPlans';

const talk: NpcDecision = { action: 'talk', subject: '', days: 0, news: '' };
const conversational = new Set<DialogueChoice['action']>([
  'exchange', 'agenda', 'past', 'private', 'respect', 'press', 'topics', 'topic', 'apology', 'greet',
]);

export function readNpcMove(content: unknown, labels: readonly string[]): string {
  if (typeof content === 'string') {
    try {
      const value = JSON.parse(content);
      if (value?.confidence === '明确' && labels.includes(value.action)) return value.action;
    } catch { /* An incomplete local generation falls back to conversation. */ }
  }
  return NPC_DECISIONS.talk;
}

interface NpcMoveSelector {
  selectNpcMove(messages: ChatCompletionMessage[], labels: string[], signal: AbortSignal): Promise<string>;
}

export async function routeNpcLine(
  model: NpcMoveSelector, character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState,
  journey: JourneyState, chat: { node: DialogueNode; turns: NpcChatMessage[] }, line: string, signal: AbortSignal,
): Promise<{ decision: NpcDecision; choice?: DialogueChoice }> {
  signal.throwIfAborted();
  const idle = { decision: talk };
  if (player.isDead || !runtime.met || !chat.node.choices.length || isMemoryTurn(line)) return idle;
  const intent = deriveNpcPlan(line, journey, character.id);
  const options = npcDecisionOptions(character, runtime, player, journey, line);
  // A cancellation concerns the player's own attendance and needs no second assent from the NPC.
  if (intent?.action === 'cancel' && options.cancel) return { decision: intent };
  const indirect = /如果|假如|假使|要是|听说|听闻|并没有|没说要|[「」“”"]/u.test(line);
  const choices = intent || indirect ? [] : chat.node.choices.filter(c => !c.lockReason && conversational.has(c.action));
  const topics = choices.map((c, index) => ({ label: '话题' + (index + 1), meaning: c.label.slice(0, 80) }));
  const labels = [...Object.keys(options).map(key => NPC_DECISIONS[key as NpcDecision['action']]), ...topics.map(t => t.label)];
  if (labels.length < 2) return idle;
  const messages = npcDecisionMessages(character, runtime, journey, chat.turns, line, options, topics);
  const label = await model.selectNpcMove(messages, labels, signal);
  signal.throwIfAborted();
  if (intent && options[intent.action] && NPC_DECISIONS[intent.action] === label) return { decision: intent };
  const index = topics.findIndex(topic => topic.label === label);
  return index < 0 ? idle : { decision: talk, choice: choices[index] };
}
