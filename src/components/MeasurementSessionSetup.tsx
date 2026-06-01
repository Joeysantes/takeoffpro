import { useState } from 'react';
import { useAssemblyStore } from '../store/assemblyStore';
import { useTakeoffStore } from '../store/takeoffStore';
import type { MeasurementSession } from '../store/takeoffStore';
import type { TradeCategory, MeasurementType } from '../types';
import { COLOR_CYCLE } from '../utils/measurementUtils';

const TRADES: TradeCategory[] = ['General','Concrete','Drywall','Electrical','HVAC','Plumbing','Framing','Painting','Flooring'];

interface Props {
  toolType: MeasurementType;
  existingCount: number; // how many of this type already exist
  onClose: () => void;
}

const TYPE_LABELS: Record<MeasurementType, { noun: string; verb: string }> = {
  linear: { noun: 'Linear',  verb: 'measuring' },
  area:   { noun: 'Area',    verb: 'measuring' },
  count:  { noun: 'Counter', verb: 'counting'  },
};

export default function MeasurementSessionSetup({ toolType, existingCount, onClose }: Props) {
  const { startSession } = useTakeoffStore();
  const { assemblies } = useAssemblyStore();

  const [name, setName] = useState('');
  const [trade, setTrade] = useState<TradeCategory>('General');
  const [unitCost, setUnitCost] = useState(0);
  const [formula, setFormula] = useState('');
  const [selectedAssembly, setSelectedAssembly] = useState('');

  const relevantAssemblies = assemblies.filter(
    (a) => a.category === toolType || a.category === 'mixed'
  );

  function applyAssembly(id: string) {
    setSelectedAssembly(id);
    const asm = assemblies.find((a) => a.id === id);
    if (!asm) return;
    const item = asm.items.find((i) => i.type === toolType) ?? asm.items[0];
    if (item) {
      if (!name) setName(item.name || asm.name);
      setTrade(item.trade);
      setUnitCost(item.unitCost);
      setFormula(item.formula ?? '');
    }
  }

  function handleStart() {
    const sessionName = name.trim() || `${TYPE_LABELS[toolType].noun} ${existingCount + 1}`;
    const session: MeasurementSession = {
      type: toolType,
      name: sessionName,
      trade,
      color: COLOR_CYCLE[existingCount % COLOR_CYCLE.length],
      unitCost,
      formula: formula || undefined,
      drawCount: 0,
      countMeasurementId: null,
    };
    startSession(session);
    onClose();
  }

  const { noun } = TYPE_LABELS[toolType];

  return (
    <div className="absolute inset-0 bg-black/30 flex items-start justify-center pt-16 z-40">
      <div className="bg-white rounded-xl shadow-2xl w-84 p-5 border border-zinc-200" style={{ width: 340 }}>
        <h3 className="text-base font-semibold text-zinc-900 mb-3">Start {noun} Session</h3>

        {relevantAssemblies.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-zinc-500 mb-1">From Assembly (optional)</label>
            <select
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={selectedAssembly}
              onChange={(e) => applyAssembly(e.target.value)}
            >
              <option value="">— Start from scratch —</option>
              {relevantAssemblies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
          <input
            className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            placeholder={`e.g. ${toolType === 'count' ? 'Doors & Frames' : toolType === 'linear' ? 'Exterior Walls' : 'Living Room Floor'}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') onClose(); }}
          />
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Trade</label>
            <select
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
              value={trade}
              onChange={(e) => setTrade(e.target.value as TradeCategory)}
            >
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Unit Cost $</label>
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

        {(toolType === 'linear' || toolType === 'area') && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Formula (optional)</label>
            <input
              className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm font-mono"
              placeholder={toolType === 'linear' ? 'length × h × $cost' : 'area × h × $cost'}
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleStart}
          >
            Start {noun}
          </button>
          <button
            className="px-4 py-2 text-sm rounded-lg border border-zinc-300 hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
