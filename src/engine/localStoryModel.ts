import { Wllama, LoggerWithoutDebug } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { readStoryOutcome, STORY_DIRECTOR, STORY_SCHEMA } from './openStory';

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
