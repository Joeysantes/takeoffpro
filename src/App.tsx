import React, { useRef } from 'react';
import { useTakeoffStore } from './store/takeoffStore';
import { convertFileToPlanPages } from './utils/fileConversion';
import DropZone from './components/DropZone';
import Toolbar from './components/Toolbar';
import LeftSidebar from './components/LeftSidebar';
import PdfViewer from './components/PdfViewer';
import RightPanel from './components/RightPanel';
import type { Project } from './types';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const { project, setProject } = useTakeoffStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    try {
      const pages = await convertFileToPlanPages(file);
      const proj: Project = {
        id: uuidv4(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        pages,
        createdAt: new Date().toISOString(),
      };
      setProject(proj);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process file');
    }
  }

  function onUploadClick() {
    fileInputRef.current?.click();
  }

  if (!project) {
    return <DropZone />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.dxf,.dwg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          e.target.value = '';
        }}
      />
      <Toolbar onUpload={onUploadClick} />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <PdfViewer />
        <RightPanel />
      </div>
    </div>
  );
}
