import { CharacterData, SkillCategory, SkillTag } from '../types/game';

export interface WorldRegion {
  id: string;
  name: string;
  subtitle: string;
  dangerLevel: string;
  minRealmIndex: number;
  spiritDensity: number;
  specialtyMaterials: string[];
  description: string;
  themeColor: string;
}

export interface CraftMaterial {
  id: string;
  name: string;
  element: 'sword' | 'thunder' | 'blood' | 'alchemy' | 'yin_yang' | 'defense';
  rarity: '凡品' | '灵品' | '宝品' | '仙品';
  price: number;
  description: string;
  statBoost: {
    atk?: number;
    def?: number;
    sense?: number;
    hp?: number;
    mp?: number;
    exp?: number;
    lifespan?: number;
  };
}

export interface SynergyBond {
  id: string;
  name: string;
  category: SkillCategory | 'hybrid';
  requiredCount: number;
  description: string;
  atkMult: number;
  defMult: number;
  critBonus: number;
  cultivationBonus: number;
  swordIntentGain?: number;
  swordStrikeMult?: number;
  dualExpBonus?: number;
  lifestealBonus?: number;
  poisonBonus?: number;
  stunBonus?: number;
}

export interface NpcWorldStatus {
  charId: string;
  realmIndex: number;
  exp: number;
  regionId: string;
  activityText: string;
  canIntervene: boolean;
  interveneType: 'rescue' | 'spar' | 'co_explore' | 'aid_breakthrough' | 'trade';
  interveneLabel: string;
  isCompanion: boolean;
  activityKey?: string;
  availableUntilDay?: number;
  recoverUntilDay?: number;
  jealousy: number;
  relations: Record<string, string>;
}

export const WORLD_REGIONS: WorldRegion[] = [
  {
    id: 'taixu_peak',
    name: '太虚剑巅',
    subtitle: '万剑朝宗 · 正道魁首',
    dangerLevel: '低危 · 适合炼气~金丹',
    minRealmIndex: 0,
    spiritDensity: 1.35,
    specialtyMaterials: ['taibai_metal', 'snow_lotus'],
    description: '终年积雪的万丈剑峰，云海之中残存无数古修剑意，闭关与参悟剑道有奇效。',
    themeColor: '#7dd3fc',
  },
  {
    id: 'qingming_wild',
    name: '青冥十万大山',
    subtitle: '群妖盘踞 · 灵草遍地',
    dangerLevel: '中危 · 妖兽出没',
    minRealmIndex: 0,
    spiritDensity: 1.15,
    specialtyMaterials: ['blood_ginseng', 'corpse_grass'],
    description: '横亘数千里的原始古林，奇珍异草与凶戾妖兽并存，是散修历练夺宝的首选之地。',
    themeColor: '#34d399',
  },
  {
    id: 'heishan_market',
    name: '黑山鬼市',
    subtitle: '正魔混杂 · 奇珍黑拍',
    dangerLevel: '中危 · 杀人夺宝频发',
    minRealmIndex: 1,
    spiritDensity: 1.0,
    specialtyMaterials: ['nether_iron', 'star_sand'],
    description: '只在子夜开启的地下鬼市，不问来历只认灵石，常有上古残卷与违禁破境丹流通。',
    themeColor: '#c084fc',
  },
  {
    id: 'yaowang_valley',
    name: '药王百草谷',
    subtitle: '四季如春 · 丹香万里',
    dangerLevel: '安全 · 丹道圣地',
    minRealmIndex: 0,
    spiritDensity: 1.3,
    specialtyMaterials: ['snow_lotus', 'blood_ginseng'],
    description: '药王谷核心灵脉所在，地火温润，在此炼制破境丹或疗愈内伤事半功倍。',
    themeColor: '#10b981',
  },
  {
    id: 'feiyue_palace',
    name: '绯月合欢宫',
    subtitle: '红尘画舫 · 魅影迷踪',
    dangerLevel: '中危 · 道心考验',
    minRealmIndex: 2,
    spiritDensity: 1.25,
    specialtyMaterials: ['fox_core', 'corpse_grass'],
    description: '建立于云梦泽画舫之上的魔道圣地，歌管楼台间暗藏阴阳双修大阵。',
    themeColor: '#f472b6',
  },
  {
    id: 'zixiao_thunder',
    name: '紫霄雷墟',
    subtitle: '天劫遗土 · 狂雷淬体',
    dangerLevel: '高危 · 推荐筑基以上',
    minRealmIndex: 5,
    spiritDensity: 1.65,
    specialtyMaterials: ['thunder_bamboo', 'star_sand'],
    description: '上古大能渡劫劈出的千里雷泽，空气中弥漫着毁灭雷弧，可借天威推演绝世杀招。',
    themeColor: '#a855f7',
  },
];

export const CRAFT_MATERIALS: CraftMaterial[] = [
  {
    id: 'taibai_metal',
    name: '太白玄金',
    element: 'sword',
    rarity: '宝品',
    price: 65,
    description: '极西剑山产出的庚金之精，锋锐无匹，炼器可大幅提升攻伐与暴击。',
    statBoost: { atk: 12, sense: 3 },
  },
  {
    id: 'thunder_bamboo',
    name: '紫霄雷竹',
    element: 'thunder',
    rarity: '宝品',
    price: 75,
    description: '受九天神雷洗礼而不死之灵竹，蕴含狂暴雷元。',
    statBoost: { atk: 15, mp: 45 },
  },
  {
    id: 'blood_ginseng',
    name: '千年血参',
    element: 'blood',
    rarity: '灵品',
    price: 50,
    description: '吸纳古战场精血而成的灵参，大补气血与寿元，更是炼制破境丹的主药。',
    statBoost: { hp: 160, lifespan: 3 },
  },
  {
    id: 'snow_lotus',
    name: '天山雪莲',
    element: 'defense',
    rarity: '灵品',
    price: 55,
    description: '冰崖之巅盛开的净世白莲，清心涤魂，配合天狐媚珠可炼【结金丹】。',
    statBoost: { def: 9, mp: 60, sense: 5 },
  },
  {
    id: 'fox_core',
    name: '天狐媚珠',
    element: 'yin_yang',
    rarity: '宝品',
    price: 80,
    description: '灵狐一族凝练百年的内丹，阴阳流转，乃炼制【结金丹】与【化婴丹】的核心灵引。',
    statBoost: { exp: 180, sense: 8, mp: 50 },
  },
  {
    id: 'corpse_grass',
    name: '断魂腐骨草',
    element: 'alchemy',
    rarity: '灵品',
    price: 45,
    description: '剧毒与生机并存的奇草，以毒入丹往往能炼出奇效。',
    statBoost: { atk: 9, exp: 110 },
  },
  {
    id: 'nether_iron',
    name: '九幽冥铁',
    element: 'defense',
    rarity: '宝品',
    price: 70,
    description: '深渊寒脉孕育的黑铁，坚不可摧。',
    statBoost: { def: 15, hp: 120 },
  },
  {
    id: 'star_sand',
    name: '周天星辰砂',
    element: 'thunder',
    rarity: '仙品',
    price: 120,
    description: '天外陨星碎屑，蕴含宇宙法理，炼制【九转化婴丹】与仙阶神兵的至高神材。',
    statBoost: { atk: 14, def: 10, sense: 12, lifespan: 5 },
  },
];

export const SYNERGY_BONDS: SynergyBond[] = [
  {
    id: 'syn_sword_2',
    name: '剑心通明 (剑道×2)',
    category: 'sword',
    requiredCount: 2,
    description: '装配 ≥2 门剑道功法：总攻击 +16%，暴击率 +10%，出剑额外凝聚 1 层剑意。',
    atkMult: 0.16,
    defMult: 0,
    critBonus: 0.1,
    cultivationBonus: 0,
    swordIntentGain: 1,
  },
  {
    id: 'syn_sword_3',
    name: '万剑诛仙 (剑道×3)',
    category: 'sword',
    requiredCount: 3,
    description: '总攻击 +34%、防御 +10%、暴击率 +20%、吐纳倍率 +0.1。保留额外剑意，每回合剑罡再造成攻击 35% 的伤害。',
    atkMult: 0.34,
    defMult: 0.1,
    critBonus: 0.2,
    cultivationBonus: 0.1,
    swordIntentGain: 1,
    swordStrikeMult: 0.35,
  },
  {
    id: 'syn_yinyang_2',
    name: '阴阳交泰 (阴阳×2)',
    category: 'yin_yang',
    requiredCount: 2,
    description: '装配 ≥2 门阴阳功法：二气流转，修炼速度 +28%，防御 +15%，双修收益额外 +25%。',
    atkMult: 0.1,
    defMult: 0.15,
    critBonus: 0.05,
    cultivationBonus: 0.28,
    dualExpBonus: 0.25,
  },
  {
    id: 'syn_blood_2',
    name: '血海不枯 (血道×2)',
    category: 'blood',
    requiredCount: 2,
    description: '装配 ≥2 门血道功法：以战养战，总攻击 +24%，暴击 +10%，全技能附带额外 15% 吸血。',
    atkMult: 0.24,
    defMult: 0,
    critBonus: 0.1,
    cultivationBonus: 0.05,
    lifestealBonus: 0.15,
  },
  {
    id: 'syn_alchemy_2',
    name: '百草厄难 (丹毒×2)',
    category: 'alchemy',
    requiredCount: 2,
    description: '装配 ≥2 门丹道功法：药毒同源，防御 +20%，修炼速度 +18%，丹毒伤害提升 50%。',
    atkMult: 0.12,
    defMult: 0.2,
    critBonus: 0,
    cultivationBonus: 0.18,
    poisonBonus: 0.5,
  },
  {
    id: 'syn_thunder_2',
    name: '九霄天威 (雷法×2)',
    category: 'thunder',
    requiredCount: 2,
    description: '装配 ≥2 门雷系功法：雷霆万钧，总攻击 +28%，暴击率 +15%，雷电麻痹概率提升。',
    atkMult: 0.28,
    defMult: 0,
    critBonus: 0.15,
    cultivationBonus: 0,
    stunBonus: 0.1,
  },
];

export function equippedSchools(equipped: string[], skills: SkillTag[]) {
  const counts: Partial<Record<SynergyBond['category'], number>> = {};
  for (const id of new Set(equipped)) {
    const skill = skills.find((entry) => entry.id === id);
    if (skill) counts[skill.category] = (counts[skill.category] ?? 0) + 1;
  }
  const active = SYNERGY_BONDS.filter((bond) => {
    const count = counts[bond.category] ?? 0;
    return count >= bond.requiredCount && !SYNERGY_BONDS.some((other) =>
      other.category === bond.category && other.requiredCount > bond.requiredCount && count >= other.requiredCount);
  });
  return { counts, active };
}

export const EXTRA_CHARACTERS: CharacterData[] = [
  {
    id: 'mu_qingge',
    name: '慕清歌',
    title: '天音阁 · 绝代琴仙',
    sect: '天音阁',
    styleTag: '清雅琴修',
    personalityTags: ['知性温润', '音律杀伐', '外柔内刚'],
    themeColor: '#a78bfa',
    accentColor: '#8b5cf6',
    emblemType: 'moon',
    bio: '怀抱七弦焦尾古琴游历九州的天音阁首徒，一曲《潇湘水云》可洗尽铅华、稳固心神，亦可化作无形音刃斩灭元神。',
    resonanceSkillId: 'nine_heaven_thunder',
    favoriteGifts: ['pure_heart_lotus', 'jade_slip'],
    dialogues: {
      stranger: [
        '“道友步履匆匆，眉宇间似有煞气郁结，不如静听清歌一曲？”',
        '“琴音如道心，急躁一分便乱了宫商。”',
      ],
      acquainted: [
        '“昨日新谱了一曲《问道引》，不知何人能解其中真意……幸好你来了。”',
        '“若你在秘境中神魂受创，随时捏碎传音玉简，我的琴声定为你护法。”',
      ],
      infatuated: [
        '“从前我抚琴只敬天地山水，如今指尖落下的每一个音符，却皆是你的名字。”',
        '“九州浩瀚，只要有你在侧，陋室茅檐亦胜过天音仙阙。”',
      ],
      soulmate: [
        '“千古知音唯一人。自今日起，清歌的琴与命，皆系于夫君一身。”',
        '“来，闭目凝神，随我的琴音引九天星雷淬炼神魂！”',
      ],
    },
    emotionDialogues: {
      normal: '“高山流水，静候知音。”',
      smile: '“见你平安归来，这根悬着的琴弦总算可以松下了。”',
      shy: '“刚才那一节弹错了……都怪你目光太炽热，乱我琴心。”',
      angry: '“铮——！（琴弦骤断）你既心系旁人，又何必来听我的曲？”',
      injured: '“无妨，只是震伤了指尖经脉，休养数日便好。”',
      blackened: '“我已布下九曲锁魂音阵，从今往后，你只能听我一人的声音。”',
    },
    chatOptions: [
      {
        id: 'mu_chat_music',
        label: '闭目静听琴音，与她共论天音镇魂之道（检定：神识 ≥ 24）',
        checkStat: 'sense',
        checkThreshold: 24,
        replyText: '慕清歌眸光欣喜：“千古知音难觅，原来道友真能听懂我曲中寂寥！”琴音涤荡之下，你的神识与修为大增！',
        failReplyText: '慕清歌温婉一笑：“道友虽未通音律，但这份澄澈心意，清歌已然知晓。”',
        affectionDelta: 15,
        emotion: 'smile',
        senseBonus: 5,
        expBonus: 95,
      },
      {
        id: 'mu_chat_care',
        label: '取出一盒灵玉膏，轻轻替她涂抹拨弦磨伤的指尖',
        replyText: '慕清歌纤细的指尖在你掌心微微一颤，脸颊浮起淡淡红晕：“习琴之人早惯了这些，偏你这般细心……”',
        affectionDelta: 18,
        emotion: 'shy',
        expBonus: 80,
      },
      {
        id: 'mu_chat_duet',
        label: '以剑气和鸣琴音，与她合奏一曲《破阵乐》',
        replyText: '剑啸琴鸣直冲云霄！慕清歌衣袂飘飘，与你心神相通，合奏毕后赠你一枚护心宝丹！',
        affectionDelta: 14,
        emotion: 'smile',
        atkBonus: 4,
        itemRewardId: 'heart_guard_pill',
      },
    ],
    dualCultivationScenes: [
      '【竹林听雨·七弦同契】潇潇夜雨敲打竹叶，慕清歌横琴于膝，微凉的指尖轻轻抚过你的眉心与胸膛。随着《天音神魂交泰曲》奏响，两人的元神在空灵音域中紧密缠绵，浩瀚神识与修为如潮水般涌入你的气海！',
      '【天音仙阁·琴瑟和鸣】月白纱帐轻扬，慕清歌褪去素雅琴袍，温润如玉的身躯轻颤着与你相拥。每一次吐纳都暗合宫商角徵羽五音天道，不仅彻底涤尽你的心魔隐患，更令你下一次突破成功率大幅提升！',
      '【瑶台星夜·神魂双修】漫天星辉落入琴盘，慕清歌枕在你的肩头，呼吸温软缠绵：“夫君且凝神，清歌以本命琴魂助你铸就无暇道基……”纯粹无比的元阴灵力瞬间贯通周天！',
      '【高山流水·大道共鸣】焦尾古琴无风自动，发出嗡鸣仙音护住洞府。慕清歌眸含秋水，与你十指紧扣直至天明，修为与神识双双迎来蜕变！',
    ],
    proactiveVisitEvents: [
      {
        title: '【琴仙夜访】月下洞府的清心曲',
        description: '月华如练，洞府外忽然响起空灵婉转的七弦琴音。慕清歌抱琴立于竹影之下，柔声道：“感应到你近日突破在即、气机略显浮躁，特来为你抚琴一曲镇压心魔。”',
        choices: [
          {
            text: '迎她入府，握着她的手共抚七弦琴（好感大增+修为）',
            reply: '四手同抚一琴，慕清歌耳尖通红，琴音化作实质灵雨滋润你的丹田！',
            affectionDelta: 18,
            emotion: 'shy',
            expDelta: 160,
          },
          {
            text: '借琴音砥砺剑意，与她切磋音剑合击之术',
            reply: '慕清歌欣然应允，七道音刃化作流光与你过招，令你攻防技艺大进！',
            affectionDelta: 14,
            emotion: 'smile',
            expDelta: 140,
            triggerSpar: true,
          },
        ],
      },
    ],
    exclusiveEventIds: [],
  },
  {
    id: 'ao_shuanghua',
    name: '敖霜华',
    title: '北冥龙宫 · 玄冰龙女',
    sect: '北冥龙宫',
    styleTag: '傲娇龙女',
    personalityTags: ['皇族傲骨', '嘴硬心软', '战力狂暴'],
    themeColor: '#38bdf8',
    accentColor: '#0284c7',
    emblemType: 'sword',
    bio: '身负上古冰夷真龙血脉的北冥小公主，额生晶莹龙角，脾气高傲火爆，却偏偏对你百般护短，谁敢欺负你她第一个掀翻对方山门。',
    resonanceSkillId: 'mystic_ice_shield',
    favoriteGifts: ['cold_jade_tassel', 'crimson_ganoderma'],
    dialogues: {
      stranger: [
        '“喂，人族小修士！看什么看，没见过真龙血脉本公主吗？”',
        '“本公主乃北冥之主，岂会看上你们人族这些粗浅法器！”',
      ],
      acquainted: [
        '“哼，这枚龙鳞只是本公主褪换下来的废品，赏你当护身符，可别弄丢了！”',
        '“听说你在外边被人暗算了？报上名来，本公主这就去冻平他的洞府！”',
      ],
      infatuated: [
        '“笨蛋！谁、谁担心你了？我只是恰好路过此地巡视领地而已！”',
        '“龙族一生只认一位伴侣……你若敢辜负本公主，我把你冻在万年玄冰里天天看着！”',
      ],
      soulmate: [
        '“吾以北冥真龙逆鳞起誓，与君共享万年龙元，同生共死，永世不渝！”',
        '“有本公主为你护道，这天底下无论是仙是魔，都休想伤你一根寒毛！”',
      ],
    },
    emotionDialogues: {
      normal: '“今日要去哪处秘境大闹一场？本公主陪你！”',
      smile: '“哼哼，算你识相，知道本公主最爱这件宝贝！”',
      shy: '“别、别碰我的龙角！那里最敏感了，你这登徒子……”',
      angry: '“好哇！背着本公主去幽会别的女修？看我不一记龙息冻住你！”',
      injured: '“区区小伤，龙族体魄顷刻便能复原，不许小瞧我！”',
      blackened: '“把你锁在北冥深海的玄冰水晶宫里，你就再也不会看别人一眼了吧？”',
    },
    chatOptions: [
      {
        id: 'ao_chat_horn',
        label: '伸手轻轻摸了摸她额头晶莹的冰晶龙角（需好感 ≥ 35）',
        minAffection: 35,
        replyText: '敖霜华浑身一软，险些跌进你怀里，满脸羞红地龇牙道：“你、你找死啊！龙族的角只有道侣才能碰……再摸一下也不是不行！”',
        failReplyText: '“大胆人族，竟敢摸本公主的龙角！”一道寒霜直接将你的手冻成了冰块！',
        affectionDelta: 18,
        emotion: 'shy',
        expBonus: 110,
      },
      {
        id: 'ao_chat_spar',
        label: '邀她比拼纯粹肉身与真元力量（检定：攻击 ≥ 35）',
        checkStat: 'atk',
        checkThreshold: 35,
        replyText: '轰然对掌之后，敖霜华眼睛发亮：“痛快！没想到你这人族体魄竟不输我龙族，本公主认可你了！”',
        failReplyText: '敖霜华得意地叉腰大笑：“哈哈，还差得远呢！不过看在你这么拼命的份上，本公主指点你两招！”',
        affectionDelta: 14,
        emotion: 'smile',
        atkBonus: 5,
        expBonus: 90,
      },
      {
        id: 'ao_chat_treasure',
        label: '夸赞北冥龙宫富甲天下，向小富婆讨要一点零花灵丹',
        replyText: '“哼，算你有眼光！本公主最不缺的就是天材地宝，这瓶破障灵丹赏你了！”',
        affectionDelta: 12,
        emotion: 'smile',
        itemRewardId: 'barrier_break_pill',
      },
    ],
    dualCultivationScenes: [
      '【北冥龙殿·真龙逆鳞】万丈深海的玄冰水晶宫内，敖霜华羞恼地咬着唇角，主动引导你的手掌按在她心口最柔软的真龙逆鳞之上。刹那间苍蓝龙吟响彻九霄，霸道绝伦的太古真龙本源涌入你的经脉，令你的肉身强度与修为原地腾飞！',
      '【玄冰玉床·龙元淬体】平日里不可一世的龙族小公主此刻双眸蒙上一层水雾，额前晶莹龙角泛起迷人的粉霞。随着龙人同契大阵运转，万年玄冰龙元与你的丹田真火水乳交融，修为暴涨的同时更铸就了坚不可摧的龙鳞护体！',
      '【九天云海·腾龙双修】敖霜华携你直入云端雷海，在漫天冰晶与霞光中与你紧密相拥：“笨蛋，抓紧本公主了！今日我便分你百年龙寿与皇族气运！”浩瀚灵机醍醐灌顶！',
      '【寒渊秘境·血脉共鸣】冰泉翻涌之间，敖霜华轻喘着伏在你肩头，尾巴般缠人的龙气将你牢牢锁住，真龙精血反哺之下，你的气血上限与修为大幅飙升！',
    ],
    proactiveVisitEvents: [
      {
        title: '【龙女踢馆】敖霜华的傲娇投喂',
        description: '一道苍蓝流光轰然落在你的洞府院中，敖霜华双手抱胸、昂着下巴扔过来一只沉甸甸的螺匣：“喂！本公主刚去海外秘境抄了一窝千年海妖，顺手捡的破烂吃不完，便宜你了！”',
        choices: [
          {
            text: '笑着揉乱她的长发，夸她是天底下最护短的小龙女',
            reply: '敖霜华小脸爆红，结结巴巴地跺脚：“谁、谁护着你了！快把东西收好！”匣中竟有一枚珍贵丹药！',
            affectionDelta: 18,
            emotion: 'shy',
            expDelta: 150,
            itemGainId: 'barrier_break_pill',
          },
          {
            text: '邀她当场痛快打上一架，检验近期修行成果',
            reply: '“来就来，谁怕谁！输了的人今天负责烤灵鱼！”',
            affectionDelta: 15,
            emotion: 'smile',
            expDelta: 140,
            triggerSpar: true,
          },
        ],
      },
    ],
    exclusiveEventIds: [],
  },
  {
    id: 'su_xinghe',
    name: '苏星河',
    title: '钦天监 · 星卜天女',
    sect: '钦天观星台',
    styleTag: '神秘星修',
    personalityTags: ['洞悉天机', '古灵精怪', '宿命羁绊'],
    themeColor: '#facc15',
    accentColor: '#eab308',
    emblemType: 'cauldron',
    bio: '常年坐在浑天星盘上推演大世气运的少女天师，眸中似有星河旋转。她早在三年前便卦算到你是她命中的“破局之人”。',
    resonanceSkillId: 'ten_thousand_swords',
    favoriteGifts: ['jade_slip', 'hehuan_sachet'],
    dialogues: {
      stranger: [
        '“咦？你的命盘竟是一片混沌迷雾，连我的紫微星盘也算不透呢~”',
        '“天机不可泄露，不过若是道友请我吃一壶灵果酒，倒可以偷偷告诉你一卦。”',
      ],
      acquainted: [
        '“我昨夜夜观天象，算出你今日必会来找我，看，茶都已经替你温好啦！”',
        '“你的桃花劫可重得很呢，要不要本天师替你画一道斩桃花符呀？”',
      ],
      infatuated: [
        '“占卜一道最忌将自身算入卦中……可不知从何时起，我的每一卦里都有你的影子。”',
        '“哪怕窥破天机要折损寿元，我也想替你算尽前路吉凶，护你一世周全。”',
      ],
      soulmate: [
        '“星河倒转，宿命归真。原来我苦苦推演百年的无上大道，自始至终就是你。”',
        '“诸天星斗听令，以此身气运尽数加持吾夫，助他踏破仙门！”',
      ],
    },
    emotionDialogues: {
      normal: '“今日卦象大吉，宜闭关，宜访友，更宜见我~”',
      smile: '“我就算出你会带礼物来，果然分毫不差！”',
      shy: '“哎呀，这一卦怎么算到了红鸾星动……不准看我的星盘！”',
      angry: '“本天师掐指一算，你刚刚是不是又去见那位合欢宗姐姐了？从实招来！”',
      injured: '“咳……强行逆转天机遭了点反噬，只要靠在你身边歇会儿就好。”',
      blackened: '“既然天道要夺走你，那我便篡改这周天星轨，将你我的命魂死死绑在一起。”',
    },
    chatOptions: [
      {
        id: 'su_chat_divine',
        label: '请她为你卜算下一重境界突破的吉凶命数（检定：气运 ≥ 18）',
        checkStat: 'luck',
        checkThreshold: 18,
        replyText: '苏星河指尖拨动紫微星盘，眸中星光大盛：“紫气东来，命星高照！我再借你一缕星辰气运，助你下次冲关顺遂！”',
        failReplyText: '苏星河吐了吐舌头：“卦象云遮雾绕，不过有本天师替你改运，定能逢凶化吉！”',
        affectionDelta: 15,
        emotion: 'smile',
        expBonus: 100,
        senseBonus: 4,
      },
      {
        id: 'su_chat_tease',
        label: '突然抽走她手中的星筹：“算尽天下，那你可算出我此刻想亲你？”',
        replyText: '苏星河怔在原地，白皙小脸瞬间染上胭脂色，捂着乱跳的心口嗔道：“你、你不按卦象出牌！犯规啦！”',
        affectionDelta: 18,
        emotion: 'shy',
        expBonus: 90,
      },
      {
        id: 'su_chat_star',
        label: '共登观星高台，引周天星力淬炼经脉',
        replyText: '星辉如瀑垂落，苏星河与你并肩而坐，教你如何接引北极帝星之力入体！',
        affectionDelta: 14,
        emotion: 'normal',
        expBonus: 115,
      },
    ],
    dualCultivationScenes: [
      '【钦天星台·周天星斗】万丈高空之上的浑天星盘缓缓运转，苏星河一袭星纱长裙在夜风中散开，眸中倒映着漫天银河与你的身影。当两人神魂相拥，三百六十五颗主星同时降下璀璨星辉，将你的修为与天道气运推向巅峰！',
      '【紫微命宫·宿命交织】苏星河纤手结印，以自身天命卦象与你的气海相连，声音轻颤而虔诚：“三生石上早已写下今日之果，星河愿以一身天机修为，换夫君仙途永昌！”磅礴星元轰然灌顶！',
      '【银河幻境·灵犀一点】在星盘演化出的无垠星海幻境中，苏星河羞怯地褪去天师威仪，与你眉心相贴、呼吸相闻。每一次阴阳流转都引动星辰共鸣，令你的神识与破境感悟成倍增长！',
      '【逆转天机·双星伴月】命盘之上红鸾星大放光明，苏星河紧紧抱住你的后背，将钦天监秘传的《周天星宿造化诀》与你倾囊共修，修为暴涨！',
    ],
    proactiveVisitEvents: [
      {
        title: '【天女夜算】苏星河的改命星符',
        description: '夜空一颗流星划落你的小院，苏星河骑着星光凝成的仙鹤翩然降落，神秘兮兮地晃了晃手中的金签：“本天师夜观星象，算出你近期有一桩大机缘，特地连夜赶来给你送改命星符啦！”',
        choices: [
          {
            text: '将她从仙鹤上抱下来，在院中石桌旁共赏星河',
            reply: '苏星河乖巧地靠在你肩头数星星，悄悄将一枚蕴含星力的灵丹塞进你手心。',
            affectionDelta: 18,
            emotion: 'shy',
            expDelta: 150,
            itemGainId: 'heart_guard_pill',
          },
          {
            text: '请她布下星宿剑阵，与你演练破阵杀伐之术',
            reply: '“好呀，那你可要小心我的星辰落雷哦！”一番切磋后你神识与战力大进！',
            affectionDelta: 14,
            emotion: 'smile',
            expDelta: 140,
            triggerSpar: true,
          },
        ],
      },
    ],
    exclusiveEventIds: [],
  },
];

export const SKILL_PREFIXES = [
  { name: '太虚·', mult: 0.28, crit: 0.1, swordIntent: 2, tag: '剑意叠加' },
  { name: '弑神·', mult: 0.48, crit: 0.14, pierce: 0.35, tag: '破甲绝杀' },
  { name: '噬血·', mult: 0.25, lifesteal: 0.3, berserk: true, tag: '残血狂暴' },
  { name: '九霄·', mult: 0.4, crit: 0.1, stun: 0.45, pierce: 0.3, tag: '雷劫麻痹' },
  { name: '玄冥·', mult: 0.18, shield: 0.32, stun: 0.3, tag: '玄冰封禁' },
  { name: '万毒·', mult: 0.22, poison: 4, detonate: true, tag: '剧毒引爆' },
  { name: '阴阳·', mult: 0.26, heal: 0.2, lifesteal: 0.18, tag: '阴阳回春' },
  { name: '逆命·', mult: 0.55, selfCost: 0.1, hits: 3, tag: '三连搏命' },
];

export const SKILL_SUFFIXES = [
  { name: '斩仙剑典', category: 'sword' as SkillCategory, baseMp: 22, cd: 2 },
  { name: '紫电神雷引', category: 'thunder' as SkillCategory, baseMp: 28, cd: 2 },
  { name: '化血冥功', category: 'blood' as SkillCategory, baseMp: 18, cd: 2 },
  { name: '百草厄难经', category: 'alchemy' as SkillCategory, baseMp: 20, cd: 2 },
  { name: '天狐合欢赋', category: 'yin_yang' as SkillCategory, baseMp: 24, cd: 2 },
  { name: '不动明王印', category: 'defense' as SkillCategory, baseMp: 20, cd: 2 },
];

export function generateProceduralSkill(
  customName: string,
  preferredCategory: SkillCategory,
  playerSense: number
): SkillTag {
  const pre = SKILL_PREFIXES[Math.floor(Math.random() * SKILL_PREFIXES.length)];
  const suf =
    SKILL_SUFFIXES.find((s) => s.category === preferredCategory) ??
    SKILL_SUFFIXES[Math.floor(Math.random() * SKILL_SUFFIXES.length)];

  const senseFactor = Math.min(0.85, playerSense * 0.006);
  const damageMult = Number((1.45 + pre.mult + senseFactor).toFixed(2));
  const rarity =
    damageMult >= 2.25 ? '天阶' : damageMult >= 1.85 ? '地阶' : '玄阶';

  const finalName = customName.trim() || `${pre.name}${suf.name}`;
  const effects: string[] = [`造成 ${damageMult}x 伤害`];
  if (pre.hits) effects.push(`${pre.hits}段连击`);
  if (pre.pierce) effects.push(`无视${Math.round(pre.pierce * 100)}%防御`);
  if (pre.stun) effects.push(`${Math.round(pre.stun * 100)}%概率麻痹敌方`);
  if (pre.swordIntent) effects.push(`凝聚${pre.swordIntent}层剑意`);
  if (pre.detonate) effects.push(`满5层引爆丹毒`);
  if (pre.crit) effects.push(`暴击+${Math.round(pre.crit * 100)}%`);
  if (pre.lifesteal) effects.push(`吸血${Math.round(pre.lifesteal * 100)}%`);
  if (pre.shield) effects.push(`护盾${Math.round(pre.shield * 100)}%`);
  if (pre.poison) effects.push(`叠毒${pre.poison}层`);
  if (pre.heal) effects.push(`回血${Math.round(pre.heal * 100)}%`);

  return {
    id: `custom_skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: finalName,
    category: preferredCategory,
    rarity,
    level: 1,
    description: `【自创神通·${pre.tag}】${effects.join('，')}；被动攻击 +8%、修炼速度 +6%。`,
    mpCost: suf.baseMp,
    cooldown: suf.cd,
    damageMult,
    hitCount: pre.hits,
    armorPiercePct: pre.pierce,
    stunChance: pre.stun,
    swordIntentGain: pre.swordIntent,
    detonatePoison: pre.detonate,
    lowHpBerserk: pre.berserk,
    critBonus: pre.crit,
    lifestealPct: pre.lifesteal,
    shieldPct: pre.shield,
    poisonStacks: pre.poison,
    healPct: pre.heal,
    selfHpCostPct: pre.selfCost,
    passiveBonus: {
      atkPct: 0.08,
      cultivationMult: 0.06,
    },
  };
}

export function fuseTwoSkills(skillA: SkillTag, skillB: SkillTag): SkillTag {
  const fusedMult = Number(
    (Math.max(skillA.damageMult, skillB.damageMult) * 1.24).toFixed(2)
  );
  const fusedName = `${skillA.name.slice(0, 2)}·${skillB.name.slice(-3)}真解`;
  return {
    id: `fused_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: fusedName,
    category: skillA.category,
    rarity: '仙阶',
    level: 1,
    description: `【万法融合·仙阶绝学】由【${skillA.name}】与【${skillB.name}】融会贯通！造成 ${fusedMult}x 伤害，兼具双方神通法则（破甲/连击/麻痹/毒爆/剑意），被动攻击 +16%、防御 +12%。`,
    mpCost: Math.round((skillA.mpCost + skillB.mpCost) * 0.65),
    cooldown: Math.max(skillA.cooldown, skillB.cooldown, 2),
    damageMult: fusedMult,
    hitCount: Math.max(skillA.hitCount ?? 1, skillB.hitCount ?? 1),
    armorPiercePct: Math.max(skillA.armorPiercePct ?? 0, skillB.armorPiercePct ?? 0, 0.25),
    stunChance: Math.max(skillA.stunChance ?? 0, skillB.stunChance ?? 0),
    swordIntentGain: (skillA.swordIntentGain ?? 0) + (skillB.swordIntentGain ?? 0),
    consumeSwordIntent: skillA.consumeSwordIntent || skillB.consumeSwordIntent,
    detonatePoison: skillA.detonatePoison || skillB.detonatePoison,
    lowHpBerserk: skillA.lowHpBerserk || skillB.lowHpBerserk,
    critBonus: Math.max(skillA.critBonus ?? 0, skillB.critBonus ?? 0) + 0.1,
    lifestealPct: Math.max(skillA.lifestealPct ?? 0, skillB.lifestealPct ?? 0),
    shieldPct: Math.max(skillA.shieldPct ?? 0, skillB.shieldPct ?? 0),
    poisonStacks: (skillA.poisonStacks ?? 0) + (skillB.poisonStacks ?? 0),
    healPct: Math.max(skillA.healPct ?? 0, skillB.healPct ?? 0),
    passiveBonus: {
      atkPct: 0.16,
      defPct: 0.12,
      cultivationMult: 0.12,
    },
  };
}
