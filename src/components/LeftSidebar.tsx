import { useState } from 'react';
import PageThumbnails from './PageThumbnails';
import BatchRenameModal from './BatchRenameModal';
import { useTakeoffStore } from '../store/takeoffStore';

export default function LeftSidebar() {
  const project = useTakeoffStore((s) => s.project);
  const [showBatchRename, setShowBatchRename] = useState(false);

  return (
    <div className="w-[220px] bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-hidden">
      {project && (
        <div className="px-2 pt-2 shrink-0">
          <button
            className="w-full text-xs text-zinc-500 hover:text-blue-600 hover:bg-blue-50 border border-zinc-200 rounded px-2 py-1 transition-colors"
            onClick={() => setShowBatchRename(true)}
          >
            Rename Pages…
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <PageThumbnails />
      </div>
      {showBatchRename && <BatchRenameModal onClose={() => setShowBatchRename(false)} />}
    </div>
  );
}
