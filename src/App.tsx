import { useRef, useState } from 'react';
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

export default function App() {
  const { project, setProject, addPages, activeTab } = useTakeoffStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [isAdding, setIsAdding] = useState(false); // true = adding to existing project

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

  function handleCancel() {
    setPendingFiles(null);
  }

  if (!project) {
    return (
      <>
        <DropZone onFiles={(files) => { setIsAdding(false); setPendingFiles(files); }} />
        {pendingFiles && (
          <UploadOptionsDialog
            fileName={pendingFiles.map((f) => f.name).join(', ')}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </>
    );
  }

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
          onCancel={handleCancel}
        />
      )}

      <Toolbar onAddPage={(multiple) => triggerUpload(multiple, true)} />

      {activeTab === 'plan' ? (
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar />
          <PdfViewer />
          <RightPanel />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <EstimatingView />
        </div>
      )}
    </div>
  );
}
