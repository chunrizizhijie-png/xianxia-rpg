import { useEffect, useRef } from 'react';
import { Compass, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { EventChoice, GameEvent, PlayerState } from '../types/game';
import { checkEventStat } from '../engine/gameEngine';

interface EventModalProps {
  event: GameEvent;
  player: PlayerState;
  resultText: string | null;
  onSelectChoice: (choice: EventChoice) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<GameEvent['category'], string> = {
  secret_realm: '秘境夺宝',
  market: '坊市捡漏',
  sect_intrigue: '同门暗算',
  shura_field: '女修修罗场',
  inner_demon: '心魔劫',
  encounter: '仙途奇遇',
};

export function EventModal({
  event,
  player,
  resultText,
  onSelectChoice,
  onClose,
}: EventModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="event-title"
        onKeyDown={(press) => { if (press.key === 'Escape') onClose(); }}
        className="xuan-card flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl animate-fade-in">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#c5a059]/20 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Compass aria-hidden="true" className="h-5 w-5 shrink-0 text-[#c5a059]" />
            <div className="min-w-0">
              <p className="text-[11px] text-[#c5a059]">{CATEGORY_LABEL[event.category]}</p>
              <h3 id="event-title" className="break-words text-lg font-bold text-[#e2c488]">{event.title}</h3>
            </div>
          </div>
          <button ref={closeButton} type="button" aria-label={resultText === null ? '暂收奇遇' : '关闭奇遇'}
            onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-stone-200 hover:bg-white/10">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <p className="xuan-panel whitespace-pre-line rounded-xl p-4 text-base leading-relaxed text-stone-200">
            {event.description}
          </p>

          {resultText !== null ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#c5a059]/40 bg-[#c5a059]/10 p-4 text-sm leading-relaxed text-[#f3dfb6]">
                {resultText}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onClose}
                  className="rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] px-5 py-2 text-xs font-bold text-[#0f1115]">
                  收起传闻 · 继续问道
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {event.choices.map((choice) => {
                const passed = checkEventStat(player, choice.check);
                return (
                  <button key={choice.id} type="button" onClick={() => onSelectChoice(choice)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#c5a059]/25 bg-[#12151b] p-3.5 text-left transition hover:border-[#c5a059] hover:bg-[#1b2029]">
                    <span className="text-sm text-stone-100">{choice.text}</span>
                    {choice.check && (
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${
                        passed ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-950/50 text-amber-300'
                      }`}>
                        {passed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {choice.check.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
