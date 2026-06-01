import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAssemblyStore } from '../store/assemblyStore';
import { useTakeoffStore } from '../store/takeoffStore';
import type { Assembly, AssemblyItem, AssemblyCategory, MeasurementType, TradeCategory } from '../types';
import { COLOR_CYCLE } from '../utils/measurementUtils';

const TRADES: TradeCategory[] = ['General','Concrete','Drywall','Electrical','HVAC','Plumbing','Framing','Painting','Flooring'];
const TYPES: MeasurementType[] = ['linear','area','count'];
const CATEGORIES: AssemblyCategory[] = ['area','linear','count','mixed'];

function blankItem(): AssemblyItem {
  return { name: '', type: 'linear', trade: 'General', unitCost: 0, unit: 'ft', color: COLOR_CYCLE[0] };
}

export default function AssembliesView() {
  const { assemblies, saveAssembly, deleteAssembly } = useAssemblyStore();
  const { project, currentPageIndex, addMeasurement } = useTakeoffStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Assembly | null>(null);
  const [applyMsg, setApplyMsg] = useState('');

  const selected = assemblies.find((a) => a.id === selectedId) ?? null;

  function newAssembly() {
    const a: Assembly = {
      id: uuidv4(),
      name: 'New Assembly',
      category: 'mixed',
      items: [blankItem()],
      createdAt: new Date().toISOString(),
    };
    setEditing(a);
    setSelectedId(a.id);
  }

  function saveEditing() {
    if (!editing) return;
    saveAssembly(editing);
    setEditing(null);
  }

  function applyToPage() {
    if (!selected || !project) return;
    const page = project.pages[currentPageIndex];
    const offset = page.measurements.length;
    selected.items.forEach((item, i) => {
      addMeasurement({
        id: uuidv4(),
        type: item.type,
        name: item.name || `${item.trade} ${item.type}`,
        trade: item.trade,
        color: item.color || COLOR_CYCLE[i % COLOR_CYCLE.length],
        points: [],
        value: 0,
        unit: item.unit,
        unitCost: item.unitCost,
        visible: true,
        pageIndex: currentPageIndex,
        height: item.height,
        priceMode: item.priceMode,
        formula: item.formula,
      });
    });
    setApplyMsg(`Applied ${selected.items.length} item(s) to page ${currentPageIndex + 1}. Go to Plan View to draw them.`);
    setTimeout(() => setApplyMsg(''), 4000);
    void offset;
  }

  const current = editing ?? selected;

  return (
    <div className="flex flex-1 overflow-hidden bg-zinc-50">
      {/* Left list */}
      <div className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-zinc-800">Assemblies</h2>
          <button
            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={newAssembly}
          >
            + New
          </button>
        </div>

        {assemblies.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div>
              <p className="text-sm text-zinc-500">No assemblies yet</p>
              <p className="text-xs text-zinc-400 mt-1">Create reusable measurement templates for any project</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {CATEGORIES.map((cat) => {
              const group = assemblies.filter((a) => a.category === cat);
              if (group.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide bg-zinc-50 capitalize">
                    {cat}
                  </div>
                  {group.map((a) => (
                    <button
                      key={a.id}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        selectedId === a.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => { setSelectedId(a.id); setEditing(null); }}
                    >
                      <div className="font-medium truncate">{a.name}</div>
                      <div className="text-xs text-zinc-400">{a.items.length} item{a.items.length !== 1 ? 's' : ''}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right editor / detail */}
      <div className="flex-1 overflow-y-auto p-5">
        {!current ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            Select an assembly or create a new one
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              {editing ? (
                <>
                  <input
                    className="text-xl font-bold text-zinc-900 bg-transparent border-b-2 border-blue-400 focus:outline-none flex-1"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Assembly name"
                  />
                  <select
                    className="border border-zinc-300 rounded px-2 py-1 text-sm"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value as AssemblyCategory })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={saveEditing}>
                    Save
                  </button>
                  <button className="px-3 py-1.5 text-sm rounded border border-zinc-300 hover:bg-zinc-50" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-zinc-900 flex-1">{current.name}</h3>
                  <button className="px-3 py-1.5 text-sm rounded border border-zinc-300 hover:bg-zinc-50" onClick={() => setEditing({ ...current })}>
                    Edit
                  </button>
                  <button className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={applyToPage}>
                    Apply to Page {currentPageIndex + 1}
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => { deleteAssembly(current.id); setSelectedId(null); }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>

            {applyMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                {applyMsg}
              </div>
            )}

            {editing && (
              <div className="mb-3">
                <textarea
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-400 resize-none"
                  rows={2}
                  placeholder="Description (optional)"
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
            )}

            {/* Items table */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Trade</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Unit</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-zinc-500">Unit Cost</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Formula</th>
                    {editing && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-100 last:border-0">
                      <td className="px-3 py-2">
                        {editing ? (
                          <input className="border border-zinc-200 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:border-blue-400"
                            value={item.name}
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, name: e.target.value };
                              setEditing({ ...editing, items });
                            }} />
                        ) : <span className="text-zinc-700">{item.name || '—'}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <select className="border border-zinc-200 rounded px-1 py-1 text-xs"
                            value={item.type}
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, type: e.target.value as MeasurementType };
                              setEditing({ ...editing, items });
                            }}>
                            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : <span className="text-zinc-500 capitalize">{item.type}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <select className="border border-zinc-200 rounded px-1 py-1 text-xs"
                            value={item.trade}
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, trade: e.target.value as TradeCategory };
                              setEditing({ ...editing, items });
                            }}>
                            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : <span className="text-zinc-500">{item.trade}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input className="border border-zinc-200 rounded px-2 py-1 text-xs w-14"
                            value={item.unit}
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, unit: e.target.value };
                              setEditing({ ...editing, items });
                            }} />
                        ) : <span className="text-zinc-500">{item.unit}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <input type="number" className="border border-zinc-200 rounded px-2 py-1 text-xs w-20 text-right"
                            value={item.unitCost}
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, unitCost: parseFloat(e.target.value) || 0 };
                              setEditing({ ...editing, items });
                            }} />
                        ) : <span className="text-zinc-700">${item.unitCost.toFixed(2)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input className="border border-zinc-200 rounded px-2 py-1 text-xs w-32"
                            value={item.formula ?? ''}
                            placeholder="e.g. qty × h × $cost"
                            onChange={(e) => {
                              const items = [...editing.items];
                              items[idx] = { ...item, formula: e.target.value };
                              setEditing({ ...editing, items });
                            }} />
                        ) : <span className="text-zinc-400 text-xs">{item.formula || '—'}</span>}
                      </td>
                      {editing && (
                        <td className="px-1">
                          <button
                            className="text-zinc-300 hover:text-red-500 p-1"
                            onClick={() => {
                              const items = editing.items.filter((_, i) => i !== idx);
                              setEditing({ ...editing, items });
                            }}
                          >×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editing && (
                <div className="px-3 py-2 border-t border-zinc-100">
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setEditing({ ...editing, items: [...editing.items, blankItem()] })}
                  >
                    + Add item
                  </button>
                </div>
              )}
            </div>

            {!editing && current.description && (
              <p className="mt-3 text-sm text-zinc-500 italic">{current.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
