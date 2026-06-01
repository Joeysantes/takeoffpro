import TakeoffList from './TakeoffList';
import SummaryTable from './SummaryTable';
import { useTakeoffStore } from '../store/takeoffStore';

export default function RightPanel() {
  const project = useTakeoffStore((s) => s.project);

  if (!project) return null;

  return (
    <div className="w-[300px] bg-white border-l border-zinc-200 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-200 bg-zinc-50 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-700">Takeoffs</h2>
      </div>
      <TakeoffList />
      <SummaryTable />
    </div>
  );
}
