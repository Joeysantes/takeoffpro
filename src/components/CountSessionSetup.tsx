import { useState } from 'react';
import { useAssemblyStore } from '../store/assemblyStore';
import { useTakeoffStore } from '../store/takeoffStore';
import type { TradeCategory } from '../types';
import { COLOR_CYCLE } from '../utils/measurementUtils';

const TRADES: TradeCategory[] = ['General','Concrete','Drywall','Electrical','HVAC','Plumbing','Framing','Painting','Flooring'];

interface Props {
  existingCount: number;
  onClose: () => void;
}

export default function CountSessionSetup({ existingCount, onClose }: Props) {
  const { startCountSession } = useTakeoffStore();
  const { assemblies } = useAssemblyStore();

  const [name, setName] = useState('');
  const [trade, setTrade] = useState<TradeCategory>('General');
  const [unitCost, setUnitCost] = useState(0);
  const [selectedAssembly, setSelectedAssembly] = useState('');

  const countAssemblies = assemblies.filter((a) =>
    a.category === 'count' || a.category === 'mixed'
  );

  function applyAssembly(id: string) {
    setSelectedAssembly(id);
    const asm = assemblies.find((a) => a.id === id);
    if (!asm) return;
    const item = asm.items.find((i) => i.type === 'count') ?? asm.items[0];
    if (item) {
      if (!name) setName(item.name || asm.name);
      setTrade(item.trade);
      setUnitCost(item.unitCost);
    }
  }

  function handleStart() {
    const sessionName = name.trim() || `Count ${existingCount + 1}`;
    startCountSession({
      measurementId: null,
      name: sessionName,
      trade,
      color: COLOR_CYCLE[existingCount % COLOR_CYCLE.length],
      unitCost,
    });
    onClose();
  }

  return (
    <div className="absolute inset-0 bg-black/30 flex items-start justify-center pt-20 z-40">
      <div className="bg-white rounded-xl shadow-2xl w-80 p-5 border border-zinc-200">
        <h3 className="text-base font-semibold text-zinc-900 mb-3">Name this Count</h3>

        {countAssemblies.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-zinc-600 mb-1">From Assembly (optional)</label>
            <select
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={selectedAssembly}
              onChange={(e) => applyAssembly(e.target.value)}
            >
              <option value="">— Start from scratch —</option>
              {countAssemblies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Counter name</label>
          <input
            className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            placeholder={`Count ${existingCount + 1}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') onClose(); }}
          />
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Trade</label>
            <select
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={trade}
              onChange={(e) => setTrade(e.target.value as TradeCategory)}
            >
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Unit Cost</label>
            <input
              type="number"
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={unitCost}
              min={0}
              step={0.01}
              onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleStart}
          >
            Start Counting
          </button>
          <button
            className="px-3 py-2 text-sm rounded-lg border border-zinc-300 hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
