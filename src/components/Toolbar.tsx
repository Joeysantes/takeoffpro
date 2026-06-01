import { useState, useRef } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import type { ActiveTool, AppTab } from '../types';

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const SCALE_PRESETS = [
  { label: 'No Scale', feet: null },
  { label: "1/8\"=1'", feet: 96 },
  { label: "1/4\"=1'", feet: 48 },
  { label: "3/8\"=1'", feet: 32 },
  { label: "1/2\"=1'", feet: 16 },
  { label: "3/4\"=1'", feet: 10.667 },
  { label: "1\"=1'", feet: 8 },
  { label: '1:50', ratio: 50 },
  { label: '1:100', ratio: 100 },
  { label: '1:200', ratio: 200 },
];

const TOOLS: { tool: ActiveTool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 'S' },
  { tool: 'linear', label: 'Linear', key: 'L' },
  { tool: 'area', label: 'Area', key: 'A' },
  { tool: 'count', label: 'Count', key: 'C' },
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
    isVerifying,
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
  }

  function zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  }

  function handleScalePreset(label: string) {
    if (!page) return;
    const preset = SCALE_PRESETS.find((p) => p.label === label);
    if (!preset || !('feet' in preset) || preset.feet === null) return;
    // Need calibration points — trigger calibrate tool with preset context
    setActiveTool('calibrate');
  }

  return (
    <div className="shrink-0 bg-white border-b border-zinc-200">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-100">
        {(['plan', 'estimating'] as AppTab[]).map((tab) => (
          <button
            key={tab}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
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

      {/* Main toolbar — only show in plan view */}
      {activeTab === 'plan' && (
        <div className="h-12 flex items-center px-3 gap-2">
          {/* Left: Logo + project name + add pages */}
          <span className="font-bold text-blue-600 text-base mr-1">TakeoffPro</span>

          {project && (
            <>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium text-zinc-800 w-40 focus:outline-none"
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
                  className="text-sm font-medium text-zinc-700 hover:text-blue-600 hover:underline max-w-[150px] truncate"
                  onClick={startRename}
                  title="Click to rename project"
                >
                  {project.name}
                </button>
              )}

              <button
                className="px-2.5 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 flex items-center gap-1"
                onClick={() => onAddPage(false)}
                title="Add single page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Page
              </button>
              <button
                className="px-2.5 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50"
                onClick={() => onAddPage(true)}
                title="Add multiple pages"
              >
                Add Batch
              </button>
            </>
          )}

          <div className="w-px h-6 bg-zinc-200 mx-1" />

          {/* Center: Tools */}
          {project && (
            <>
              {isCalibrating || isVerifying ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isCalibrating
                    ? 'Click two points on a known dimension — Esc to cancel'
                    : 'Click two points to verify scale — Esc to cancel'}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
                  {TOOLS.map(({ tool, label, key }) => (
                    <button
                      key={tool}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                        activeTool === tool
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-600 hover:bg-zinc-200'
                      }`}
                      onClick={() => setActiveTool(tool)}
                      title={`${label} (${key})`}
                    >
                      {label}
                      <kbd className={`text-[10px] px-0.5 rounded ${activeTool === tool ? 'opacity-70' : 'text-zinc-400'}`}>
                        {key}
                      </kbd>
                    </button>
                  ))}
                </div>
              )}

              <div className="w-px h-6 bg-zinc-200 mx-1" />

              {/* Scale section */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500 shrink-0">Scale:</span>
                <select
                  className="border border-zinc-300 rounded px-2 py-1 text-xs"
                  value={page?.scale?.label?.split(' (')[0] ?? 'No Scale'}
                  onChange={(e) => handleScalePreset(e.target.value)}
                >
                  {SCALE_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
                <button
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    activeTool === 'calibrate'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-zinc-300 hover:bg-zinc-50'
                  }`}
                  onClick={() => setActiveTool(activeTool === 'calibrate' ? 'select' : 'calibrate')}
                  title="Click two points to calibrate scale"
                >
                  Set Scale
                </button>
                <button
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    activeTool === 'verify'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-zinc-300 hover:bg-zinc-50'
                  }`}
                  onClick={() => setActiveTool(activeTool === 'verify' ? 'select' : 'verify')}
                  title="Click two points to verify scale"
                >
                  Verify
                </button>
                {page?.scale && (
                  <span className="text-xs text-zinc-500 max-w-[120px] truncate" title={page.scale.label}>
                    {page.scale.label}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Right: Zoom */}
          <div className="ml-auto flex items-center gap-1">
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-600 font-bold"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]}
            >
              −
            </button>
            <span className="text-xs text-zinc-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-600 font-bold"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
