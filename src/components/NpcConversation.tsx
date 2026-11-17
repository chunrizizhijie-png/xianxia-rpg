import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PORTRAITS } from '../data/portraits';
import type { DialogueChoice, DialogueNode } from '../engine/npcDialogue';
import type { CharacterData } from '../types/game';

export interface ConversationTurn {
  speaker: string;
  line: string;
}

interface NpcConversationProps {
  character: CharacterData;
  location: string;
  remote: boolean;
  node: DialogueNode;
  turns: ConversationTurn[];
  onChoose: (choice: DialogueChoice) => void;
  onSpeak: (line: string) => boolean;
  openStoryReady: boolean;
  storyBusy: boolean;
  storyError: string | null;
  onEnableStory: () => void;
  onCancelStory: () => void;
  onClose: () => void;
}

export function NpcConversation({
  character, location, remote, node, turns, onChoose, onSpeak, onClose,
  openStoryReady, storyBusy, storyError, onEnableStory, onCancelStory,
}: NpcConversationProps) {
  const threadEnd = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState('');
  const [unheard, setUnheard] = useState(false);
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length]);
  useEffect(() => {
    closeButton.current?.focus();
  }, []);
  const portrait = PORTRAITS[character.id];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="npc-conversation-title"
        onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
        className="xuan-card grid max-h-[94dvh] w-full max-w-4xl grid-cols-1 overflow-y-auto rounded-xl sm:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]"
      >
        {portrait && (
          <img
            src={portrait}
            alt={`${character.name}立绘`}
            className="h-44 w-full object-cover object-[center_24%] sm:h-full sm:object-[center_25%]"
          />
        )}
        <div className="min-w-0 space-y-4 p-4 sm:p-6">
          <header className="flex items-start justify-between gap-4 border-b border-[#c5a059]/30 pb-3">
            <div>
              <h2 id="npc-conversation-title" className="text-lg font-semibold text-[#e2c488]">{character.name}</h2>
              <p className="mt-1 text-xs text-stone-400">{location} · {remote ? '玉简传音' : '当面交谈'}</p>
              {openStoryReady
                ? <p className="mt-1 text-xs text-[#e2c488]">本地自由叙事</p>
                : <button type="button" onClick={onEnableStory} className="mt-1 text-xs text-[#e2c488]">载入本地模型</button>}
            </div>
            <button ref={closeButton} aria-label="结束交谈" onClick={onClose} type="button"
              className="rounded p-2 text-stone-300 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="max-h-[28dvh] space-y-3 overflow-y-auto pr-2 sm:max-h-56" aria-live="polite">
            {turns.map((turn, index) => (
              <p key={index} className={`whitespace-pre-line break-words text-base leading-relaxed ${turn.speaker === '你' ? 'text-stone-400' : 'text-stone-100'}`}>
                {turn.speaker === '你' && <span className="mr-2 text-xs text-[#e2c488]">你</span>}
                {turn.line}
              </p>
            ))}
            <div ref={threadEnd} />
          </div>
          {(node.choices.length > 0 || openStoryReady) && (
            <form onSubmit={(event) => {
              event.preventDefault();
              const line = draft.trim();
              if (!line) return;
              if (onSpeak(line)) {
                setDraft('');
                setUnheard(false);
              } else {
                setUnheard(true);
              }
            }}>
              <div className="flex gap-2">
                <input
                  aria-label="自己说一句"
                  value={draft}
                  maxLength={openStoryReady ? 500 : 120}
                  disabled={storyBusy}
                  onChange={(event) => { setDraft(event.target.value); setUnheard(false); }}
                  placeholder={openStoryReady ? '说一句话，或描述此刻的行动' : '用自己的话问她，或回应下面的选项'}
                  className="min-w-0 flex-1 rounded-md border border-stone-700 bg-[#11141a] px-3 py-2 text-sm text-stone-100"
                />
                <button type="submit" disabled={storyBusy || !draft.trim()}
                  className="shrink-0 rounded-md border border-[#c5a059]/45 px-3 py-2 text-sm text-[#e2c488] disabled:opacity-40">
                  开口
                </button>
              </div>
              {storyBusy && (
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-400">
                  <span role="status">正在推演这一幕…</span>
                  <button type="button" onClick={onCancelStory} className="px-2 py-1 text-stone-200">取消这一回</button>
                </div>
              )}
              {storyError && <p role="alert" className="mt-2 text-xs text-amber-200">{storyError}</p>}
              {unheard && (
                <p role="status" className="mt-2 text-xs text-stone-400">
                  试试问行程、问候，或用自己的话回应下方的一个选项。
                </p>
              )}
            </form>
          )}
          <div className="space-y-2">
            {node.choices.map((choice) => (
              <button
                type="button"
                key={choice.topic?.id ?? choice.action}
                onClick={() => { setUnheard(false); onChoose(choice); }}
                disabled={storyBusy || Boolean(choice.lockReason)}
                className="block min-h-10 w-full rounded-md border border-[#c5a059]/30 bg-[#11141a] px-3 py-2 text-left text-sm text-stone-100 hover:border-[#e2c488] disabled:opacity-50"
              >
                {choice.label}
                {choice.lockReason && <span className="ml-2 text-xs text-stone-400">{choice.lockReason}</span>}
              </button>
            ))}
            <button type="button" onClick={onClose} className="min-h-10 px-2 text-sm text-stone-400 hover:text-stone-100">
              告辞
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
