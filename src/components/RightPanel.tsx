import TakeoffList from './TakeoffList';
import SummaryTable from './SummaryTable';
import MeasurementProperties from './MeasurementProperties';
import { useTakeoffStore } from '../store/takeoffStore';

interface Props {
  width: number;
  onCollapse: () => void;
}

export default function RightPanel({ width, onCollapse }: Props) {
  const project = useTakeoffStore((s) => s.project);

  if (!project) return null;

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
    </div>
  );
}
