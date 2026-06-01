import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { SCALE_PRESETS } from '../utils/scalePresets';

interface Props {
  pixelDist: number;
  pageIndex: number;
  onClose: () => void;
}

export default function ScaleModal({ pixelDist, pageIndex, onClose }: Props) {
  const { setScale, setScaleAllPages } = useTakeoffStore();
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'feet' | 'inches' | 'meters'>('feet');
  const [selectedPreset, setSelectedPreset] = useState('No Scale');
  const [applyAll, setApplyAll] = useState(false);

  function handlePresetChange(label: string) {
    setSelectedPreset(label);
    const preset = SCALE_PRESETS.find((p) => p.label === label);
    if (!preset || preset.none || preset.custom) return;

    if (preset.feetPerInch !== undefined) {
      // architectural/engineering: preset gives feet per drawing inch
      // pixelDist pixels = ? real feet → need user to tell us pixels per inch first
      // Prefill with the nominal feet that corresponds to 1 drawing inch
      setUnit('feet');
      setDistance(String(preset.feetPerInch));
    } else if (preset.ratio !== undefined) {
      // 1:N — in meters: pixelDist px represents pixelDist/96 inches * (N/12) feet
      // Simple approach: express as meters
      setUnit('meters');
      // assume 96 DPI screen: 1 px ≈ 1/96 inch = 0.0254/96 m
      const realMeters = (pixelDist / 96) * 0.0254 * preset.ratio;
      setDistance(realMeters.toFixed(4));
    }
  }

  function handleSet() {
    const dist = parseFloat(distance);
    if (isNaN(dist) || dist <= 0) return;

    let distInFeet: number;
    if (unit === 'feet') distInFeet = dist;
    else if (unit === 'inches') distInFeet = dist / 12;
    else distInFeet = dist * 3.28084;

    const pixelsPerFoot = pixelDist / distInFeet;
    const scaleConfig = {
      pixelsPerFoot,
      label: `${selectedPreset !== 'No Scale' && selectedPreset !== 'Custom' ? selectedPreset : `${distance} ${unit}`}`,
    };

    if (applyAll) {
      setScaleAllPages(scaleConfig);
    } else {
      setScale(pageIndex, scaleConfig);
    }
    onClose();
  }

  function handleCancel() {
    const { resetCalibration } = useTakeoffStore.getState();
    resetCalibration();
    onClose();
  }

  const architecturalPresets = SCALE_PRESETS.filter(
    (p) => !p.none && !p.custom && !p.ratio
  );
  const metricPresets = SCALE_PRESETS.filter((p) => p.ratio !== undefined);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[440px] p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Set Scale</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Measured distance: <strong>{pixelDist.toFixed(1)} px</strong>
        </p>

        {/* Preset selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Scale Preset</label>
          <select
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <option value="No Scale">No Scale</option>
            <optgroup label="── Architectural ──">
              {architecturalPresets.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="── Metric / Ratio ──">
              {metricPresets.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </optgroup>
            <option value="Custom">Custom</option>
          </select>
        </div>

        {/* Manual distance input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Real-world distance for the two points you clicked
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. 20"
              value={distance}
              onChange={(e) => { setDistance(e.target.value); setSelectedPreset('Custom'); }}
            />
            <select
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm"
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof unit)}
            >
              <option value="feet">Feet</option>
              <option value="inches">Inches</option>
              <option value="meters">Meters</option>
            </select>
          </div>
        </div>

        {/* Apply to all pages */}
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-blue-600"
            checked={applyAll}
            onChange={(e) => setApplyAll(e.target.checked)}
          />
          <span className="text-sm text-zinc-700">Apply this scale to <strong>all pages</strong></span>
        </label>

        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            onClick={handleSet}
            disabled={!distance || parseFloat(distance) <= 0}
          >
            {applyAll ? 'Set Scale for All Pages' : 'Set Scale'}
          </button>
        </div>
      </div>
    </div>
  );
}
