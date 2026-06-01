import { useState } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';

interface Props {
  onClose: () => void;
}

export default function BatchRenameModal({ onClose }: Props) {
  const { project, renamePage } = useTakeoffStore();
  const pages = project?.pages ?? [];

  const [names, setNames] = useState<string[]>(
    pages.map((p) => p.name ?? `Page ${p.pageIndex + 1}`)
  );

  function handleSave() {
    names.forEach((name, i) => {
      if (pages[i]) renamePage(pages[i].pageIndex, name);
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-96 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">Rename Pages</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {pages.map((page, i) => (
            <div key={page.pageIndex} className="flex items-center gap-3">
              <img
                src={page.imageDataUrl}
                alt=""
                className="w-12 h-10 object-contain rounded border border-zinc-200 shrink-0"
              />
              <input
                className="flex-1 border border-zinc-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                value={names[i]}
                onChange={(e) => {
                  const updated = [...names];
                  updated[i] = e.target.value;
                  setNames(updated);
                }}
                placeholder={`Page ${page.pageIndex + 1}`}
              />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-200 flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSave}
          >
            Save All
          </button>
        </div>
      </div>
    </div>
  );
}
