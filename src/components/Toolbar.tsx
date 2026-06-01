import React from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { exportToExcel, exportToPDF, exportToCSV } from '../utils/exportUtils';
import type { ColorMode } from '../types';

const COLOR_MODES: { mode: ColorMode; label: string }[] = [
  { mode: 'full', label: 'Full' },
  { mode: 'half', label: '50%' },
  { mode: 'grayscale', label: 'Gray' },
  { mode: 'bw', label: 'B&W' },
];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2];

interface Props {
  onUpload: () => void;
}

export default function Toolbar({ onUpload }: Props) {
  const { project, currentPageIndex, zoom, activeTool, isCalibrating, setColorMode, setActiveTool, setZoom } =
    useTakeoffStore();

  const page = project?.pages[currentPageIndex];

  return (
    <div className="h-12 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2 mr-2">
        <span className="font-bold text-blue-600 text-lg">TakeoffPro</span>
        <button
          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          onClick={onUpload}
        >
          Upload Plans
        </button>
      </div>

      <div className="w-px h-6 bg-zinc-200" />

      {isCalibrating && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Click two points on a known dimension — press Escape to cancel
        </div>
      )}

      {!isCalibrating && (
        <>
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
            {COLOR_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  page?.colorMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-200'
                }`}
                onClick={() => page && setColorMode(currentPageIndex, mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-zinc-200" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Scale:</span>
            <span className={`text-xs ${page?.scale ? 'text-zinc-700' : 'text-zinc-400'}`}>
              {page?.scale?.label ?? 'No scale set'}
            </span>
            <button
              className={`px-3 py-1.5 text-sm rounded-md border ${
                activeTool === 'calibrate'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-zinc-300 hover:bg-zinc-50'
              }`}
              onClick={() => setActiveTool(activeTool === 'calibrate' ? 'select' : 'calibrate')}
            >
              Set Scale
            </button>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <select
          className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>{Math.round(z * 100)}%</option>
          ))}
        </select>

        {project && (
          <>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
              onClick={() => exportToExcel(project)}
            >
              Excel
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
              onClick={() => exportToPDF(project)}
            >
              PDF
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
              onClick={() => exportToCSV(project)}
            >
              CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
