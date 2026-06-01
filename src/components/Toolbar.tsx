import { useState, useRef } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { SCALE_PRESETS } from '../utils/scalePresets';
import type { ActiveTool, AppTab } from '../types';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const TOOLS: { tool: ActiveTool; label: string; key: string }[] = [
  { tool: 'select',  label: 'Select',    key: 'S' },
  { tool: 'linear',  label: 'Linear',    key: 'L' },
  { tool: 'area',    label: 'Area',      key: 'A' },
  { tool: 'count',   label: 'Count',     key: 'C' },
  { tool: 'dimension', label: 'Dimension', key: 'D' },
];

interface Props {
  onAddPage: (multiple: boolean) => void;
}

export default function Toolbar({ onAddPage }: Props) {
  const {
    project,
    currentPageIndex,
    zoom,
    activeTool,
    activeTab,
    isCalibrating,
    isDimensioning,
    setActiveTool,
    setActiveTab,
    setZoom,
    renameProject,
  } = useTakeoffStore();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const page = project?.pages[currentPageIndex];

  function startRename() {
    setNameVal(project?.name ?? '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitRename() {
    if (nameVal.trim()) renameProject(nameVal.trim());
    setEditingName(false);
  }

  function zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
    else setZoom(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
  }

  function zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
    else setZoom(ZOOM_LEVELS[0]);
  }

  const isActive = (tool: ActiveTool) => activeTool === tool;
  const showHint = isCalibrating || isDimensioning;

  return (
    <div className="shrink-0 bg-white border-b border-zinc-200">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-100">
        {(['plan', 'estimating'] as AppTab[]).map((tab) => (
          <button
            key={tab}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'plan' ? 'Plan View' : 'Estimating'}
          </button>
        ))}
      </div>

      {/* Main toolbar — plan view only */}
      {activeTab === 'plan' && (
        <div className="h-12 flex items-center px-3 gap-2 overflow-x-auto">

          {/* Logo + project name + add pages */}
          <span className="font-bold text-blue-600 text-base shrink-0">TakeoffPro</span>

          {project && (
            <>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium text-zinc-800 w-40 focus:outline-none shrink-0"
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
              ) : (
                <button
                  className="text-sm font-medium text-zinc-700 hover:text-blue-600 hover:underline max-w-[140px] truncate shrink-0"
                  onClick={startRename}
                  title="Click to rename project"
                >
                  {project.name}
                </button>
              )}

              <button
                className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 flex items-center gap-1 shrink-0"
                onClick={() => onAddPage(false)}
              >
                <span className="text-base leading-none">+</span> Add Page
              </button>
              <button
                className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 shrink-0"
                onClick={() => onAddPage(true)}
              >
                Add Batch
              </button>
            </>
          )}

          <div className="w-px h-6 bg-zinc-200 shrink-0" />

          {/* Hint bar OR tool buttons */}
          {showHint ? (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1 shrink-0">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isCalibrating
                ? 'Click two points on a known dimension — Esc to cancel'
                : 'Click a point, move cursor to see live distance — Esc to cancel'}
            </div>
          ) : project ? (
            <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5 shrink-0">
              {TOOLS.map(({ tool, label, key }) => (
                <button
                  key={tool}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                    isActive(tool)
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-600 hover:bg-zinc-200'
                  }`}
                  onClick={() => setActiveTool(isActive(tool) ? 'select' : tool)}
                  title={`${label} (${key})`}
                >
                  {label}
                  <kbd className={`text-[10px] px-0.5 rounded ${isActive(tool) ? 'opacity-70' : 'text-zinc-400'}`}>
                    {key}
                  </kbd>
                </button>
              ))}
            </div>
          ) : null}

          {project && (
            <>
              <div className="w-px h-6 bg-zinc-200 shrink-0" />

              {/* Scale */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-zinc-500">Scale:</span>
                <select
                  className="border border-zinc-300 rounded px-1.5 py-1 text-xs max-w-[130px]"
                  value={page?.scale?.label ?? 'No Scale'}
                  onChange={(e) => {
                    // selecting a preset alone just activates calibrate so user clicks 2 points
                    if (e.target.value !== 'No Scale') setActiveTool('calibrate');
                  }}
                >
                  {SCALE_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
                <button
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    isActive('calibrate')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-zinc-300 hover:bg-zinc-50'
                  }`}
                  onClick={() => setActiveTool(isActive('calibrate') ? 'select' : 'calibrate')}
                >
                  Set Scale
                </button>
                {page?.scale && (
                  <span className="text-xs text-zinc-500 max-w-[100px] truncate" title={page.scale.label}>
                    {page.scale.label}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Zoom controls — right side */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-bold text-base disabled:opacity-30"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
            >−</button>
            <span className="text-xs text-zinc-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-bold text-base disabled:opacity-30"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            >+</button>
          </div>

        </div>
      )}
    </div>
  );
}
