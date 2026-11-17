import React, { useState } from 'react';
import { Save, Upload, Download, Code2, Play, X, Trash2 } from 'lucide-react';
import { SaveSlotData } from '../types/game';
import { downloadText } from '../engine/lifeSave';
import { LifeFileInput } from './LifeFileInput';

interface SettingsAndHotReloadModalProps {
  saveSlots: (SaveSlotData | null)[];
  onSaveToSlot: (slotId: number) => boolean;
  onLoadFromSlot: (slotId: number) => void;
  onDeleteSlot: (slotId: number) => void;
  onExportSaveJson: () => string;
  daoName: string;
  canSave: boolean;
  onAnotherLife: () => void;
  onImportSaveJson: (jsonStr: string) => { ok: boolean; message: string };
  onInjectCustomData: (
    type: 'events' | 'characters',
    jsonStr: string,
    triggerImmediately: boolean
  ) => { ok: boolean; message: string };
  onClose: () => void;
}

const SAMPLE_EVENT_JSON = `[
  {
    "id": "evt_custom_demo",
    "title": "太古星陨坠落",
    "category": "encounter",
    "description": "一道流光划破夜空坠入后山灵潭，潭底隐约浮现上古星纹。",
    "choices": [
      {
        "id": "absorb_star",
        "text": "引星辰之力淬炼神识（检定：神识 >= 15）",
        "check": { "stat": "sense", "threshold": 15, "label": "神识 >= 15" },
        "successOutcome": {
          "text": "星辉入体，你的神识与修为暴涨！",
          "expDelta": 150,
          "senseDelta": 6,
          "spiritStonesDelta": 100
        },
        "failOutcome": {
          "text": "星力过于狂暴，你被震退数步。",
          "hpDelta": -40
        }
      }
    ]
  }
]`;

export const SettingsAndHotReloadModal: React.FC<SettingsAndHotReloadModalProps> = ({
  saveSlots,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onExportSaveJson,
  daoName,
  canSave,
  onAnotherLife,
  onImportSaveJson,
  onInjectCustomData,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'saves' | 'hot_reload'>('saves');
  const [saveJsonText, setSaveJsonText] = useState('');
  const [hotType, setHotType] = useState<'events' | 'characters'>('events');
  const [hotJson, setHotJson] = useState(SAMPLE_EVENT_JSON);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleExport = () => {
    const data = onExportSaveJson();
    setSaveJsonText(data);
    downloadText(`${daoName}·修行存档.json`, data, 'application/json');
    setFeedback({ ok: true, text: '已发起存档文件下载，也可复制下方 JSON。' });
  };

  const handleImport = () => {
    const res = onImportSaveJson(saveJsonText);
    setFeedback({ ok: res.ok, text: res.message });
  };

  const handleInject = (triggerNow: boolean) => {
    const res = onInjectCustomData(hotType, hotJson, triggerNow);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok && triggerNow) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="xuan-card rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('saves')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activeTab === 'saves'
                  ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488]'
                  : 'border-stone-800 text-stone-400'
              }`}
            >
              玉简存档槽位
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hot_reload')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activeTab === 'hot_reload'
                  ? 'bg-[#c5a059]/20 border-[#c5a059] text-[#e2c488]'
                  : 'border-stone-800 text-stone-400'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              剧情/角色 JSON 热扩展器
            </button>
          </div>
          <button type="button" aria-label="关闭存档与设置" onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div
            className={`text-xs px-3 py-2 rounded-lg border ${
              feedback.ok
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {activeTab === 'saves' ? (
          <div className="space-y-4">
            <div className="space-y-2.5">
              {[0, 1, 2].map((slotId) => {
                const slot = saveSlots[slotId];
                return (
                  <div
                    key={slotId}
                    className="xuan-panel rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#e2c488]">
                        存档槽位 {slotId + 1}
                      </p>
                      {slot ? (
                        <p className="text-xs text-stone-300 mt-0.5">
                          {slot.daoName} · {slot.realmName} · {slot.ageText}
                          <span className="text-stone-500 ml-2">({slot.savedAt})</span>
                        </p>
                      ) : (
                        <p className="text-xs text-stone-500 mt-0.5">空置玉简</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canSave}
                        onClick={() => {
                          const ok = onSaveToSlot(slotId);
                          setFeedback({ ok, text: ok ? `已保存至槽位 ${slotId + 1}。` : '本地存档写入失败。' });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#c5a059]/20 hover:bg-[#c5a059]/35 border border-[#c5a059]/45 text-xs text-[#e2c488] disabled:opacity-40"
                      >
                        <Save className="w-3.5 h-3.5" /> 覆盖保存
                      </button>
                      {slot && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onLoadFromSlot(slotId);
                              setFeedback({ ok: true, text: `已读取槽位 ${slotId + 1}。` });
                            }}
                            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs text-stone-200"
                          >
                            读取
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSlot(slotId)}
                            className="p-1.5 rounded text-stone-500 hover:text-rose-400"
                            title="删除存档"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="gold-divider" />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-300">
                  存档 JSON 导入 / 导出
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={handleExport}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-stone-800 hover:bg-stone-700 text-xs text-stone-200 disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> 导出当前存档
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#c5a059]/20 hover:bg-[#c5a059]/35 border border-[#c5a059]/45 text-xs text-[#e2c488]"
                  >
                    <Upload className="w-3.5 h-3.5" /> 导入覆盖
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={saveJsonText}
                onChange={(e) => setSaveJsonText(e.target.value)}
                placeholder="在此粘贴存档 JSON 或点击导出..."
                className="w-full p-3 rounded-lg bg-[#0f1115] border border-stone-800 text-[11px] font-mono text-stone-300 focus:outline-none focus:border-[#c5a059]"
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <LifeFileInput onImport={onImportSaveJson} />
                <button type="button" onClick={onAnotherLife} disabled={!canSave}
                  className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-200 disabled:opacity-40">
                  返回立道号
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-300">
                粘贴符合 <code className="text-[#e2c488]">GameEvent[]</code> 或{' '}
                <code className="text-[#e2c488]">CharacterData[]</code> 规范的 JSON 数组，运行时热注入立即生效。
              </p>
              <select
                value={hotType}
                onChange={(e) => setHotType(e.target.value as 'events' | 'characters')}
                className="px-2.5 py-1 rounded bg-[#0f1115] border border-[#c5a059]/40 text-xs text-[#e2c488]"
              >
                <option value="events">新奇遇事件 (events)</option>
                <option value="characters">新女修角色 (characters)</option>
              </select>
            </div>

            <textarea
              rows={11}
              value={hotJson}
              onChange={(e) => setHotJson(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#0f1115] border border-[#c5a059]/30 text-[11px] font-mono text-stone-200 focus:outline-none focus:border-[#c5a059]"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleInject(false)}
                className="px-4 py-2 rounded-lg border border-[#c5a059]/45 text-xs text-[#e2c488] hover:bg-[#c5a059]/15"
              >
                仅注入池中
              </button>
              <button
                type="button"
                onClick={() => handleInject(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#b8893a] to-[#d6b26b] text-[#0f1115] font-bold text-xs"
              >
                <Play className="w-3.5 h-3.5" /> 注入并立即测试
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
