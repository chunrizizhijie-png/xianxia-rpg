import { Wllama, LoggerWithoutDebug, type ChatCompletionMessage } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { readStoryOutcome, STORY_DIRECTOR, STORY_SCHEMA } from './openStory';
import { spokenReply } from './npcSpeech';
import { NPC_DECISIONS } from './npcPlans';
import { readNpcMove } from './npcIntent';

interface BrowserGpu {
  requestAdapter: () => Promise<{ features: ReadonlySet<string> } | null>;
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

  async selectNpcMove(messages: ChatCompletionMessage[], labels: string[], signal: AbortSignal): Promise<string> {
    if (!this.engine || labels.length <= 1) return NPC_DECISIONS.talk;
    try {
      const result = await this.engine.createChatCompletion({
        messages,
        temperature: 0.1,
        max_tokens: 48,
        cache_prompt: true,
        abortSignal: signal,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'npc_next_action',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: labels },
                confidence: { type: 'string', enum: ['明确', '不确定'] },
              },
              required: ['action', 'confidence'],
              additionalProperties: false,
            },
          },
        },
      });
      signal.throwIfAborted();
      return readNpcMove(result.choices[0]?.message.content, labels);
    } catch {
      signal.throwIfAborted();
      return NPC_DECISIONS.talk;
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
