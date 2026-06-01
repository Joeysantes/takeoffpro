import { useTakeoffStore } from '../store/takeoffStore';
import type { PriceMode } from '../types';

function autoFormula(
  type: string,
  value: number,
  unit: string,
  height: number | undefined,
  priceMode: PriceMode | undefined,
  unitCost: number
): string {
  if (type === 'linear') {
    if (priceMode === 'per-sqft' && height) {
      return `${value.toFixed(1)} ft × ${height} ft × $${unitCost}/sq ft`;
    }
    return `${value.toFixed(1)} ${unit} × $${unitCost}/linear ft`;
  }
  if (type === 'area') {
    if (priceMode === 'per-cuft' && height) {
      return `${value.toFixed(1)} sq ft × ${height} ft × $${unitCost}/cu ft`;
    }
    return `${value.toFixed(1)} sq ft × $${unitCost}/sq ft`;
  }
  return `${value} ea × $${unitCost}/ea`;
}

export default function MeasurementProperties() {
  const { project, selectedMeasurementId, updateMeasurement } = useTakeoffStore();

  if (!selectedMeasurementId || !project) return null;

  const measurement = project.pages
    .flatMap((p) => p.measurements)
    .find((m) => m.id === selectedMeasurementId);

  if (!measurement) return null;

  const m = measurement;

  function update(updates: Parameters<typeof updateMeasurement>[1]) {
    const merged = { ...m, ...updates };
    const formula = autoFormula(
      merged.type,
      merged.value,
      merged.unit,
      merged.height,
      merged.priceMode,
      merged.unitCost
    );
    updateMeasurement(m.id, { ...updates, formula });
  }

  const surfaceArea =
    m.type === 'linear' && m.height ? (m.value * m.height).toFixed(2) : null;
  const volume =
    m.type === 'area' && m.height ? (m.value * m.height).toFixed(2) : null;

  const total =
    m.type === 'linear' && m.priceMode === 'per-sqft' && m.height
      ? m.value * m.height * m.unitCost
      : m.type === 'area' && m.priceMode === 'per-cuft' && m.height
      ? m.value * m.height * m.unitCost
      : m.value * m.unitCost;

  return (
    <div className="border-b border-zinc-200 p-3 bg-blue-50/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-sm" style={{ background: m.color }} />
        <span className="text-xs font-semibold text-zinc-700">{m.name}</span>
        <span className="text-xs text-zinc-400 capitalize">({m.type})</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {/* Primary value */}
        <div className="text-zinc-500">{m.type === 'count' ? 'Count' : m.type === 'linear' ? 'Length' : 'Area'}</div>
        <div className="text-zinc-700 font-medium">{m.value.toFixed(2)} {m.unit}</div>

        {/* Height (linear + area only) */}
        {m.type !== 'count' && (
          <>
            <div className="text-zinc-500">Height (ft)</div>
            <input
              type="number"
              className="border border-zinc-300 rounded px-1.5 py-0.5 text-xs bg-white w-full"
              value={m.height ?? ''}
              placeholder="0"
              min={0}
              step={0.1}
              onChange={(e) => update({ height: parseFloat(e.target.value) || undefined })}
            />
          </>
        )}

        {/* Derived value */}
        {surfaceArea && (
          <>
            <div className="text-zinc-500">Surface Area</div>
            <div className="text-zinc-700 font-medium">{surfaceArea} sq ft</div>
          </>
        )}
        {volume && (
          <>
            <div className="text-zinc-500">Volume</div>
            <div className="text-zinc-700 font-medium">{volume} cu ft</div>
          </>
        )}

        {/* Price mode */}
        {m.type !== 'count' && (
          <>
            <div className="text-zinc-500">Price Per</div>
            <select
              className="border border-zinc-300 rounded px-1 py-0.5 text-xs bg-white"
              value={m.priceMode ?? 'per-unit'}
              onChange={(e) => update({ priceMode: e.target.value as PriceMode })}
            >
              {m.type === 'linear' && <option value="per-unit">Linear ft</option>}
              {m.type === 'linear' && <option value="per-sqft">Sq ft (L×H)</option>}
              {m.type === 'area' && <option value="per-unit">Sq ft</option>}
              {m.type === 'area' && <option value="per-cuft">Cu ft (A×H)</option>}
            </select>
          </>
        )}

        {/* Unit cost */}
        <div className="text-zinc-500">Unit Cost ($)</div>
        <input
          type="number"
          className="border border-zinc-300 rounded px-1.5 py-0.5 text-xs bg-white w-full"
          value={m.unitCost}
          min={0}
          step={0.01}
          onChange={(e) => update({ unitCost: parseFloat(e.target.value) || 0 })}
        />

        {/* Total */}
        <div className="text-zinc-500 font-medium">Total</div>
        <div className="text-blue-700 font-bold">${total.toFixed(2)}</div>
      </div>

      {/* Formula */}
      <div className="mt-2">
        <div className="text-xs text-zinc-400 mb-1">Formula</div>
        <input
          className="w-full border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-600 bg-white font-mono"
          value={m.formula ?? autoFormula(m.type, m.value, m.unit, m.height, m.priceMode, m.unitCost)}
          onChange={(e) => updateMeasurement(m.id, { formula: e.target.value })}
        />
      </div>
    </div>
  );
}
