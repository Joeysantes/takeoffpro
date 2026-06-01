import { useState } from 'react';
import type { UploadOptions, ColorMode } from '../types';

interface Props {
  fileName: string;
  onConfirm: (options: UploadOptions) => void;
  onCancel: () => void;
}

const COLOR_OPTIONS: { mode: ColorMode; label: string; desc: string }[] = [
  { mode: 'full', label: 'Full Color', desc: 'Largest file, best quality' },
  { mode: 'grayscale', label: 'Grayscale', desc: 'Smaller, faster navigation' },
  { mode: 'bw', label: 'Black & White', desc: 'Smallest, fastest' },
];

const RES_OPTIONS: { scale: number; label: string; desc: string }[] = [
  { scale: 0.75, label: 'Draft', desc: '75% — fastest' },
  { scale: 1, label: 'Standard', desc: '100% — recommended' },
  { scale: 1.5, label: 'High', desc: '150% — sharpest' },
];

export default function UploadOptionsDialog({ fileName, onConfirm, onCancel }: Props) {
  const [colorMode, setColorMode] = useState<ColorMode>('full');
  const [scale, setScale] = useState(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[420px] p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Process Plan</h2>
        <p className="text-sm text-zinc-500 mb-5 truncate" title={fileName}>{fileName}</p>

        <div className="mb-5">
          <div className="text-sm font-medium text-zinc-700 mb-2">Color Mode</div>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_OPTIONS.map(({ mode, label, desc }) => (
              <button
                key={mode}
                className={`flex flex-col items-center p-3 rounded-lg border-2 text-center transition-colors ${
                  colorMode === mode
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setColorMode(mode)}
              >
                <div
                  className="w-8 h-6 rounded mb-1.5 border border-zinc-300"
                  style={{
                    background:
                      mode === 'full'
                        ? 'linear-gradient(135deg, #ef4444 0%, #3b82f6 50%, #22c55e 100%)'
                        : mode === 'grayscale'
                        ? 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 50%, #4b5563 100%)'
                        : 'linear-gradient(135deg, #000 0%, #888 50%, #fff 100%)',
                  }}
                />
                <span className="text-xs font-medium text-zinc-800">{label}</span>
                <span className="text-xs text-zinc-400 mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm font-medium text-zinc-700 mb-2">Resolution</div>
          <div className="grid grid-cols-3 gap-2">
            {RES_OPTIONS.map(({ scale: s, label, desc }) => (
              <button
                key={s}
                className={`flex flex-col items-center p-3 rounded-lg border-2 text-center transition-colors ${
                  scale === s
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setScale(s)}
              >
                <span className="text-sm font-semibold text-zinc-800">{label}</span>
                <span className="text-xs text-zinc-400 mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Lower resolution = smaller file size = faster page navigation
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={() => onConfirm({ colorMode, scale })}
          >
            Process File
          </button>
        </div>
      </div>
    </div>
  );
}
