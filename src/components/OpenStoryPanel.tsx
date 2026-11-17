import { useState } from 'react';
import { X } from 'lucide-react';
import type { StoryRecord } from '../types/journey';

interface OpenStoryPanelProps {
  location: string;
  modelName: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  result: { text: string; effects: string[] } | null;
  pending: StoryRecord[];
  onModel: (file: File) => void;
  onAct: (action: string) => boolean;
  onCancel: () => void;
  onClose: () => void;
}

export function OpenStoryPanel({
  location, modelName, loading, busy, error, result, pending, onModel, onAct, onCancel, onClose,
}: OpenStoryPanelProps) {
  const [draft, setDraft] = useState('');
  const fileMode = window.location.protocol === 'file:';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-story-title"
        className="xuan-card max-h-[92dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl p-4 sm:p-6"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#c5a059]/30 pb-3">
          <div>
            <h2 id="open-story-title" className="text-lg font-semibold text-[#e2c488]">自由行动</h2>
            <p className="mt-1 text-sm text-stone-400">{location}</p>
          </div>
          <button type="button" aria-label="关闭自由行动" onClick={onClose}
            className="rounded p-2 text-stone-300 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="min-w-0 break-words text-sm text-stone-300">
            {fileMode ? '请从本机网页载入模型，使用自由叙事。'
              : loading ? '正在从磁盘读取模型…'
              : modelName ? `已载入 ${modelName}` : '选一个本地 GGUF 模型，便可描写你想做的事。'}
          </p>
          {fileMode ? (
            <a href="http://127.0.0.1:4188/" className="rounded border border-[#c5a059]/40 px-3 py-2 text-xs text-[#e2c488]">
              打开本机网页
            </a>
          ) : (
            <label className="inline-flex cursor-pointer rounded border border-[#c5a059]/40 px-3 py-2 text-xs text-[#e2c488] focus-within:ring-1">
              {modelName ? '更换模型文件' : '选择模型文件'}
              <input type="file" accept=".gguf" aria-label="本地 GGUF 模型" disabled={loading || busy}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onModel(file);
                  event.currentTarget.value = '';
                }} />
            </label>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
        {(result || busy) && (
          <div aria-live="polite" className="xuan-panel rounded-lg px-4 py-3">
            {busy ? <p role="status" className="text-base text-stone-300">正在推演这一幕…</p> : (
              <>
                <p className="whitespace-pre-line break-words text-base leading-7 text-stone-100">{result?.text}</p>
                {!!result?.effects.length && <p className="mt-2 text-sm text-[#e2c488]">{result.effects.join(' · ')}</p>}
              </>
            )}
          </div>
        )}

        {modelName && (
          <form className="space-y-2.5" onSubmit={(event) => {
            event.preventDefault();
            if (onAct(draft.trim())) setDraft('');
          }}>
            <label htmlFor="open-action" className="text-sm text-[#e2c488]">想试着做什么</label>
            <textarea id="open-action" rows={3} value={draft} maxLength={500} disabled={busy || loading}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="比如：我捡起窗下那片旧瓦，请屋里的人瞧一瞧上面的字。"
              className="w-full resize-y rounded-md border border-stone-700 bg-[#101318] px-3 py-2 text-base text-stone-100" />
            <div className="flex justify-end gap-2">
              {busy && <button type="button" onClick={onCancel}
                className="rounded border border-stone-700 px-3 py-2 text-sm text-stone-300">取消这一回</button>}
              <button type="submit" disabled={busy || loading || !draft.trim()}
                className="rounded border border-[#c5a059]/45 bg-[#c5a059]/15 px-4 py-2 text-sm text-[#e2c488] disabled:opacity-40">
                试试看
              </button>
            </div>
          </form>
        )}
        {pending.length > 0 && (
          <p className="border-t border-stone-800 pt-3 text-sm text-stone-400">
            还有 {pending.length} 件事在后头，最早一件会在第 {Math.min(...pending.map((entry) => entry.day))} 日见分晓。
          </p>
        )}
      </section>
    </div>
  );
}
