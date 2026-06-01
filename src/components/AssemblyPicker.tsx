import { useState } from 'react';
import { useAssemblyStore } from '../store/assemblyStore';
import type { MeasurementType, TradeCategory, PriceMode } from '../types';

interface PreFill {
  name: string;
  trade: TradeCategory;
  unitCost: number;
  priceMode?: PriceMode;
  formula?: string;
  height?: number;
}

interface Props {
  toolType: MeasurementType;
  onApply: (preFill: PreFill) => void;
  onSkip: () => void;
}

export default function AssemblyPicker({ toolType, onApply, onSkip }: Props) {
  const { assemblies } = useAssemblyStore();
  const [selectedId, setSelectedId] = useState('');
  const [selectedItemIdx, setSelectedItemIdx] = useState(0);

  const relevant = assemblies.filter(
    (a) => a.category === toolType || a.category === 'mixed'
  );

  if (relevant.length === 0) {
    onSkip();
    return null;
  }

  const selectedAssembly = relevant.find((a) => a.id === selectedId);
  const items = selectedAssembly?.items.filter((i) => i.type === toolType || selectedAssembly.category === 'mixed') ?? [];

  function handleApply() {
    if (!selectedAssembly) { onSkip(); return; }
    const item = items[selectedItemIdx] ?? items[0];
    if (!item) { onSkip(); return; }
    onApply({
      name: item.name || selectedAssembly.name,
      trade: item.trade,
      unitCost: item.unitCost,
      priceMode: item.priceMode,
      formula: item.formula,
      height: item.height,
    });
  }

  return (
    <div className="absolute inset-0 bg-black/25 flex items-start justify-center pt-16 z-40">
      <div className="bg-white rounded-xl shadow-2xl w-80 p-4 border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-800 mb-3">
          Use an Assembly? <span className="font-normal text-zinc-400 capitalize">({toolType})</span>
        </h3>

        <div className="mb-3">
          <select
            className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setSelectedItemIdx(0); }}
          >
            <option value="">— No assembly —</option>
            {relevant.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {selectedAssembly && items.length > 1 && (
          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">Item</label>
            <select
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={selectedItemIdx}
              onChange={(e) => setSelectedItemIdx(Number(e.target.value))}
            >
              {items.map((item, i) => (
                <option key={i} value={i}>{item.name || `Item ${i + 1}`} — ${item.unitCost}/{item.unit}</option>
              ))}
            </select>
          </div>
        )}

        {selectedAssembly && items[selectedItemIdx] && (
          <div className="mb-3 p-2 bg-zinc-50 rounded-lg text-xs text-zinc-600 space-y-0.5">
            <div><span className="text-zinc-400">Trade:</span> {items[selectedItemIdx].trade}</div>
            <div><span className="text-zinc-400">Unit Cost:</span> ${items[selectedItemIdx].unitCost}/{items[selectedItemIdx].unit}</div>
            {items[selectedItemIdx].formula && <div><span className="text-zinc-400">Formula:</span> {items[selectedItemIdx].formula}</div>}
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleApply}
            disabled={!selectedId}
          >
            Use Assembly
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 hover:bg-zinc-50"
            onClick={onSkip}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
