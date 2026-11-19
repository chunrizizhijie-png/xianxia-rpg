import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Send, X } from 'lucide-react';
import { PORTRAITS } from '../data/portraits';
import type { DialogueChoice, DialogueNode } from '../engine/npcDialogue';
import type { CharacterData } from '../types/game';
import type { NpcChatMessage } from '../types/journey';

interface NpcConversationProps {
  character: CharacterData;
  location: string;
  remote: boolean;
  node: DialogueNode;
  turns: NpcChatMessage[];
  onChoose: (choice: DialogueChoice) => void;
  onSpeak: (line: string) => boolean | Promise<boolean>;
  modelName: string | null;
  loadingModel: boolean;
  plan?: string;
  pending: { input: string; reply: string } | null;
  error: string | null;
  onModel: (file: File) => void;
  onCancelStory: () => void;
  onClose: () => void;
}

function ChatBubble({ speaker, player, text }: { speaker: string; player?: boolean; text: string }) {
  return (
    <div className={`flex flex-col gap-1 ${player ? 'items-end' : 'items-start'}`}>
      <span className="px-1 text-xs text-stone-400">{speaker}</span>
      <p className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl border px-3.5 py-2.5 text-base leading-7 ${
        player ? 'rounded-tr-sm border-[#c5a059]/30 bg-[#342a1d] text-[#f7e6c8]'
          : 'rounded-tl-sm border-stone-700/75 bg-[#20242b] text-stone-100'
      }`}>{text}</p>
    </div>
  );
}

export function NpcConversation({
  character, location, remote, node, turns, onChoose, onSpeak, onClose,
  modelName, loadingModel, plan, pending, error, onModel, onCancelStory,
}: NpcConversationProps) {
  const thread = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const atBottom = useRef(true);
  const [draft, setDraft] = useState('');
  const [unheard, setUnheard] = useState(false);
  const portrait = PORTRAITS[character.id];
  const fileMode = window.location.protocol === 'file:';
  const busy = pending !== null;

  useLayoutEffect(() => {
    if (thread.current && atBottom.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [turns, pending]);

  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="npc-conversation-title"
        onKeyDown={(event) => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) onClose(); }}
        className={`xuan-card grid h-[min(720px,calc(100dvh-1rem))] w-full max-w-4xl overflow-hidden rounded-xl sm:h-[min(720px,calc(100dvh-3rem))] ${
          portrait ? 'sm:grid-cols-[minmax(0,4fr)_minmax(0,9fr)]' : ''
        }`}
      >
        {portrait && (
          <img
            src={portrait}
            alt={`${character.name}立绘`}
            className="hidden h-full min-h-0 w-full object-cover object-[center_28%] sm:block"
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-col bg-[#15171c]">
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[#c5a059]/25 px-3 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {portrait && <img src={portrait} alt={`${character.name}立绘`} className="h-11 w-11 shrink-0 rounded-full border border-[#c5a059]/25 object-cover object-[center_24%] sm:hidden" />}
              <div className="min-w-0">
                <h2 id="npc-conversation-title" className="text-lg font-semibold text-[#e2c488]">{character.name}</h2>
                <p className="text-xs leading-5 text-stone-400">{location} · {remote ? '玉简传音' : '当面交谈'}</p>
              </div>
            </div>
            <button ref={closeButton} aria-label="结束交谈" onClick={onClose} type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-stone-200 hover:bg-white/10">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 border-b border-white/5 px-4 py-1 text-xs sm:px-5">
            <span role="status" title={modelName ?? undefined} className="min-w-0 text-stone-300">
              {loadingModel ? '正在读取本地模型…' : modelName ? '本地 AI 已连接' : '剧情对话'}
            </span>
            {fileMode ? <span className="py-2 text-[#e2c488]">请在本机网页载入 AI</span> : (
              <label className="flex min-h-9 cursor-pointer items-center rounded px-2 text-[#e2c488] hover:bg-white/5 focus-within:ring-1">
                {modelName ? '更换模型' : '载入本地模型'}
                <input type="file" accept=".gguf" aria-label="本地 GGUF 模型" disabled={loadingModel || busy}
                  className="sr-only" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setUnheard(false);
                      onModel(file);
                    }
                    event.currentTarget.value = '';
                  }} />
              </label>
            )}
          </div>
          {plan && <p className="shrink-0 break-words border-b border-[#c5a059]/15 px-4 py-2 text-xs text-[#e2c488] sm:px-5">{plan}</p>}
          <div ref={thread} role="log" aria-label="交谈记录" aria-relevant="additions"
            onScroll={(event) => {
              const element = event.currentTarget;
              atBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop < 48;
            }}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {turns.map((turn, index) => (
              <div key={index} className="space-y-2">
                {turn.day !== undefined && turns[index - 1]?.day !== turn.day && (
                  <p className="text-center text-xs text-stone-400">第 {turn.day} 日</p>
                )}
                <ChatBubble speaker={turn.role === 'user' ? '你' : character.name}
                  text={turn.content} player={turn.role === 'user'} />
                {turn.note && <p className="break-words text-center text-xs leading-5 text-[#e2c488]">{turn.note}</p>}
              </div>
            ))}
            {pending && (
              <>
                <ChatBubble speaker="你" player text={pending.input} />
                <div aria-live="off"><ChatBubble speaker={character.name} text={pending.reply || '…'} /></div>
              </>
            )}
          </div>
          <div className="shrink-0 border-t border-[#c5a059]/20 px-3 pb-3 pt-1 sm:px-5">
            {node.choices.length > 0 && (
              <details className="group">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm text-[#e2c488]">
                  <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0" /> {node.choices.some(choice => choice.action === 'outing') ? '这时可以做什么' : '可选话题与行动'}
                </summary>
                <div className="mb-2 max-h-[22dvh] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                  {node.choices.map((choice) => (
                    <button type="button" key={choice.outingId ?? choice.topic?.id ?? choice.absenceId ?? choice.action}
                      onClick={() => { atBottom.current = true; setUnheard(false); onChoose(choice); }}
                      disabled={busy || Boolean(choice.lockReason)}
                      className="block min-h-10 w-full rounded-md border border-[#c5a059]/25 bg-[#11141a] px-3 py-2 text-left text-sm text-stone-100 hover:border-[#e2c488] disabled:opacity-50">
                      {choice.label}
                      {choice.lockReason && <span className="ml-2 text-xs text-stone-400">{choice.lockReason}</span>}
                    </button>
                  ))}
                </div>
              </details>
            )}
            {error && <p role="alert" className="my-2 text-sm text-amber-200">{error}</p>}
            {unheard && <p role="status" className="my-2 text-xs text-stone-300">她没听明白。可以提一件具体的事，比如「后天在这里见面好吗？」</p>}
            {busy && (
              <div className="flex items-center justify-between gap-2 text-xs text-stone-300">
                <span role="status">{character.name}正在回复…</span>
                <button type="button" onClick={onCancelStory} className="min-h-9 px-2 text-stone-200">停止回复</button>
              </div>
            )}
            {node.choices.length > 0 && <form className="flex items-end gap-2" onSubmit={async (event) => {
              event.preventDefault();
              const line = draft.trim();
              if (!line || busy || loadingModel) return;
              atBottom.current = true;
              setUnheard(false);
              const result = onSpeak(line);
              if (await result) setDraft('');
              else if (result === false) setUnheard(true);
            }}>
                <textarea
                  aria-label="自己说一句"
                  value={draft}
                  maxLength={modelName ? 500 : 120}
                  readOnly={busy} disabled={loadingModel} rows={2}
                  onChange={(event) => { setDraft(event.target.value); setUnheard(false); }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  placeholder={`跟${character.name}说点什么…`}
                  className="min-w-0 flex-1 resize-none rounded-lg border border-stone-600 bg-[#11141a] px-3 py-2 text-base text-stone-100 focus:border-[#e2c488] focus:outline-none"
                />
                <button type="submit" disabled={busy || loadingModel || !draft.trim()}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#d7b471] px-3 text-sm font-semibold text-[#1b1610] hover:bg-[#e2c488] disabled:opacity-40">
                  <Send aria-hidden="true" className="h-4 w-4" /> 发送
                </button>
            </form>}
          </div>
        </div>
      </section>
    </div>
  );
}
