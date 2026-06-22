import { useState } from 'react';
import TakeoffList from './TakeoffList';
import SummaryTable from './SummaryTable';
import MeasurementProperties from './MeasurementProperties';
import { useTakeoffStore } from '../store/takeoffStore';

interface Props {
  width: number;
  onCollapse: () => void;
}

export default function RightPanel({ width, onCollapse }: Props) {
  const { project, currentPageIndex, deleteAnnotation, updateAnnotation } = useTakeoffStore();
  const [annotCollapsed, setAnnotCollapsed] = useState(true);

  if (!project) return null;

  const page = project.pages[currentPageIndex];
  const annotations = page?.annotations ?? [];

  return (
    <div
      className="bg-white border-l border-zinc-200 flex flex-col overflow-hidden shrink-0"
      style={{ width }}
    >
      <div className="px-3 py-2 border-b border-zinc-200 bg-zinc-50 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">Takeoffs</h2>
        <button
          className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded hover:bg-zinc-200 transition-colors"
          onClick={onCollapse}
          title="Collapse panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <MeasurementProperties />
      <TakeoffList />
      <SummaryTable />

      {/* Annotations section */}
      <div className="border-t border-zinc-200 shrink-0">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide bg-zinc-50 hover:bg-zinc-100"
          onClick={() => setAnnotCollapsed((c) => !c)}
        >
          <span className="flex items-center gap-1.5">
            Annotations
            {annotations.length > 0 && (
              <span className="bg-zinc-300 text-zinc-600 rounded-full px-1.5 py-0 font-normal normal-case text-[10px]">
                {annotations.length}
              </span>
            )}
          </span>
          <span>{annotCollapsed ? '▶' : '▼'}</span>
        </button>

        {!annotCollapsed && (
          <div className="overflow-y-auto max-h-40">
            {annotations.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-400">No annotations yet</div>
            ) : (
              annotations.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs border-b border-zinc-50 hover:bg-zinc-50"
                >
                  {ann.type === 'note' ? (
                    <span className="text-zinc-500 shrink-0">📝</span>
                  ) : (
                    <span
                      className="w-3 h-3 rounded shrink-0"
                      style={{ background: ann.color, opacity: 0.7 }}
                    />
                  )}
                  <span className="flex-1 truncate text-zinc-700">
                    {ann.type === 'note'
                      ? (ann.text?.slice(0, 30) ?? 'Note')
                      : (ann.text ?? 'Highlight')}
                  </span>
                  <button
                    className={`shrink-0 text-zinc-400 hover:text-zinc-700 ${ann.visible ? '' : 'opacity-40'}`}
                    onClick={() => updateAnnotation(ann.id, { visible: !ann.visible })}
                    title={ann.visible ? 'Hide' : 'Show'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    className="shrink-0 text-zinc-400 hover:text-red-500"
                    onClick={() => deleteAnnotation(ann.id)}
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
