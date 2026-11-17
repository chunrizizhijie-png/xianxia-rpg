import React from 'react';
import { Skull, RotateCcw } from 'lucide-react';

interface EpitaphModalProps {
  title: string;
  inscription: string;
  onReincarnate: () => void;
  onExportChronicle: () => void;
}

export const EpitaphModal: React.FC<EpitaphModalProps> = ({
  title,
  inscription,
  onReincarnate,
  onExportChronicle,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-lg w-full p-7 text-center space-y-5 animate-fade-in border-[#c5a059]/50">
        <div className="w-14 h-14 mx-auto rounded-full bg-stone-900 border border-[#c5a059]/40 flex items-center justify-center">
          <Skull className="w-7 h-7 text-[#c5a059]" />
        </div>
        <div>
          <p className="text-xs tracking-[0.3em] text-stone-500">身陨道消 · 因果结算</p>
          <h2 className="text-2xl font-bold text-[#e2c488] mt-1">{title}</h2>
        </div>
        <div className="xuan-panel rounded-xl p-5 text-sm leading-loose text-stone-300 text-left">
          {inscription}
        </div>
        <button type="button" onClick={onExportChronicle}
          className="mr-2 rounded-lg border border-[#c5a059]/40 px-4 py-3 text-sm text-[#e2c488]">
          导出人生纪事
        </button>
        <button
          type="button"
          onClick={onReincarnate}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-sm hover:brightness-110 transition"
        >
          <RotateCcw className="w-4 h-4" /> 轮回转世 · 再续仙缘
        </button>
      </div>
    </div>
  );
};
