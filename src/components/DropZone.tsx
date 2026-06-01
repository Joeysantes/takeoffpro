import React, { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTakeoffStore } from '../store/takeoffStore';
import { convertFileToPlanPages } from '../utils/fileConversion';
import type { Project } from '../types';

export default function DropZone() {
  const setProject = useTakeoffStore((s) => s.setProject);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const pages = await convertFileToPlanPages(file);
        const project: Project = {
          id: uuidv4(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          pages,
          createdAt: new Date().toISOString(),
        };
        setProject(project);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      } finally {
        setLoading(false);
      }
    },
    [setProject]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-lg px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">TakeoffPro</h1>
          <p className="text-zinc-500 mt-1">Construction Takeoff Software</p>
        </div>
        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-16 cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-zinc-300 bg-white hover:border-blue-300 hover:bg-zinc-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.dxf,.dwg"
            onChange={onFileChange}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-600">Processing file…</p>
            </div>
          ) : (
            <>
              <svg
                className="w-12 h-12 text-zinc-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-lg font-medium text-zinc-700">Drop plans here or click to browse</p>
              <p className="text-sm text-zinc-400 mt-2">Supports PDF, JPG, PNG, TIFF, DXF</p>
            </>
          )}
        </label>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
