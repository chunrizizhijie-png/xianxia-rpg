import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Flame,
  Sparkles,
  ScrollText,
  Mountain,
  Heart,
} from 'lucide-react';
import { REALMS } from './data/realms';
import { EVENTS } from './data/events';
import { hasOrigin } from './data/destinies';
import { ENEMIES, ITEMS, SKILLS } from './data/itemsAndSkills';
import {
  CRAFT_MATERIALS,
  CraftMaterial,
  WORLD_REGIONS,
  WorldRegion,
  fuseTwoSkills,
  generateProceduralSkill,
} from './data/worldSandbox';
import {
  ALL_CHARACTERS,
  buildInterveneEvent,
  buildProactiveVisitEvent,
  createSparEnemyFromCharacter,
  findRetreatInterruption,
  initializeJourney,
  initNpcWorldStatuses,
  markRescueSent,
  refreshNpcAgendas,
  rescueEventId,
  simulateWorldTick,
} from './engine/livingWorldEngine';
import {
  BattleState,
  CharacterData,
  CharacterRuntimeState,
  EventChoice,
  GameEvent,
  ItemConfig,
  LogEntry,
  PlayerState,
  SaveSlotData,
  SkillCategory,
  SkillTag,
} from './types/game';
import type { JourneyState, NpcChatMessage } from './types/journey';
import {
  advanceTime,
  attemptBreakthrough,
  checkEventStat,
  createInitialCharacters,
  createInitialPlayer,
  cultivate,
  daysToBottleneck,
  executeBattleTurn,
  filterAvailableEvents,
  formatAge,
  generateEpitaph,
  getEffectiveCombatStats,
  getEffectiveCultivationMult,
  initBattle,
  interactWithCharacter,
  resolveEventOutcome,
  useInventoryItem,
} from './engine/gameEngine';
import {
  downloadText,
  parseLife,
  readLastLife,
  readSaveSlots,
  restoreCharacters,
  restoreJourney,
  restoreCraftTalents,
  RESUME_STORAGE_KEY,
  SAVE_VERSION,
  SLOT_STORAGE_KEY,
  writeChronicle,
  writeLocal,
} from './engine/lifeSave';
import { HERB_VALLEY, HERBALIST, herbJournalLine, rememberNpc } from './engine/herbJourney';
import {
  answerSmallTalk, chooseDialogue, encounterCharacter, matchDialogueInput, openConversation,
  type DialogueChoice, type DialogueNode,
} from './engine/npcDialogue';
import { isMemoryTurn, npcChatMessages, npcDecisionMessages, npcPlanLabel, saveNpcChat } from './engine/npcChat';
import { applyNpcDecision, type NpcDecision, npcDecisionOptions, pendingNpcTask } from './engine/npcPlans';
import { giftRefusal, relationshipFor, storyEventId } from './engine/relationships';
import { applyStoryOutcome, createStoryPrompt, settleStoryFollowups } from './engine/openStory';
import { LocalStoryModel } from './engine/localStoryModel';
import { CharacterCreationModal } from './components/CharacterCreationModal';
import { finishBirthDraft, type BirthDraft } from './engine/birth';
import { TopStatusBar } from './components/TopStatusBar';
import { PortraitStage } from './components/PortraitStage';
import { BreakthroughModal } from './components/BreakthroughModal';
import { EventModal } from './components/EventModal';
import { BattlePanel } from './components/BattlePanel';
import { ImmortalBondPanel } from './components/ImmortalBondPanel';
import { InventoryAndSkillsPanel } from './components/InventoryAndSkillsPanel';
import { applyCraftAction, CRAFT_ITEMS, RECIPES, type CraftAction } from './engine/crafting';
import { CraftingPanel } from './components/CraftingPanel';
import { SandboxHubPanel } from './components/SandboxHubPanel';
import { SettingsAndHotReloadModal } from './components/SettingsAndHotReloadModal';
import { EpitaphModal } from './components/EpitaphModal';
import { NpcConversation } from './components/NpcConversation';
import { LifeFileInput } from './components/LifeFileInput';
import { OpenStoryPanel } from './components/OpenStoryPanel';

const BASE_ITEMS = [...ITEMS, ...CRAFT_ITEMS];
const STARTING_MATERIALS: Record<string, number> = {};
const WORKSHOP_PRODUCTS = new Set(RECIPES.map(recipe => recipe.id));
const DAYS_PER_MONTH = 30;

export default function App() {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [characterDefs, setCharacterDefs] = useState<CharacterData[]>(ALL_CHARACTERS);
  const [eventDefs, setEventDefs] = useState<GameEvent[]>(EVENTS);
  const [skillDefs, setSkillDefs] = useState<SkillTag[]>(SKILLS);
  const [itemDefs, setItemDefs] = useState<ItemConfig[]>(BASE_ITEMS);
  const [charStates, setCharStates] = useState<Record<string, CharacterRuntimeState>>(() =>
    createInitialCharacters(ALL_CHARACTERS)
  );
  const [journey, setJourney] = useState(() => initializeJourney(ALL_CHARACTERS, 0));
  const { npcStatuses, regionId: currentRegionId } = journey;
  const [materials, setMaterials] = useState<Record<string, number>>(STARTING_MATERIALS);
  const [activeCharId, setActiveCharId] = useState<string>(ALL_CHARACTERS[0].id);
  const [retreatPlan, setRetreatPlan] = useState('week');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [eventResultText, setEventResultText] = useState<string | null>(null);
  const [eventMinimized, setEventMinimized] = useState(false);
  const eventVisible = Boolean(activeEvent && !eventMinimized);
  const [dualSceneModal, setDualSceneModal] = useState<{
    charName: string;
    sceneText: string;
    summaryText: string;
  } | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [showBreakthrough, setShowBreakthrough] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveSlots, setSaveSlots] = useState<(SaveSlotData | null)[]>(readSaveSlots);
  const [lastLife, setLastLife] = useState(readLastLife);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [conversation, setConversation] = useState<{
    charId: string;
    node: DialogueNode;
    greeting: string;
    turns: NpcChatMessage[];
  } | null>(null);
  const [storyModel] = useState(() => new LocalStoryModel());
  const [modelName, setModelName] = useState<string | null>(null);
  const [storyPanel, setStoryPanel] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyResult, setStoryResult] = useState<{ text: string; effects: string[] } | null>(null);
  const [pendingNpcReply, setPendingNpcReply] = useState<{ input: string; reply: string } | null>(null);
  const storyJob = useRef<AbortController | null>(null);
  const sceneVersion = useRef({ player, journey });
  useEffect(() => {
    sceneVersion.current = { player, journey };
  }, [player, journey]);

  const cancelStory = () => storyJob.current?.abort();

  const loadStoryModel = async (file: File) => {
    if (modelLoading || storyJob.current) return;
    setModelLoading(true);
    setModelName(null);
    setStoryError(null);
    try {
      await storyModel.load(file);
      setModelName(file.name);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : '本地模型载入失败，请检查 GGUF 文件。');
    } finally {
      setModelLoading(false);
    }
  };

  const closeStoryPanel = () => {
    cancelStory();
    setStoryPanel(false);
    setStoryError(null);
  };

  const showEvent = (event: GameEvent | null, minimized = false) => {
    setActiveEvent(event);
    setEventResultText(null);
    setEventMinimized(minimized);
  };

  const appendLog = (
    p: PlayerState,
    category: LogEntry['category'],
    text: string,
    at = journey,
  ) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ageText: formatAge(p.ageMonths),
        day: at.day,
        regionName: WORLD_REGIONS.find((region) => region.id === at.regionId)?.name,
        category,
        text,
      },
      ...prev,
    ]);
  };

  const captureLife = useCallback((slotId: number): SaveSlotData | null => {
    if (!player) return null;
    return {
      version: SAVE_VERSION,
      slotId,
      savedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      daoName: player.daoName,
      realmName: REALMS[player.realmIndex].name,
      ageText: formatAge(player.ageMonths),
      player,
      characters: charStates,
      logs,
      activeCharacterId: activeCharId,
      journey,
      pendingEvent: activeEvent && eventResultText === null ? activeEvent : undefined,
      pendingEventMinimized: activeEvent && eventResultText === null && eventMinimized ? true : undefined,
      materials,
      customSkills: skillDefs.filter((skill) => !SKILLS.includes(skill)),
      customItems: itemDefs.filter((item) => !BASE_ITEMS.includes(item)),
      customCharacters: characterDefs.filter((character) => !ALL_CHARACTERS.includes(character)),
      customEvents: eventDefs.filter((event) => !EVENTS.includes(event)),
    };
  }, [player, charStates, logs, activeCharId, journey, materials, skillDefs, itemDefs, characterDefs, eventDefs, activeEvent, eventResultText, eventMinimized]);

  useEffect(() => {
    if (!player || (battle && !player.isDead)) return;
    if (!writeLocal(RESUME_STORAGE_KEY, captureLife(0))) setStorageUnavailable(true);
  }, [player, captureLife, battle]);

  const loadLife = (save: SaveSlotData) => {
    closeStoryPanel();
    setStoryResult(null);
    const defs = [...ALL_CHARACTERS, ...(save.customCharacters ?? [])];
    const characters = restoreCharacters(save, defs);
    let restoredJourney = restoreJourney(save, defs);
    let pendingEvent = save.pendingEvent;
    if (pendingEvent) {
      const rescueKey = storyEventId(pendingEvent.id);
      const rescuer = defs.find((character) => rescueEventId(character.id) === rescueKey);
      const status = rescuer && restoredJourney.npcStatuses[rescuer.id];
      if (rescuer && status) {
        if (!pendingEvent.choices.some((choice) => choice.id === 'rescue_call_backup')) {
          pendingEvent = buildInterveneEvent(rescuer, { ...status, interveneType: 'rescue' }, save.player);
        }
        restoredJourney = markRescueSent(restoredJourney, rescuer.id);
      }
    }
    setCharacterDefs(defs);
    setSkillDefs([...(save.customSkills ?? []), ...SKILLS]);
    setItemDefs([...(save.customItems ?? []), ...BASE_ITEMS]);
    setEventDefs([...(save.customEvents ?? []), ...EVENTS]);
    setPlayer({ ...save.player, craftTalents: restoreCraftTalents(save, restoredJourney) });
    setCharStates(characters);
    setJourney(restoredJourney);
    setMaterials(save.materials ?? STARTING_MATERIALS);
    setLogs(save.logs);
    setActiveCharId(defs.some((character) => character.id === save.activeCharacterId)
      ? save.activeCharacterId : defs[0].id);
    setBattle(null);
    showEvent(pendingEvent ?? null, Boolean(pendingEvent && save.pendingEventMinimized));
    setConversation(null);
    setDualSceneModal(null);
    setShowBreakthrough(false);
    setShowSettings(false);
  };

  const importLife = (contents: string) => {
    try {
      const save = parseLife(JSON.parse(contents));
      if (!save) return { ok: false, message: '存档格式或版本不受支持。' };
      loadLife(save);
      return { ok: true, message: '存档已载入。' };
    } catch {
      return { ok: false, message: '无法读取存档，请检查 JSON 格式。' };
    }
  };

  const handleStartGame = (
    daoName: string,
    birth: BirthDraft,
  ) => {
    closeStoryPanel();
    setStoryResult(null);
    const initP = createInitialPlayer(daoName, birth.root, birth.traits, birth.craftTalents);
    finishBirthDraft();
    const initChars = createInitialCharacters(characterDefs);
    setPlayer(initP);
    setCharStates(initChars);
    const firstDay = initializeJourney(characterDefs, Math.floor(Math.random() * 0x100000000));
    setJourney(firstDay);
    setMaterials(STARTING_MATERIALS);
    setSkillDefs(SKILLS);
    setItemDefs(BASE_ITEMS);
    setActiveCharId(characterDefs[0].id);
    setBattle(null);
    showEvent(null);
    setConversation(null);
    setLogs([
      {
        id: 'init',
        ageText: formatAge(initP.ageMonths),
        category: 'system',
        day: 1,
        regionName: '太虚剑巅',
        text: `${initP.daoName}初到太虚剑巅。山门外，几个背药筐的行脚客正在打听通往药王谷的路。`,
      },
    ]);
  };

  if (!player) {
    return (
      <CharacterCreationModal onStart={handleStartGame}>
        <div className="flex flex-wrap items-center gap-2">
          {lastLife && (
            <button type="button" onClick={() => loadLife(lastLife)}
              className="rounded border border-[#c5a059]/40 px-3 py-2 text-xs text-[#e2c488]">
              继续上次 · {lastLife.daoName}
            </button>
          )}
          {saveSlots.map((slot, index) => slot && (
            <button type="button" key={index} onClick={() => loadLife(slot)}
              className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-200">
              读取存档 {index + 1} · {slot.daoName}
            </button>
          ))}
          <LifeFileInput onImport={importLife} />
        </div>
      </CharacterCreationModal>
    );
  }

  const releaseDeferredEncounter = () => {
    if (!activeEvent || !eventMinimized) return false;
    appendLog(player, 'event', `你放下了「${activeEvent.title}」。`);
    showEvent(null);
    return true;
  };

  const advanceJourney = (
    nextPlayer: PlayerState,
    { days = 0, from = journey, allowUrgent = false }: {
      days?: number;
      from?: JourneyState;
      allowUrgent?: boolean;
    } = {},
  ) => {
    const longDays = Math.max(0, nextPlayer.ageMonths - player.ageMonths) * DAYS_PER_MONTH;
    const shortMonths = Math.floor((from.day - 1 + days) / DAYS_PER_MONTH) -
      Math.floor((from.day - 1) / DAYS_PER_MONTH);
    const aged = shortMonths > 0 ? advanceTime(nextPlayer, shortMonths) : nextPlayer;
    const elapsedDays = longDays + days;
    setPlayer(aged);
    if (elapsedDays === 0) {
      if (from !== journey) setJourney(from);
      return { player: aged, journey: from };
    }
    const encounterRemains = !releaseDeferredEncounter() && Boolean(activeEvent);
    const tick = simulateWorldTick(from, characterDefs, aged, elapsedDays,
      allowUrgent && !aged.isDead && !encounterRemains && !battle, charStates);
    const continued = settleStoryFollowups(tick.nextJourney);
    setJourney(continued.journey);
    for (const entry of continued.due) {
      appendLog(aged, 'event', entry.text, { ...continued.journey, day: entry.day, regionId: entry.regionId });
    }
    for (const rumor of tick.worldRumors) appendLog(aged, 'system', rumor, continued.journey);
    if (tick.proactiveEvent) showEvent(tick.proactiveEvent);
    return { player: aged, journey: continued.journey };
  };

  const currentRealm = REALMS[player.realmIndex] ?? REALMS[REALMS.length - 1];
  const nextRealm = REALMS[player.realmIndex + 1];
  const canBreakthrough = Boolean(nextRealm && player.exp >= currentRealm.maxExp);
  const combatStats = getEffectiveCombatStats(player, skillDefs);
  const currentRegion =
    WORLD_REGIONS.find((r) => r.id === currentRegionId) ?? WORLD_REGIONS[0];
  const cultMult =
    getEffectiveCultivationMult(player, skillDefs) * currentRegion.spiritDensity;
  const acquaintances = characterDefs.filter((character) => charStates[character.id]?.met);
  const activeChar = acquaintances.find((character) => character.id === activeCharId) ?? acquaintances[0] ?? characterDefs[0];
  const activeCharState = charStates[activeChar.id];
  const relationships = Object.fromEntries(characterDefs.map((character) => [
    character.id, relationshipFor(journey, character.id, charStates[character.id]),
  ]));

  const goalDays = daysToBottleneck(player, skillDefs, currentRegion.spiritDensity);
  const appointmentDays = [
    ...(journey.herb.phase === 'promised' && journey.herb.meetingDay !== undefined ? [journey.herb.meetingDay] : []),
    ...(journey.openStory?.pending ?? []).filter((entry) => entry.npcTask?.kind === 'meet').map((entry) => entry.day),
  ].filter((day) => day >= journey.day);
  const nextAppointment = appointmentDays.length ? Math.min(...appointmentDays) : undefined;
  const beforeMeeting = nextAppointment === undefined ? 0 : Math.max(0, nextAppointment - journey.day - 1);
  const selectedRetreat = retreatPlan === 'meeting' && !beforeMeeting ? 'week' : retreatPlan;
  const retreatDays = selectedRetreat === 'week' ? 7 : selectedRetreat === 'season' ? 90
    : selectedRetreat === 'bottleneck' ? goalDays : beforeMeeting;
  const handleCultivate = (days: number) => {
    if (battle || player.isDead || eventVisible) return;
    const lifeDays = (player.lifespanCapYears * 12 - player.ageMonths) * DAYS_PER_MONTH -
      ((journey.day - 1) % DAYS_PER_MONTH);
    const plannedDays = Math.max(0, Math.min(days, lifeDays));
    const interruption = findRetreatInterruption(journey, characterDefs, player, plannedDays, charStates);
    const elapsedDays = interruption ? interruption.day - journey.day : plannedDays;
    const { nextPlayer, expGained } = cultivate(player, REALMS, skillDefs, elapsedDays, currentRegion.spiritDensity);
    const from = interruption ? {
      ...journey,
      lastNoticeDay: interruption.day,
      retreatNotices: [...(journey.retreatNotices ?? []), storyEventId(interruption.event.id)],
    } : journey;
    const advanced = advanceJourney(nextPlayer, { days: elapsedDays, from, allowUrgent: !interruption });
    const progress = `你在${currentRegion.name}闭关 ${elapsedDays} 日，修为 +${expGained}。`;
    appendLog(
      advanced.player,
      'cultivation',
      interruption ? `${progress} 途中收到一封来信，你暂时收功。` : progress,
      advanced.journey,
    );
    if (interruption && !advanced.player.isDead) {
      showEvent({
        ...interruption.event,
        description: `${progress}\n\n${interruption.event.description}`,
      });
    }
  };

  const handleRest = () => {
    if (battle || player.isDead || eventVisible) return;
    const rested = {
      ...player,
      hp: Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.08)),
      mp: Math.min(player.maxMp, player.mp + Math.ceil(player.maxMp * 0.15)),
      injury: Math.max(0, player.injury - 1),
    };
    const advanced = advanceJourney(rested, { days: 1, allowUrgent: true });
    appendLog(advanced.player, 'cultivation', `你在${currentRegion.name}歇息一日。`, advanced.journey);
  };

  const handleExplore = (isSecretRealm = false) => {
    if (battle || player.isDead || eventVisible) return;
    const pool = filterAvailableEvents(eventDefs, player, charStates, currentRegionId, journey.clearedSites);
    const filtered = isSecretRealm
      ? pool.filter((e) => e.category === 'secret_realm')
      : pool;
    if (!filtered.length) {
      const clue = eventDefs.find(e => e.category === 'secret_realm' && e.regionId &&
        player.realmIndex >= (e.minRealmIndex ?? 0) && !journey.clearedSites?.includes(e.id));
      const place = WORLD_REGIONS.find(r => r.id === clue?.regionId);
      appendLog(player, 'event', clue && place ? '行脚人提到' + place.name + '的「' + clue.title + '」，你记下了去路。' : '你打听了一圈，此地眼下没有可探的遗迹。');
      return;
    }
    const picked = filtered[Math.floor(Math.random() * filtered.length)];
    if (picked) {
      releaseDeferredEncounter();
      showEvent(picked);
    }
  };

  const handleStartSparWithChar = (charId: string, eventId?: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || !charStates[charId]?.met || st?.activityKey === 'craft-order' || player.isDead || battle || st?.regionId !== currentRegionId) return;
    const sparEnemy = createSparEnemyFromCharacter(cDef, st?.realmIndex ?? 3);
    releaseDeferredEncounter();
    showEvent(null);
    setBattle(initBattle(sparEnemy, { type: 'spar', charId, eventId }));
  };

  const handleEventChoice = (choice: EventChoice) => {
    if (!activeEvent || eventResultText !== null || !hasOrigin(player.destinyTraits, choice.requiredOrigin)) return;
    const passed = checkEventStat(player, choice.check);
    const selectedOutcome = passed
      ? choice.successOutcome
      : choice.failOutcome ?? choice.successOutcome;

    const localEncounter = /^(intervene_|visit_|retreat_)/.test(activeEvent.id);
    const relation = selectedOutcome.characterAffection;
    const witness = relation?.charId;
    const supported = passed && ['rescue_blood_shield', 'rescue_sense_snipe', 'co_tank_trap', 'aid_share_mp'].includes(choice.id);
    const memoryKind = selectedOutcome.memoryKind ?? (choice.id === 'co_snatch_betray' ? 'harm' : supported ? 'help' : 'witness');
    const eventKey = storyEventId(activeEvent.id);
    const memoryId = `event:${eventKey}:${memoryKind}`;
    const alreadyRemembered = witness && journey.memories[witness]?.some((memory) =>
      memory.id.startsWith(`event:${eventKey}:`) || storyEventId(memory.id) === eventKey);
    const outcome = relation && relation.delta > 0 ? {
      ...selectedOutcome,
      characterAffection: {
        ...relation,
        delta: alreadyRemembered || selectedOutcome.triggerBattleEnemyId ? 0 : Math.min(8, relation.delta),
      },
    } : selectedOutcome;
    const { nextPlayer, nextCharacters } = resolveEventOutcome(
      player,
      charStates,
      outcome,
      REALMS,
      localEncounter ? 0 : 2,
    );

    const tookTreasure = activeEvent.category === 'secret_realm' && passed &&
      Boolean(outcome.itemGainId || outcome.skillGainId) && !outcome.triggerBattleEnemyId;
    let nextJourney = tookTreasure ? { ...journey, clearedSites: [...new Set([...(journey.clearedSites ?? []), activeEvent.id])] } : journey;
    if (witness && !outcome.triggerBattleEnemyId) {
      nextJourney = rememberNpc(nextJourney, witness, { id: memoryId, kind: memoryKind, detail: outcome.text });
      if (outcome.characterAffection?.emotion === 'injured' || choice.id === 'co_snatch_betray') {
        const status = npcStatuses[witness];
        if (status) {
          nextJourney = {
            ...nextJourney,
            npcStatuses: { ...nextJourney.npcStatuses, [witness]: { ...status, recoverUntilDay: journey.day + 2 } },
          };
        }
      }
    }
    const advanced = advanceJourney(nextPlayer, { days: localEncounter ? 1 : 0, from: nextJourney });
    setCharStates(nextCharacters);
    appendLog(advanced.player, 'event', `【${activeEvent.title}】\n你的选择：${choice.text}\n${outcome.text}`, advanced.journey);

    if (outcome.characterAffection) {
      setActiveCharId(outcome.characterAffection.charId);
    }

    if (outcome.triggerBattleEnemyId && !advanced.player.isDead) {
      if (outcome.triggerBattleEnemyId.startsWith('spar_')) {
        const cid = outcome.triggerBattleEnemyId.replace('spar_', '');
        handleStartSparWithChar(cid, activeEvent.id);
        return;
      }
      const enemy =
        ENEMIES.find((e) => e.id === outcome.triggerBattleEnemyId) ?? ENEMIES[0];
      showEvent(null);
      setBattle(
        initBattle(enemy, {
          type: 'rescue',
          charId: outcome.characterAffection?.charId,
          eventId: activeEvent.id,
        })
      );
      return;
    }

    setEventResultText(outcome.text);
  };

  const handleBreakthroughAttempt = (
    useMainPill: boolean,
    useHeartGuardPill: boolean,
    spendLuck: boolean
  ) => {
    const res = attemptBreakthrough(
      player,
      REALMS,
      useMainPill,
      useHeartGuardPill,
      spendLuck
    );
    const advanced = advanceJourney(res.nextPlayer);
    appendLog(advanced.player, 'breakthrough', res.message, advanced.journey);
    setShowBreakthrough(false);
  };

  const handleCastSkill = (skillId: string) => {
    if (!battle) return;
    const { nextBattle, nextPlayer } = executeBattleTurn(
      battle,
      player,
      skillDefs,
      skillId
    );

    const companionEntry = Object.values(npcStatuses).find((n) => n.isCompanion);
    if (
      companionEntry &&
      !nextBattle.finished &&
      battle.contextTag?.charId !== companionEntry.charId
    ) {
      const compChar = characterDefs.find((c) => c.id === companionEntry.charId);
      if (compChar) {
        const assistDmg = 26 + companionEntry.realmIndex * 20;
        const afterAssistHp = Math.max(0, nextBattle.enemyHp - assistDmg);
        nextBattle.enemyHp = afterAssistHp;
        nextBattle.logs.push({
          id: `comp_${nextBattle.turn}_${Date.now()}`,
          turn: nextBattle.turn,
          actor: 'player',
          text: `【护道助战】${compChar.name}翩然出手，施展本命仙法对${nextBattle.enemy.name}追加 ${assistDmg} 点伤害！`,
          tone: 'crit',
        });
        if (afterAssistHp <= 0) {
          nextBattle.finished = true;
          nextBattle.victory = true;
          nextPlayer.exp += nextBattle.enemy.rewardExp;
          nextPlayer.spiritStones += nextBattle.enemy.rewardStones;
          nextBattle.logs.push({
            id: `comp_win_${Date.now()}`,
            turn: nextBattle.turn,
            actor: 'system',
            text: `在${compChar.name}的联手合击下，【${nextBattle.enemy.name}】应声伏诛！`,
            tone: 'victory',
          });
        }
      }
    }

    setBattle(nextBattle);
    setPlayer(nextPlayer);
    if (!player.isDead && nextPlayer.isDead) {
      appendLog(nextPlayer, 'battle', `与${nextBattle.enemy.name}斗法失手，${nextPlayer.deathReason ?? '道消身陨'}。`);
    }
  };

  const handleFinishBattle = () => {
    if (!battle) return;
    let nextJourney = journey;
    if (battle.victory) {
      const site = eventDefs.find(e => e.id === battle.contextTag?.eventId && e.category === 'secret_realm');
      if (site) nextJourney = { ...journey, clearedSites: [...new Set([...(journey.clearedSites ?? []), site.id])] };
      appendLog(
        player,
        'battle',
        `战胜【${battle.enemy.name}】，收获修为 +${battle.enemy.rewardExp}、灵石 +${battle.enemy.rewardStones}。`
      );
      if (battle.contextTag?.charId) {
        const cid = battle.contextTag.charId;
        const cDef = characterDefs.find((c) => c.id === cid);
        const cs = charStates[cid];
        if (cDef && cs) {
          const sparred = battle.contextTag.type === 'spar';
          const eventKey = battle.contextTag.eventId ? storyEventId(battle.contextTag.eventId) : battle.enemy.id;
          const id = sparred ? 'battle:spar' : `event:${eventKey}:help`;
          const foughtBefore = journey.memories[cid]?.some((memory) =>
            memory.id === id || (sparred && memory.kind === 'spar'));
          nextJourney = rememberNpc(nextJourney, cid, {
            id,
            kind: sparred ? 'spar' : 'help',
            detail: sparred
              ? `你与${cDef.name}交手切磋，最后小胜一招。`
              : `你与${cDef.name}一道迎战${battle.enemy.name}，并携手脱险。`,
          });
          setCharStates((prev) => ({
            ...prev,
            [cid]: {
              ...cs,
              affection: Math.min(150, cs.affection + (foughtBefore ? 0 : sparred ? 3 : 10)),
              emotion: 'smile',
              lastSpokenLine: sparred ? '「刚才那一招我看清楚了。改日再比。」' : '「等回到安全的地方，再慢慢说这件事。」',
            },
          }));
        }
      }
    }
    if (!player.isDead) advanceJourney(player, { days: 1, from: nextJourney });
    setBattle(null);
  };

  const handleUseItem = (item: ItemConfig) => {
    const { nextPlayer, message } = useInventoryItem(player, item, REALMS);
    setPlayer(nextPlayer);
    appendLog(nextPlayer, 'system', message);
  };

  const handleBuyItem = (item: ItemConfig) => {
    if (WORKSHOP_PRODUCTS.has(item.id) || item.id.startsWith('crafted_') || player.spiritStones < item.price) return;
    const nextPlayer: PlayerState = {
      ...player,
      spiritStones: player.spiritStones - item.price,
      inventory: {
        ...player.inventory,
        [item.id]: (player.inventory[item.id] ?? 0) + 1,
      },
    };
    setPlayer(nextPlayer);
    appendLog(
      nextPlayer,
      'system',
      `在坊市花费 ${item.price} 灵石购得【${item.name}】。`
    );
  };

  const handleToggleEquipSkill = (skillId: string) => {
    const equipped = player.equippedSkills;
    if (equipped.includes(skillId)) {
      if (equipped.length <= 1) return;
      setPlayer({
        ...player,
        equippedSkills: equipped.filter((id) => id !== skillId),
      });
    } else if (equipped.length < 4) {
      setPlayer({
        ...player,
        equippedSkills: [...equipped, skillId],
      });
    }
  };

  const handleTalk = (charId: string, opening?: string) => {
    const character = characterDefs.find((entry) => entry.id === charId);
    const runtime = charStates[charId];
    if (!character || !runtime || battle || player.isDead || eventVisible || storyJob.current) return;
    const local = npcStatuses[charId]?.regionId === currentRegionId;
    if (!local && (!runtime.met || !runtime.hasContact)) return;
    const arrival = encounterCharacter(character, runtime, journey);
    if (arrival) {
      setCharStates((previous) => ({ ...previous, [charId]: arrival.runtime }));
      setJourney(arrival.journey);
      appendLog(player, 'bond', `在${currentRegion.name}结识了${character.name}。`, arrival.journey);
    }
    const entry = openConversation({ character, player, runtime: arrival?.runtime ?? runtime, journey: arrival?.journey ?? journey });
    const line = arrival?.line ?? opening;
    const node = line ? { ...entry, line } : entry;
    const history = journey.npcChats?.[charId];
    const turns = history?.messages ?? [];
    const resume = !opening && node.choices.length > 0 && turns.length > 0 &&
      history?.regionId === currentRegionId && history.greeting === entry.line;
    setActiveCharId(charId);
    setStoryError(null);
    setConversation({
      charId, node, greeting: entry.line,
      turns: resume ? turns : [...turns, { role: 'assistant', content: node.line, scripted: true }],
    });
  };

  const handleDialogueChoice = (choice: DialogueChoice, spoken = choice.label) => {
    if (!conversation || storyJob.current || choice.lockReason || !conversation.node.choices.includes(choice)) return;
    const character = characterDefs.find((entry) => entry.id === conversation.charId);
    const runtime = charStates[conversation.charId];
    if (!character || !runtime) return;
    const next = chooseDialogue({ character, runtime, player, journey }, choice);
    if (next.visit) {
      const status = npcStatuses[character.id];
      if (!status?.canIntervene || status.regionId !== currentRegionId) return;
      const visit = buildProactiveVisitEvent(character, player);
      if (!visit) return;
      releaseDeferredEncounter();
      setJourney({
        ...journey,
        npcStatuses: { ...npcStatuses, [character.id]: { ...status, canIntervene: false } },
      });
      setConversation(null);
      showEvent(visit);
      return;
    }
    setStoryError(null);
    const tookTrip = next.journey.herb.phase === 'fulfilled' && journey.herb.phase !== 'fulfilled';
    const advanced = advanceJourney(next.player, { from: next.journey, days: tookTrip ? 1 : 0 });
    const fromChat = journey.npcChats?.[character.id]?.messages ?? [];
    const followups = advanced.journey.npcChats?.[character.id]?.messages.filter((turn) => !fromChat.includes(turn)) ?? [];
    const turns: NpcChatMessage[] = [...conversation.turns,
      { role: 'user', content: spoken, scripted: spoken === choice.label, day: journey.day },
      { role: 'assistant', content: next.node.line, scripted: true, day: advanced.journey.day }, ...followups];
    const greeting = choice.action === 'greet' ? next.node.line : conversation.greeting;
    setJourney(saveNpcChat(advanced.journey, character.id, turns, greeting));
    setCharStates({ ...charStates, [character.id]: next.runtime });
    setConversation({ charId: character.id, node: next.node, greeting, turns });
    if (choice.action !== 'greet') {
      const opening = conversation.turns.length === 1 ? `${conversation.node.line}\n\n` : '';
      appendLog(advanced.player, 'bond', `与${character.name}交谈\n${opening}你：${spoken}\n${next.node.line}`, advanced.journey);
    }
  };

  const handleOpenAction = (input: string): boolean => {
    const action = input.trim();
    if (!action || !modelName || modelLoading || storyJob.current || eventVisible || battle || player.isDead) return false;
    const actor = characterDefs.find((character) => action.includes(character.name));
    const runtime = actor ? charStates[actor.id] : undefined;
    if (actor && (!runtime?.met || (npcStatuses[actor.id]?.regionId !== currentRegionId && !runtime.hasContact))) {
      setStoryError(runtime?.met ? '你们还没留下传音印记，得当面找她。' : '你们还未结识。可循当地见闻，当面互通姓名。');
      return false;
    }
    const request = new AbortController();
    storyJob.current = request;
    setStoryBusy(true);
    setStoryError(null);

    const prompt = createStoryPrompt(action, player, journey, logs, actor, runtime);
    void (async () => {
      try {
        const outcome = await storyModel.narrate(prompt, request.signal);
        if (request.signal.aborted) return;
        if (sceneVersion.current.player !== player || sceneVersion.current.journey !== journey) {
          setStoryError('等待期间场面已经变了。你可以按现在的处境再说一次。');
          return;
        }
        const turn = applyStoryOutcome(outcome, action, player, journey, actor?.id);
        const advanced = advanceJourney(turn.player, { days: turn.days, from: turn.journey });
        const suffix = turn.effects.length ? `\n${turn.effects.join(' · ')}` : '';
        appendLog(advanced.player, actor ? 'bond' : 'event',
          `你：${action}\n${turn.record.text}${suffix}`, advanced.journey);
        setStoryResult({ text: turn.record.text, effects: turn.effects });

        if (actor && runtime) {
          const nextRuntime = { ...runtime, lastSpokenLine: turn.record.text,
            interactionCount: runtime.interactionCount + 1 };
          setCharStates((previous) => ({ ...previous, [actor.id]: nextRuntime }));
        }
        if (advanced.player.isDead) {
          setConversation(null);
          setStoryPanel(false);
        }
      } catch {
        if (!request.signal.aborted) setStoryError('这一步的叙事没有生成完整。可以用原来的说法再试一次。');
      } finally {
        if (storyJob.current === request) {
          storyJob.current = null;
          setStoryBusy(false);
        }
      }
    })();
    return true;
  };

  const handleNpcReply = async (line: string, character: CharacterData, chat: NonNullable<typeof conversation>) => {
    const runtime = charStates[character.id];
    const request = new AbortController();
    storyJob.current = request;
    setStoryBusy(true);
    setStoryError(null);
    setPendingNpcReply({ input: line, reply: '' });
    try {
      const options = npcDecisionOptions(character, runtime, player, journey, line);
      const decision = isMemoryTurn(line) ? undefined : await storyModel.decideNpcAction(
        npcDecisionMessages(character, runtime, journey, chat.turns, line, options),
        Object.keys(options) as NpcDecision['action'][], request.signal);
      if (request.signal.aborted) return false;
      const action = decision ? applyNpcDecision(decision, character, runtime, player, journey, line)
        : { journey, note: undefined, spoken: undefined, direction: '能从旧话找到答案，就回应对方问的具体细节。对方嘱你记下的事只留在这里。' };
      const messages = npcChatMessages(character, runtime, player, journey, chat.turns, line, action.direction);
      const generated = await storyModel.replyAsNpc(character.name, messages, request.signal, (partial) => {
        if (!action.spoken && storyJob.current === request && !request.signal.aborted) {
          setPendingNpcReply({ input: line, reply: partial });
        }
      }).catch((error) => {
        if (request.signal.aborted || !action.spoken) throw error;
        return action.spoken.fallback;
      });
      if (request.signal.aborted) return false;
      if (sceneVersion.current.player !== player || sceneVersion.current.journey !== journey) {
        setStoryError('等候时场面已经变了，可以重新发送。');
        return false;
      }
      const reply = action.spoken && !action.spoken.cue.test(generated) ? action.spoken.fallback : generated;
      const turns: NpcChatMessage[] = [...chat.turns, { role: 'user', content: line, day: journey.day },
        { role: 'assistant', content: reply, note: action.note, day: journey.day }];
      setConversation({ ...chat, turns });
      setJourney(saveNpcChat(action.journey, character.id, turns, chat.greeting));
      appendLog(player, 'bond', `与${character.name}交谈\n你：${line}\n${reply}${action.note ? `\n${action.note}` : ''}`);
      return true;
    } catch {
      if (!request.signal.aborted) setStoryError('这句话没接上。原话还在输入框里，可以重试。');
      return false;
    } finally {
      if (storyJob.current === request) {
        storyJob.current = null;
        setStoryBusy(false);
        setPendingNpcReply(null);
      }
    }
  };

  const handlePlayerLine = (line: string) => {
    if (!conversation || storyJob.current) return false;
    if (/^(告辞|我先走了|改日再聊)[。！]?$/.test(line)) {
      setConversation(null);
      return true;
    }
    if (!conversation.node.choices.length) return false;
    const matchingChoice = matchDialogueInput(line, conversation.node, Boolean(modelName));
    if (matchingChoice) {
      handleDialogueChoice(matchingChoice, line);
      return true;
    }
    const character = characterDefs.find((entry) => entry.id === conversation.charId);
    if (!character) return false;
    if (modelName) return handleNpcReply(line, character, conversation);
    const reply = answerSmallTalk(line, character, journey);
    if (!reply) return false;
    const turns: NpcChatMessage[] = [...conversation.turns, { role: 'user', content: line, day: journey.day },
      { role: 'assistant', content: reply, scripted: true, day: journey.day }];
    setConversation({ ...conversation, turns });
    setJourney(saveNpcChat(journey, character.id, turns, conversation.greeting));
    appendLog(player, 'bond', `与${character.name}交谈\n你：${line}\n${reply}`);
    return true;
  };

  const handleInteract = (
    charId: string,
    action: 'gift' | 'dual_cultivate',
    giftItem?: ItemConfig
  ) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const cState = charStates[charId];
    const npcSt = npcStatuses[charId];
    if (!cDef || !cState?.met || battle || eventVisible || player.isDead || npcSt?.regionId !== currentRegionId) return;
    if (action === 'gift') {
      if (!giftItem || (player.inventory[giftItem.id] ?? 0) <= 0) return;
      const refusal = giftRefusal(journey, cDef, cState, giftItem);
      if (refusal) {
        handleTalk(charId, refusal);
        return;
      }
    }
    if (action === 'dual_cultivate' && relationships[charId].dualReason) {
      handleTalk(charId, `「${relationships[charId].dualReason.replace(/^她/, '我')}。」`);
      return;
    }

    const { nextCharacters, nextPlayer, message, dualSceneText, shuraTriggered } =
      interactWithCharacter(
        cDef,
        cState,
        charStates,
        player,
        action,
        giftItem,
        npcSt?.realmIndex ?? 4,
        skillDefs,
      );
    setCharStates(nextCharacters);
    const from = action === 'gift' && giftItem && (player.inventory[giftItem.id] ?? 0) > 0
      ? rememberNpc(journey, charId, {
          id: `gift:${giftItem.id}`, kind: 'gift', detail: `你赠给${cDef.name}一件${giftItem.name}。`,
        })
      : journey;
    const advanced = advanceJourney(nextPlayer, { from });
    appendLog(advanced.player, 'bond', dualSceneText ? `${dualSceneText}\n${message}` : message, advanced.journey);

    if (dualSceneText) {
      setDualSceneModal({
        charName: cDef.name,
        sceneText: dualSceneText,
        summaryText: message,
      });
      return;
    }

    if (shuraTriggered) {
      const shuraEvt = eventDefs.find((e) => e.category === 'shura_field' &&
        e.requiredPartners?.every((id) => nextCharacters[id]?.isSoulmate));
      if (shuraEvt) {
        releaseDeferredEncounter();
        showEvent(shuraEvt);
        return;
      }
    }
    if (action === 'gift') handleTalk(charId, nextCharacters[charId].lastSpokenLine);
  };

  const handleTravelRegion = (region: WorldRegion) => {
    if (battle || player.isDead || eventVisible || region.id === currentRegionId || player.realmIndex < region.minRealmIndex) return;
    const advanced = advanceJourney(player, {
      days: 1, from: { ...journey, regionId: region.id }, allowUrgent: true,
    });
    appendLog(
      advanced.player,
      'system',
      `你用一日赶到${region.name}。`,
      advanced.journey,
    );
  };

  const handleGatherMaterial = (region: WorldRegion) => {
    if (battle || player.isDead || region.id !== currentRegionId) return;
    const matId =
      region.specialtyMaterials[
        Math.floor(Math.random() * region.specialtyMaterials.length)
      ];
    const mat = CRAFT_MATERIALS.find((m) => m.id === matId) ?? CRAFT_MATERIALS[0];
    setMaterials((prev) => ({ ...prev, [mat.id]: (prev[mat.id] ?? 0) + 1 }));
    const advanced = advanceJourney(player, { days: 1, allowUrgent: true });
    appendLog(
      advanced.player,
      'event',
      `在「${region.name}」寻了一日，采到【${mat.name}】×1。`,
      advanced.journey,
    );
  };

  const handleBuyMaterial = (mat: CraftMaterial) => {
    if (battle || eventVisible || !currentRegion.specialtyMaterials.includes(mat.id) || player.spiritStones < mat.price) return;
    setPlayer({ ...player, spiritStones: player.spiritStones - mat.price });
    setMaterials((prev) => ({ ...prev, [mat.id]: (prev[mat.id] ?? 0) + 1 }));
    appendLog(player, 'system', `花费 ${mat.price} 灵石购入灵材【${mat.name}】。`);
  };

  const handleCreateProceduralSkill = (
    name: string,
    category: SkillCategory
  ) => {
    if (player.spiritStones < 60) return;
    const newSkill = generateProceduralSkill(name, category, player.sense);
    setSkillDefs((prev) => [newSkill, ...prev]);
    const nextEquipped =
      player.equippedSkills.length < 4
        ? [...player.equippedSkills, newSkill.id]
        : player.equippedSkills;
    const nextP: PlayerState = {
      ...player,
      spiritStones: player.spiritStones - 60,
      unlockedSkills: [newSkill.id, ...player.unlockedSkills],
      equippedSkills: nextEquipped,
    };
    setPlayer(nextP);
    appendLog(
      nextP,
      'cultivation',
      `灵台顿悟！你自创了${newSkill.rarity}独门神通【${newSkill.name}】！`
    );
  };

  const handleFuseSkills = (idA: string, idB: string) => {
    if (player.spiritStones < 100 || idA === idB) return;
    const skA = skillDefs.find((s) => s.id === idA);
    const skB = skillDefs.find((s) => s.id === idB);
    if (!skA || !skB) return;
    const fused = fuseTwoSkills(skA, skB);
    setSkillDefs((prev) => [fused, ...prev]);
    const nextP: PlayerState = {
      ...player,
      spiritStones: player.spiritStones - 100,
      unlockedSkills: [fused.id, ...player.unlockedSkills],
      equippedSkills: [fused.id, ...player.equippedSkills.slice(0, 3)],
    };
    setPlayer(nextP);
    appendLog(
      nextP,
      'cultivation',
      `万法归一！你将【${skA.name}】与【${skB.name}】融会贯通，合成仙阶绝学【${fused.name}】！`
    );
  };

  const craftContext = { player, journey, materials, charStates, characters: characterDefs, talents: player.craftTalents! };
  const handleCraft = (action: CraftAction) => {
    if (battle || player.isDead || eventVisible) return;
    const result = applyCraftAction(craftContext, action);
    if (!result.ok) { appendLog(player, 'system', result.message); return; }
    setMaterials(result.materials);
    let from = result.journey;
    if (action.type === 'make' && action.maker !== 'player') {
      const maker = characterDefs.find(c => c.id === action.maker);
      const first = maker && charStates[maker.id] && encounterCharacter(maker, charStates[maker.id], from);
      if (first && maker) {
        from = first.journey;
        setCharStates(prev => ({ ...prev, [maker.id]: first.runtime }));
        appendLog(player, 'bond', first.line, from);
      }
    }
    const advanced = advanceJourney(result.player, { from: refreshNpcAgendas(from), days: result.days });
    appendLog(advanced.player, 'system', result.message, advanced.journey);
  };

  // High-Stakes Intervention Event Builder!
  const handleInterveneNpc = (charId: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || !charStates[charId]?.met || !st?.canIntervene || st.regionId !== currentRegionId || battle || player.isDead || eventVisible) return;
    const afterNotice = st.interveneType === 'rescue' ? markRescueSent(journey, charId) : journey;
    if (st.interveneType === 'rescue' && afterNotice === journey) {
      setJourney(refreshNpcAgendas(journey));
      return;
    }

    setActiveCharId(charId);
    if (st.interveneType === 'spar') {
      handleStartSparWithChar(charId);
    } else {
      releaseDeferredEncounter();
      showEvent(buildInterveneEvent(cDef, st, player));
    }

    setJourney({
      ...afterNotice,
      npcStatuses: { ...npcStatuses, [charId]: { ...st, canIntervene: false } },
    });
  };

  const handleToggleCompanion = (charId: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || !charStates[charId]?.met || st?.activityKey === 'craft-order' || !st || battle || player.isDead || st.regionId !== currentRegionId) return;
    if (!st.isCompanion && relationships[charId]?.inviteReason) return;

    const nextVal = !st.isCompanion;
    const updated = Object.fromEntries(Object.entries(npcStatuses)
      .map(([id, value]) => [id, { ...value, isCompanion: id === charId && nextVal }]));
    setJourney(refreshNpcAgendas({ ...journey, npcStatuses: updated }));
    setActiveCharId(charId);
    appendLog(
      player,
      'bond',
      nextVal
        ? `【结伴同行】${cDef.name}欣然应允与你并肩游历九州，并在战斗中为你护道助战！`
        : `${cDef.name}暂别离队，继续独自游历修真界。`
    );
  };

  const handleSaveToSlot = (slotId: number) => {
    const saved = captureLife(slotId);
    if (!saved || battle) return false;
    const nextSlots = [...saveSlots];
    nextSlots[slotId] = saved;
    if (!writeLocal(SLOT_STORAGE_KEY, nextSlots)) {
      setStorageUnavailable(true);
      return false;
    }
    setSaveSlots(nextSlots);
    return true;
  };

  const handleLoadFromSlot = (slotId: number) => {
    const slot = saveSlots[slotId];
    if (!slot) return;
    loadLife(slot);
  };

  const handleDeleteSlot = (slotId: number) => {
    const nextSlots = [...saveSlots];
    nextSlots[slotId] = null;
    if (writeLocal(SLOT_STORAGE_KEY, nextSlots)) setSaveSlots(nextSlots);
    else setStorageUnavailable(true);
  };

  const handleExportSaveJson = () => JSON.stringify(captureLife(0), null, 2);

  const handleExportChronicle = () => {
    const save = captureLife(0);
    if (save) downloadText(`${player.daoName}·九州修行纪事.md`, writeChronicle(save, characterDefs), 'text/markdown');
  };

  const handleAnotherLife = () => {
    closeStoryPanel();
    setStoryResult(null);
    const saved = captureLife(0);
    if (saved) {
      setLastLife(saved);
      if (!writeLocal(RESUME_STORAGE_KEY, saved)) setStorageUnavailable(true);
    }
    setShowSettings(false);
    setPlayer(null);
    finishBirthDraft();
  };

  const handleInjectCustomData = (
    type: 'events' | 'characters',
    jsonStr: string,
    triggerImmediately: boolean
  ) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { ok: false, message: '请提供非空的 JSON 数组。' };
      }
      if (type === 'events') {
        const valid = parsed.every((e) => e.id && e.title && Array.isArray(e.choices));
        if (!valid) return { ok: false, message: '事件对象缺少 id / title / choices。' };
        setEventDefs((prev) => [...parsed, ...prev]);
        appendLog(player, 'system', `热注入了 ${parsed.length} 条自定义奇遇事件。`);
        if (triggerImmediately) {
          releaseDeferredEncounter();
          showEvent(parsed[0]);
        }
        return { ok: true, message: `成功注入 ${parsed.length} 条事件！` };
      } else {
        const valid = parsed.every((c) => c?.id && c.name && c.dialogues &&
          Array.isArray(c.personalityTags) && c.chatOptions?.length >= 3 &&
          new Set(c.dualCultivationScenes ?? []).size >= 4 && c.proactiveVisitEvents?.length > 0);
        if (!valid) return { ok: false, message: '请检查角色资料、至少三条专属对话、四幕独立双修剧情和主动事件。' };
        const ids = new Set(characterDefs.map((character) => character.id));
        for (const entry of parsed) {
          if (ids.has(entry.id)) return { ok: false, message: '人物标识重复，请为新人物使用独立的 id。' };
          ids.add(entry.id);
        }
        setCharacterDefs((prev) => [...prev, ...parsed]);
        setCharStates((prev) => ({ ...prev, ...createInitialCharacters(parsed) }));
        setJourney((prev) => refreshNpcAgendas({
          ...prev, npcStatuses: { ...prev.npcStatuses, ...initNpcWorldStatuses(parsed) },
        }));
        if (triggerImmediately) {
          setActiveCharId(parsed[0].id);
        }
        appendLog(player, 'system', `热注入了 ${parsed.length} 位新女修角色。`);
        return { ok: true, message: `成功注入 ${parsed.length} 位女修！` };
      }
    } catch {
      return { ok: false, message: 'JSON 语法错误，请检查括号与引号。' };
    }
  };

  const expPct = Math.min(100, (player.exp / currentRealm.maxExp) * 100);
  const epitaph = player.isDead
    ? generateEpitaph(player, REALMS, charStates)
    : null;
  const herbLine = herbJournalLine(journey);
  const herbRegion = WORLD_REGIONS.find((region) => region.id === HERB_VALLEY);
  const conversationCharacter = characterDefs.find((character) => character.id === conversation?.charId);
  const conversationRegion = WORLD_REGIONS.find((region) => region.id === npcStatuses[conversation?.charId ?? '']?.regionId);
  const lastStoryLine = journey.openStory?.history.slice(-1)[0]?.text;

  return (
    <div className="min-h-screen p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      <TopStatusBar
        player={player}
        realm={currentRealm}
        effectiveAtk={combatStats.atk}
        effectiveDef={combatStats.def}
        onOpenSettings={() => setShowSettings(true)}
      />
      {storageUnavailable && (
        <p role="status" className="rounded border border-amber-500/40 px-3 py-2 text-xs text-amber-200">
          浏览器暂时无法保存到本地。可在存档面板下载当前进度。
        </p>
      )}

      {/* Main 2-Column Layout: Left Gameplay + Right Heroine Portrait Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className={activeCharState?.met ? 'lg:col-span-8 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {/* Cultivation & Core Action Console */}
          <div className="xuan-card rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#e2c488]">
                  {currentRegion.name} · 第 {journey.day} 日
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {currentRealm.description}（当前综合修炼倍率 x{cultMult.toFixed(2)}）
                </p>
              </div>
              <span className="text-xs text-[#e2c488] font-semibold">
                修为：{player.exp} / {currentRealm.maxExp}
              </span>
            </div>

            <div className="h-2.5 bg-[#0b0d11] rounded-full overflow-hidden border border-[#c5a059]/25">
              <div
                className="h-full bg-gradient-to-r from-[#9e7a38] via-[#c5a059] to-[#f0d599] transition-all duration-500"
                style={{ width: `${expPct}%` }}
              />
            </div>

            {activeEvent && eventMinimized && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c5a059]/35 px-3 py-2">
                <div>
                  <p className="text-sm text-[#e2c488]">暂收 · {activeEvent.title}</p>
                  <p className="mt-1 text-xs text-stone-400">时间推进或遇到新奇遇后，这件事就会错过。</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEventMinimized(false)}
                    className="min-h-11 rounded-md border border-[#c5a059]/45 px-3 text-sm text-[#e2c488] hover:bg-[#c5a059]/15">继续奇遇</button>
                  <button type="button" onClick={releaseDeferredEncounter}
                    className="min-h-11 rounded-md px-3 text-sm text-stone-300 hover:bg-white/10">放下此事</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <button
                type="button"
                disabled={Boolean(battle) || eventVisible}
                onClick={() => { setStoryError(null); setStoryPanel(true); }}
                className="rounded-xl border border-[#c5a059]/50 bg-[#c5a059]/10 px-3 py-2.5 text-xs font-semibold text-[#e2c488] hover:bg-[#c5a059]/20 disabled:opacity-40"
              >
                自由行动
              </button>
              <button
                type="button"
                disabled={Boolean(battle)}
                onClick={handleRest}
                className="rounded-xl border border-[#c5a059]/35 px-3 py-2.5 text-xs text-[#e2c488] hover:bg-[#1e232e] disabled:opacity-40"
              >
                歇息一日
              </button>
              <div className="flex flex-col gap-1">
                <select aria-label="闭关期限" value={selectedRetreat} onChange={(event) => setRetreatPlan(event.target.value)}
                  className="min-w-0 rounded border border-stone-700 bg-[#12151b] p-1 text-xs text-stone-200">
                  <option value="week">吐纳七日</option>
                  <option value="season">静修三月</option>
                  <option value="bottleneck">修至瓶颈（{goalDays} 日）</option>
                  {beforeMeeting > 0 && <option value="meeting">约前一日出关（{beforeMeeting} 日）</option>}
                </select>
                <button type="button" disabled={Boolean(battle) || eventVisible || retreatDays <= 0}
                  onClick={() => handleCultivate(retreatDays)}
                  className="flex items-center justify-center gap-1 rounded border border-[#c5a059]/35 px-2 py-1.5 text-xs text-[#e2c488] disabled:opacity-40">
                  <Sparkles className="h-3 w-3" /> 入定闭关
                </button>
              </div>

              <button
                type="button"
                disabled={Boolean(battle)}
                onClick={() => handleExplore(false)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#12151b] hover:bg-[#1e232e] border border-sky-400/35 text-xs font-semibold text-sky-200 disabled:opacity-40 transition"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                外出历练 (2月)
              </button>

              <button
                type="button"
                disabled={Boolean(battle)}
                onClick={() => handleExplore(true)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#12151b] hover:bg-[#1e232e] border border-purple-400/35 text-xs font-semibold text-purple-200 disabled:opacity-40 transition"
              >
                <Mountain className="w-4 h-4 text-purple-400" />
                秘境探索 (2月)
              </button>

              <button
                type="button"
                disabled={!canBreakthrough || Boolean(battle)}
                onClick={() => setShowBreakthrough(true)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  canBreakthrough
                    ? 'bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] animate-pulse-gold'
                    : 'bg-stone-900/60 border border-stone-800 text-stone-500 cursor-not-allowed'
                }`}
              >
                <Flame className="w-4 h-4" />
                {canBreakthrough ? '冲击瓶颈！' : '修为未满'}
              </button>
            </div>
            {nextAppointment !== undefined && journey.day + retreatDays >= nextAppointment &&
              <p className="text-xs text-amber-300">第 {nextAppointment} 日有约。此次预计第 {journey.day + retreatDays} 日出关，记得留出赶路时间。</p>}
          </div>

          {herbLine && !battle && (
            <section className="xuan-panel rounded-lg px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#e2c488]">药庐约事</h3>
                  <p className="mt-1 text-sm text-stone-300">{herbLine}</p>
                </div>
                {journey.herb.phase !== 'declined' && (currentRegionId === HERB_VALLEY ? (
                  npcStatuses[HERBALIST]?.regionId !== currentRegionId && !charStates[HERBALIST]?.hasContact ? (
                    <span className="text-xs text-stone-400">药庐今日闭门，改日再来。</span>
                  ) :
                  <button type="button" onClick={() => handleTalk(HERBALIST)}
                    className="rounded border border-[#c5a059]/45 px-3 py-2 text-xs text-[#e2c488]">
                    {npcStatuses[HERBALIST]?.regionId === currentRegionId ? charStates[HERBALIST]?.met ? '去药庐见林婉儿' : '拜访药庐主人' : '向林婉儿传音'}
                  </button>
                ) : herbRegion && (
                  <button type="button" onClick={() => handleTravelRegion(herbRegion)}
                    className="rounded border border-[#c5a059]/45 px-3 py-2 text-xs text-[#e2c488]">
                    前往药王百草谷（1 日）
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Battle Panel OR Chronicle Log */}
          {battle ? (
            <BattlePanel
              battle={battle}
              player={player}
              skills={skillDefs}
              onCastSkill={handleCastSkill}
              onToggleAuto={() =>
                setBattle((prev) => (prev ? { ...prev, autoMode: !prev.autoMode } : null))
              }
              onFinishBattle={handleFinishBattle}
            />
          ) : (
            <div className="xuan-card rounded-xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#e2c488] flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-[#c5a059]" />
                  九州修行纪事
                </h3>
                <button type="button" onClick={handleExportChronicle}
                  className="rounded border border-[#c5a059]/35 px-2.5 py-1.5 text-xs text-[#e2c488]">
                  导出人生纪事
                </button>
              </div>
              <div className="xuan-panel rounded-lg p-3 h-56 sm:h-64 overflow-y-auto space-y-3 text-base">
                {logs.slice(0, 30).map((log) => (
                  <div key={log.id} className="whitespace-pre-line leading-7 text-stone-300">
                    <span className="text-[#c5a059]/80 mr-2">[{log.day ? `第 ${log.day} 日` : log.ageText}]</span>
                    <span>{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sandbox Hub Panel */}
          <SandboxHubPanel
            player={player}
            skills={skillDefs}
            characters={characterDefs}
            charStates={charStates}
            npcStatuses={npcStatuses}
            relationships={relationships}
            currentRegionId={currentRegionId}
            materials={materials}
            onTravelRegion={handleTravelRegion}
            onGatherMaterial={handleGatherMaterial}
            onBuyMaterial={handleBuyMaterial}
            onCreateProceduralSkill={handleCreateProceduralSkill}
            onFuseSkills={handleFuseSkills}
            workshop={<fieldset disabled={Boolean(battle) || eventVisible}>
              <CraftingPanel context={craftContext} onAction={handleCraft} />
            </fieldset>}
            onTalk={handleTalk}
            onInterveneNpc={handleInterveneNpc}
            onToggleCompanion={handleToggleCompanion}
          />

          {/* Immortal Bond & Inventory/Skills */}
          {acquaintances.length > 0 && <ImmortalBondPanel
            characters={acquaintances}
            charStates={charStates}
            activeCharId={activeChar.id}
            player={player}
            items={itemDefs}
            skills={skillDefs}
            onSelectChar={setActiveCharId}
            onInteract={handleInteract}
            onTalk={handleTalk}
            local={npcStatuses[activeChar.id]?.regionId === currentRegionId}
            atWork={npcStatuses[activeChar.id]?.activityKey === 'craft-order'}
            relationship={relationships[activeChar.id]}
            onSparWithChar={handleStartSparWithChar}
          />}

          <InventoryAndSkillsPanel
            player={player}
            items={itemDefs}
            skills={skillDefs}
            onUseItem={handleUseItem}
            onBuyItem={handleBuyItem}
            workshopProducts={WORKSHOP_PRODUCTS}
            onToggleEquipSkill={handleToggleEquipSkill}
          />
        </div>

        {/* Right Sticky Heroine Portrait Stage */}
        <div className="hidden lg:col-span-4 lg:block">
          <div className="lg:sticky lg:top-4">
            {activeCharState?.met && (
              <PortraitStage
                character={activeChar}
                runtime={activeCharState}
                relationshipLabel={relationships[activeChar.id].label}
              />
            )}
          </div>
        </div>
      </div>

      {conversation && conversationCharacter && (
        <NpcConversation
          key={conversation.charId}
          character={conversationCharacter}
          location={conversationRegion?.name ?? '九州'}
          remote={conversationRegion?.id !== currentRegionId}
          node={conversation.node}
          turns={conversation.turns}
          onChoose={handleDialogueChoice}
          onSpeak={handlePlayerLine}
          modelName={modelName}
          loadingModel={modelLoading}
          plan={npcPlanLabel(pendingNpcTask(journey, conversation.charId))}
          pending={pendingNpcReply}
          error={storyError}
          onModel={loadStoryModel}
          onCancelStory={cancelStory}
          onClose={() => { cancelStory(); setStoryError(null); setConversation(null); }}
        />
      )}
      {storyPanel && (
        <OpenStoryPanel
          location={`${currentRegion.name} · 第 ${journey.day} 日`}
          modelName={modelName}
          loading={modelLoading}
          busy={storyBusy}
          error={storyError}
          result={storyResult ?? (lastStoryLine ? { text: lastStoryLine, effects: [] } : null)}
          pending={journey.openStory?.pending ?? []}
          onModel={loadStoryModel}
          onAct={(action) => handleOpenAction(action)}
          onCancel={cancelStory}
          onClose={closeStoryPanel}
        />
      )}

      {/* Dual Cultivation Exclusive Scene Modal */}
      {dualSceneModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="xuan-card rounded-2xl max-w-xl w-full p-6 space-y-4 border-pink-400/40 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-pink-300 flex items-center gap-2">
                <Heart className="w-5 h-5 fill-pink-400/30" />
                双修共鸣 · {dualSceneModal.charName}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-950/60 border border-pink-400/40 text-pink-200">
                阴阳交泰 · 大道同契
              </span>
            </div>
            <p className="text-sm leading-loose text-stone-100 xuan-panel rounded-xl p-4 italic">
              {dualSceneModal.sceneText}
            </p>
            <div className="p-3.5 rounded-xl bg-[#c5a059]/15 border border-[#c5a059]/40 text-xs text-[#f3dfb6]">
              {dualSceneModal.summaryText}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDualSceneModal(null)}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs"
              >
                收功凝神 · 继续修行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showBreakthrough && (
        <BreakthroughModal
          player={player}
          currentRealm={currentRealm}
          nextRealm={nextRealm}
          onAttempt={handleBreakthroughAttempt}
          onClose={() => setShowBreakthrough(false)}
        />
      )}

      {activeEvent && eventVisible && (
        <EventModal
          event={activeEvent}
          player={player}
          resultText={eventResultText}
          onSelectChoice={handleEventChoice}
          onClose={() => {
            if (eventResultText === null) setEventMinimized(true);
            else showEvent(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsAndHotReloadModal
          saveSlots={saveSlots}
          onSaveToSlot={handleSaveToSlot}
          onLoadFromSlot={handleLoadFromSlot}
          onDeleteSlot={handleDeleteSlot}
          onExportSaveJson={handleExportSaveJson}
          onImportSaveJson={importLife}
          daoName={player.daoName}
          canSave={!battle}
          onAnotherLife={handleAnotherLife}
          onInjectCustomData={handleInjectCustomData}
          onClose={() => setShowSettings(false)}
        />
      )}

      {epitaph && (
        <EpitaphModal
          title={epitaph.title}
          inscription={epitaph.inscription}
          onReincarnate={handleAnotherLife}
          onExportChronicle={handleExportChronicle}
        />
      )}
    </div>
  );
}
