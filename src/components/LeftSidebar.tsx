import PageThumbnails from './PageThumbnails';
import ToolPalette from './ToolPalette';

export default function LeftSidebar() {
  return (
    <div className="w-[260px] bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <PageThumbnails />
      </div>
      <ToolPalette />
    </div>
  );
}
