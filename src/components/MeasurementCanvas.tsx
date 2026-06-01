import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useTakeoffStore } from '../store/takeoffStore';
import type { Measurement, Point } from '../types';
import {
  pixelDistance,
  polylineLength,
  polygonArea,
  pixelsToFeet,
  pixelsToSqFt,
  polygonCentroid,
  getNextColor,
} from '../utils/measurementUtils';

interface Props {
  width: number;
  height: number;
  pageIndex: number;
}

interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
}

interface PendingFinish {
  type: 'linear' | 'area';
  lastPoint: Point; // screen coords
  x: number;
  y: number;
}

function toDisplay(p: Point, zoom: number): Point {
  return { x: p.x * zoom, y: p.y * zoom };
}

function toStore(p: Point, zoom: number): Point {
  return { x: p.x / zoom, y: p.y / zoom };
}

function countByType(measurements: Measurement[], type: string): number {
  return measurements.filter((m) => m.type === type).length;
}

function computeValue(points: Point[], type: string, scale: { pixelsPerFoot: number } | null) {
  if (type === 'linear') {
    const px = polylineLength(points);
    return scale ? { value: pixelsToFeet(px, scale.pixelsPerFoot), unit: 'ft' } : { value: px, unit: 'px' };
  }
  if (type === 'area') {
    const sqPx = polygonArea(points);
    return scale
      ? { value: pixelsToSqFt(sqPx, scale.pixelsPerFoot), unit: 'sq ft' }
      : { value: sqPx, unit: 'sq px' };
  }
  return { value: 1, unit: 'ea' };
}

function liveDist(p1: Point, p2: Point, scale: { pixelsPerFoot: number } | null): string {
  const px = pixelDistance(p1, p2);
  if (scale) return `${pixelsToFeet(px, scale.pixelsPerFoot).toFixed(2)} ft`;
  return `${px.toFixed(0)} px`;
}

export default function MeasurementCanvas({ width, height, pageIndex }: Props) {
  const {
    project, zoom, activeTool, selectedMeasurementId,
    isCalibrating, isDimensioning, calibrationPoints, dimensionPoints,
    hiddenTrades,
    addMeasurement, deleteMeasurement, selectMeasurement,
    setCalibrationPoints, setDimensionPoints, setDimensionResult,
    clearDimension, resetCalibration, setActiveTool,
  } = useTakeoffStore();

  const page = project?.pages[pageIndex];
  const measurements = page?.measurements ?? [];
  const scale = page?.scale ?? null;

  const [inProgress, setInProgress] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scalePixelDist, setScalePixelDist] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, visible: false });
  const [pendingFinish, setPendingFinish] = useState<PendingFinish | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ScaleModalComp, setScaleModalComp] = useState<React.ComponentType<{
    pixelDist: number; pageIndex: number; onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    import('./ScaleModal').then((m) => setScaleModalComp(() => m.default));
  }, []);

  // Reset in-progress when tool changes
  useEffect(() => {
    setInProgress([]);
    setMousePos(null);
    setPendingFinish(null);
  }, [activeTool]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') return;
      if (e.key === 'Escape') {
        if (isCalibrating) resetCalibration();
        if (isDimensioning) clearDimension();
        setInProgress([]);
        setMousePos(null);
        setPendingFinish(null);
        setContextMenu({ x: 0, y: 0, visible: false });
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
        if (selectedMeasurementId) deleteMeasurement(selectedMeasurementId);
      }
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const map: Record<string, typeof activeTool> = { s: 'select', l: 'linear', a: 'area', c: 'count', d: 'dimension' };
        const t = map[e.key.toLowerCase()];
        if (t) setActiveTool(t);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCalibrating, isDimensioning, selectedMeasurementId, activeTool,
      resetCalibration, clearDimension, deleteMeasurement, setActiveTool]);

  // Auto-dismiss pending finish bar after 4s
  useEffect(() => {
    if (pendingFinish) {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        setPendingFinish(null);
        setActiveTool('select');
      }, 4000);
    }
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, [pendingFinish, setActiveTool]);

  const getPos = useCallback((stage: Konva.Stage): Point => {
    return stage.getPointerPosition() ?? { x: 0, y: 0 };
  }, []);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = getPos(e.target.getStage()!);
    setMousePos(pos);
  }, [getPos]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    setContextMenu({ x: 0, y: 0, visible: false });

    const pos = getPos(e.target.getStage()!);
    const stored = toStore(pos, zoom);

    // Calibrate
    if (isCalibrating) {
      const newPts = [...calibrationPoints, stored];
      setCalibrationPoints(newPts);
      if (newPts.length === 2) {
        const p1d = toDisplay(newPts[0], zoom);
        const p2d = toDisplay(newPts[1], zoom);
        setScalePixelDist(pixelDistance(p1d, p2d));
        setShowScaleModal(true);
      }
      return;
    }

    // Dimension tool
    if (isDimensioning) {
      const newPts = [...dimensionPoints, stored];
      setDimensionPoints(newPts);
      if (newPts.length >= 2) {
        const p1d = toDisplay(newPts[0], zoom);
        const p2d = toDisplay(newPts[1], zoom);
        const dist = pixelDistance(p1d, p2d);
        setDimensionResult(scale ? pixelsToFeet(dist, scale.pixelsPerFoot) : dist);
        // Reset to single-point after locking; next click starts fresh
        setTimeout(() => setDimensionPoints([]), 2000);
      }
      return;
    }

    if (activeTool === 'select') { selectMeasurement(null); return; }

    if (activeTool === 'count') {
      addMeasurement({
        id: uuidv4(), type: 'count',
        name: `Count ${countByType(measurements, 'count') + 1}`,
        trade: 'General', color: getNextColor(measurements.length),
        points: [stored], value: 1, unit: 'ea', unitCost: 0, visible: true, pageIndex,
      });
      return;
    }

    if (activeTool === 'linear') {
      setInProgress((prev) => [...prev, stored]);
      return;
    }

    if (activeTool === 'area') {
      if (inProgress.length >= 3) {
        const firstDisp = toDisplay(inProgress[0], zoom);
        if (pixelDistance(pos, firstDisp) < 10) { finishArea(inProgress, pos); return; }
      }
      setInProgress((prev) => [...prev, stored]);
    }
  }, [activeTool, inProgress, isCalibrating, isDimensioning, calibrationPoints, dimensionPoints,
      measurements, zoom, pageIndex, scale, getPos, addMeasurement, selectMeasurement,
      setCalibrationPoints, setDimensionPoints, setDimensionResult]);

  const handleDblClick = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'linear' && inProgress.length >= 2) {
      const pts = inProgress.length > 1 ? inProgress.slice(0, -1) : inProgress;
      finishLinear(pts.length >= 2 ? pts : inProgress, mousePos ?? toDisplay(inProgress[inProgress.length - 1], zoom));
      return;
    }
    if (activeTool === 'area' && inProgress.length >= 3) {
      finishArea(inProgress, mousePos ?? toDisplay(inProgress[inProgress.length - 1], zoom));
    }
  }, [activeTool, inProgress, mousePos, zoom]);

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    const pos = getPos(e.target.getStage()!);
    // Only show if clicking empty space (not on a measurement shape)
    if (e.target === e.target.getStage() || e.target.getParent() === e.target.getLayer()) {
      setContextMenu({ x: pos.x, y: pos.y, visible: true });
    }
  }, [getPos]);

  function finishLinear(points: Point[], lastScreenPos: Point) {
    if (points.length < 2) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'linear', scale);
    addMeasurement({
      id: uuidv4(), type: 'linear',
      name: `Linear ${countByType(measurements, 'linear') + 1}`,
      trade: 'General', color: getNextColor(measurements.length),
      points, value, unit, unitCost: 0, visible: true, pageIndex,
    });
    setInProgress([]);
    setPendingFinish({ type: 'linear', lastPoint: toStore(lastScreenPos, zoom), x: lastScreenPos.x, y: lastScreenPos.y });
  }

  function finishArea(points: Point[], lastScreenPos: Point) {
    if (points.length < 3) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'area', scale);
    addMeasurement({
      id: uuidv4(), type: 'area',
      name: `Area ${countByType(measurements, 'area') + 1}`,
      trade: 'General', color: getNextColor(measurements.length),
      points, value, unit, unitCost: 0, visible: true, pageIndex,
    });
    setInProgress([]);
    setPendingFinish({ type: 'area', lastPoint: toStore(lastScreenPos, zoom), x: lastScreenPos.x, y: lastScreenPos.y });
  }

  function handleContinue() {
    if (!pendingFinish) return;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingFinish(null);
    setActiveTool(pendingFinish.type);
    if (pendingFinish.type === 'linear') {
      setInProgress([pendingFinish.lastPoint]);
    }
    // area continues fresh
  }

  function handleDone() {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingFinish(null);
    setActiveTool('select');
  }

  const handleMeasurementClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (activeTool === 'select') selectMeasurement(id);
  }, [activeTool, selectMeasurement]);

  const handleCountRightClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    deleteMeasurement(id);
  }, [deleteMeasurement]);

  const lastMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  const cursor = (isCalibrating || isDimensioning || activeTool === 'linear' || activeTool === 'area' || activeTool === 'count')
    ? 'crosshair' : 'default';

  function displayPts(pts: Point[]) {
    return pts.flatMap((p) => [p.x * zoom, p.y * zoom]);
  }

  function renderMeasurement(m: Measurement) {
    if (!m.visible) return null;
    if (hiddenTrades.includes(m.trade)) return null;
    const isSelected = m.id === selectedMeasurementId;
    const pts = m.points.map((p) => toDisplay(p, zoom));
    const r = parseInt(m.color.slice(1, 3), 16);
    const g = parseInt(m.color.slice(3, 5), 16);
    const b = parseInt(m.color.slice(5, 7), 16);

    if (m.type === 'count') {
      const idx = measurements.filter((x) => x.type === 'count' && x.id <= m.id).length;
      return (
        <Group key={m.id} x={pts[0].x} y={pts[0].y}
          onClick={(e) => handleMeasurementClick(m.id, e)}
          onContextMenu={(e) => handleCountRightClick(m.id, e)}
          onMouseEnter={() => setHoveredId(m.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <Circle radius={12} fill={m.color}
            stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={2}
            shadowBlur={m.id === hoveredId ? 6 : 0} />
          <Text text={String(idx)} fontSize={10} fill="#fff" fontStyle="bold"
            align="center" verticalAlign="middle" width={24} height={24} offsetX={12} offsetY={12} />
        </Group>
      );
    }

    if (m.type === 'linear') {
      const flatPts = displayPts(m.points);
      const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
      const label = `${m.value.toFixed(1)} ${m.unit}`;
      return (
        <Group key={m.id}>
          <Line points={flatPts} stroke={m.color} strokeWidth={isSelected ? 3 : 2}
            dash={isSelected ? [8, 4] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
            hitStrokeWidth={12} />
          <Group x={mid.x} y={mid.y - 14}>
            <Rect x={-2} y={-9} width={label.length * 5 + 8} height={14} fill={m.color} cornerRadius={4} />
            <Text text={label} fontSize={9} fill="#fff" fontStyle="bold" x={2} y={-8} />
          </Group>
        </Group>
      );
    }

    if (m.type === 'area') {
      const flatPts = displayPts(m.points);
      const centroid = polygonCentroid(pts);
      const label = `${m.value.toFixed(1)} ${m.unit}`;
      return (
        <Group key={m.id}>
          <Line points={flatPts} closed fill={`rgba(${r},${g},${b},0.15)`}
            stroke={m.color} strokeWidth={isSelected ? 3 : 2}
            dash={isSelected ? [8, 4] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)} />
          <Group x={centroid.x} y={centroid.y - 8}>
            <Rect x={-2} y={-9} width={label.length * 5 + 8} height={14} fill={m.color} cornerRadius={4} />
            <Text text={label} fontSize={9} fill="#fff" fontStyle="bold" x={2} y={-8} />
          </Group>
        </Group>
      );
    }
    return null;
  }

  function renderInProgress() {
    if (inProgress.length === 0) return null;
    const pts = inProgress.map((p) => toDisplay(p, zoom));
    const allPts = mousePos ? [...pts, mousePos] : pts;
    const flat = allPts.flatMap((p) => [p.x, p.y]);
    // Live distance label for last segment
    const lastPt = pts[pts.length - 1];
    const label = lastPt && mousePos ? liveDist(lastPt, mousePos, scale) : '';
    const mid = lastPt && mousePos ? { x: (lastPt.x + mousePos.x) / 2, y: (lastPt.y + mousePos.y) / 2 } : null;

    return (
      <>
        {activeTool === 'linear' && (
          <Line points={flat} stroke="#2563EB" strokeWidth={2} dash={[6, 3]} opacity={0.8} />
        )}
        {activeTool === 'area' && (
          <Line points={flat} stroke="#2563EB" strokeWidth={2} fill="rgba(37,99,235,0.08)" dash={[6, 3]} />
        )}
        {/* Live segment length */}
        {mid && label && (
          <Group x={mid.x} y={mid.y - 14}>
            <Rect x={-2} y={-9} width={label.length * 5.5 + 8} height={14} fill="#2563EB" cornerRadius={4} opacity={0.9} />
            <Text text={label} fontSize={9} fill="#fff" fontStyle="bold" x={2} y={-8} />
          </Group>
        )}
      </>
    );
  }

  function renderCalibration() {
    if (!isCalibrating || calibrationPoints.length === 0) return null;
    const pts = calibrationPoints.map((p) => toDisplay(p, zoom));
    const allPts = mousePos && pts.length === 1 ? [...pts, mousePos] : pts;
    return (
      <>
        {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={5} fill="#EF4444" />)}
        {allPts.length >= 2 && (
          <Line points={allPts.flatMap((p) => [p.x, p.y])} stroke="#EF4444" strokeWidth={2} dash={[6, 3]} />
        )}
        {/* Live calibration distance */}
        {mousePos && pts.length === 1 && (() => {
          const label = liveDist(pts[0], mousePos, scale);
          const mid = { x: (pts[0].x + mousePos.x) / 2, y: (pts[0].y + mousePos.y) / 2 };
          return (
            <Group x={mid.x} y={mid.y - 14}>
              <Rect x={-2} y={-9} width={label.length * 5.5 + 8} height={14} fill="#EF4444" cornerRadius={4} opacity={0.9} />
              <Text text={label} fontSize={9} fill="#fff" fontStyle="bold" x={2} y={-8} />
            </Group>
          );
        })()}
      </>
    );
  }

  function renderDimension() {
    if (!isDimensioning) return null;
    const pts = dimensionPoints.map((p) => toDisplay(p, zoom));
    const endPt = pts.length >= 2 ? pts[1] : mousePos;
    if (!endPt || pts.length === 0) {
      // No anchor yet — show crosshair hint at cursor
      return null;
    }
    const anchor = pts[0];
    const label = liveDist(anchor, endPt, scale);
    const mid = { x: (anchor.x + endPt.x) / 2, y: (anchor.y + endPt.y) / 2 };
    const locked = pts.length >= 2;
    return (
      <>
        <Circle x={anchor.x} y={anchor.y} radius={5} fill="#16A34A" />
        {locked && <Circle x={endPt.x} y={endPt.y} radius={5} fill="#16A34A" />}
        <Line
          points={[anchor.x, anchor.y, endPt.x, endPt.y]}
          stroke="#16A34A" strokeWidth={2} dash={[8, 4]}
        />
        <Group x={mid.x} y={mid.y - 18}>
          <Rect x={-4} y={-11} width={label.length * 7 + 14} height={18} fill="#16A34A" cornerRadius={5} />
          <Text text={label} fontSize={11} fill="#fff" fontStyle="bold" x={3} y={-9} />
        </Group>
      </>
    );
  }

  function renderTooltip() {
    if (!hoveredId || !mousePos) return null;
    const m = measurements.find((x) => x.id === hoveredId);
    if (!m) return null;
    return (
      <Group x={mousePos.x + 12} y={mousePos.y - 32}>
        <Rect fill="rgba(0,0,0,0.78)" cornerRadius={4} width={140} height={34} />
        <Text text={m.name} fill="#fff" fontSize={10} fontStyle="bold" x={7} y={6} />
        <Text text={`${m.value.toFixed(2)} ${m.unit}`} fill="#d4d4d4" fontSize={9} x={7} y={19} />
      </Group>
    );
  }

  return (
    <>
      <Stage
        width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0, cursor }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
      >
        <Layer>
          {measurements.map(renderMeasurement)}
          {renderInProgress()}
          {renderCalibration()}
          {renderDimension()}
          {renderTooltip()}
        </Layer>
      </Stage>

      {/* Pending finish action bar */}
      {pendingFinish && (
        <div
          className="absolute z-20 flex gap-1 items-center bg-white border border-zinc-300 rounded-lg shadow-lg px-2 py-1.5"
          style={{
            left: Math.min(pendingFinish.x + 12, width - 180),
            top: Math.max(pendingFinish.y - 40, 4),
          }}
        >
          <span className="text-xs text-zinc-500 mr-1">Next:</span>
          <button
            className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
            onClick={handleContinue}
          >
            Continue
          </button>
          <button
            className="px-2.5 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu.visible && (
        <div
          className="absolute z-30 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu({ x: 0, y: 0, visible: false })}
        >
          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-700"
            onClick={() => { setActiveTool('linear'); setContextMenu({ x: 0, y: 0, visible: false }); }}>
            Start New Linear
          </button>
          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-700"
            onClick={() => { setActiveTool('area'); setContextMenu({ x: 0, y: 0, visible: false }); }}>
            Start New Area
          </button>
          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-700"
            onClick={() => { setActiveTool('count'); setContextMenu({ x: 0, y: 0, visible: false }); }}>
            Start New Count
          </button>
          {lastMeasurement && lastMeasurement.type !== 'count' && (
            <>
              <div className="h-px bg-zinc-100 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-blue-600 font-medium"
                onClick={() => {
                  const m = lastMeasurement;
                  setActiveTool(m.type as 'linear' | 'area');
                  if (m.type === 'linear' && m.points.length > 0) {
                    setInProgress([m.points[m.points.length - 1]]);
                  }
                  setContextMenu({ x: 0, y: 0, visible: false });
                }}
              >
                Continue "{lastMeasurement.name}"
              </button>
            </>
          )}
          <div className="h-px bg-zinc-100 my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-500"
            onClick={() => setContextMenu({ x: 0, y: 0, visible: false })}
          >
            Cancel
          </button>
        </div>
      )}

      {showScaleModal && ScaleModalComp && (
        <ScaleModalComp
          pixelDist={scalePixelDist}
          pageIndex={pageIndex}
          onClose={() => setShowScaleModal(false)}
        />
      )}
    </>
  );
}
