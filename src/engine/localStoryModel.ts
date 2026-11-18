import { Wllama, LoggerWithoutDebug, type ChatCompletionMessage } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { readStoryOutcome, STORY_DIRECTOR, STORY_SCHEMA } from './openStory';
import { NPC_DECISIONS, type NpcDecision } from './npcPlans';

interface BrowserGpu {
  requestAdapter: () => Promise<{ features: ReadonlySet<string> } | null>;
}

const TALK_ONLY: NpcDecision = { action: 'talk', subject: '', days: 0, news: '' };

function spokenReply(raw: string, name: string): string {
  const text = raw.trim().replace(/^[（(][^）)]*[）)]\s*/u, '');
  if (!text || name.startsWith(text)) return '';
  const named = text.startsWith(name);
  const afterName = named ? text.slice(name.length).trimStart() : text;
  if ((named && !/^[：:]/u.test(afterName)) || /^[她他](?:闻|看|听|笑|把|将|微|抬|轻|说|低|摇|点|想)/u.test(text)) {
    const speech = text.match(/「([^」]*)|“([^”]*)/u);
    return speech?.[1] ?? speech?.[2] ?? '';
  }
  const line = named ? afterName.slice(1).trimStart() : afterName;
  const quoted = line.match(/^(?:「([^」]*)」|“([^”]*)”)$/u);
  const speech = quoted ? (quoted[1] ?? quoted[2] ?? '') : line;
  const sentences = speech.match(/[^。！？!?]+[。！？!?]*/gu) ?? [];
  let previous = '';
  return sentences.filter((sentence) => {
    if (/^\s*(?:用|以).{0,26}(?:口气|口吻|语气)[，,]|^\s*(?:只输出|省去|遵守这|用第一人称)/u.test(sentence)) return false;
    const words = sentence.replace(/[\s。！？!?]/gu, '');
    const repeated = words === previous;
    previous = words;
    return !repeated;
  }).join('').trim();
}

export class LocalStoryModel {
  private engine?: Wllama;

  async load(file: File) {
    if (location.protocol === 'file:') throw new Error('浏览器直接打开离线文件时无法启动模型。请从本机网页载入。');
    const signature = new TextDecoder().decode(await file.slice(0, 4).arrayBuffer());
    if (signature !== 'GGUF') throw new Error('请选择有效的 GGUF 模型文件。');
    const threads = globalThis.crossOriginIsolated
      ? Math.min(6, Math.max(1, (navigator.hardwareConcurrency || 4) - 2))
      : 1;
    await this.engine?.exit();
    this.engine = undefined;
    const browserGpu = (navigator as Navigator & { gpu?: BrowserGpu }).gpu;
    const adapter = await browserGpu?.requestAdapter().catch(() => null);
    const loadEngine = async (accelerate: boolean) => {
      const engine = new Wllama({ default: wasmUrl }, { allowOffline: true, logger: LoggerWithoutDebug, suppressNativeLog: true });
      try {
        await engine.loadModel([file], {
          n_ctx: 3072, n_threads: threads, n_gpu_layers: accelerate ? 99 : 0,
          n_batch: 128, n_ubatch: 128, jinja: true, reasoning: false, warmup: false,
        });
        return engine;
      } catch (error) {
        await engine.exit().catch(() => undefined);
        throw error;
      }
    };
    this.engine = adapter?.features.has('shader-f16')
      ? await loadEngine(true).catch(() => loadEngine(false))
      : await loadEngine(false);
  }

  async decideNpcAction(
    messages: ChatCompletionMessage[], actions: NpcDecision['action'][], signal: AbortSignal,
  ): Promise<NpcDecision> {
    if (!this.engine || actions.length <= 1) return TALK_ONLY;
    try {
      const result = await this.engine.createChatCompletion({
        messages,
        temperature: 0.2,
        max_tokens: 170,
        abortSignal: signal,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'npc_next_action',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: actions.map((action) => NPC_DECISIONS[action]) },
                subject: { type: 'string', maxLength: 32 },
                days: { type: 'integer', minimum: 1, maximum: 7 },
                news: { type: 'string', maxLength: 100 },
              },
              required: ['action', 'subject', 'days', 'news'],
              additionalProperties: false,
            },
          },
        },
      });
      signal.throwIfAborted();
      const answer = result.choices[0]?.message.content;
      if (typeof answer !== 'string') return TALK_ONLY;
      const { action: label, subject, days, news } = JSON.parse(answer);
      const action = actions.find((entry) => NPC_DECISIONS[entry] === label);
      if (!action || action === 'talk') return TALK_ONLY;
      return {
        action,
        subject: typeof subject === 'string' ? subject : '',
        days: Number.isSafeInteger(days) ? days : 0,
        news: typeof news === 'string' ? news : '',
      };
    } catch {
      signal.throwIfAborted();
      return TALK_ONLY;
    }
  }

  async replyAsNpc(name: string, messages: ChatCompletionMessage[], signal: AbortSignal, onReply: (partial: string) => void) {
    if (!this.engine) throw new Error('请先载入一个本地模型。');
    let reply = '';
    await this.engine.createChatCompletion({
      messages,
      stream: true,
      onData: (chunk) => {
        const token = chunk.choices[0]?.delta.content;
        if (!token || signal.aborted) return;
        reply += token;
        onReply(spokenReply(reply, name));
      },
      temperature: 0.57,
      top_p: 0.9,
      max_tokens: 128,
      penalty_repeat: 1.05,
      cache_prompt: true,
      abortSignal: signal,
    });
    signal.throwIfAborted();
    const text = spokenReply(reply, name);
    if (!/[\u3400-\u9fff]/u.test(text)) throw new Error('模型没有生成可读的中文回复。');
    return text;
  }

  async narrate(prompt: string, signal: AbortSignal) {
    if (!this.engine) throw new Error('请先载入一个本地模型。');
    const result = await this.engine.createChatCompletion({
      messages: [
        { role: 'system', content: STORY_DIRECTOR },
        { role: 'user', content: prompt },
      ],
      temperature: 0.72,
      top_p: 0.92,
      max_tokens: 285,
      penalty_repeat: 1.12,
      cache_prompt: true,
      abortSignal: signal,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'cultivation_scene', strict: true, schema: STORY_SCHEMA },
      },
    });
    const reply = result.choices[0]?.message.content;
    if (typeof reply !== 'string') throw new Error('本地模型没有返回可读的剧情。');
    return readStoryOutcome(reply);
  }
}
