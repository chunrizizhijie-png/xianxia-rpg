import type { NpcWorldStatus } from './worldSandbox';

export interface NpcStop {
  regionId: string;
  days: number;
  type: NpcWorldStatus['interveneType'];
  activity: string;
  reply: string;
}

export interface NpcProfile {
  greeting: string;
  letter: string;
  privateTopic: {
    question: string;
    answer: string;
    respect: string;
    press: string;
    trusted: string;
  };
  rememberedHelp: string;
  rememberedHarm: string;
  stops: NpcStop[];
}

export const NPC_PROFILES: Record<string, NpcProfile> = {
  shen_qingqiu: {
    greeting: '沈清秋把剑往身侧让了半寸。「坐。你是来借剑，还是来借我？」',
    letter: '玉简里先传来收剑入鞘的轻响。「我在外头。你说短些，我听着。」',
    privateTopic: {
      question: '问她为何随身带两枚剑符',
      answer: '「一枚是我的。另一枚你别碰。」她理齐匣里的两枚剑符，手没有松开。',
      respect: '她抬眼看了你一眼。「多谢。能交给你看的时候，我会自己开口。」',
      press: '「我刚才说得够清楚了。」她合上剑匣，转身出了门。',
      trusted: '「你上回没有追问。」她摊开剑符，让你看背面的刻字。「是我师父留的。」',
    },
    rememberedHelp: '「上回你守了阵眼，没把我一个人丢在里面。此事我记得。」',
    rememberedHarm: '「上回那道剑伤已经好了。东西你可以拿走，这次别指望我与你同路。」',
    stops: [
      { regionId: 'taixu_peak', days: 5, type: 'spar', activity: '在试剑崖校验外门剑阵', reply: '「西阵的第三根剑桩松了。我守到换班，愿意的话陪我试两招。」' },
      { regionId: 'qingming_wild', days: 3, type: 'rescue', activity: '沿山道查找断掉的护阵剑符', reply: '「剑符断在背阴坡。若我入夜仍未传信，你可去药王谷问她们。」' },
      { regionId: 'yaowang_valley', days: 4, type: 'trade', activity: '给守山弟子换取伤药', reply: '「我带了几株剑崖的雪莲，想换外伤药。药王谷后门那条石阶近日好走些。」' },
    ],
  },
  ye_liuli: {
    greeting: '夜琉璃将空杯转向你。「茶剩一盏。你先坐，还是先回答我一个问题？」',
    letter: '「你也挑这个时候来找我？」玉简里传来她的笑声，「慢慢说，隔墙的人刚走。」',
    privateTopic: {
      question: '问她在鬼市替谁留了一个座',
      answer: '「替一个还不起债的人。」她放下杯沿挡着的座牌，「姓氏就免了。」',
      respect: '「会装糊涂的人少见。下回看见那张座牌，留它在原处就好。」',
      press: '笑意还在，她已经把座牌反扣过来。「你再追问，我就得怀疑是谁叫你来的了。」',
      trusted: '「还认得那张座牌么？她把债还清了。方才给我的茶，也是她托人带的。」',
    },
    rememberedHelp: '「你上回真敢回来找我。我原以为你一出了那扇门，就当没见过我。」',
    rememberedHarm: '「你我分宝那回的账我还留着。今天要跟我谈买卖，先把灵石摆出来。」',
    stops: [
      { regionId: 'heishan_market', days: 5, type: 'trade', activity: '清点鬼市一处旧铺的欠账', reply: '「旧主跑路了，欠街坊的钱可没消失。等我把账抄完，才能去绯月。」' },
      { regionId: 'feiyue_palace', days: 4, type: 'aid_breakthrough', activity: '回绯月查验封住的旧阵', reply: '「那群长老想借闭阵看我低头。我先守阵，等他们露破绽。」' },
      { regionId: 'heishan_market', days: 3, type: 'rescue', activity: '试着绕开追到鬼市的眼线', reply: '「柜台上有两只一样的杯子，你就往左走。若剩一只，今晚别来。」' },
    ],
  },
  lin_waner: {
    greeting: '林婉儿用袖口拭净手上的药末。「来得正好。手伸过来，我看看这副脉又让你糟蹋成什么样了。」',
    letter: '「等我把炉盖压上。好了，听得见。你那边可是缺药？」',
    privateTopic: {
      question: '问药庐里为什么有一只始终封着的药柜',
      answer: '「是我没配成的方子。」她捏着钥匙，「还有一味的分量没想明白，我先就自己看看。」',
      respect: '「好。若哪天配成，我给你闻第一炉。」她把钥匙上的药末抹净了。',
      press: '她扣上药柜的木环。「今日先到这里吧。我的方子，我自己收着。」',
      trusted: '「上回那味药，我想通了，先减半。」她把方笺递出来，「你帮我看看，字太小就凑近点。」',
    },
    rememberedHelp: '「你回来那天脚上都是泥。炉边给你留了热水，这次也有。」',
    rememberedHarm: '「你走那夜，我替自己包了半个时辰的伤。你若还想来讨药，把缘故说清楚。」',
    stops: [
      { regionId: 'yaowang_valley', days: 9, type: 'trade', activity: '在药庐炮制新到的灵材', reply: '「血参已经炮好了，我正等新鲜雪莲。这炉若开得成，守夜的人就有药用了。」' },
      { regionId: 'qingming_wild', days: 4, type: 'co_explore', activity: '到青冥山涧辨药、采药', reply: '「崖上那几株药决不能连根拔。要同走，就帮我记下能踩的地方。」' },
      { regionId: 'yaowang_valley', days: 4, type: 'trade', activity: '回谷分药，给药童换班', reply: '「这一炉只剩最后几丸。我在这儿值两晚，白日里药童会替我看炉。」' },
    ],
  },
  mu_qingge: {
    greeting: '慕清歌掌心落在弦上，余音止了。「我看你站了一会儿。想听完这一曲，还是说说来意？」',
    letter: '「我才把琴弦松下来。此刻清静，你想说什么？」',
    privateTopic: {
      question: '问她曲谱里空着一拍是何缘故',
      answer: '「那一拍该有人接。」指尖停在纸上，「我如今还不想换另一个人。」',
      respect: '「留白的人知道自己何时开口。这一拍就暂且空着吧。」',
      press: '她把琴谱卷紧。「执意填上，也只是多一个错音。我们改日再谈。」',
      trusted: '「我另写了两小节，还留着那一拍。愿意听听现在的尾声么？」',
    },
    rememberedHelp: '「你肯在阵外等我把最后一个音弹完。那一夜能活下来，我一直记得。」',
    rememberedHarm: '「你夺匣那声比琴弦断时还响。如今若要再合作，你先讲准备怎么分。」',
    stops: [
      { regionId: 'yaowang_valley', days: 4, type: 'trade', activity: '替药庐守夜，用琴音助伤者入眠', reply: '「药童把苦药甜药都分错了。今夜我留下，等他们睡稳才走。」' },
      { regionId: 'taixu_peak', days: 5, type: 'spar', activity: '借剑崖风声推敲新曲', reply: '「有一处弦音借剑声就能试出来。你肯跟我走一遍么？」' },
      { regionId: 'qingming_wild', days: 3, type: 'co_explore', activity: '沿溪寻找能做琴轸的古木', reply: '「溪北树是活的，别锯。若有雷劈落的枝，我想拣一段试音。」' },
    ],
  },
  ao_shuanghua: {
    greeting: '敖霜华把靴上的泥在门槛上蹭掉。「你选今日来得巧。我刚忙完，先说是来玩还是来求我。」',
    letter: '「你听得清么？风太吵。我找块背风的石头，你等一下。」',
    privateTopic: {
      question: '问她袖中那枚旧龙鳞是谁的',
      answer: '「我的。小时候掉的。」她重新掖紧袖口，「留着有用，别借。」',
      respect: '「你这回倒好说话。改日给你看新磨的那一枚，这枚先收起来。」',
      press: '「说了不借。人族是非要试试我的脾气才听得懂么？」她把袖口拢死。',
      trusted: '她将一枚光亮的鳞放在案头。「给你看新的。旧那枚给了我母亲，她想留。」',
    },
    rememberedHelp: '「那次你替我接下一阵，手都抬不起来了。我记着，欠你一次。」',
    rememberedHarm: '「宝匣你夺了去，休想再约我替你开机关。先把上回的账讲完。」',
    stops: [
      { regionId: 'qingming_wild', days: 5, type: 'co_explore', activity: '勘察山泉下的冰窟', reply: '「洞口只有一条道能回岸上，我要先记下来。你敢下去，便跟紧我。」' },
      { regionId: 'taixu_peak', days: 4, type: 'spar', activity: '在剑崖试验新炼的冰甲', reply: '「只让三招，第四招认真打。我这片甲若碎了，就去药王谷换。」' },
      { regionId: 'zixiao_thunder', days: 3, type: 'rescue', activity: '赶到雷泽取回遗失的龙鳞', reply: '「若同一片地面响了两次雷，就换地方站。我已有一片鳞被钉进去。」' },
    ],
  },
  su_xinghe: {
    greeting: '苏星河把铜筹拢到碗里。「恰好差一道难题。你给我带了淋过雨的靴子，还是件新鲜事？」',
    letter: '「你先别猜我是不是算到你了。我刚吃完饭，正好有空。」',
    privateTopic: {
      question: '问她为什么把自己的卦签反放',
      answer: '「有一处我看不懂。先留在我这里。」她用小指压住卦签，「今夜先讲别人的事。」',
      respect: '「你就当这桌上少了一根签。改天我读通，换我来找你。」',
      press: '她用铜碗盖住桌上的签。「别掀。我也有不让旁人替我算的时候。」',
      trusted: '「原来我把水声算成了雨声。」她翻开旧签，「正好，我想让你看看我是怎样算错的。」',
    },
    rememberedHelp: '「那夜算到会有人回来。我本来不敢信，结果是你。回头与你重排一次盘。」',
    rememberedHarm: '「我算过你会取走匣子，没算准你会亲自动手。这一道要等你来解。」',
    stops: [
      { regionId: 'taixu_peak', days: 4, type: 'aid_breakthrough', activity: '借剑峰的视野校对星历', reply: '「云薄才看得见。今夜守上半夜就好，下半夜人困容易抄错。」' },
      { regionId: 'heishan_market', days: 4, type: 'trade', activity: '向鬼市钟匠求一副走得准的刻漏', reply: '「上一副漏得快，害我算差半刻。我盯着他试完水才付钱。」' },
      { regionId: 'feiyue_palace', days: 3, type: 'co_explore', activity: '赴绯月水岸核对旧星图', reply: '「我在两张星图上看见同一个墨点。得去原处看，才知画的是星还是灯。」' },
    ],
  },
};
