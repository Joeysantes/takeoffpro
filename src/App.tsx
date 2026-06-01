import { useRef, useState, useCallback, useEffect } from 'react';
import { useTakeoffStore } from './store/takeoffStore';
import { convertFileToPlanPages } from './utils/fileConversion';
import DropZone from './components/DropZone';
import Toolbar from './components/Toolbar';
import LeftSidebar from './components/LeftSidebar';
import PdfViewer from './components/PdfViewer';
import RightPanel from './components/RightPanel';
import EstimatingView from './components/EstimatingView';
import UploadOptionsDialog from './components/UploadOptionsDialog';
import type { Project, UploadOptions } from './types';
import { v4 as uuidv4 } from 'uuid';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 520;
const DEFAULT_PANEL_WIDTH = 300;

export default function App() {
  const { project, setProject, addPages, activeTab } = useTakeoffStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Resizable right panel
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const lastPanelWidth = useRef(DEFAULT_PANEL_WIDTH);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_PANEL_WIDTH);

  function togglePanel() {
    if (panelCollapsed) {
      setPanelCollapsed(false);
      setPanelWidth(lastPanelWidth.current || DEFAULT_PANEL_WIDTH);
    } else {
      lastPanelWidth.current = panelWidth;
      setPanelCollapsed(true);
    }
  }

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const next = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartWidth.current + delta));
      setPanelWidth(next);
      if (panelCollapsed) setPanelCollapsed(false);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panelCollapsed]);

  function triggerUpload(multiple: boolean, adding = false) {
    setIsAdding(adding);
    if (fileInputRef.current) {
      fileInputRef.current.multiple = multiple;
      fileInputRef.current.click();
    }
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) setPendingFiles(files);
    e.target.value = '';
  }

  async function handleConfirm(options: UploadOptions) {
    if (!pendingFiles) return;
    setPendingFiles(null);
    try {
      const allPages = [];
      for (const file of pendingFiles) {
        const pages = await convertFileToPlanPages(file, options);
        allPages.push(...pages);
      }
      if (isAdding && project) {
        addPages(allPages);
      } else {
        const proj: Project = {
          id: uuidv4(),
          name: pendingFiles[0].name.replace(/\.[^/.]+$/, ''),
          pages: allPages.map((p, i) => ({ ...p, pageIndex: i })),
          createdAt: new Date().toISOString(),
        };
        setProject(proj);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process file');
    }
  }

  if (!project) {
    return (
      <>
        <DropZone onFiles={(files) => { setIsAdding(false); setPendingFiles(files); }} />
        {pendingFiles && (
          <UploadOptionsDialog
            fileName={pendingFiles.map((f) => f.name).join(', ')}
            onConfirm={handleConfirm}
            onCancel={() => setPendingFiles(null)}
          />
        )}
      </>
    );
  }

  const effectivePanelWidth = panelCollapsed ? 0 : panelWidth;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.dxf,.dwg"
        onChange={onFilesSelected}
      />

      {pendingFiles && (
        <UploadOptionsDialog
          fileName={pendingFiles.map((f) => f.name).join(', ')}
          onConfirm={handleConfirm}
          onCancel={() => setPendingFiles(null)}
        />
      )}

      <Toolbar onAddPage={(multiple) => triggerUpload(multiple, true)} />

      {activeTab === 'plan' ? (
        <div className="flex flex-1 overflow-hidden relative">
          <LeftSidebar />
          <PdfViewer />

          {/* Drag handle */}
          <div
            className="w-1 shrink-0 bg-zinc-200 hover:bg-blue-400 cursor-col-resize transition-colors active:bg-blue-600 z-10"
            onMouseDown={onDragStart}
            title="Drag to resize panel"
          />

          {/* Right panel */}
          {!panelCollapsed && (
            <RightPanel
              width={effectivePanelWidth}
              onCollapse={togglePanel}
            />
          )}

          {/* Collapsed tab */}
          {panelCollapsed && (
            <button
              className="shrink-0 w-7 bg-zinc-50 border-l border-zinc-200 flex flex-col items-center justify-center gap-1 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={togglePanel}
              title="Expand Takeoffs panel"
            >
              <span className="text-zinc-400 text-[10px] rotate-90 whitespace-nowrap tracking-wide font-medium" style={{ writingMode: 'vertical-rl' }}>
                Takeoffs
              </span>
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <EstimatingView />
        </div>
      )}
    </div>
  );
}
