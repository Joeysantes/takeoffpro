import { useRef, useEffect, useState, useCallback } from 'react';
import { useTakeoffStore } from '../store/takeoffStore';
import MeasurementCanvas from './MeasurementCanvas';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

export default function PdfViewer() {
  const { project, currentPageIndex, zoom, setZoom, zoomRequest, requestZoom } = useTakeoffStore();
  const page = project?.pages[currentPageIndex];
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit to window helper
  const computeFit = useCallback((w: number, h: number, imgW: number, imgH: number) => {
    const scale = Math.min(w / imgW, h / imgH) * 0.95;
    const clamped = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
    return {
      scale: clamped,
      pos: { x: (w - imgW * clamped) / 2, y: (h - imgH * clamped) / 2 },
    };
  }, []);

  // Fit on page change or initial load
  const lastPageIndex = useRef(-1);
  useEffect(() => {
    if (!page || containerSize.w === 0) return;
    if (page.pageIndex === lastPageIndex.current) return;
    lastPageIndex.current = page.pageIndex;
    const { scale, pos } = computeFit(containerSize.w, containerSize.h, page.width, page.height);
    setStageScale(scale);
    setStagePos(pos);
    setZoom(scale);
  }, [page?.pageIndex, containerSize, computeFit, setZoom]);

  // Handle zoom requests from toolbar
  useEffect(() => {
    if (!zoomRequest || !page || containerSize.w === 0) return;
    if (zoomRequest === 'fit') {
      const { scale, pos } = computeFit(containerSize.w, containerSize.h, page.width, page.height);
      setStageScale(scale);
      setStagePos(pos);
      setZoom(scale);
    } else {
      const newScale = Math.min(Math.max(zoomRequest, MIN_SCALE), MAX_SCALE);
      const cx = containerSize.w / 2;
      const cy = containerSize.h / 2;
      const newX = cx - (cx - stagePos.x) * (newScale / stageScale);
      const newY = cy - (cy - stagePos.y) * (newScale / stageScale);
      setStageScale(newScale);
      setStagePos({ x: newX, y: newY });
      setZoom(newScale);
    }
    requestZoom(null);
  }, [zoomRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync toolbar +/- zoom buttons (they call setZoom directly)
  const prevZoom = useRef(zoom);
  useEffect(() => {
    if (Math.abs(zoom - stageScale) < 0.001) return; // avoid loop
    if (Math.abs(zoom - prevZoom.current) < 0.001) return;
    prevZoom.current = zoom;
    const newScale = Math.min(Math.max(zoom, MIN_SCALE), MAX_SCALE);
    const cx = containerSize.w / 2;
    const cy = containerSize.h / 2;
    const ratio = stageScale > 0 ? newScale / stageScale : 1;
    setStagePos((p) => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
    setStageScale(newScale);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spacebar
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const handleTransformChange = useCallback((newScale: number, newPos: { x: number; y: number }) => {
    setStageScale(newScale);
    setStagePos(newPos);
    setZoom(newScale);
    prevZoom.current = newScale;
  }, [setZoom]);

  function zoomStep(direction: 1 | -1) {
    if (!page) return;
    const steps = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
    let idx = direction > 0
      ? steps.findIndex((s) => s > stageScale + 0.001)
      : steps.findLastIndex((s) => s < stageScale - 0.001);
    if (idx === -1) idx = direction > 0 ? steps.length - 1 : 0;
    const newScale = steps[idx] ?? stageScale;
    const cx = containerSize.w / 2;
    const cy = containerSize.h / 2;
    const ratio = stageScale > 0 ? newScale / stageScale : 1;
    const newPos = { x: cx - (cx - stagePos.x) * ratio, y: cy - (cy - stagePos.y) * ratio };
    handleTransformChange(newScale, newPos);
  }

  if (!page) return null;

  const cursor = spaceDown ? 'grab' : 'default';

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative select-none bg-zinc-300"
      style={{ cursor }}
    >
      {/* PDF image with mirrored CSS transform */}
      <img
        src={page.imageDataUrl}
        alt={page.name ?? `Page ${page.pageIndex + 1}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: page.width,
          height: page.height,
          transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          userSelect: 'none',
          imageRendering: 'auto',
        }}
        draggable={false}
      />

      {/* Konva canvas (same transform via stage scale/position) */}
      {containerSize.w > 0 && (
        <MeasurementCanvas
          width={containerSize.w}
          height={containerSize.h}
          pageIndex={currentPageIndex}
          stageScale={stageScale}
          stagePos={stagePos}
          onTransformChange={handleTransformChange}
          spaceDown={spaceDown}
        />
      )}

      {/* Zoom controls overlay */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/95 backdrop-blur rounded-lg shadow border border-zinc-200 px-2 py-1 z-10">
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-zinc-700 font-bold text-base disabled:opacity-30"
          onClick={() => zoomStep(-1)}
          disabled={stageScale <= MIN_SCALE}
        >−</button>
        <span className="text-xs text-zinc-600 w-11 text-center select-none font-medium">{Math.round(stageScale * 100)}%</span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-zinc-700 font-bold text-base disabled:opacity-30"
          onClick={() => zoomStep(1)}
          disabled={stageScale >= MAX_SCALE}
        >+</button>
        <div className="w-px h-4 bg-zinc-200 mx-1" />
        <button
          className="px-2 py-0.5 text-xs rounded hover:bg-zinc-100 text-zinc-600 font-medium"
          onClick={() => {
            const { scale, pos } = computeFit(containerSize.w, containerSize.h, page.width, page.height);
            handleTransformChange(scale, pos);
          }}
        >Fit</button>
        <button
          className="px-2 py-0.5 text-xs rounded hover:bg-zinc-100 text-zinc-600 font-medium"
          onClick={() => {
            const x = (containerSize.w - page.width) / 2;
            const y = (containerSize.h - page.height) / 2;
            handleTransformChange(1, { x, y });
          }}
        >100%</button>
      </div>
    </div>
  );
}
