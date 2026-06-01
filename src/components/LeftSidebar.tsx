import PageThumbnails from './PageThumbnails';
import ToolPalette from './ToolPalette';
import TradeLayerPanel from './TradeLayerPanel';
import BatchRenameModal from './BatchRenameModal';
import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';

export default function LeftSidebar() {
  const [showRename, setShowRename] = useState(false);
  const project = useTakeoffStore((s) => s.project);

  return (
    <div className="w-[220px] bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-hidden shrink-0">
      {project && (
        <div className="px-2 pt-2 shrink-0">
          <button
            className="w-full text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded py-1 hover:bg-zinc-100 transition-colors"
            onClick={() => setShowRename(true)}
          >
            Rename Pages…
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <PageThumbnails />
      </div>
      <TradeLayerPanel />
      <ToolPalette />
      {showRename && <BatchRenameModal onClose={() => setShowRename(false)} />}
    </div>
  );
}
