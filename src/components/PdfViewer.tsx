import { useRef } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import MeasurementCanvas from './MeasurementCanvas';

export default function PdfViewer() {
  const { project, currentPageIndex, zoom } = useTakeoffStore();
  const page = project?.pages[currentPageIndex];
  const containerRef = useRef<HTMLDivElement>(null);

  if (!page) return null;

  const dispW = page.width * zoom;
  const dispH = page.height * zoom;

  const filterStyle =
    page.colorMode === 'grayscale'
      ? 'grayscale(1)'
      : page.colorMode === 'bw'
      ? 'grayscale(1) contrast(1.8) brightness(1.1)'
      : page.colorMode === 'half'
      ? 'grayscale(0.5)'
      : 'none';

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-zinc-300 relative">
      <div
        className="relative inline-block m-4"
        style={{ width: dispW, height: dispH }}
      >
        <img
          src={page.imageDataUrl}
          alt={`Page ${page.pageIndex + 1}`}
          style={{ width: dispW, height: dispH, filter: filterStyle, display: 'block' }}
          draggable={false}
        />
        <MeasurementCanvas
          width={dispW}
          height={dispH}
          pageIndex={currentPageIndex}
        />
      </div>
    </div>
  );
}
