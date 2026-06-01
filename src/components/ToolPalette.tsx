import React, { useEffect } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import type { ActiveTool } from '../types';

const TOOLS: { tool: ActiveTool; label: string; key: string; icon: React.ReactNode }[] = [
  {
    tool: 'select',
    label: 'Select',
    key: 'S',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
      </svg>
    ),
  },
  {
    tool: 'linear',
    label: 'Linear',
    key: 'L',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
      </svg>
    ),
  },
  {
    tool: 'area',
    label: 'Area',
    key: 'A',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
      </svg>
    ),
  },
  {
    tool: 'count',
    label: 'Count',
    key: 'C',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" strokeWidth={2} />
      </svg>
    ),
  },
];

export default function ToolPalette() {
  const { activeTool, setActiveTool, project } = useTakeoffStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!project || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      const tool = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (tool) setActiveTool(tool.tool);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [project, setActiveTool]);

  if (!project) return null;

  return (
    <div className="p-2 border-t border-zinc-200">
      <div className="text-xs text-zinc-500 px-1 mb-2 font-medium">Tools</div>
      <div className="flex flex-col gap-1">
        {TOOLS.map(({ tool, label, key, icon }) => (
          <button
            key={tool}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              activeTool === tool
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700'
            }`}
            onClick={() => setActiveTool(tool)}
          >
            {icon}
            <span className="flex-1 text-left">{label}</span>
            <kbd
              className={`text-xs px-1 rounded ${
                activeTool === tool ? 'bg-blue-500 text-blue-100' : 'bg-zinc-100 text-zinc-400'
              }`}
            >
              {key}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
