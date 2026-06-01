import { useRef, useState, useCallback, useEffect } from 'react';
import { useTakeoffStore } from './store/takeoffStore';
import { convertFileToPlanPages } from './utils/fileConversion';
import DropZone from './components/DropZone';
import Toolbar from './components/Toolbar';
import LeftSidebar from './components/LeftSidebar';
import PdfViewer from './components/PdfViewer';
import RightPanel from './components/RightPanel';
import EstimatingView from './components/EstimatingView';
import AssembliesView from './components/AssembliesView';
import UploadOptionsDialog from './components/UploadOptionsDialog';
import type { Project, UploadOptions } from './types';
import { v4 as uuidv4 } from 'uuid';

const MIN_PANEL = 180;
const MAX_PANEL = 520;
const DEFAULT_PANEL = 300;

export default function App() {
  const { project, setProject, addPages, activeTab } = useTakeoffStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Resizable right panel
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const lastPanelWidth = useRef(DEFAULT_PANEL);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_PANEL);

  function togglePanel() {
    if (panelCollapsed) {
      setPanelCollapsed(false);
      setPanelWidth(lastPanelWidth.current || DEFAULT_PANEL);
    } else {
      lastPanelWidth.current = panelWidth;
      setPanelCollapsed(true);
    }
  }

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const next = Math.max(MIN_PANEL, Math.min(MAX_PANEL, dragStartW.current + delta));
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

      {activeTab === 'plan' && (
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar />
          <PdfViewer />
          {/* Drag handle */}
          <div
            className="w-1 shrink-0 bg-zinc-200 hover:bg-blue-400 cursor-col-resize transition-colors active:bg-blue-600 z-10"
            onMouseDown={onDragStart}
            title="Drag to resize"
          />
          {!panelCollapsed ? (
            <RightPanel width={effectivePanelWidth} onCollapse={togglePanel} />
          ) : (
            <button
              className="shrink-0 w-7 bg-zinc-50 border-l border-zinc-200 flex flex-col items-center justify-center hover:bg-blue-50 transition-colors"
              onClick={togglePanel}
              title="Expand Takeoffs panel"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {activeTab === 'estimating' && (
        <div className="flex flex-1 overflow-hidden">
          <EstimatingView />
        </div>
      )}

      {activeTab === 'assemblies' && (
        <div className="flex flex-1 overflow-hidden">
          <AssembliesView />
        </div>
      )}
    </div>
  );
}
