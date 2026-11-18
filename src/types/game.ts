import type { JourneyState, MemoryKind } from './journey';

export type EmotionState =
  | 'normal'
  | 'smile'
  | 'shy'
  | 'angry'
  | 'injured'
  | 'blackened';

export type SpiritRootType = 'heavenly' | 'thunder_variant' | 'five_elements';

export interface SpiritRootConfig {
  id: SpiritRootType;
  name: string;
  title: string;
  description: string;
  cultivationMult: number;
  breakthroughBonus: number;
  atkBonus: number;
  mpBonus: number;
  luckBonus: number;
  color: string;
}

export interface DestinyTrait {
  id: string;
  name: string;
  rarity: '缺憾' | '凡品' | '灵品' | '天命';
  description: string;
  modifiers: {
    cultivationSpeedMult?: number;
    luckBonus?: number;
    charmBonus?: number;
    critRateBonus?: number;
    atkBonus?: number;
    defBonus?: number;
    senseBonus?: number;
    lifespanBonus?: number;
  };
}

export interface RealmConfig {
  id: string;
  index: number;
  name: string;
  majorStage: '炼气期' | '筑基期' | '金丹期' | '元婴期';
  isMajorBottleneck?: boolean;
  requiredPillId?: string;
  requiredPillName?: string;
  maxExp: number;
  baseHp: number;
  baseMp: number;
  baseAtk: number;
  baseDef: number;
  baseSense: number;
  lifespanCap: number;
  baseBreakthroughRate: number;
  failureHpPenaltyPct: number;
  failureLifespanPenaltyYears: number;
  description: string;
}

export type SkillCategory =
  | 'sword'
  | 'blood'
  | 'alchemy'
  | 'yin_yang'
  | 'thunder'
  | 'defense';

export interface SkillTag {
  id: string;
  name: string;
  category: SkillCategory;
  rarity: '黄阶' | '玄阶' | '地阶' | '天阶' | '仙阶';
  level?: number;
  description: string;
  mpCost: number;
  cooldown: number;
  damageMult: number;
  hitCount?: number;
  armorPiercePct?: number;
  stunChance?: number;
  swordIntentGain?: number;
  consumeSwordIntent?: boolean;
  detonatePoison?: boolean;
  lowHpBerserk?: boolean;
  healPct?: number;
  selfHpCostPct?: number;
  shieldPct?: number;
  critBonus?: number;
  lifestealPct?: number;
  poisonStacks?: number;
  passiveBonus?: {
    atkPct?: number;
    defPct?: number;
    cultivationMult?: number;
    critRate?: number;
  };
}

export type ItemType = 'pill' | 'treasure' | 'gift';

export interface ItemConfig {
  id: string;
  name: string;
  type: ItemType;
  rarity: '凡品' | '灵品' | '宝品' | '仙品';
  price: number;
  pillTier?: 'qi' | 'foundation' | 'golden' | 'nascent' | 'universal';
  description: string;
  effect: {
    hpRestore?: number;
    mpRestore?: number;
    expGain?: number;
    breakthroughBonus?: number;
    injuryHeal?: number;
    affectionGain?: number;
    atkBonus?: number;
    defBonus?: number;
    senseBonus?: number;
    lifespanGain?: number;
  };
}

export type AffectionStage = 'stranger' | 'acquainted' | 'infatuated' | 'soulmate';

export interface CharacterChatOption {
  id: string;
  label: string;
  minAffection?: number;
  checkStat?: 'sense' | 'charm' | 'atk' | 'luck';
  checkThreshold?: number;
  replyText: string;
  failReplyText?: string;
  affectionDelta: number;
  emotion: EmotionState;
  expBonus?: number;
  senseBonus?: number;
  atkBonus?: number;
  itemRewardId?: string;
}

export interface CharacterData {
  id: string;
  name: string;
  title: string;
  sect: string;
  styleTag: string;
  personalityTags: string[];
  themeColor: string;
  accentColor: string;
  emblemType: 'sword' | 'lotus' | 'cauldron' | 'moon';
  bio: string;
  resonanceSkillId: string;
  favoriteGifts: string[];
  dialogues: Record<AffectionStage, string[]>;
  emotionDialogues: Partial<Record<EmotionState, string>>;
  chatOptions: CharacterChatOption[];
  dualCultivationScenes: string[];
  proactiveVisitEvents: {
    title: string;
    description: string;
    choices: {
      text: string;
      reply: string;
      affectionDelta: number;
      emotion: EmotionState;
      expDelta?: number;
      hpDelta?: number;
      itemGainId?: string;
      triggerSpar?: boolean;
    }[];
  }[];
  exclusiveEventIds: string[];
}

export interface CharacterRuntimeState {
  id: string;
  met: boolean;
  affection: number;
  emotion: EmotionState;
  isSoulmate: boolean;
  interactionCount: number;
  dualCount?: number;
  lastSpokenLine: string;
}

export type CheckStatKey = 'sense' | 'luck' | 'charm' | 'atk' | 'def' | 'realmIndex' | 'mp' | 'spiritStones';

export interface EventCheck {
  stat: CheckStatKey;
  threshold: number;
  label: string;
}

export interface EventOutcome {
  text: string;
  memoryKind?: MemoryKind;
  expDelta?: number;
  hpDelta?: number;
  mpDelta?: number;
  spiritStonesDelta?: number;
  luckDelta?: number;
  senseDelta?: number;
  charmDelta?: number;
  atkDelta?: number;
  defDelta?: number;
  lifespanDelta?: number;
  injuryDelta?: number;
  itemGainId?: string;
  skillGainId?: string;
  characterAffection?: {
    charId: string;
    delta: number;
    emotion?: EmotionState;
  };
  triggerBattleEnemyId?: string;
}

export interface EventChoice {
  id: string;
  text: string;
  check?: EventCheck;
  successOutcome: EventOutcome;
  failOutcome?: EventOutcome;
}

export type EventCategory =
  | 'secret_realm'
  | 'market'
  | 'sect_intrigue'
  | 'shura_field'
  | 'inner_demon'
  | 'encounter';

export interface GameEvent {
  id: string;
  title: string;
  category: EventCategory;
  minRealmIndex?: number;
  maxRealmIndex?: number;
  requiredCharId?: string;
  minAffection?: number;
  description: string;
  choices: EventChoice[];
}

export interface EnemyConfig {
  id: string;
  name: string;
  realmName: string;
  realmIndex: number;
  hp: number;
  atk: number;
  def: number;
  sense: number;
  skills: {
    name: string;
    damageMult: number;
    description: string;
  }[];
  rewardExp: number;
  rewardStones: number;
  rewardItemId?: string;
  description: string;
}

export interface PlayerState {
  daoName: string;
  spiritRoot: SpiritRootType;
  destinyTraits: string[];
  realmIndex: number;
  exp: number;
  ageMonths: number;
  lifespanCapYears: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  sense: number;
  luck: number;
  charm: number;
  critRate: number;
  spiritStones: number;
  injury: number;
  nextBreakthroughBonus?: number;
  equippedSkills: string[];
  unlockedSkills: string[];
  inventory: Record<string, number>;
  stats: {
    battlesWon: number;
    breakthroughSuccess: number;
    breakthroughFailed: number;
    eventsCompleted: number;
    majorRealmsReached: string[];
  };
  isDead: boolean;
  deathReason?: string;
}

export interface BattleLogLine {
  id: string;
  turn: number;
  actor: 'player' | 'enemy' | 'system';
  text: string;
  tone?: 'damage' | 'heal' | 'crit' | 'info' | 'victory' | 'defeat';
}

export interface BattleState {
  enemy: EnemyConfig;
  enemyHp: number;
  enemyMaxHp: number;
  turn: number;
  playerShield: number;
  playerSwordIntent: number;
  enemyPoisonStacks: number;
  enemyStunned: boolean;
  skillCooldowns: Record<string, number>;
  logs: BattleLogLine[];
  finished: boolean;
  victory: boolean;
  autoMode: boolean;
  contextTag?: {
    type: 'rescue' | 'spar' | 'co_explore' | 'normal';
    charId?: string;
    eventId?: string;
  };
}

export interface LogEntry {
  id: string;
  ageText: string;
  day?: number;
  regionName?: string;
  category: 'cultivation' | 'breakthrough' | 'event' | 'battle' | 'bond' | 'system';
  text: string;
}

export interface SaveSlotData {
  version?: number;
  slotId: number;
  savedAt: string;
  daoName: string;
  realmName: string;
  ageText: string;
  player: PlayerState;
  characters: Record<string, CharacterRuntimeState>;
  logs: LogEntry[];
  activeCharacterId: string;
  journey?: JourneyState;
  pendingEvent?: GameEvent;
  pendingEventMinimized?: boolean;
  materials?: Record<string, number>;
  customSkills?: SkillTag[];
  customItems?: ItemConfig[];
  customCharacters?: CharacterData[];
  customEvents?: GameEvent[];
}
