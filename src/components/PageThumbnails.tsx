import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';

export default function PageThumbnails() {
  const {
    project, currentPageIndex, setCurrentPage, renamePage,
    activeCountSession, continueCountOnPage, stopCountSession,
  } = useTakeoffStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [pendingPageChange, setPendingPageChange] = useState<number | null>(null);

  if (!project) return null;

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
    if (activeCountSession) {
      // Ask user if they want to continue count on new page
      setPendingPageChange(pageIndex);
    } else {
      setCurrentPage(pageIndex);
    }
  }

  function handleContinueCount() {
    if (pendingPageChange === null) return;
    continueCountOnPage(pendingPageChange);
    setPendingPageChange(null);
  }

  function handleStopCount() {
    if (pendingPageChange === null) return;
    stopCountSession();
    setCurrentPage(pendingPageChange);
    setPendingPageChange(null);
  }

  function handleJustChangePage() {
    if (pendingPageChange === null) return;
    setCurrentPage(pendingPageChange);
    setPendingPageChange(null);
  }

  return (
    <div className="flex flex-col gap-2 p-2 relative">
      {/* Page change prompt when count session is active */}
      {pendingPageChange !== null && activeCountSession && (
        <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-3 gap-2 rounded-lg border border-blue-200 shadow-lg">
          <p className="text-xs font-semibold text-zinc-800 text-center">
            Continue counting <span className="text-blue-600">"{activeCountSession.name}"</span> on{' '}
            {project.pages.find((p) => p.pageIndex === pendingPageChange)?.name ?? `Page ${pendingPageChange + 1}`}?
          </p>
          <button
            className="w-full py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleContinueCount}
          >
            Continue counting here
          </button>
          <button
            className="w-full py-1.5 text-xs rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
            onClick={handleStopCount}
          >
            Stop count, go to page
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
        return (
          <div
            key={page.pageIndex}
            className={`flex flex-col items-center gap-1 p-1 rounded-lg border-2 transition-colors cursor-pointer ${
              isActive ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-zinc-300'
            }`}
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
        );
      })}
    </div>
  );
}
