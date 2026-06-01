import React, { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { pixelDistance } from '../utils/measurementUtils';

interface Props {
  pixelDist: number;
  pageIndex: number;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Custom', value: null },
  { label: '1/8"=1\'', feet: 96 },
  { label: '1/4"=1\'', feet: 48 },
  { label: '3/8"=1\'', feet: 32 },
  { label: '1/2"=1\'', feet: 16 },
  { label: '3/4"=1\'', feet: 10.667 },
  { label: '1"=1\'', feet: 8 },
  { label: '1:50', feet: null, ratio: 50 },
  { label: '1:100', feet: null, ratio: 100 },
  { label: '1:200', feet: null, ratio: 200 },
];

export default function ScaleModal({ pixelDist, pageIndex, onClose }: Props) {
  const { setScale, resetCalibration } = useTakeoffStore();
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'feet' | 'inches' | 'meters'>('feet');
  const [preset, setPreset] = useState('Custom');

  function handlePreset(label: string) {
    setPreset(label);
    const p = PRESETS.find((x) => x.label === label);
    if (!p || !('feet' in p) || p.value === null) return;
    if ('ratio' in p && p.ratio) {
      setUnit('meters');
      setDistance((pixelDist / p.ratio).toFixed(4));
    } else if ('feet' in p && p.feet) {
      setUnit('feet');
      setDistance((pixelDist / p.feet).toFixed(4));
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
    setScale(pageIndex, { pixelsPerFoot, label: `${distance} ${unit} (${preset})` });
    onClose();
  }

  function handleCancel() {
    resetCalibration();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Set Scale</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Measured pixel distance: <strong>{pixelDist.toFixed(1)}px</strong>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Preset Scale</label>
          <select
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
            value={preset}
            onChange={(e) => handlePreset(e.target.value)}
          >
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Real-world distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. 10"
              value={distance}
              onChange={(e) => { setDistance(e.target.value); setPreset('Custom'); }}
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

        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSet}
          >
            Set Scale
          </button>
        </div>
      </div>
    </div>
  );
}
