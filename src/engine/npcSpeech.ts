// The small model sometimes continues a transcript past its own turn, especially
// after a quoted exchange. Apply the same cleanup to streaming and final text.
export function spokenReply(raw: string, name: string): string {
  const visible = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/giu, '').trim();
  const firstTurn = visible.split(/(?:^|\n)\s*(?:玩家|用户|user|道友|对方)\s*[：:]|<\|im_(?:end|start)\|>/iu)[0];
  const text = firstTurn.replace(/^[（(][^）)]*[）)]\s*/u, '').trim();
  if (!text || name.startsWith(text) || /^<th(?:i(?:nk?)?)?$/iu.test(text)) return '';
  const named = text.startsWith(name);
  const afterName = named ? text.slice(name.length).trimStart() : text;
  const narration = (named && !/^[：:]/u.test(afterName)) ||
    /^[她他](?:转|站|走|闻|看|听|笑|把|将|微|抬|轻|说|低|摇|点|想)/u.test(text);
  const utterance = narration ? (text.match(/[「“]([^」”]*)/u)?.[1] ?? '')
    : (named ? afterName.slice(1) : afterName).trim().replace(/^([「“])([\s\S]*?)([」”])?$/u, '$2');
  const sentences = utterance.match(/[^。！？!?]+[。！？!?]*/gu) ?? [];
  let previous = '';
  return sentences.filter(sentence => {
    if (/^\s*(?:用|以).{0,26}(?:口气|口吻|语气)[，,]|^\s*(?:只输出|省去|遵守这|用第一人称)/u.test(sentence)) return false;
    const words = sentence.replace(/[\s。！？!?]/gu, '');
    const repeated = words === previous;
    previous = words;
    return !repeated;
  }).join('').trim();
}
