import { GameEvent } from '../types/game';

export const EVENTS: GameEvent[] = [
  // 1. 秘境夺宝 x3
  {
    id: 'evt_secret_sword_tomb',
    regionId: 'qingming_wild',
    title: '古修剑冢现世',
    category: 'secret_realm',
    description: '青冥山脉深处忽然剑鸣阵阵，一座尘封千年的剑修洞府破开禁制，残破剑阵中隐约可见一卷青色玉简与数枚灵石。',
    choices: [
      {
        id: 'sense_break',
        text: '以神识推演剑阵生门，强行取宝（检定：神识 ≥ 22）',
        check: { stat: 'sense', threshold: 22, label: '神识 ≥ 22' },
        successOutcome: {
          text: '你神识如丝般精准避开七处杀阵节点，稳稳摄出记载着万剑归宗终式的玉简与一袋灵石！',
          expDelta: 90,
          spiritStonesDelta: 85,
          skillGainId: 'ten_thousand_swords',
        },
        failOutcome: {
          text: '剑阵杀机骤起，你仓促退避仍被一道余波剑气划伤肩胛，只捡回少许灵石。',
          hpDelta: -65,
          injuryDelta: 12,
          spiritStonesDelta: 25,
        },
      },
      {
        id: 'observe_cautiously',
        text: '在外围拾取散落灵气晶石，不贪图阵眼之物',
        successOutcome: {
          text: '虽未入核心剑阵，你却在外围石壁上参悟了几道古剑痕，心境颇有精进。',
          expDelta: 55,
          spiritStonesDelta: 40,
        },
      },
    ],
  },
  {
    id: 'evt_secret_flame_lotus',
    regionId: 'yaowang_valley',
    title: '地火熔池红莲',
    category: 'secret_realm',
    minRealmIndex: 3,
    description: '地底熔岩翻涌之处，一株百年火属性灵药正值成熟，然而一头赤焰魔蟒正盘踞池畔吐信守护。',
    choices: [
      {
        id: 'slay_python',
        text: '祭出法器正面斩妖夺莲（触发战斗：赤焰魔蟒）',
        successOutcome: {
          text: '你长啸一声，真元鼓荡，迎向那头凶焰滔天的赤焰魔蟒！',
          triggerBattleEnemyId: 'flame_python',
        },
      },
      {
        id: 'steal_with_luck',
        text: '趁魔蟒打盹，隐匿气息偷摘莲子（检定：气运 ≥ 20）',
        check: { stat: 'luck', threshold: 20, label: '气运 ≥ 20' },
        successOutcome: {
          text: '天运加身！恰好一阵地火喷发遮蔽了你的身形，你顺手摘得两枚赤血灵芝飘然远遁。',
          itemGainId: 'crimson_ganoderma',
          expDelta: 75,
        },
        failOutcome: {
          text: '脚下碎石滚落惊动魔蟒，被它一记火息擦中后背，狼狈逃窜。',
          hpDelta: -110,
          injuryDelta: 18,
        },
      },
    ],
  },
  {
    id: 'evt_secret_golem_hall',
    regionId: 'zixiao_thunder',
    title: '上古机关藏宝殿',
    category: 'secret_realm',
    minRealmIndex: 5,
    description: '密殿穹顶镶嵌着星辰夜明珠，中央石台上静静放着一尊九转药匣，但殿角两尊青铜傀儡双目骤然亮起红光！',
    choices: [
      {
        id: 'fight_golem',
        text: '迎战古修镇殿傀儡（触发战斗）',
        successOutcome: {
          text: '傀儡轰然迈步，青石地板寸寸龟裂，大战一触即发！',
          triggerBattleEnemyId: 'realm_golem',
        },
      },
      {
        id: 'use_sense_bypass',
        text: '以神识干扰傀儡核心阵纹（检定：神识 ≥ 42）',
        check: { stat: 'sense', threshold: 42, label: '神识 ≥ 42' },
        successOutcome: {
          text: '你精准切断灵石供能回路，傀儡僵立当场，轻松取走殿内秘宝与洗髓丹！',
          itemGainId: 'marrow_wash_pill',
          spiritStonesDelta: 160,
          expDelta: 140,
        },
        failOutcome: {
          text: '神识反被机关阵纹震伤，被迫退出藏宝殿。',
          hpDelta: -95,
          mpDelta: -40,
          injuryDelta: 15,
        },
      },
    ],
  },

  // 2. 坊市捡漏 x3
  {
    id: 'evt_market_rusty_sword',
    regionId: 'heishan_market',
    title: '鬼市地摊的锈铁片',
    category: 'market',
    description: '夜色下的青石坊市人声鼎沸，一个邋遢老修摊位角落摆着半截生锈断剑，标价仅 30 灵石，隐约透出一丝极淡的锋锐气息。',
    choices: [
      {
        id: 'swordshop_read_temper',
        requiredOrigin: 'swordshop',
        text: '借摊边的灯看剑脊上的回火纹',
        successOutcome: { text: '剑坊师傅教过你这道纹。你顺着断口比划复原了剑式，谢过摊主才把剑放回原处。', expDelta: 45, atkDelta: 1 },
      },
      {
        id: 'inspect_with_sense',
        text: '凝神探查其中玄机（检定：神识 ≥ 18）',
        check: { stat: 'sense', threshold: 18, label: '神识 ≥ 18' },
        successOutcome: {
          text: '你拂去铁锈，竟发现剑脊暗藏一式高阶剑意拓印，当即买下参悟！',
          spiritStonesDelta: -30,
          atkDelta: 6,
          expDelta: 80,
          skillGainId: 'ten_thousand_swords',
        },
        failOutcome: {
          text: '买下后反复参详，却只是一块染了妖兽血的普通凡铁，白白花去 30 灵石。',
          spiritStonesDelta: -30,
        },
      },
      {
        id: 'bargain_and_buy',
        text: '直接讲价买下顺便淘几枚聚气丹',
        successOutcome: {
          text: '老修见你爽快，不仅便宜卖了断剑，还搭赠了一枚聚气丹。',
          spiritStonesDelta: -20,
          itemGainId: 'qi_gathering_pill',
        },
      },
    ],
  },
  {
    id: 'evt_market_auction_gift',
    regionId: 'heishan_market',
    title: '珍宝阁流拍奇物',
    category: 'market',
    description: '坊市珍宝阁正在清理无人竞拍的杂物箱，里面有一枚寒玉剑穗与一具合欢香囊，掌柜开价 100 灵石打包出售。',
    choices: [
      {
        id: 'ledger_trace_bids',
        requiredOrigin: 'ledger',
        text: '翻一翻流拍单，对照前三笔叫价',
        successOutcome: { text: '三笔叫价的尾数一模一样，连笔迹也相同。你合上账页，把灵石收回袋里，记住了这家铺子的印记。', senseDelta: 1, expDelta: 20 },
      },
      {
        id: 'buy_cold_jade',
        text: '花费 90 灵石单购寒玉剑穗（赠予沈清秋极佳）',
        successOutcome: {
          text: '玉穗入手冰凉澄澈，正是剑修最喜之物。',
          spiritStonesDelta: -90,
          itemGainId: 'cold_jade_tassel',
        },
      },
      {
        id: 'buy_sachet',
        text: '花费 90 灵石单购合欢香囊（赠予夜琉璃极佳）',
        successOutcome: {
          text: '香囊幽香袅袅，透着一股令人心神摇曳的魔道奇韵。',
          spiritStonesDelta: -90,
          itemGainId: 'hehuan_sachet',
        },
      },
      {
        id: 'gamble_luck',
        text: '凭气运顺手摸走角落的蒙尘丹瓶（检定：气运 ≥ 22）',
        check: { stat: 'luck', threshold: 22, label: '气运 ≥ 22' },
        successOutcome: {
          text: '掌柜只当是废丹随手十灵石卖你，归来擦净竟是一枚货真价实的筑基丹！',
          spiritStonesDelta: -10,
          itemGainId: 'foundation_pill',
        },
        failOutcome: {
          text: '买回家打开一看，果然是一瓶早已失效的焦糊废丹渣。',
          spiritStonesDelta: -10,
        },
      },
    ],
  },
  {
    id: 'evt_market_rogue_ambush',
    regionId: 'heishan_market',
    title: '坊市外黑松林劫道',
    category: 'market',
    description: '刚出坊市十里，两名蒙面散修便从暗处祭出飞刀拦路：“道友收获颇丰，不如留下储物袋买命！”',
    choices: [
      {
        id: 'fight_rogue',
        text: '冷笑拔剑：“区区劫修，也敢拦路！”（触发战斗：黑煞散修）',
        successOutcome: {
          text: '你灵力暴起，直接迎战黑煞散修！',
          triggerBattleEnemyId: 'rogue_cultivator',
        },
      },
      {
        id: 'intimidate_charm',
        text: '释放威压与气度震慑对方（检定：攻击 ≥ 45）',
        check: { stat: 'atk', threshold: 45, label: '攻击 ≥ 45' },
        successOutcome: {
          text: '你周身杀伐剑意如渊似岳，黑煞散修吓得脸色煞白，扔下 50 灵石赔罪逃窜！',
          spiritStonesDelta: 50,
          expDelta: 45,
        },
        failOutcome: {
          text: '对方看穿你外强中干，掷出毒镖将你击伤并抢走 40 灵石。',
          hpDelta: -60,
          spiritStonesDelta: -40,
          injuryDelta: 10,
        },
      },
    ],
  },

  // 3. 同门暗算 x3
  {
    id: 'evt_intrigue_poison_tea',
    regionId: 'taixu_peak',
    title: '师兄的“贺礼灵茶”',
    category: 'sect_intrigue',
    description: '素来与你不睦的内门弟子赵无极笑吟吟端来一盏灵茶：“师弟近日进境神速，这杯碧螺春乃是我特地为你泡的。”',
    choices: [
      {
        id: 'clinic_recognize_tea',
        requiredOrigin: 'clinic',
        text: '借着闻茶香，辨一辨那股熟悉的药味',
        successOutcome: { text: '小时候替药庐翻晒过的苦草，就是这个味道。你把茶留在桌上，另倒了一杯清水。', senseDelta: 1, expDelta: 15 },
      },
      {
        id: 'detect_poison',
        text: '暗运神识察觉茶汤异样（检定：神识 ≥ 20）',
        check: { stat: 'sense', threshold: 20, label: '神识 ≥ 20' },
        successOutcome: {
          text: '你敏锐嗅出茶底混有散功散，假意失手将茶泼在他衣袍上，反敲诈了他一笔封口灵石！',
          spiritStonesDelta: 65,
          senseDelta: 3,
        },
        failOutcome: {
          text: '你未曾防备一饮而尽，当晚丹田剧痛，修为倒退且添了内伤。',
          expDelta: -45,
          hpDelta: -70,
          injuryDelta: 16,
        },
      },
      {
        id: 'decline_coldly',
        text: '冷声谢绝：“修炼在即，不敢贪口腹之欲。”',
        successOutcome: {
          text: '赵无极讪讪退去，你保全了自身，静心吐纳半月。',
          expDelta: 40,
        },
      },
    ],
  },
  {
    id: 'evt_intrigue_mission_sabotage',
    regionId: 'taixu_peak',
    title: '宗门任务暗箭难防',
    category: 'sect_intrigue',
    description: '执行巡山清剿任务时，原本该策应你的同门突然撤走阵旗，将你独自困在一群嗜血妖狼的包围圈中！',
    choices: [
      {
        id: 'slay_wolves',
        text: '杀出重围！（触发战斗：嗜血妖狼）',
        successOutcome: {
          text: '你眼中寒芒毕露，反手一剑斩向扑来的妖狼！',
          triggerBattleEnemyId: 'blood_wolf',
        },
      },
      {
        id: 'defend_and_escape',
        text: '催动护体灵罡硬抗围攻突围（检定：防御 ≥ 24）',
        check: { stat: 'def', threshold: 24, label: '防御 ≥ 24' },
        successOutcome: {
          text: '你浑身金光大放，硬生生顶着狼爪突围而出，回去后将那暗算同门告上执法堂获赏 80 灵石！',
          spiritStonesDelta: 80,
          defDelta: 3,
        },
        failOutcome: {
          text: '护盾被妖狼撕裂，勉强逃回宗门，气血大损。',
          hpDelta: -85,
          injuryDelta: 15,
        },
      },
    ],
  },
  {
    id: 'evt_intrigue_puppet_spy',
    regionId: 'taixu_peak',
    title: '山门外魔宗暗桩',
    category: 'sect_intrigue',
    minRealmIndex: 4,
    description: '深夜巡查灵脉时，你撞见一名身披黑袍的阴傀宗执事正在篡改护山大阵灵石！',
    choices: [
      {
        id: 'battle_deacon',
        text: '当场拦截斩妖除魔（触发战斗：阴傀宗执事）',
        successOutcome: {
          text: '“魔道贼子，休走！”你挺身拦住去路。',
          triggerBattleEnemyId: 'puppet_deacon',
        },
      },
      {
        id: 'report_stealthily',
        text: '暗中记下阵法破绽，悄然禀报宗门长老',
        successOutcome: {
          text: '长老及时布下天罗地网擒获暗桩，赐你一枚护心丹与五十灵石嘉奖。',
          itemGainId: 'heart_guard_pill',
          spiritStonesDelta: 50,
        },
      },
    ],
  },

  // 4. 女修修罗场 x3
  {
    id: 'evt_shura_sword_demon',
    title: '修罗场 · 剑影与绯月',
    requiredPartners: ['shen_qingqiu', 'ye_liuli'],
    category: 'shura_field',
    description: '你刚从太虚剑宗议事归来，迎面却见夜琉璃正巧笑嫣然地替你整理衣领——而十丈之外，手握长剑的沈清秋正冷冷注视着这一幕，周身寒霜凝结！',
    choices: [
      {
        id: 'soothe_both',
        text: '从容周旋，以绝佳气度化解剑拔弩张（检定：魅力 ≥ 24）',
        check: { stat: 'charm', threshold: 24, label: '魅力 ≥ 24' },
        successOutcome: {
          text: '你温声安抚清秋并巧妙点破琉璃的试探，二女虽仍互不相让，却齐齐被你的从容折服！',
          characterAffection: { charId: 'shen_qingqiu', delta: 12, emotion: 'shy' },
          charmDelta: 4,
          expDelta: 65,
        },
        failOutcome: {
          text: '你越描越黑，沈清秋冷哼转身离去，夜琉璃则似笑非笑地咬了你一口。',
          characterAffection: { charId: 'shen_qingqiu', delta: -12, emotion: 'angry' },
          hpDelta: -30,
        },
      },
      {
        id: 'stand_by_shen',
        text: '立刻退开半步向沈清秋行礼：“师姐莫误会，我与魔宗并无瓜葛。”',
        successOutcome: {
          text: '沈清秋眉梢微舒，神色缓和；夜琉璃却冷笑一声，眼神危险地眯了起来。',
          characterAffection: { charId: 'shen_qingqiu', delta: 16, emotion: 'smile' },
        },
      },
      {
        id: 'hold_ye',
        text: '反手揽住夜琉璃腰肢：“圣女万里来访，自当以礼相待。”',
        successOutcome: {
          text: '夜琉璃掩唇娇笑，眼波流转；远处剑气骤然劈断一株古松！',
          characterAffection: { charId: 'ye_liuli', delta: 18, emotion: 'smile' },
        },
      },
    ],
  },
  {
    id: 'evt_shura_elixir_scent',
    title: '修罗场 · 药庐里的脂粉香',
    requiredPartners: ['lin_waner', 'ye_liuli'],
    category: 'shura_field',
    description: '林婉儿正端着亲手熬制的补气汤走近你，鼻尖忽然微微一动：“咦？师兄袖口这股合欢花的冷香……是从哪位仙子身上沾来的？”她笑容越发温柔，手里却悄悄多了一把银针。',
    choices: [
      {
        id: 'explain_smoothly',
        text: '坦诚方才路遇伏击才沾染魔香（检定：神识 ≥ 25）',
        check: { stat: 'sense', threshold: 25, label: '神识 ≥ 25' },
        successOutcome: {
          text: '林婉儿细查你脉象确有打斗暗伤，立刻收起银针心疼地替你敷药。',
          characterAffection: { charId: 'lin_waner', delta: 15, emotion: 'shy' },
          hpDelta: 80,
          injuryDelta: -10,
        },
        failOutcome: {
          text: '林婉儿笑眯眯地递来一碗苦得发黑的“特制十全大补汤”，喝完你腹痛了整整三天……',
          characterAffection: { charId: 'lin_waner', delta: -8, emotion: 'angry' },
          hpDelta: -55,
        },
      },
      {
        id: 'praise_waner',
        text: '接过药碗一饮而尽：“再香也不及婉儿你炼的灵药清甜。”',
        successOutcome: {
          text: '林婉儿脸颊微红，嗔怪地白了你一眼，却还是悄悄往你怀里塞了两枚聚气丹。',
          characterAffection: { charId: 'lin_waner', delta: 14, emotion: 'shy' },
          itemGainId: 'qi_gathering_pill',
        },
      },
    ],
  },
  {
    id: 'evt_shura_moonlight_duel',
    title: '双姝夜访洞府',
    requiredPartners: ['shen_qingqiu', 'ye_liuli'],
    category: 'shura_field',
    description: '月圆之夜，沈清秋送来一柄寒玉剑穗，恰逢夜琉璃翻窗而入递上合欢香囊，三人齐聚狭小洞府，空气瞬间凝结！',
    choices: [
      {
        id: 'accept_both_gracefully',
        text: '“两位仙子厚爱，在下愧领，愿共论大道。”（检定：魅力 ≥ 28）',
        check: { stat: 'charm', threshold: 28, label: '魅力 ≥ 28' },
        successOutcome: {
          text: '你以深厚道心与翩翩风度谈吐不凡，竟让二女难得坐下共饮一壶灵茶，双双好感大增！',
          characterAffection: { charId: 'ye_liuli', delta: 15, emotion: 'shy' },
          expDelta: 110,
          charmDelta: 5,
        },
        failOutcome: {
          text: '二女一言不合在洞府外动起手来，剑气与魔焰掀翻了你的屋顶……',
          hpDelta: -75,
          spiritStonesDelta: -40,
        },
      },
      {
        id: 'meditate_escape',
        text: '“突感瓶颈松动，需立刻闭关！”借机遁入密室',
        successOutcome: {
          text: '你果断开启护府阵法躲过一劫，顺带还真吐纳出了一丝灵气。',
          expDelta: 45,
        },
      },
    ],
  },

  // 5. 心魔劫 x3
  {
    id: 'evt_demon_past_regret',
    title: '心魔劫 · 幻境故人',
    category: 'inner_demon',
    description: '闭关吐纳之际，识海忽然泛起黑雾，一道与你一模一样的暗影踏雾而来：“修仙漫漫终成枯骨，何不堕入魔道换取百年逍遥？”',
    choices: [
      {
        id: 'crush_demon',
        text: '道心如铁，正面斩灭心魔！（触发战斗：心魔幻影）',
        successOutcome: {
          text: '你神魂化剑，向识海中的心魔幻影斩去！',
          triggerBattleEnemyId: 'inner_demon_shadow',
        },
      },
      {
        id: 'chant_mantra',
        text: '默诵《太上清静经》守住灵台（检定：神识 ≥ 28）',
        check: { stat: 'sense', threshold: 28, label: '神识 ≥ 28' },
        successOutcome: {
          text: '经声如洪钟大吕震散黑雾，你的神识反倒更加凝练通透！',
          senseDelta: 8,
          expDelta: 120,
        },
        failOutcome: {
          text: '心魔趁虚而入，灵台震荡吐出一口淤血，神识受损。',
          hpDelta: -90,
          injuryDelta: 20,
        },
      },
    ],
  },
  {
    id: 'evt_demon_blood_temptation',
    title: '血海魔典的诱惑',
    category: 'inner_demon',
    description: '你在古修骸骨旁拾得一枚血色玉简，其中记载着损耗寿元换取极致力量的《燃血秘法》，隐约有邪念诱你立刻修习。',
    choices: [
      {
        id: 'learn_blood_art',
        text: '研习血道秘术，掌握《燃血秘法》（折损 2 年寿元）',
        successOutcome: {
          text: '你以指尖精血为引烙印法诀，虽损了两年寿元，却多了一门绝境翻盘的杀招！',
          lifespanDelta: -2,
          skillGainId: 'blood_burn',
          atkDelta: 5,
        },
      },
      {
        id: 'destroy_jade',
        text: '一掌震碎邪玉，护持正道本心',
        successOutcome: {
          text: '玉简化作齑粉，冥冥之中似有天道垂青，你的气运悄然提升。',
          luckDelta: 5,
          expDelta: 65,
        },
      },
    ],
  },
  {
    id: 'evt_demon_lifespan_anxiety',
    title: '枯荣一念间',
    category: 'inner_demon',
    description: '见昔日同门鬓角染霜、寿元将尽而坐化，你忽然对漫漫长生路生出一丝惶恐与执念。',
    choices: [
      {
        id: 'enlighten_dao',
        text: '静坐观花开花落，感悟枯荣大道（检定：神识 ≥ 24）',
        check: { stat: 'sense', threshold: 24, label: '神识 ≥ 24' },
        successOutcome: {
          text: '刹那顿悟！心境豁然开朗，寿元上限竟凭空延展 4 年，修为亦随之暴涨！',
          lifespanDelta: 4,
          expDelta: 140,
        },
        failOutcome: {
          text: '枯坐三日仍难解心中郁结，勉强平复心绪。',
          expDelta: 20,
        },
      },
      {
        id: 'go_training',
        text: '与其空叹岁月，不如挥剑百遍破除迷惘',
        successOutcome: {
          text: '汗水挥洒之间杂念尽去，攻击力稳步提升。',
          atkDelta: 4,
          expDelta: 55,
        },
      },
    ],
  },

  // 6. 仙途奇遇 / 专属互动 x3
  {
    id: 'evt_shen_sword_cliff',
    regionId: 'taixu_peak',
    title: '剑崖论道 · 霜雪初融',
    requiredCharId: 'shen_qingqiu',
    minAffection: 20,
    category: 'encounter',
    description: '大雪纷飞的太虚剑崖之上，沈清秋独自站在悬崖边擦拭佩剑，见你走来，难得开口邀你共参一式剑意。',
    choices: [
      {
        id: 'spar_with_shen',
        text: '拔剑切磋，印证剑道（检定：攻击 ≥ 35）',
        check: { stat: 'atk', threshold: 35, label: '攻击 ≥ 35' },
        successOutcome: {
          text: '双剑交鸣如龙吟！沈清秋唇角微不可察地扬起一抹弧度：“不错，已有几分剑修气象。”',
          characterAffection: { charId: 'shen_qingqiu', delta: 18, emotion: 'smile' },
          atkDelta: 5,
          expDelta: 95,
        },
        failOutcome: {
          text: '三招之内佩剑便被她震落，她虽未责备，却替你指出了七处破绽。',
          characterAffection: { charId: 'shen_qingqiu', delta: 8, emotion: 'normal' },
          expDelta: 60,
        },
      },
      {
        id: 'drape_cloak',
        text: '取出一件灵狐暖裘披在她肩上',
        successOutcome: {
          text: '沈清秋身躯微微一僵，雪白耳尖染上一抹绯红：“……多事。”却并未将披风取下。',
          characterAffection: { charId: 'shen_qingqiu', delta: 16, emotion: 'shy' },
        },
      },
    ],
  },
  {
    id: 'evt_ye_moon_pavilion',
    regionId: 'feiyue_palace',
    title: '绯月阁夜宴',
    requiredCharId: 'ye_liuli',
    minAffection: 35,
    category: 'encounter',
    description: '合欢宗圣女夜琉璃设下灵果夜宴邀你小酌，纱幔轻垂间幽香浮动，她执起玉杯笑盈盈望着你。',
    choices: [
      {
        id: 'drink_with_ye',
        text: '坦然共饮三杯灵酿，与她笑谈风月（检定：魅力 ≥ 20）',
        check: { stat: 'charm', threshold: 20, label: '魅力 ≥ 20' },
        successOutcome: {
          text: '酒过三巡，夜琉璃眼波如水般倚近你肩头：“小冤家，姐姐越来越舍不得放你走了呢~”',
          characterAffection: { charId: 'ye_liuli', delta: 20, emotion: 'shy' },
          mpDelta: 60,
          expDelta: 85,
        },
        failOutcome: {
          text: '你一杯便有些醉意微醺，被她笑着弹了下额头：“酒量这么浅，以后怎么陪姐姐？”',
          characterAffection: { charId: 'ye_liuli', delta: 10, emotion: 'smile' },
          expDelta: 50,
        },
      },
      {
        id: 'ask_for_art',
        text: '借机讨教一二双修吐纳之法',
        successOutcome: {
          text: '夜琉璃咯咯娇笑，指尖在你胸口画了个灵纹：“先欠着，以后慢慢教你。”',
          characterAffection: { charId: 'ye_liuli', delta: 12, emotion: 'smile' },
          expDelta: 70,
        },
      },
    ],
  },
  {
    id: 'evt_lin_elixir_trial',
    regionId: 'yaowang_valley',
    title: '药王谷开炉试丹',
    requiredCharId: 'lin_waner',
    minAffection: 14,
    category: 'encounter',
    description: '林婉儿正在药庐炼制一炉玄阶灵丹，炉火将成之际忽然灵气暴走，她额头渗出细汗向你投来求助的目光。',
    choices: [
      {
        id: 'stabilize_cauldron',
        text: '以神识与灵力稳住丹炉火候（检定：神识 ≥ 22）',
        check: { stat: 'sense', threshold: 22, label: '神识 ≥ 22' },
        successOutcome: {
          text: '轰然一声药香扑鼻，极品成丹！林婉儿欢呼着扑进你怀里，将主丹与清心莲子一并塞给你。',
          characterAffection: { charId: 'lin_waner', delta: 22, emotion: 'smile' },
          itemGainId: 'pure_heart_lotus',
          expDelta: 90,
        },
        failOutcome: {
          text: '丹炉炸出一团黑烟，把两人都熏成了小花猫，林婉儿扑哧一声笑了出来。',
          characterAffection: { charId: 'lin_waner', delta: 12, emotion: 'shy' },
          hpDelta: -25,
        },
      },
      {
        id: 'fetch_spring_water',
        text: '迅速取来灵泉水替她降温调息',
        successOutcome: {
          text: '虽未成极品，却保全了大半药力，林婉儿温柔道谢并赠你一瓶丹药。',
          characterAffection: { charId: 'lin_waner', delta: 14, emotion: 'smile' },
          itemGainId: 'heart_guard_pill',
        },
      },
    ],
  },
];
