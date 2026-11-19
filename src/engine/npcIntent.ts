import type { ChatCompletionMessage } from '@wllama/wllama';
import type { CharacterData, CharacterRuntimeState, PlayerState } from '../types/game';
import type { JourneyState, NpcChatMessage } from '../types/journey';
import { isMemoryTurn, npcDecisionMessages } from './npcChat';
import type { DialogueChoice, DialogueNode } from './npcDialogue';
import { deriveNpcPlan, NPC_DECISIONS, npcDecisionOptions, type NpcDecision, type NpcPlanHint } from './npcPlans';
import { classifyOffline, SOCIAL_ATTITUDES, type SocialAttitude } from './npcSocial';

const talk: NpcDecision = { action: 'talk', subject: '', days: 0, news: '' };
const conversational = new Set<DialogueChoice['action']>([
  'exchange', 'agenda', 'past', 'private', 'respect', 'press', 'topics', 'topic', 'apology', 'greet', 'outing',
]);

export interface NpcUnderstanding {
  decision: NpcDecision;
  choice?: DialogueChoice;
  hint?: NpcPlanHint;
  attitude: SocialAttitude;
}

interface Move {
  action: string;
  attitude: SocialAttitude;
  proposal: '无' | '邀约' | '查访';
  subject: string;
}

export function readNpcMove(content: unknown, labels: readonly string[], line: string): Move | undefined {
  if (typeof content !== 'string') return;
  try {
    const move = JSON.parse(content);
    if (move?.confidence !== '明确' || !labels.includes(move.action) || !SOCIAL_ATTITUDES.includes(move.attitude) ||
      !['无', '邀约', '查访'].includes(move.proposal) || typeof move.subject !== 'string') return;
    const subject = move.subject.trim();
    if (subject && (!line.includes(subject) || subject.length > 40)) return;
    if ((move.proposal !== '无' || move.attitude !== '闲谈') && !subject) return;
    return { action: move.action, attitude: move.attitude, proposal: move.proposal, subject };
  } catch { return; }
}

interface NpcMoveSelector {
  selectNpcMove(messages: ChatCompletionMessage[], labels: string[], signal: AbortSignal): Promise<unknown>;
}

export async function understandNpcLine(
  model: NpcMoveSelector | null, character: CharacterData, runtime: CharacterRuntimeState, player: PlayerState,
  journey: JourneyState, chat: { node: DialogueNode; turns: NpcChatMessage[] }, line: string, signal: AbortSignal,
): Promise<NpcUnderstanding> {
  signal.throwIfAborted();
  const idle: NpcUnderstanding = { decision: talk, attitude: '闲谈' };
  if (player.isDead || !runtime.met || !chat.node.choices.length) return idle;
  const intent = deriveNpcPlan(line, journey, character.id);
  if (!intent && isMemoryTurn(line)) return idle;
  const options = npcDecisionOptions(character, runtime, player, journey, line);
  if (intent?.action === 'cancel' && options.cancel) return { ...idle, decision: intent };
  if (!model) return { decision: intent ?? talk, attitude: intent ? '闲谈' : classifyOffline(line) };
  // An indirect mention can still be discussed freely, without selecting an action on somebody else's behalf.
  const indirect = /如果|假如|假使|要是|听说|听闻|并没有|没说要|[「」“”"]/u.test(line);
  const choices = intent || indirect ? [] : chat.node.choices.filter(c => !c.lockReason && conversational.has(c.action));
  if (!intent && !indirect) {
    for (const action of ['meet', 'inquire'] as const) {
      const allowed = npcDecisionOptions(character, runtime, player, journey, line, { action });
      if (allowed[action]) options[action] = allowed[action];
    }
  }
  const topics = choices.map((c, index) => ({ label: '话题' + (index + 1), meaning: c.label.slice(0, 80) }));
  const labels = [...Object.keys(options).map(key => NPC_DECISIONS[key as NpcDecision['action']]), ...topics.map(t => t.label)];
  const messages = npcDecisionMessages(character, runtime, journey, chat.turns, line, options, topics, chat.node.line);
  const generated = await model.selectNpcMove(messages, labels, signal);
  signal.throwIfAborted();
  const move = readNpcMove(generated, labels, line);
  if (!move) return idle;
  const proposedKind = move.proposal === '邀约' ? 'meet' : move.proposal === '查访' ? 'inquire' : undefined;
  const hint = proposedKind && (!indirect || intent) && (!intent || proposedKind === intent.action)
    ? { action: proposedKind, subject: intent ? undefined : move.subject } as NpcPlanHint : undefined;
  const plan = intent ?? (hint && deriveNpcPlan(line, journey, character.id, hint));
  if (plan) return { decision: options[plan.action] && move.action === NPC_DECISIONS[plan.action] ? plan : talk, hint, attitude: '闲谈' };
  const index = topics.findIndex(topic => topic.label === move.action);
  return { decision: talk, choice: index >= 0 ? choices[index] : undefined, attitude: indirect && move.attitude === '施压' ? '闲谈' : move.attitude };
}
