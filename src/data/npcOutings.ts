import type { MemoryKind, OutingId } from '../types/journey';

export interface OutingContext {
  name: string;
  region: string;
  familiar: boolean;
  path: readonly string[];
}

export type OutingText = string | ((context: OutingContext) => string);
export type OutingChoice = {
  id: string;
  label: string;
  requires?: string;
} & (
  { to: string; wait?: number } |
  { end: OutingText; memory: MemoryKind; letter: string; delay: number }
);
interface Chapter {
  line: OutingText;
  choices: OutingChoice[];
}
interface OutingStory {
  title: string;
  chapters: Record<string, Chapter>;
}

// These are the companion's own observations, before the player decides what matters.
export const OUTING_VOICES: Record<string, Record<OutingId, string>> = {
  shen_qingqiu: { letter: '「封口没动过。先别拆。」', tea: '「第一口太急，舌头烫了。我得重尝。」', bell: '「铃响三下，船却只动了两回。你听出没有？」' },
  ye_liuli: { letter: '「肯付钱领信的未必是收信的人。先别谈价钱。」', tea: '「茶摊若关了，我欠她的三文茶账该找谁还？」', bell: '「船钱算到上岸，脚夫的工钱可要算到回家。」' },
  lin_waner: { letter: '「纸都起毛了，揣这封信的人怕是拿出来看过许多回。」', tea: '「舌根是涩，杯底却甜。这两碗真出自一锅水？」', bell: '「每日被吵醒两回的人，这几天怕是睡不好。」' },
  mu_qingge: { letter: '「有人好端端坐在跟前，也有话只肯写进信里。」', tea: '「别忙着报茶名。咽下去停一停，余味还会变。」', bell: '「尾音被什么吃掉了。站到桥洞里听，或许又不同。」' },
  ao_shuanghua: { letter: '「赶路就赶路，拿人家的信垫车脚算怎么回事。」', tea: '「喝茶还要猜？大碗给我，我说哪碗解渴。」', bell: '「我拉过水上的缆。手上忙的时候，听错一声也来不及补。」' },
  su_xinghe: { letter: '「戳记是旧历的。按今年的集期去找，怕会扑空。」', tea: '「有意思。同一瓮水，先后半刻倒出来，味道就不同。」', bell: '「账上记的是铃响的时辰，没记谁听得着。」' },
};

const go = (id: string, label: string, to: string, wait?: number): OutingChoice => ({ id, label, to, wait });
const end = (id: string, label: string, memory: MemoryKind, text: OutingText, delay: number, letter: string): OutingChoice =>
  ({ id, label, memory, end: text, delay, letter });

export const OUTINGS: Record<OutingId, OutingStory> = {
  letter: {
    title: '未拆的家书',
    chapters: {
      start: {
        line: ({ name, region }) => `在${region}路旁歇脚时，一阵风把驮车上的纸吹到${name}膝前。那是十年前的一封退信，封面只写着「烧碗的阿青」。赶车人正要把它塞回破车脚下。一个端碗卖水的老妇伸了伸手，又把手缩了回去。`,
        choices: [go('potter', '跟端碗的老妇坐一会儿', 'potter'), go('courier', '先问赶车人从哪里捡到信', 'courier')],
      },
      potter: {
        line: '老妇不肯认领，却把手中那只碗翻转过来。底足上压着半个月牙。「我带过两个徒弟，都叫阿青。走的那个是我女儿，她不肯再回来烧碗。」她看着没拆过的封口，问是谁替她收了十年。',
        choices: [go('mark', '请她在泥上按下旧窑记号，以后核对收件人', 'custody'), go('listen', '先听她说说女儿为什么离开', 'custody')],
      },
      courier: {
        line: '赶车人从座板底下翻出一本退件簿。旧驿撤掉那天，他父亲驮走了无人认领的东西。簿上有收信手印，却无人签领这封信。老人怕担干系，一直贴钱交保管费。',
        choices: [go('copy', '抄下退件簿的日期，只留收信人看', 'custody'), go('fee', '去问旧驿当年由谁收下这笔保管费', 'custody')],
      },
      custody: {
        line: ({ path, name, familiar }) => {
          const clue = path.includes('mark') ? '泥上的半月印与信脚的淡印严丝合缝。' : path.includes('listen') ? '原来母女最后一次见面时，老妇摔了女儿第一次独自烧成的碗。' : path.includes('copy') ? '退件日与旧窑搬迁的日子只差一天。' : '旧驿的伙计认出那笔钱是老妇年年替女儿交的。';
          return clue + `一个年轻挑夫自称是阿青的儿子，伸手就要代领。${name}` + (familiar ? '把原信交到你手里。「拿稳。这一遭我听你的。」' : '按住封口。「先让写信的人有机会说句话。」');
        },
        choices: [go('sealed', '把信封好，请挑夫捎口信让本人答复', 'answer', 2), go('receipt', '让挑夫写一张凭据，请他带回收信人的回条', 'answer', 1)],
      },
      answer: {
        line: ({ path }) => (path.includes('sealed') ? '阿青托人把一只月牙底的碗送来了。她说信封上是自己的小名，请别在人前念。' : '挑夫带回了回条，也带来一桩难事：阿青肯收信，却不肯让母亲知道自己的住处。') + '老妇来问结果时，手里捧着一只烤暖的碗。她只问：「她还烧碗么？」',
        choices: [
          end('private', '只捎一句她肯接信，其余留给她们自己谈', 'confidence', ({ name }) => `老妇把暖碗包好，没再追问住处。回程时${name}才开口：「有些话到了嘴边，你也肯替人留着。以后我的信能托你。」`,
            4, '阿青自己托人带来一封短札，封面只写了个「娘」字。我替她送到了；写的什么，我也没看。'),
          { ...end('kiln', '用两个半月窑记做收讫凭据，不抄住址', 'help', '两枚半月印合成一只圆。旧驿把退信账划清了，母女都留着知道对方平安的泥印。',
            3, '老妇把半月窑记按进了新碗的底足。她把另一半空出来，说下回想让女儿自己添。'), requires: 'mark' },
          { ...end('ledger', '据退件簿日期销掉赶车人父亲的滞账', 'help', '退件簿上终于补了一行朱字。赶车人又把车翻了一遍，这回翻出两件旧木器，自己送回原处。',
            2, '赶车人把找还木器的两张签条送来了。他爹不再垫保管费，今日把车脚也终于修好了。'), requires: 'copy' },
          end('answeronly', '照回条办好交接，替挑夫把凭据收齐', 'story', '纸上的事一一办齐了。老妇没等到第二句话，把碗包回布里。你们转过街角时，还能听见她收碗的轻响。',
            3, '挑夫回来交了最后一张签条。老妇把碗放回摊上，坐下问我还喝不喝水。我陪她坐了一会儿。'),
        ],
      },
    },
  },
  tea: {
    title: '两碗涩茶',
    chapters: {
      start: {
        line: ({ name }) => `赶集的人刚散，茶棚还留着两只热碗。摊主明日就要收棚，今晚想把茶方传给徒弟。两只碗一只出自师父，一只出自徒弟。${name}才喝了一口，徒弟已经红了眼睛：「是不是我又煮坏了？」`,
        choices: [go('taste', '请她们先不说是哪一碗，再认真尝尝', 'taste'), go('hands', '先坐到徒弟烧水的矮凳旁边', 'hands')],
      },
      taste: {
        line: '第二口凉茶反而回甜。你们换过杯子才发现，老师傅那只薄瓷碗散热得快，徒弟用的厚碗里茶叶一直闷着。摊主张了张嘴，把那句「火候不行」咽了回去。',
        choices: [go('cups', '把两碗茶对调，再请师徒一起盲尝', 'ask'), go('rain', '留下厚碗试一壶更短的浸茶时间', 'ask')],
      },
      hands: {
        line: '徒弟每次提壶都要换一次手。她替客人挑水伤过腕子，只能把水分成三次冲。师父怪她心急，却从没蹲在这张矮凳上看过她怎么干活。',
        choices: [go('ladle', '请师父坐到这张凳上，用小水勺重冲一碗', 'ask'), go('speak', '把旁人请开，让徒弟自己解释手腕的事', 'ask')],
      },
      ask: {
        line: ({ path, name, familiar }) => {
          const clue = path.includes('cups') ? '碗一换，老师傅也猜错了自己的手艺。' : path.includes('rain') ? '厚碗只泡半刻，凉下来居然比薄碗甜。' : path.includes('ladle') ? '小勺舀下去，第三道水恰好压住茶末。' : '师父听完，第一次替徒弟搬了水桶。';
          return clue + `${name}问你明早谁来开摊。` + (familiar ? '她把你那碗留在顺手的一边，给你续了水。' : '她转了转空杯，在等你先开口。') + '师父想把招牌留下，徒弟却想把木牌翻过去，先卖自己煮的茶。';
        },
        choices: [go('oldsign', '借原来的招牌开一天，两种喝法写明白', 'nextpot', 1), go('blank', '陪徒弟把木牌翻过来，等客人自己评', 'nextpot', 1)],
      },
      nextpot: {
        line: ({ path, name }) => (path.includes('oldsign') ? '次日的旧招牌下，两行茶单都被水汽洇开了。老客还认得味道，赶路的人却嫌等得太久。' : '空白木牌没能招来昨天的人，几个挑担的却把头锅全喝光了，还问「这碗叫什么」。') + `${name}带来徒弟写的茶笺。她留了一个空行，想知道你觉得哪件事值得传给下一个人。`,
        choices: [
          { ...end('recipe', '写两种杯子该泡多久，留给赶路人自己挑', 'help', '茶笺上多了两道圆圆的碗印。徒弟找了两只粗细不同的杯子，照着你留下的时辰重新起了一锅水。',
            2, '茶摊今日多了一排自带杯子的熟客。徒弟捏捏杯壁就知道哪一碗该早点出汤，你留下的茶笺快被翻软了。'), requires: 'taste' },
          { ...end('stool', '写下矮凳的高度和水勺的分量', 'help', '徒弟让木匠多打了一张矮凳。茶笺头一句是「先叫来学的人坐稳」，壶柄也缠上了一层旧布。',
            3, '新凳送到了。今早徒弟坐着给师父冲了一碗茶，从头到尾都没换手。她托我跟你说，腕子省力多了。'), requires: 'hands' },
          end('leaveblank', '还她一张空笺，让她亲笔写第一句', 'confidence', ({ name }) => `她写下「先给对面的人倒一碗」。你和${name}各自捧着茶，直到喝完也没人催对方接话。`,
            2, '那张笺背面又添了一行：「坐下喝的人不用赶。」我去时有个脚夫正在长凳上打盹，炉上替他温着半碗。'),
        ],
      },
    },
  },
  bell: {
    title: '漏掉的一声',
    chapters: {
      start: {
        line: ({ region }) => `${region}的路口搭着渡船的歇脚棚。船上连响三遍铃，背货的人却坐着没动。一个小脚夫捂着鞋底的破洞说，昨夜就是听错一声，最后一班船把他留在了岸上。`,
        choices: [go('shore', '跟脚夫走一遍昨夜背货的路', 'shore'), go('boat', '上甲板问摇铃的船娘是怎么报班的', 'boat')],
      },
      shore: {
        line: '走到桥洞里，风把第二声吞了。穿洞而过时，先前听到的尾音和新的一声叠在一起。脚夫停步让你听，可背货的人哪能每回都停？',
        choices: [go('chalk', '在听不清的石壁上画一道潮线作记号', 'trial'), go('runner', '问最晚过桥的人愿不愿沿途捎口信', 'trial')],
      },
      boat: {
        line: '船娘把系铃的旧绳翻给你看。绳结有两个，分别给逆风和顺风用。她习惯凭手感换结，新来的帮工却不知道桥下也有人在听。',
        choices: [go('knot', '和帮工试一遍两种绳结，把声音记下', 'trial'), go('lamp', '问船娘借一盏能挂在桅上的旧灯', 'trial')],
      },
      trial: {
        line: ({ path, name }) => {
          const clue = path.includes('chalk') ? '粉线入水时，铃声最容易混在一起。' : path.includes('runner') ? '跑腿的人能递话，可最晚收摊的总得欠他一份人情。' : path.includes('knot') ? '短结打出的两声脆响，过桥洞也不会混。' : '桅灯从两岸都看得着，起雾时却会变成一团白。';
          return clue + `${name}用两枚铜钱在桌上摆出两岸的位置。「先试一晚。有人漏船，总得知道他卡在哪儿。」船娘只够安排一次试航。`;
        },
        choices: [go('latecrew', '请船等最后一队脚夫过桥，记下耽搁多久', 'morning', 1), go('ontime', '照时辰开船，在两岸各留一个记数的人', 'morning', 1)],
      },
      morning: {
        line: ({ path, familiar }) => (path.includes('latecrew') ? '试航的木筹送来了。五名脚夫赶上了船，岸那头卖鱼的人却白等了半个时辰。' : '两岸木筹相差三根。船娘准点到了对岸，三名背货人却在风口等了一夜。') + (familiar ? '她将两边的木筹并排放在你掌中。「这回你来开口，我在旁边作证。」' : '她先问两边能否都留个名字，再将木筹递过来。'),
        choices: [
          { ...go('marks', '拿潮线和木筹一起核对，找出只需改铃的夜晚', 'settle'), requires: 'chalk' },
          { ...go('double', '请帮工用短结发末班信号，请脚夫当场试听', 'settle'), requires: 'knot' },
          { ...go('relay', '把捎话人的回程也算进去，轮换守桥的人', 'settle'), requires: 'runner' },
          { ...go('lantern', '请两岸把桅灯遮开两遍，试试对岸能否辨认', 'settle'), requires: 'lamp' },
          go('witness', '请船娘和落船的人各说一句，把分歧写在同一张纸上', 'settle'),
        ],
      },
      settle: {
        line: ({ path }) => {
          const result = path.includes('marks') ? '纸上的潮线和鱼贩的记时碰在同一格。只需在满潮换铃。'
            : path.includes('double') ? '小脚夫在桥洞里举起两根手指，帮工隔水回了个手势。新铃号两边都认得。'
            : path.includes('relay') ? '脚夫摊开回程的更表，卖鱼人也把名字添了上去。现在传信的人赶得及上自己的船了。'
            : path.includes('lantern') ? '岸灯回了两明两暗。后来的人不用去追前面那个人，只消认灯就知道末班船还在。'
            : '船娘愿意报末班，脚夫也肯提前把货堆上岸。两边都请你别把商量的事写成罚人的规条。';
          return result + '木告示还差最后一行。';
        },
        choices: [
          end('trialweek', '写上先试七天，之后由两岸一同修订', 'help', ({ name }) => `告示钉好后，脚夫把第一根木筹挂在下面。两岸的人终于有地方反映误船。${name}看着那截木头说：「这桩事总算有人接得下去了。」`,
            7, '试航满了七天，告示下挂了六根白筹、一根黑筹。两岸的人把那晚误船的时辰记了下来，商量潮高时让船多等一会儿。'),
          end('names', '把两边自愿值夜的名字写上，小事让彼此捎信', 'confidence', '船娘拿着笔，一个个念名字，连最小的脚夫也等着自己应声才写。回程路上，你们还听见两岸互相认人的笑声。',
            3, '昨夜泊船时起了雾，守桥的人认得值班脚夫，先去喊他。那块写名字的木牌倒真派上了用场。'),
        ],
      },
    },
  },
};
