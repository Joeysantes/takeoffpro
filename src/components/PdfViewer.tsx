import { useRef, useEffect, useState, useCallback } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import MeasurementCanvas from './MeasurementCanvas';

export default function PdfViewer() {
  const { project, currentPageIndex, zoom } = useTakeoffStore();
  const page = project?.pages[currentPageIndex];
  const containerRef = useRef<HTMLDivElement>(null);

  const [spaceDown, setSpaceDown] = useState(false);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const startPan = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    panRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  }, []);

  const doPan = useCallback((clientX: number, clientY: number) => {
    if (!panRef.current.active) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = panRef.current.scrollLeft - (clientX - panRef.current.startX);
    el.scrollTop = panRef.current.scrollTop - (clientY - panRef.current.startY);
  }, []);

  const endPan = useCallback(() => {
    panRef.current.active = false;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { e.preventDefault(); startPan(e.clientX, e.clientY); return; }
    if (e.button === 0 && spaceDown) { e.preventDefault(); startPan(e.clientX, e.clientY); }
  }, [spaceDown, startPan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (panRef.current.active) { e.preventDefault(); doPan(e.clientX, e.clientY); }
  }, [doPan]);

  const onMouseUp = useCallback(() => endPan(), [endPan]);

  if (!page) return null;

  const dispW = page.width * zoom;
  const dispH = page.height * zoom;

  const cursor = panRef.current.active ? 'grabbing' : spaceDown ? 'grab' : 'default';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-zinc-300 relative select-none"
      style={{ cursor }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        className="relative inline-block m-4"
        style={{ width: dispW, height: dispH }}
      >
        <img
          src={page.imageDataUrl}
          alt={page.name ?? `Page ${page.pageIndex + 1}`}
          style={{ width: dispW, height: dispH, display: 'block' }}
          draggable={false}
        />
        <MeasurementCanvas width={dispW} height={dispH} pageIndex={currentPageIndex} />
      </div>
    </div>
  );
}
