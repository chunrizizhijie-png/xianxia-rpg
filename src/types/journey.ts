import type { NpcWorldStatus } from '../data/worldSandbox';
import type { CraftState } from '../engine/crafting';

export type MemoryKind =
  | 'promise' | 'help' | 'decline' | 'absence' | 'witness'
  | 'harm' | 'spar' | 'gift' | 'confidence' | 'pressure' | 'apology' | 'topic' | 'story';

export interface NpcMemory {
  id: string;
  kind: MemoryKind;
  day: number;
  detail: string;
}

export interface HerbJourney {
  phase: 'available' | 'promised' | 'declined' | 'missed' | 'fulfilled';
  meetingDay?: number;
  resolvedDay?: number;
  helperId?: string;
  route?: 'investigate' | 'detour';
}

export interface StoryRecord {
  id: string;
  day: number;
  regionId: string;
  charId?: string;
  action?: string;
  text: string;
  fact?: string;
  npcTask?: { kind: 'inquire' | 'meet'; subject: string; arrived?: boolean };
}

export interface OpenStoryState {
  turns: number;
  history: StoryRecord[];
  pending: StoryRecord[];
}

export interface NpcChatMessage {
  workshopOffer?: { recipeId: string; maker: string; regionId: string; day: number };
  role: 'user' | 'assistant';
  content: string;
  scripted?: boolean;
  day?: number;
  note?: string;
}

export interface NpcChatRecollection {
  quote: string;
  reply?: string;
  day?: number;
}

export interface NpcChatThread {
  day: number;
  regionId: string;
  greeting?: string;
  messages: NpcChatMessage[];
  recollections?: NpcChatRecollection[];
}

export type OutingId = 'letter' | 'tea' | 'bell';

export interface NpcOuting {
  meetingId: string;
  story: OutingId;
  startedDay: number;
  regionId: string;
  familiar: boolean;
  path: string[];
  returnDay?: number;
}

export interface JourneyState {
  outings?: Record<string, NpcOuting>;
  craft?: CraftState;
  clearedSites?: string[];
  day: number;
  seed: number;
  regionId: string;
  npcStatuses: Record<string, NpcWorldStatus>;
  memories: Record<string, NpcMemory[]>;
  lastNoticeDay: number;
  retreatNotices?: string[];
  openStory?: OpenStoryState;
  npcChats?: Record<string, NpcChatThread>;
  herb: HerbJourney;
}
