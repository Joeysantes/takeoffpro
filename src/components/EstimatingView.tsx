import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { exportToExcel, exportToPDF, exportToCSV } from '../utils/exportUtils';
import type { TradeCategory, PriceMode } from '../types';

const TRADES: TradeCategory[] = [
  'General', 'Concrete', 'Drywall', 'Electrical', 'HVAC',
  'Plumbing', 'Framing', 'Painting', 'Flooring',
];

function computeTotal(m: { type: string; value: number; height?: number; priceMode?: PriceMode; unitCost: number }): number {
  if (m.type === 'linear' && m.priceMode === 'per-sqft' && m.height) return m.value * m.height * m.unitCost;
  if (m.type === 'area' && m.priceMode === 'per-cuft' && m.height) return m.value * m.height * m.unitCost;
  return m.value * m.unitCost;
}

function computeQty(m: { type: string; value: number; height?: number; priceMode?: PriceMode }): number {
  if (m.type === 'linear' && m.priceMode === 'per-sqft' && m.height) return m.value * m.height;
  if (m.type === 'area' && m.priceMode === 'per-cuft' && m.height) return m.value * m.height;
  return m.value;
}

function computeUnit(m: { unit: string; priceMode?: PriceMode }): string {
  if (m.priceMode === 'per-sqft') return 'sq ft';
  if (m.priceMode === 'per-cuft') return 'cu ft';
  return m.unit;
}

export default function EstimatingView() {
  const { project, updateMeasurement, duplicateMeasurement } = useTakeoffStore();
  const [pageFilter, setPageFilter] = useState<number | 'all'>('all');
  const [duplicateTarget, setDuplicateTarget] = useState<Record<string, number>>({});

  if (!project) return null;

  const getPageName = (idx: number) =>
    project.pages.find((p) => p.pageIndex === idx)?.name ?? `Page ${idx + 1}`;

  const allMeasurements = project.pages.flatMap((p) => p.measurements);
  const filtered = pageFilter === 'all' ? allMeasurements : allMeasurements.filter((m) => m.pageIndex === pageFilter);
  const grand = filtered.reduce((s, m) => s + computeTotal(m), 0);

  const grouped = TRADES.reduce<Record<string, typeof filtered>>((acc, trade) => {
    const group = filtered.filter((m) => m.trade === trade);
    if (group.length > 0) acc[trade] = group;
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="h-12 border-b border-zinc-200 flex items-center px-4 gap-3 shrink-0 bg-zinc-50">
        <span className="font-semibold text-zinc-700 text-sm">{project.name}</span>
        <span className="text-zinc-300">|</span>
        <select
          className="border border-zinc-300 rounded-md px-2 py-1 text-sm"
          value={pageFilter === 'all' ? 'all' : pageFilter}
          onChange={(e) => setPageFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All Pages</option>
          {project.pages.map((p) => (
            <option key={p.pageIndex} value={p.pageIndex}>{getPageName(p.pageIndex)}</option>
          ))}
        </select>
        <span className="text-sm text-zinc-500">{filtered.length} items</span>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50" onClick={() => exportToExcel(project)}>Excel</button>
          <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50" onClick={() => exportToPDF(project)}>PDF Report</button>
          <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50" onClick={() => exportToCSV(project)}>CSV</button>
          <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 text-zinc-400 cursor-not-allowed" disabled title="Coming soon">Template</button>
        </div>
      </div>

      {/* Grand total banner */}
      <div className="px-4 py-2 bg-blue-600 text-white flex items-center justify-between shrink-0">
        <span className="text-sm font-medium">Project Grand Total</span>
        <span className="text-xl font-bold">${grand.toFixed(2)}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 text-sm">
            <p>No measurements found</p>
            <p className="text-xs mt-1">Switch to Plan View and add some takeoffs first</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-100 z-10">
              <tr className="border-b border-zinc-300">
                <th className="text-left px-3 py-2 text-zinc-600 font-semibold">Page</th>
                <th className="text-left px-3 py-2 text-zinc-600 font-semibold">Name</th>
                <th className="text-left px-3 py-2 text-zinc-600 font-semibold">Type</th>
                <th className="text-right px-3 py-2 text-zinc-600 font-semibold">Qty</th>
                <th className="text-left px-3 py-2 text-zinc-600 font-semibold">Unit</th>
                <th className="text-right px-3 py-2 text-zinc-600 font-semibold">Height ft</th>
                <th className="text-right px-3 py-2 text-zinc-600 font-semibold">Unit Cost</th>
                <th className="text-left px-3 py-2 text-zinc-600 font-semibold">Formula</th>
                <th className="text-right px-3 py-2 text-zinc-600 font-semibold">Total</th>
                <th className="px-2 py-2 text-zinc-600 font-semibold">Dup.</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([trade, items]) => {
                const subtotal = items.reduce((s, m) => s + computeTotal(m), 0);
                return (
                  <>
                    <tr key={`${trade}-hdr`} className="bg-zinc-50">
                      <td colSpan={10} className="px-3 py-1.5 font-semibold text-zinc-600 text-xs uppercase tracking-wide border-t border-zinc-200">{trade}</td>
                    </tr>
                    {items.map((m) => (
                      <tr key={m.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="px-3 py-1.5 text-zinc-500">{getPageName(m.pageIndex)}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: m.color }} />
                            <input
                              className="border-none bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 text-xs text-zinc-700 w-28"
                              value={m.name}
                              onChange={(e) => updateMeasurement(m.id, { name: e.target.value })}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-zinc-500 capitalize">{m.type}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-700">{computeQty(m).toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-zinc-500">{computeUnit(m)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number"
                            className="w-16 text-right border border-zinc-200 rounded px-1 bg-white text-xs"
                            value={m.height ?? ''} placeholder="—" min={0} step={0.1}
                            onChange={(e) => updateMeasurement(m.id, { height: parseFloat(e.target.value) || undefined })}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number"
                            className="w-20 text-right border border-zinc-200 rounded px-1 bg-white text-xs"
                            value={m.unitCost} min={0} step={0.01}
                            onChange={(e) => updateMeasurement(m.id, { unitCost: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className="border border-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono bg-white w-40"
                            value={m.formula ?? ''} placeholder="formula"
                            onChange={(e) => updateMeasurement(m.id, { formula: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-zinc-800">${computeTotal(m).toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <select
                              className="text-xs border border-zinc-200 rounded px-1 py-0.5 w-16"
                              value={duplicateTarget[m.id] ?? m.pageIndex}
                              onChange={(e) => setDuplicateTarget((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
                            >
                              {project.pages.map((p) => (
                                <option key={p.pageIndex} value={p.pageIndex}>{getPageName(p.pageIndex)}</option>
                              ))}
                            </select>
                            <button
                              className="text-zinc-400 hover:text-blue-600 p-0.5"
                              title="Duplicate this measurement"
                              onClick={() => duplicateMeasurement(m.id, duplicateTarget[m.id] ?? m.pageIndex)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr key={`${trade}-sub`} className="bg-zinc-50 border-b border-zinc-200">
                      <td colSpan={9} className="px-3 py-1.5 text-right text-zinc-500 font-medium">{trade} subtotal</td>
                      <td className="px-3 py-1.5 text-right font-bold text-zinc-700">${subtotal.toFixed(2)}</td>
                    </tr>
                  </>
                );
              })}
              <tr className="bg-blue-50 border-t-2 border-blue-300 sticky bottom-0">
                <td colSpan={9} className="px-3 py-2 text-right font-bold text-zinc-800">Grand Total</td>
                <td className="px-3 py-2 text-right font-bold text-blue-700 text-sm">${grand.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
