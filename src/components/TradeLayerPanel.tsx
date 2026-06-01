import { useTakeoffStore } from '../store/takeoffStore';
import { COLOR_CYCLE } from '../utils/measurementUtils';
import type { TradeCategory } from '../types';

const TRADE_COLORS: Record<TradeCategory, string> = {
  General:    COLOR_CYCLE[0],
  Concrete:   COLOR_CYCLE[1],
  Drywall:    COLOR_CYCLE[2],
  Electrical: COLOR_CYCLE[3],
  HVAC:       COLOR_CYCLE[4],
  Plumbing:   COLOR_CYCLE[5],
  Framing:    COLOR_CYCLE[6],
  Painting:   COLOR_CYCLE[7],
  Flooring:   COLOR_CYCLE[0],
};

export default function TradeLayerPanel() {
  const { project, currentPageIndex, hiddenTrades, toggleTradeVisibility, setHiddenTrades } = useTakeoffStore();

  const page = project?.pages[currentPageIndex];
  const measurements = page?.measurements ?? [];

  const activeTrades = [...new Set(measurements.map((m) => m.trade))] as TradeCategory[];

  if (activeTrades.length === 0) return null;

  const allVisible = hiddenTrades.length === 0;

  return (
    <div className="border-t border-zinc-200 px-2 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Layers</span>
        <button
          className="text-[10px] text-zinc-400 hover:text-zinc-600"
          onClick={() => setHiddenTrades(allVisible ? [...activeTrades] : [])}
        >
          {allVisible ? 'Hide all' : 'Show all'}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {activeTrades.map((trade) => {
          const hidden = hiddenTrades.includes(trade);
          const count = measurements.filter((m) => m.trade === trade).length;
          return (
            <button
              key={trade}
              className={`flex items-center gap-2 px-1.5 py-1 rounded text-xs transition-colors w-full text-left ${
                hidden ? 'opacity-40 hover:opacity-70' : 'hover:bg-zinc-100'
              }`}
              onClick={() => toggleTradeVisibility(trade)}
              title={hidden ? `Show ${trade}` : `Hide ${trade}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: TRADE_COLORS[trade] ?? '#666' }}
              />
              <span className="flex-1 text-zinc-700">{trade}</span>
              <span className="text-zinc-400">{count}</span>
              <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {hidden ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </>
                )}
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
