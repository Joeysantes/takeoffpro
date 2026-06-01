import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import type { TradeCategory, MeasurementType } from '../types';

const TRADES: TradeCategory[] = [
  'General', 'Concrete', 'Drywall', 'Electrical', 'HVAC', 'Plumbing', 'Framing', 'Painting', 'Flooring',
];

const TYPE_ICONS: Record<MeasurementType, string> = {
  linear: '↔',
  area: '▭',
  count: '#',
};

export default function TakeoffList() {
  const { project, currentPageIndex, selectedMeasurementId, updateMeasurement, deleteMeasurement, selectMeasurement } =
    useTakeoffStore();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const page = project?.pages[currentPageIndex];
  const measurements = page?.measurements ?? [];

  const grouped = TRADES.reduce<Record<string, typeof measurements>>((acc, trade) => {
    const group = measurements.filter((m) => m.trade === trade);
    if (group.length > 0) acc[trade] = group;
    return acc;
  }, {});

  if (measurements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-400 text-sm">
        <p>No measurements yet</p>
        <p className="text-xs mt-1">Select a tool and click on the plan</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {Object.entries(grouped).map(([trade, items]) => (
        <div key={trade} className="border-b border-zinc-100">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide bg-zinc-50 hover:bg-zinc-100"
            onClick={() => setCollapsed((c) => ({ ...c, [trade]: !c[trade] }))}
          >
            <span>{trade}</span>
            <span className="flex items-center gap-1">
              <span className="text-zinc-400 normal-case font-normal">{items.length}</span>
              <span>{collapsed[trade] ? '▶' : '▼'}</span>
            </span>
          </button>

          {!collapsed[trade] &&
            items.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer hover:bg-zinc-50 ${
                  m.id === selectedMeasurementId ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectMeasurement(m.id === selectedMeasurementId ? null : m.id)}
              >
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: m.color }}
                />
                <input
                  className="flex-1 min-w-0 border-none bg-transparent text-xs text-zinc-700 focus:outline-none focus:bg-white focus:border focus:border-blue-300 rounded px-1"
                  value={m.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateMeasurement(m.id, { name: e.target.value })}
                />
                <span className="text-zinc-400 shrink-0">{TYPE_ICONS[m.type]}</span>
                <span className="text-zinc-600 shrink-0 w-16 text-right">
                  {m.value.toFixed(1)} {m.unit}
                </span>
                <select
                  className="text-xs border border-zinc-200 rounded px-1 py-0.5 bg-white shrink-0"
                  value={m.trade}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateMeasurement(m.id, { trade: e.target.value as TradeCategory })}
                >
                  {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="text-zinc-400 text-xs">$</span>
                  <input
                    type="number"
                    className="w-14 border border-zinc-200 rounded px-1 py-0.5 text-xs bg-white"
                    value={m.unitCost}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateMeasurement(m.id, { unitCost: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step={0.01}
                  />
                </div>
                <button
                  className={`shrink-0 text-zinc-400 hover:text-zinc-700 ${m.visible ? '' : 'opacity-40'}`}
                  onClick={(e) => { e.stopPropagation(); updateMeasurement(m.id, { visible: !m.visible }); }}
                  title={m.visible ? 'Hide' : 'Show'}
                >
                  {m.visible ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
                <button
                  className="shrink-0 text-zinc-400 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); deleteMeasurement(m.id); }}
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
