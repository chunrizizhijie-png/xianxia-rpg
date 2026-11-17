import type { EventCheck, EventOutcome } from '../types/game';

export interface RetreatCall {
  id: string;
  charId: string;
  regionId: string;
  title: string;
  message: string;
  answer: string;
  check: EventCheck;
  result: EventOutcome;
  setback: string;
  decline: string;
  recall: string;
}

export const RETREAT_CALLS: RetreatCall[] = [
  {
    id: 'retreat_array_lamp',
    charId: 'shen_qingqiu',
    regionId: 'taixu_peak',
    title: '雨夜来的剑符',
    message: '玉简连续响了三遍。沈清秋在找没能赶回山门的两名弟子。她发来一张受潮的阵图，只来得及说一句。「帮我看看还能点亮哪盏灯。」',
    answer: '铺开阵图，辨认还能点亮的剑灯',
    check: { stat: 'sense', threshold: 10, label: '神识 10' },
    result: { text: '你找出石阶边仍在运转的阵眼。半个时辰后，她传回消息。「两人都回来了。你给的方位正好。」' },
    setback: '潮气遮住了阵纹。你回信说看不真切，沈清秋便带人从山门外绕过去找。',
    decline: '你回信说明暂时无法分心。沈清秋收下回复，去请值夜的阵师。',
    recall: '「那晚你指的灯没错。两个弟子都回了山门。那张潮阵图，我晒干后还留着。」',
  },
  {
    id: 'retreat_medicine_bundle',
    charId: 'lin_waner',
    regionId: 'yaowang_valley',
    title: '药庐少了一包止血药',
    message: '林婉儿托驿站递来一张药单。那包药是给崖下伤员的，今夜得送到。她在守炉，脚夫还在等十五块灵石。',
    answer: '出十五灵石，请脚夫先送药',
    check: { stat: 'spiritStones', threshold: 15, label: '灵石 15' },
    result: { text: '你替她付了脚钱。天明前，脚夫带回伤员已经止血的消息。林婉儿又托人多带了一句谢。', spiritStonesDelta: -15 },
    setback: '你数了数灵石，还差几块。你把数目报给她，她转去请谷里的药童送这一趟。',
    decline: '你把药单还给来人，说明这趟帮不上忙。林婉儿很快托同门送出了药。',
    recall: '「上回你垫的脚钱，我在账上写了你的名字。崖下那人今日已经能自己走回药庐了。」',
  },
  {
    id: 'retreat_market_receipt',
    charId: 'ye_liuli',
    regionId: 'heishan_market',
    title: '鬼市捎来半张借据',
    message: '一张撕过的借据夹在传音信里。夜琉璃说，有人要拿它去为难卖茶的伙计。她想让你把背面的字转给驿站掌柜，别让前堂那些人先听见。',
    answer: '找个由头请掌柜独自出来，交代借据的来历',
    check: { stat: 'charm', threshold: 12, label: '魅力 12' },
    result: { text: '掌柜看出了借据上的缺口，留下另一半作证。夜琉璃回信说，「那伙计今日照常烧水。多亏你没在前堂念出来。」' },
    setback: '掌柜正算账，没听明白你的来意。你将借据原样退回。夜琉璃说她会亲自去一趟。',
    decline: '你把半张借据封好退回。夜琉璃收下，另请熟悉驿站的人去问。',
    recall: '「驿站那个伙计还在烧水。他问谁替他递的话，我说，下次亲自倒茶给你喝。」',
  },
  {
    id: 'retreat_qin_rain',
    charId: 'mu_qingge',
    regionId: 'qingming_wild',
    title: '琴箱边的漏雨声',
    message: '慕清歌问你能否听一段玉简里的水声。山舍在漏雨，琴箱和借住的病人都在廊下。隔着一面墙，她分不清是屋瓦松了，还是那口水缸快满了。',
    answer: '细听水声，把你听出的方位告诉她',
    check: { stat: 'sense', threshold: 9, label: '神识 9' },
    result: { text: '你听见水响落在瓦片上。慕清歌将人和琴箱都挪到东厢，后来告诉你，那截廊顶果然落了两块瓦。' },
    setback: '你听见水响，也听见穿过窗缝的风。你照实回信。慕清歌说她先把人扶进屋，再查漏处。',
    decline: '你回信说此刻无法细听。她把玉简收起，先请山舍主人来看看。',
    recall: '「山舍换了两片瓦。屋里那位病人昨夜安睡了一回。你听得细，连我都漏了那个响声。」',
  },
  {
    id: 'retreat_frozen_ford',
    charId: 'ao_shuanghua',
    regionId: 'zixiao_thunder',
    title: '渡口传来的短讯',
    message: '敖霜华在河对岸，身边有两个脚上沾霜的行人。她能开一道窄冰路，请你用一缕灵力照亮渡口传讯的阵标，给他们辨方向。',
    answer: '引灵力点亮阵标，引人从冰路上回来',
    check: { stat: 'mp', threshold: 16, label: '灵力 16' },
    result: { text: '阵标亮了片刻，两人循着光走到岸边。敖霜华检查完冰面才传信回来。「人都过了。下回一起去看看那条渡口。」', mpDelta: -16 },
    setback: '你的灵力撑不起阵标，便请她先别放人踏上冰面。敖霜华转而顺着河滩带两人去渡船边。',
    decline: '你回信说明无法接应。她撤掉半成的冰路，沿河另找渡口。',
    recall: '「渡口那两个行人叫我替他们向你道谢。那夜阵标亮起来，我隔得老远也看得见。」',
  },
  {
    id: 'retreat_star_count',
    charId: 'su_xinghe',
    regionId: 'feiyue_palace',
    title: '苏星河来问更漏',
    message: '灯影刚斜过书案，苏星河便来传音。她那边的刻漏走快了一格，想请你记下今晚第一声更鼓与月过窗棂的先后。',
    answer: '守一更，把听见鼓声的时辰照实报给她',
    check: { stat: 'sense', threshold: 8, label: '神识 8' },
    result: { text: '你守在窗边等到换更，连同附近犬吠的时刻一同写去。她复核了两遍，回信说这次星历对上了。' },
    setback: '你听漏了前半更，如实回信。苏星河只好等到明晚再核一遍。',
    decline: '你告诉她今晚要守功，无法听更。她说她另去问一处驿站。',
    recall: '「我把那夜的犬吠也抄进了星历，旁人看不懂，你来看就知道是哪里。」',
  },
];
