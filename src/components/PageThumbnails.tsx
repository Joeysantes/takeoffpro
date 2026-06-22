import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import type { TradeCategory } from '../types';

const TYPE_LABEL: Record<string, string> = {
  count:  'counting',
  linear: 'linear',
  area:   'area',
};

const TRADES: TradeCategory[] = [
  'General','Concrete','Drywall','Electrical','HVAC','Plumbing','Framing','Painting','Flooring',
];

// Small SVG icons for each measurement type
function LinearIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="inline shrink-0">
      <line x1="1" y1="9" x2="9" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function AreaIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="inline shrink-0">
      <rect x="1" y="1" width="8" height="8" fill="currentColor" opacity="0.7" rx="1" />
    </svg>
  );
}
function CountIcon() {
  return <span className="text-[9px] font-bold">#</span>;
}
function NoteIcon() {
  return <span className="text-[9px]">📝</span>;
}

export default function PageThumbnails() {
  const {
    project, currentPageIndex, setCurrentPage, renamePage,
    activeSession, continueSessionOnPage, stopSession, selectMeasurement,
  } = useTakeoffStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [pendingPageChange, setPendingPageChange] = useState<number | null>(null);
  // Per-page, per-trade collapse state: key = `${pageIndex}-${trade}`
  const [collapsedTrades, setCollapsedTrades] = useState<Record<string, boolean>>({});

  if (!project) return null;

  const typeLabel = activeSession ? (TYPE_LABEL[activeSession.type] ?? activeSession.type) : '';

  function startEdit(pageIndex: number, currentName: string) {
    setEditingIndex(pageIndex);
    setEditVal(currentName);
  }

  function commitEdit(pageIndex: number) {
    if (editVal.trim()) renamePage(pageIndex, editVal.trim());
    setEditingIndex(null);
  }

  function handlePageClick(pageIndex: number) {
    if (pageIndex === currentPageIndex) return;
    if (activeSession) {
      setPendingPageChange(pageIndex);
    } else {
      setCurrentPage(pageIndex);
    }
  }

  function handleContinue() {
    if (pendingPageChange === null) return;
    continueSessionOnPage(pendingPageChange);
    setPendingPageChange(null);
  }

  function handleStop() {
    if (pendingPageChange === null) return;
    stopSession();
    setCurrentPage(pendingPageChange);
    setPendingPageChange(null);
  }

  function handleJustChangePage() {
    if (pendingPageChange === null) return;
    setCurrentPage(pendingPageChange);
    setPendingPageChange(null);
  }

  function toggleTrade(pageIndex: number, trade: string) {
    const key = `${pageIndex}-${trade}`;
    setCollapsedTrades((c) => ({ ...c, [key]: !c[key] }));
  }

  const pendingPageName = pendingPageChange !== null
    ? (project.pages.find((p) => p.pageIndex === pendingPageChange)?.name ?? `Page ${pendingPageChange + 1}`)
    : '';

  return (
    <div className="flex flex-col gap-2 p-2 relative">
      {/* Page change prompt when any session is active */}
      {pendingPageChange !== null && activeSession && (
        <div className="absolute inset-0 bg-white/97 z-10 flex flex-col items-center justify-center p-3 gap-2 rounded-lg border border-blue-200 shadow-lg">
          <p className="text-xs font-semibold text-zinc-800 text-center leading-relaxed">
            Continue {typeLabel}{' '}
            <span className="text-blue-600">"{activeSession.name}"</span>
            <br />on <span className="text-zinc-600">{pendingPageName}</span>?
          </p>
          <button
            className="w-full py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleContinue}
          >
            Continue {typeLabel} here
          </button>
          <button
            className="w-full py-1.5 text-xs rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
            onClick={handleStop}
          >
            Stop &amp; go to page
          </button>
          <button
            className="w-full py-1.5 text-xs text-zinc-400 hover:text-zinc-600"
            onClick={handleJustChangePage}
          >
            Just change page (keep session)
          </button>
        </div>
      )}

      <div className="text-xs text-zinc-500 px-1 font-medium">
        {project.pages.length} page{project.pages.length !== 1 ? 's' : ''}
      </div>

      {project.pages.map((page) => {
        const name = page.name ?? `Page ${page.pageIndex + 1}`;
        const isActive = page.pageIndex === currentPageIndex;
        const measurements = page.measurements ?? [];
        const annotations = page.annotations ?? [];

        // Group by trade
        const grouped = TRADES.reduce<Record<string, typeof measurements>>((acc, trade) => {
          const group = measurements.filter((m) => m.trade === trade);
          if (group.length > 0) acc[trade] = group;
          return acc;
        }, {});
        const hasMeasurements = measurements.length > 0;
        const hasNotes = annotations.some((a) => a.type === 'note');

        return (
          <div
            key={page.pageIndex}
            className={`flex flex-col gap-1 p-1 rounded-lg border-2 transition-colors ${
              isActive ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-zinc-300'
            }`}
          >
            {/* Thumbnail row */}
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => handlePageClick(page.pageIndex)}
            >
              <div className="relative w-16">
                <img
                  src={page.imageDataUrl}
                  alt={name}
                  className="w-16 object-contain rounded"
                  draggable={false}
                />
                {!page.scale && (
                  <div className="absolute top-0.5 right-0.5 bg-amber-400 rounded-full w-2 h-2" title="No scale set" />
                )}
              </div>

              {editingIndex === page.pageIndex ? (
                <input
                  autoFocus
                  className="w-16 border border-blue-400 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => commitEdit(page.pageIndex)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(page.pageIndex);
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-xs text-zinc-500 w-16 text-center truncate cursor-text hover:text-blue-600"
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(page.pageIndex, name); }}
                  title="Double-click to rename"
                >
                  {name}
                </span>
              )}
            </div>

            {/* Takeoff tree */}
            {!hasMeasurements && !hasNotes ? (
              <div className="text-[10px] text-zinc-400 px-1 pb-0.5">No takeoffs yet</div>
            ) : (
              <div className="text-[10px] w-full">
                {Object.entries(grouped).map(([trade, items]) => {
                  const key = `${page.pageIndex}-${trade}`;
                  const isCollapsed = collapsedTrades[key] ?? true; // default collapsed
                  return (
                    <div key={trade}>
                      {/* Trade header */}
                      <button
                        className="w-full flex items-center justify-between px-1 py-0.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                        onClick={(e) => { e.stopPropagation(); toggleTrade(page.pageIndex, trade); }}
                      >
                        <span className="truncate">{trade} ({items.length})</span>
                        <span className="ml-1 shrink-0">{isCollapsed ? '▶' : '▼'}</span>
                      </button>
                      {/* Measurement items */}
                      {!isCollapsed && items.map((m) => (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-1 pl-2 pr-1 py-0.5 hover:bg-blue-50 rounded text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (page.pageIndex !== currentPageIndex) setCurrentPage(page.pageIndex);
                            selectMeasurement(m.id);
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ background: m.color }}
                          />
                          <span className="text-zinc-400 shrink-0">
                            {m.type === 'linear' ? <LinearIcon /> : m.type === 'area' ? <AreaIcon /> : <CountIcon />}
                          </span>
                          <span className="truncate text-zinc-600 flex-1">{m.name}</span>
                          <span className="text-zinc-400 shrink-0">
                            {m.type === 'count' ? `${m.value}ea` : `${m.value.toFixed(1)}${m.unit.replace(' ', '')}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {/* Notes */}
                {hasNotes && (() => {
                  const noteKey = `${page.pageIndex}-__notes`;
                  const notesCollapsed = collapsedTrades[noteKey] ?? true;
                  const notes = annotations.filter((a) => a.type === 'note');
                  return (
                    <div>
                      <button
                        className="w-full flex items-center justify-between px-1 py-0.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                        onClick={(e) => { e.stopPropagation(); toggleTrade(page.pageIndex, '__notes'); }}
                      >
                        <span>Notes ({notes.length})</span>
                        <span className="ml-1">{notesCollapsed ? '▶' : '▼'}</span>
                      </button>
                      {!notesCollapsed && notes.map((ann) => (
                        <div key={ann.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 text-zinc-500">
                          <NoteIcon />
                          <span className="truncate">{ann.text?.slice(0, 20) ?? 'Note'}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
