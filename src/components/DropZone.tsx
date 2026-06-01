import { useCallback, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
}

export default function DropZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((files: File[]) => {
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handle(Array.from(e.dataTransfer.files));
  }, [handle]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-lg px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">TakeoffPro</h1>
          <p className="text-zinc-500 mt-1">Construction Takeoff Software</p>
        </div>
        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-16 cursor-pointer transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-zinc-300 bg-white hover:border-blue-300 hover:bg-zinc-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.dxf,.dwg"
            multiple
            onChange={(e) => handle(Array.from(e.target.files ?? []))}
          />
          <svg className="w-12 h-12 text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg font-medium text-zinc-700">Drop plans here or click to browse</p>
          <p className="text-sm text-zinc-400 mt-2">Supports PDF, JPG, PNG, TIFF, DXF</p>
        </label>
      </div>
    </div>
  );
}
