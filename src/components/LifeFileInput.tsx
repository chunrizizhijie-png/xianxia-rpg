import { useState } from 'react';
import { Upload } from 'lucide-react';

export function LifeFileInput({ onImport }: {
  onImport: (text: string) => { ok: boolean; message: string };
}) {
  const [feedback, setFeedback] = useState('');
  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-[#c5a059]/35 px-3 py-2 text-xs text-[#e2c488] focus-within:ring-1 focus-within:ring-[#e2c488]">
        <Upload className="h-3.5 w-3.5" />
        导入存档文件
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              setFeedback(onImport(await file.text()).message);
            } catch {
              setFeedback('无法读取此文件，请选择有效的存档 JSON。');
            }
            input.value = '';
          }}
        />
      </label>
      {feedback && <p role="status" className="mt-1.5 text-xs text-stone-300">{feedback}</p>}
    </div>
  );
}
