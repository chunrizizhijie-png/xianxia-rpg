import type { NpcWorldStatus } from '../data/worldSandbox';

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
}

export interface OpenStoryState {
  turns: number;
  history: StoryRecord[];
  pending: StoryRecord[];
}

export interface JourneyState {
  day: number;
  seed: number;
  regionId: string;
  npcStatuses: Record<string, NpcWorldStatus>;
  memories: Record<string, NpcMemory[]>;
  lastNoticeDay: number;
  retreatNotices?: string[];
  openStory?: OpenStoryState;
  herb: HerbJourney;
}
