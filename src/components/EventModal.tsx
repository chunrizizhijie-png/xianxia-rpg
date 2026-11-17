import React from 'react';
import { Compass, CheckCircle2, AlertTriangle } from 'lucide-react';
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

export const EventModal: React.FC<EventModalProps> = ({
  event,
  player,
  resultText,
  onSelectChoice,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-xl w-full p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#c5a059]" />
            <h3 className="text-lg font-bold text-[#e2c488]">{event.title}</h3>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e2c488]">
            {CATEGORY_LABEL[event.category]}
          </span>
        </div>

        <p className="whitespace-pre-line text-base leading-relaxed text-stone-200 xuan-panel rounded-xl p-4">
          {event.description}
        </p>

        {resultText ? (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-[#c5a059]/10 border border-[#c5a059]/40 text-sm leading-relaxed text-[#f3dfb6]">
              {resultText}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs"
              >
                收起传闻 · 继续问道
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {event.choices.map((choice) => {
              const passed = checkEventStat(player, choice.check);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice)}
                  className="w-full text-left p-3.5 rounded-xl bg-[#12151b] hover:bg-[#1b2029] border border-[#c5a059]/25 hover:border-[#c5a059] transition flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-stone-100">{choice.text}</span>
                  {choice.check && (
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
                        passed
                          ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/50'
                          : 'border-amber-500/40 text-amber-300 bg-amber-950/50'
                      }`}
                    >
                      {passed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {choice.check.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
