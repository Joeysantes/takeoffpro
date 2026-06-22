import { useState, useRef } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import { SCALE_PRESETS, getFeetPerInch } from '../utils/scalePresets';
import type { ActiveTool, AppTab } from '../types';

const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', hex: '#FDE047' },
  { label: 'Green',  hex: '#86EFAC' },
  { label: 'Blue',   hex: '#93C5FD' },
  { label: 'Pink',   hex: '#F9A8D4' },
  { label: 'Orange', hex: '#FED7AA' },
];

interface ToolDef { tool: ActiveTool; label: string; key: string; dividerBefore?: boolean; }
const TOOLS: ToolDef[] = [
  { tool: 'select',    label: 'Select',    key: 'S' },
  { tool: 'linear',   label: 'Linear',    key: 'L', dividerBefore: true },
  { tool: 'area',     label: 'Area',      key: 'A' },
  { tool: 'count',    label: 'Count',     key: 'C' },
  { tool: 'dimension',label: 'Dimension', key: 'D', dividerBefore: true },
  { tool: 'note',     label: 'Note',      key: 'N', dividerBefore: true },
  { tool: 'highlight',label: 'Highlight', key: 'H' },
];

const TABS: { id: AppTab; label: string }[] = [
  { id: 'plan',       label: 'Plan View'  },
  { id: 'estimating', label: 'Estimating' },
  { id: 'assemblies', label: 'Assemblies' },
];

interface Props {
  onAddPage: (multiple: boolean) => void;
}

export default function Toolbar({ onAddPage }: Props) {
  const {
    project, currentPageIndex, zoom, activeTool, activeTab,
    isCalibrating, isDimensioning, pendingPresetLabel,
    highlightColor, setHighlightColor,
    setActiveTool, setActiveTab, setZoom, setScale,
    setPendingPreset, renameProject, requestZoom,
  } = useTakeoffStore();

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [selectedPresetLabel, setSelectedPresetLabel] = useState('No Scale');
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
    const idx = ZOOM_STEPS.findIndex((z) => z > zoom + 0.001);
    setZoom(idx >= 0 ? ZOOM_STEPS[idx] : ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  }
  function zoomOut() {
    const idx = ZOOM_STEPS.findLastIndex((z) => z < zoom - 0.001);
    setZoom(idx >= 0 ? ZOOM_STEPS[idx] : ZOOM_STEPS[0]);
  }

  function handlePresetSelect(label: string) {
    setSelectedPresetLabel(label);
    if (label === 'No Scale') return;
    setPendingPreset(label);
    setActiveTool('calibrate');
  }

  function handleQuickApply() {
    if (!page || !selectedPresetLabel || selectedPresetLabel === 'No Scale' || selectedPresetLabel === 'Custom') return;
    const preset = SCALE_PRESETS.find((p) => p.label === selectedPresetLabel);
    if (!preset) return;
    const renderDPI = page.renderDPI ?? 96;
    const fpi = getFeetPerInch(preset);
    if (!fpi) return;
    const pixelsPerFoot = renderDPI / fpi;
    setScale(currentPageIndex, { pixelsPerFoot, label: preset.label });
  }

  const isActive = (tool: ActiveTool) => activeTool === tool;
  const showHint = isCalibrating || isDimensioning;

  return (
    <div className="shrink-0 bg-white border-b border-zinc-200">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-100 px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main toolbar — plan view only */}
      {activeTab === 'plan' && (
        <div className="h-12 flex items-center px-3 gap-2 overflow-x-auto">

          {/* Logo */}
          <span className="font-bold text-blue-600 text-base shrink-0">TakeoffPro</span>

          {project && (
            <>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium text-zinc-800 w-36 focus:outline-none shrink-0"
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                />
              ) : (
                <button
                  className="text-sm font-medium text-zinc-700 hover:text-blue-600 hover:underline max-w-[130px] truncate shrink-0"
                  onClick={startRename}
                  title="Click to rename"
                >
                  {project.name}
                </button>
              )}
              <button
                className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 shrink-0"
                onClick={() => onAddPage(false)}
              >
                + Page
              </button>
              <button
                className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 shrink-0"
                onClick={() => onAddPage(true)}
              >
                + Batch
              </button>
            </>
          )}

          <div className="w-px h-6 bg-zinc-200 shrink-0" />

          {/* Hint OR tool buttons */}
          {showHint ? (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1 shrink-0">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isCalibrating
                ? `Click two points${pendingPresetLabel ? ` (${pendingPresetLabel})` : ''} — Esc to cancel`
                : 'Click a point then move cursor to see live distance — Esc to cancel'}
            </div>
          ) : project ? (
            <div className="flex items-center shrink-0">
              <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
                {TOOLS.map(({ tool, label, key, dividerBefore }) => (
                  <>
                    {dividerBefore && <div key={`div-${tool}`} className="w-px h-5 bg-zinc-300 mx-0.5" />}
                    <button
                      key={tool}
                      className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                        isActive(tool) ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-200'
                      }`}
                      onClick={() => setActiveTool(isActive(tool) ? 'select' : tool)}
                      title={`${label} (${key})`}
                    >
                      {tool === 'note' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      )}
                      {tool === 'highlight' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      )}
                      {label}
                      <kbd className={`text-[10px] px-0.5 rounded ${isActive(tool) ? 'opacity-70' : 'text-zinc-400'}`}>{key}</kbd>
                    </button>
                  </>
                ))}
              </div>

              {/* Highlight color swatches — shown only when highlight tool is active */}
              {isActive('highlight') && (
                <div className="flex items-center gap-1 ml-2 p-1 bg-zinc-100 rounded-lg">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      className={`w-5 h-5 rounded-full transition-all ${highlightColor === c.hex ? 'ring-2 ring-offset-1 ring-zinc-600 scale-110' : 'hover:scale-110'}`}
                      style={{ background: c.hex }}
                      title={c.label}
                      onClick={() => setHighlightColor(c.hex)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {project && (
            <>
              <div className="w-px h-6 bg-zinc-200 shrink-0" />

              {/* Scale section */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-zinc-500 shrink-0">Scale:</span>
                <select
                  className="border border-zinc-300 rounded px-1.5 py-1 text-xs w-[145px]"
                  value={selectedPresetLabel}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                >
                  <option value="No Scale">No Scale</option>
                  <optgroup label="── Civil / Engineering ──">
                    {SCALE_PRESETS.filter((p) => !p.none && !p.custom && !p.ratio && (p.feetPerInch ?? 0) >= 10).map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="── Architectural ──">
                    {SCALE_PRESETS.filter((p) => !p.none && !p.custom && !p.ratio && (p.feetPerInch ?? 0) < 10).map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="── Metric ──">
                    {SCALE_PRESETS.filter((p) => p.ratio !== undefined).map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </optgroup>
                  <option value="Custom">Custom</option>
                </select>

                <button
                  className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 shrink-0"
                  onClick={handleQuickApply}
                  disabled={!selectedPresetLabel || selectedPresetLabel === 'No Scale' || selectedPresetLabel === 'Custom'}
                  title="Apply scale immediately"
                >
                  Quick Apply
                </button>

                <button
                  className={`px-2 py-1 text-xs rounded border transition-colors shrink-0 ${
                    isActive('calibrate')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-zinc-300 hover:bg-zinc-50'
                  }`}
                  onClick={() => {
                    if (selectedPresetLabel && selectedPresetLabel !== 'No Scale') setPendingPreset(selectedPresetLabel);
                    setActiveTool(isActive('calibrate') ? 'select' : 'calibrate');
                  }}
                  title="Click 2 reference points for precise calibration"
                >
                  Calibrate
                </button>

                {page?.scale && (
                  <span className="text-xs text-emerald-700 font-medium shrink-0 max-w-[110px] truncate" title={page.scale.label}>
                    ✓ {page.scale.label}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Zoom controls */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-bold text-base disabled:opacity-30"
              onClick={zoomOut}
              disabled={zoom <= 0.1}
            >−</button>
            <span className="text-xs text-zinc-600 w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
            <button
              className="w-7 h-7 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-bold text-base disabled:opacity-30"
              onClick={zoomIn}
              disabled={zoom >= 8}
            >+</button>
            <div className="w-px h-4 bg-zinc-200 mx-0.5" />
            <button
              className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-600"
              onClick={() => requestZoom('fit')}
              title="Fit plan to window"
            >
              Fit
            </button>
            <button
              className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-600"
              onClick={() => requestZoom(1)}
              title="Reset to 100% zoom"
            >
              100%
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
