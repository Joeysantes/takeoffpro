import React from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import type { TradeCategory } from '../types';

const TRADES: TradeCategory[] = [
  'General', 'Concrete', 'Drywall', 'Electrical', 'HVAC', 'Plumbing', 'Framing', 'Painting', 'Flooring',
];

export default function SummaryTable() {
  const { project, currentPageIndex, updateMeasurement } = useTakeoffStore();

  const page = project?.pages[currentPageIndex];
  const measurements = page?.measurements ?? [];

  if (measurements.length === 0) return null;

  const grouped = TRADES.reduce<Record<string, typeof measurements>>((acc, trade) => {
    const group = measurements.filter((m) => m.trade === trade);
    if (group.length > 0) acc[trade] = group;
    return acc;
  }, {});

  const grand = measurements.reduce((s, m) => s + m.value * m.unitCost, 0);

  return (
    <div className="border-t border-zinc-200 shrink-0 max-h-64 overflow-y-auto">
      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide bg-zinc-50 sticky top-0">
        Summary
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-2 py-1 text-zinc-500 font-medium">Item</th>
            <th className="text-right px-2 py-1 text-zinc-500 font-medium">Qty</th>
            <th className="text-right px-2 py-1 text-zinc-500 font-medium">Unit</th>
            <th className="text-right px-2 py-1 text-zinc-500 font-medium">$/Unit</th>
            <th className="text-right px-2 py-1 text-zinc-500 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([trade, items]) => {
            const subtotal = items.reduce((s, m) => s + m.value * m.unitCost, 0);
            return (
              <React.Fragment key={trade}>
                <tr className="bg-zinc-50">
                  <td colSpan={5} className="px-2 py-1 font-semibold text-zinc-600 text-xs uppercase tracking-wide">
                    {trade}
                  </td>
                </tr>
                {items.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100">
                    <td className="px-2 py-1 text-zinc-700">{m.name}</td>
                    <td className="px-2 py-1 text-right text-zinc-600">{m.value.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right text-zinc-500">{m.unit}</td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        className="w-14 text-right border border-zinc-200 rounded px-1 bg-white text-xs"
                        value={m.unitCost}
                        onChange={(e) => updateMeasurement(m.id, { unitCost: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={0.01}
                      />
                    </td>
                    <td className="px-2 py-1 text-right text-zinc-700">
                      ${(m.value * m.unitCost).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <td colSpan={4} className="px-2 py-1 text-right text-zinc-500 font-medium">
                    {trade} subtotal
                  </td>
                  <td className="px-2 py-1 text-right text-zinc-700 font-medium">
                    ${subtotal.toFixed(2)}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
          <tr className="bg-blue-50 border-t-2 border-blue-200">
            <td colSpan={4} className="px-2 py-1.5 text-right font-bold text-zinc-800">
              Grand Total
            </td>
            <td className="px-2 py-1.5 text-right font-bold text-blue-700">
              ${grand.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
