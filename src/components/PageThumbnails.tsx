import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';

export default function PageThumbnails() {
  const { project, currentPageIndex, setCurrentPage, renamePage } = useTakeoffStore();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  if (!project) return null;

  function startEdit(pageIndex: number, currentName: string) {
    setEditingIndex(pageIndex);
    setEditVal(currentName);
  }

  function commitEdit(pageIndex: number) {
    if (editVal.trim()) renamePage(pageIndex, editVal.trim());
    setEditingIndex(null);
  }

  return (
    <div className="flex flex-col gap-2 p-2">
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
            onClick={() => setCurrentPage(page.pageIndex)}
          >
            <div className="relative w-20">
              <img
                src={page.imageDataUrl}
                alt={name}
                className="w-20 object-contain rounded"
                draggable={false}
              />
              {!page.scale && (
                <div className="absolute top-0.5 right-0.5 bg-amber-400 rounded-full w-2 h-2" title="No scale set" />
              )}
            </div>

            {editingIndex === page.pageIndex ? (
              <input
                autoFocus
                className="w-20 border border-blue-400 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
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
                className="text-xs text-zinc-500 w-20 text-center truncate cursor-text hover:text-blue-600"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEdit(page.pageIndex, name);
                }}
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
