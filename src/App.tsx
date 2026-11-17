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
  refreshNpcAgendas,
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
  SpiritRootType,
} from './types/game';
import type { JourneyState } from './types/journey';
import {
  advanceTime,
  attemptBreakthrough,
  checkEventStat,
  createInitialCharacters,
  createInitialPlayer,
  cultivate,
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
  restoreJourney,
  RESUME_STORAGE_KEY,
  SAVE_VERSION,
  SLOT_STORAGE_KEY,
  writeChronicle,
  writeLocal,
} from './engine/lifeSave';
import { HERB_VALLEY, HERBALIST, herbJournalLine, rememberNpc } from './engine/herbJourney';
import {
  answerSmallTalk, chooseDialogue, matchDialogueInput, openConversation,
  type DialogueChoice, type DialogueNode,
} from './engine/npcDialogue';
import { giftRefusal, relationshipFor, storyEventId } from './engine/relationships';
import { applyStoryOutcome, createStoryPrompt, settleStoryFollowups } from './engine/openStory';
import { LocalStoryModel } from './engine/localStoryModel';
import { CharacterCreationModal } from './components/CharacterCreationModal';
import { TopStatusBar } from './components/TopStatusBar';
import { PortraitStage } from './components/PortraitStage';
import { BreakthroughModal } from './components/BreakthroughModal';
import { EventModal } from './components/EventModal';
import { BattlePanel } from './components/BattlePanel';
import { ImmortalBondPanel } from './components/ImmortalBondPanel';
import { InventoryAndSkillsPanel } from './components/InventoryAndSkillsPanel';
import { SandboxHubPanel } from './components/SandboxHubPanel';
import { SettingsAndHotReloadModal } from './components/SettingsAndHotReloadModal';
import { EpitaphModal } from './components/EpitaphModal';
import { NpcConversation, type ConversationTurn } from './components/NpcConversation';
import { LifeFileInput } from './components/LifeFileInput';
import { OpenStoryPanel } from './components/OpenStoryPanel';

const STARTING_MATERIALS = { taibai_metal: 2, snow_lotus: 2, blood_ginseng: 2, thunder_bamboo: 1, fox_core: 1 };
const DAYS_PER_MONTH = 30;

export default function App() {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [characterDefs, setCharacterDefs] = useState<CharacterData[]>(ALL_CHARACTERS);
  const [eventDefs, setEventDefs] = useState<GameEvent[]>(EVENTS);
  const [skillDefs, setSkillDefs] = useState<SkillTag[]>(SKILLS);
  const [itemDefs, setItemDefs] = useState<ItemConfig[]>(ITEMS);
  const [charStates, setCharStates] = useState<Record<string, CharacterRuntimeState>>(() =>
    createInitialCharacters(ALL_CHARACTERS)
  );
  const [journey, setJourney] = useState(() => initializeJourney(ALL_CHARACTERS, 0));
  const { npcStatuses, regionId: currentRegionId } = journey;
  const [materials, setMaterials] = useState<Record<string, number>>(STARTING_MATERIALS);
  const [activeCharId, setActiveCharId] = useState<string>(ALL_CHARACTERS[0].id);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [eventResultText, setEventResultText] = useState<string | null>(null);
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
    turns: ConversationTurn[];
  } | null>(null);
  const [storyModel] = useState(() => new LocalStoryModel());
  const [modelName, setModelName] = useState<string | null>(null);
  const [storyPanel, setStoryPanel] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyResult, setStoryResult] = useState<{ text: string; effects: string[] } | null>(null);
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
      materials,
      customSkills: skillDefs.filter((skill) => !SKILLS.includes(skill)),
      customItems: itemDefs.filter((item) => !ITEMS.includes(item)),
      customCharacters: characterDefs.filter((character) => !ALL_CHARACTERS.includes(character)),
      customEvents: eventDefs.filter((event) => !EVENTS.includes(event)),
    };
  }, [player, charStates, logs, activeCharId, journey, materials, skillDefs, itemDefs, characterDefs, eventDefs, activeEvent, eventResultText]);

  useEffect(() => {
    if (!player || (battle && !player.isDead)) return;
    if (!writeLocal(RESUME_STORAGE_KEY, captureLife(0))) setStorageUnavailable(true);
  }, [player, captureLife, battle]);

  const loadLife = (save: SaveSlotData) => {
    closeStoryPanel();
    setStoryResult(null);
    const defs = [...ALL_CHARACTERS, ...(save.customCharacters ?? [])];
    const characters = { ...createInitialCharacters(defs), ...save.characters };
    const restoredJourney = restoreJourney(save, defs);
    setCharacterDefs(defs);
    setSkillDefs([...(save.customSkills ?? []), ...SKILLS]);
    setItemDefs([...(save.customItems ?? []), ...ITEMS]);
    setEventDefs([...(save.customEvents ?? []), ...EVENTS]);
    setPlayer(save.player);
    setCharStates(characters);
    setJourney(restoredJourney);
    setMaterials(save.materials ?? STARTING_MATERIALS);
    setLogs(save.logs);
    setActiveCharId(defs.some((character) => character.id === save.activeCharacterId)
      ? save.activeCharacterId : defs[0].id);
    setBattle(null);
    setActiveEvent(save.pendingEvent ?? null);
    setEventResultText(null);
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
    root: SpiritRootType,
    traits: string[]
  ) => {
    closeStoryPanel();
    setStoryResult(null);
    const initP = createInitialPlayer(daoName, root, traits);
    const initChars = createInitialCharacters(characterDefs);
    setPlayer(initP);
    setCharStates(initChars);
    const firstDay = initializeJourney(characterDefs, Math.floor(Math.random() * 0x100000000));
    setJourney(firstDay);
    setMaterials(STARTING_MATERIALS);
    setSkillDefs(SKILLS);
    setItemDefs(ITEMS);
    setActiveCharId(characterDefs[0].id);
    setBattle(null);
    setActiveEvent(null);
    setEventResultText(null);
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
    const tick = simulateWorldTick(from, characterDefs, aged, elapsedDays,
      allowUrgent && !aged.isDead && !activeEvent && !battle);
    const continued = settleStoryFollowups(tick.nextJourney);
    setJourney(continued.journey);
    for (const entry of continued.due) {
      appendLog(aged, 'event', entry.text, { ...continued.journey, day: entry.day, regionId: entry.regionId });
    }
    for (const rumor of tick.worldRumors) appendLog(aged, 'system', rumor, continued.journey);
    if (tick.proactiveEvent) {
      setActiveEvent(tick.proactiveEvent);
      setEventResultText(null);
    }
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
  const activeChar =
    characterDefs.find((c) => c.id === activeCharId) ?? characterDefs[0];
  const activeCharState = charStates[activeChar.id];
  const relationships = Object.fromEntries(characterDefs.map((character) => [
    character.id, relationshipFor(journey, character.id, charStates[character.id]),
  ]));

  const handleCultivate = (months: number) => {
    if (battle || player.isDead || activeEvent) return;
    const lifeDays = (player.lifespanCapYears * 12 - player.ageMonths) * DAYS_PER_MONTH -
      ((journey.day - 1) % DAYS_PER_MONTH);
    const plannedDays = Math.max(0, Math.min(months * DAYS_PER_MONTH, lifeDays));
    const interruption = findRetreatInterruption(journey, characterDefs, player, plannedDays);
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
      setActiveEvent({
        ...interruption.event,
        description: `${progress}\n\n${interruption.event.description}`,
      });
      setEventResultText(null);
    }
  };

  const handleRest = () => {
    if (battle || player.isDead) return;
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
    if (battle || player.isDead) return;
    const pool = filterAvailableEvents(eventDefs, player, charStates);
    const filtered = isSecretRealm
      ? pool.filter((e) => e.category === 'secret_realm' || e.category === 'encounter')
      : pool;
    const source = filtered.length > 0 ? filtered : pool;
    const picked = source[Math.floor(Math.random() * source.length)];
    if (picked) {
      setActiveEvent(picked);
      setEventResultText(null);
    }
  };

  const handleStartSparWithChar = (charId: string, eventId?: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || player.isDead || battle || st?.regionId !== currentRegionId) return;
    const sparEnemy = createSparEnemyFromCharacter(cDef, st?.realmIndex ?? 3);
    setActiveEvent(null);
    setEventResultText(null);
    setBattle(initBattle(sparEnemy, { type: 'spar', charId, eventId }));
  };

  const handleEventChoice = (choice: EventChoice) => {
    if (!activeEvent || eventResultText !== null) return;
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

    let nextJourney = journey;
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
      setActiveEvent(null);
      setEventResultText(null);
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
          nextJourney = rememberNpc(journey, cid, {
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
    if (player.spiritStones < item.price) return;
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
    if (!character || !runtime || battle || player.isDead || activeEvent) return;
    const entry = openConversation({ character, runtime, player, journey });
    const node = opening ? { ...entry, line: opening } : entry;
    setActiveCharId(charId);
    setConversation({ charId, node, turns: [{ speaker: character.name, line: node.line }] });
  };

  const handleDialogueChoice = (choice: DialogueChoice, spoken = choice.label) => {
    if (!conversation || choice.lockReason || !conversation.node.choices.includes(choice)) return;
    const character = characterDefs.find((entry) => entry.id === conversation.charId);
    const runtime = charStates[conversation.charId];
    if (!character || !runtime) return;
    const next = chooseDialogue({ character, runtime, player, journey }, choice);
    if (next.visit) {
      const status = npcStatuses[character.id];
      if (!status?.canIntervene || status.regionId !== currentRegionId) return;
      const visit = buildProactiveVisitEvent(character, player);
      if (!visit) return;
      setJourney({
        ...journey,
        npcStatuses: { ...npcStatuses, [character.id]: { ...status, canIntervene: false } },
      });
      setConversation(null);
      setActiveEvent(visit);
      setEventResultText(null);
      return;
    }
    const tookTrip = next.journey.herb.phase === 'fulfilled' && journey.herb.phase !== 'fulfilled';
    const advanced = advanceJourney(next.player, { from: next.journey, days: tookTrip ? 1 : 0 });
    setCharStates({ ...charStates, [character.id]: next.runtime });
    setConversation({
      charId: character.id,
      node: next.node,
      turns: [...conversation.turns,
        { speaker: '你', line: spoken },
        { speaker: character.name, line: next.node.line }],
    });
    if (choice.action !== 'greet') {
      const opening = conversation.turns.length === 1 ? `${conversation.node.line}\n\n` : '';
      appendLog(advanced.player, 'bond', `与${character.name}交谈\n${opening}你：${spoken}\n${next.node.line}`, advanced.journey);
    }
  };

  const handleOpenAction = (input: string, dialogActorId?: string): boolean => {
    const action = input.trim();
    if (!action || !modelName || modelLoading || storyJob.current || activeEvent || battle || player.isDead) return false;
    const actor = dialogActorId
      ? characterDefs.find((character) => character.id === dialogActorId)
      : characterDefs.find((character) => action.includes(character.name));
    const runtime = actor ? charStates[actor.id] : undefined;
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
          if (dialogActorId) {
            const node = openConversation({
              character: actor, runtime: nextRuntime, player: advanced.player, journey: advanced.journey,
            });
            setConversation((current) => current?.charId === actor.id ? {
              ...current,
              node,
              turns: [...current.turns, { speaker: '你', line: action },
                { speaker: actor.name, line: turn.record.text + suffix }],
            } : current);
          }
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

  const handlePlayerLine = (line: string) => {
    if (!conversation || storyJob.current) return false;
    if (/^(告辞|我先走了|改日再聊)[。！]?$/.test(line)) {
      setConversation(null);
      return true;
    }
    if (modelName) return handleOpenAction(line, conversation.charId);
    if (!conversation.node.choices.length) return false;
    const matchingChoice = matchDialogueInput(line, conversation.node);
    if (matchingChoice) {
      handleDialogueChoice(matchingChoice, line);
      return true;
    }
    const character = characterDefs.find((entry) => entry.id === conversation.charId);
    if (!character) return false;
    const reply = answerSmallTalk(line, character, journey);
    if (!reply) return false;
    setConversation({
      ...conversation,
      turns: [...conversation.turns, { speaker: '你', line }, { speaker: character.name, line: reply }],
    });
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
    if (!cDef || !cState || battle || activeEvent || player.isDead || npcSt?.regionId !== currentRegionId) return;
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
        npcSt?.realmIndex ?? 4
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
      const shuraEvt = eventDefs.find((e) => e.category === 'shura_field');
      if (shuraEvt) {
        setActiveEvent(shuraEvt);
        setEventResultText(null);
        return;
      }
    }
    if (action === 'gift') handleTalk(charId, nextCharacters[charId].lastSpokenLine);
  };

  const handleTravelRegion = (region: WorldRegion) => {
    if (battle || player.isDead || region.id === currentRegionId || player.realmIndex < region.minRealmIndex) return;
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
    if (player.spiritStones < mat.price) return;
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

  const handleForgeItems = (
    matAId: string,
    matBId: string,
    mode: 'pill' | 'treasure',
    customTitle: string
  ) => {
    const mA = CRAFT_MATERIALS.find((m) => m.id === matAId) ?? CRAFT_MATERIALS[0];
    const mB = CRAFT_MATERIALS.find((m) => m.id === matBId) ?? CRAFT_MATERIALS[1];
    const nextMats = { ...materials };
    nextMats[mA.id] = Math.max(0, (nextMats[mA.id] ?? 0) - 1);
    nextMats[mB.id] = Math.max(0, (nextMats[mB.id] ?? 0) - 1);
    setMaterials(nextMats);

    // Special Breakthrough Pill Recipes!
    const pair = [mA.id, mB.id].sort().join('+');
    if (mode === 'pill') {
      if (pair === 'fox_core+snow_lotus') {
        const nextP: PlayerState = {
          ...player,
          inventory: {
            ...player.inventory,
            golden_core_pill: (player.inventory.golden_core_pill ?? 0) + 1,
          },
        };
        setPlayer(nextP);
        appendLog(
          nextP,
          'system',
          '丹成九转！你以天山雪莲与天狐媚珠成功炼出金丹破境至宝【结金丹】×1！'
        );
        return;
      }
      if (pair === 'fox_core+star_sand' || pair === 'blood_ginseng+star_sand') {
        const nextP: PlayerState = {
          ...player,
          inventory: {
            ...player.inventory,
            nascent_soul_pill: (player.inventory.nascent_soul_pill ?? 0) + 1,
          },
        };
        setPlayer(nextP);
        appendLog(
          nextP,
          'system',
          '仙光冲霄！你以周天星辰砂成功炼出元婴破境神丹【九转化婴丹】×1！'
        );
        return;
      }
      if (pair === 'blood_ginseng+snow_lotus') {
        const nextP: PlayerState = {
          ...player,
          inventory: {
            ...player.inventory,
            barrier_break_pill: (player.inventory.barrier_break_pill ?? 0) + 1,
          },
        };
        setPlayer(nextP);
        appendLog(
          nextP,
          'system',
          '丹香四溢！你成功炼出通用破境灵丹【破障丹】×1！'
        );
        return;
      }
    }

    const newItemId = `crafted_${Date.now()}`;
    const defaultName =
      mode === 'treasure'
        ? `${mA.name.slice(0, 2)}${mB.name.slice(0, 2)}神兵`
        : `${mA.name.slice(0, 2)}${mB.name.slice(0, 2)}造化丹`;
    const finalName = customTitle.trim() || defaultName;

    const newItem: ItemConfig = {
      id: newItemId,
      name: finalName,
      type: mode,
      rarity: '仙品',
      price: 200,
      description: `由【${mA.name}】与【${mB.name}】合炼而成的自制${
        mode === 'treasure' ? '本命法宝' : '造化奇丹'
      }。`,
      effect: {
        atkBonus: (mA.statBoost.atk ?? 0) + (mB.statBoost.atk ?? 0),
        defBonus: (mA.statBoost.def ?? 0) + (mB.statBoost.def ?? 0),
        senseBonus: (mA.statBoost.sense ?? 0) + (mB.statBoost.sense ?? 0),
        hpRestore: (mA.statBoost.hp ?? 0) + (mB.statBoost.hp ?? 0) + 150,
        expGain: (mA.statBoost.exp ?? 0) + (mB.statBoost.exp ?? 0) + 140,
        lifespanGain: (mA.statBoost.lifespan ?? 0) + (mB.statBoost.lifespan ?? 0),
      },
    };

    setItemDefs((prev) => [newItem, ...prev]);
    const nextP: PlayerState = {
      ...player,
      inventory: {
        ...player.inventory,
        [newItem.id]: 1,
      },
    };
    setPlayer(nextP);
    appendLog(
      nextP,
      'system',
      `丹器出炉！你成功炼制出仙品【${newItem.name}】，已收入储物袋！`
    );
  };

  // High-Stakes Intervention Event Builder!
  const handleInterveneNpc = (charId: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || !st?.canIntervene || st.regionId !== currentRegionId || battle || player.isDead || activeEvent) return;

    setActiveCharId(charId);
    if (st.interveneType === 'spar') {
      handleStartSparWithChar(charId);
    } else {
      setActiveEvent(buildInterveneEvent(cDef, st, player));
      setEventResultText(null);
    }

    setJourney({
      ...journey,
      npcStatuses: { ...npcStatuses, [charId]: { ...st, canIntervene: false } },
    });
  };

  const handleToggleCompanion = (charId: string) => {
    const cDef = characterDefs.find((c) => c.id === charId);
    const st = npcStatuses[charId];
    if (!cDef || !st || battle || player.isDead || st.regionId !== currentRegionId) return;
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
          setActiveEvent(parsed[0]);
          setEventResultText(null);
        }
        return { ok: true, message: `成功注入 ${parsed.length} 条事件！` };
      } else {
        const valid = parsed.every((c) => c?.id && c.name && c.dialogues &&
          Array.isArray(c.personalityTags) && c.chatOptions?.length >= 3 &&
          new Set(c.dualCultivationScenes ?? []).size >= 4 && c.proactiveVisitEvents?.length > 0);
        if (!valid) return { ok: false, message: '请检查角色资料、至少三条专属对话、四幕独立双修剧情和主动事件。' };
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
        <div className="lg:col-span-8 space-y-4">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <button
                type="button"
                disabled={Boolean(battle) || Boolean(activeEvent)}
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
              <button
                type="button"
                disabled={Boolean(battle)}
                onClick={() => handleCultivate(3)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#12151b] hover:bg-[#1e232e] border border-[#c5a059]/35 text-xs font-semibold text-stone-100 disabled:opacity-40 transition"
              >
                <Sparkles className="w-4 h-4 text-[#c5a059]" />
                闭关修炼 (3月)
              </button>

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
          </div>

          {herbLine && !battle && (
            <section className="xuan-panel rounded-lg px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#e2c488]">药庐约事</h3>
                  <p className="mt-1 text-sm text-stone-300">{herbLine}</p>
                </div>
                {journey.herb.phase !== 'declined' && (currentRegionId === HERB_VALLEY ? (
                  <button type="button" onClick={() => handleTalk(HERBALIST)}
                    className="rounded border border-[#c5a059]/45 px-3 py-2 text-xs text-[#e2c488]">
                    {npcStatuses[HERBALIST]?.regionId === currentRegionId ? '去药庐见林婉儿' : '向林婉儿传音'}
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
            onForgeItems={handleForgeItems}
            onTalk={handleTalk}
            onInterveneNpc={handleInterveneNpc}
            onToggleCompanion={handleToggleCompanion}
          />

          {/* Immortal Bond & Inventory/Skills */}
          <ImmortalBondPanel
            characters={characterDefs}
            charStates={charStates}
            activeCharId={activeChar.id}
            player={player}
            items={itemDefs}
            skills={skillDefs}
            onSelectChar={setActiveCharId}
            onInteract={handleInteract}
            onTalk={handleTalk}
            local={npcStatuses[activeChar.id]?.regionId === currentRegionId}
            relationship={relationships[activeChar.id]}
            onSparWithChar={handleStartSparWithChar}
          />

          <InventoryAndSkillsPanel
            player={player}
            items={itemDefs}
            skills={skillDefs}
            onUseItem={handleUseItem}
            onBuyItem={handleBuyItem}
            onToggleEquipSkill={handleToggleEquipSkill}
          />
        </div>

        {/* Right Sticky Heroine Portrait Stage */}
        <div className="hidden lg:col-span-4 lg:block">
          <div className="lg:sticky lg:top-4">
            {activeCharState && (
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
          openStoryReady={Boolean(modelName)}
          storyBusy={storyBusy}
          storyError={storyError}
          onEnableStory={() => { setStoryError(null); setStoryPanel(true); }}
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

      {activeEvent && (
        <EventModal
          event={activeEvent}
          player={player}
          resultText={eventResultText}
          onSelectChoice={handleEventChoice}
          onClose={() => {
            setActiveEvent(null);
            setEventResultText(null);
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
