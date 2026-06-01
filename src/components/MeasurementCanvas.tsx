import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useTakeoffStore } from '../store/takeoffStore';
import type { Measurement, Point, TradeCategory, PriceMode } from '../types';
import {
  pixelDistance,
  polylineLength,
  polygonArea,
  pixelsToFeet,
  pixelsToSqFt,
  polygonCentroid,
  getNextColor,
} from '../utils/measurementUtils';

interface Props { width: number; height: number; pageIndex: number; }
interface ContextMenu { x: number; y: number; visible: boolean; }
interface PendingFinish { type: 'linear' | 'area'; lastPoint: Point; x: number; y: number; }

function toDisplay(p: Point, zoom: number): Point { return { x: p.x * zoom, y: p.y * zoom }; }
function toStore(p: Point, zoom: number): Point { return { x: p.x / zoom, y: p.y / zoom }; }
function countByType(ms: Measurement[], t: string) { return ms.filter((m) => m.type === t).length; }

function computeValue(pts: Point[], type: string, scale: { pixelsPerFoot: number } | null) {
  if (type === 'linear') {
    const px = polylineLength(pts);
    return scale ? { value: pixelsToFeet(px, scale.pixelsPerFoot), unit: 'ft' } : { value: px, unit: 'px' };
  }
  if (type === 'area') {
    const sqPx = polygonArea(pts);
    return scale ? { value: pixelsToSqFt(sqPx, scale.pixelsPerFoot), unit: 'sq ft' } : { value: sqPx, unit: 'sq px' };
  }
  return { value: 1, unit: 'ea' };
}

function liveDist(p1: Point, p2: Point, scale: { pixelsPerFoot: number } | null): string {
  const px = pixelDistance(p1, p2);
  return scale ? `${pixelsToFeet(px, scale.pixelsPerFoot).toFixed(2)} ft` : `${px.toFixed(0)} px`;
}

export default function MeasurementCanvas({ width, height, pageIndex }: Props) {
  const store = useTakeoffStore();
  // Use a ref to always have fresh store values inside event handlers — fixes stale closure
  const storeRef = useRef(store);
  storeRef.current = store;

  const {
    project, zoom, activeTool, selectedMeasurementId,
    isCalibrating, isDimensioning, calibrationPoints, dimensionPoints,
    hiddenTrades, activeSession,
  } = store;

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
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [sessionToolType, setSessionToolType] = useState<'linear' | 'area' | 'count'>('count');
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for in-progress and assemblyPreFill so handlers always see latest value
  const inProgressRef = useRef<Point[]>([]);
  const mousePosRef = useRef<Point | null>(null);
  inProgressRef.current = inProgress;
  mousePosRef.current = mousePos;

  const [ScaleModalComp, setScaleModalComp] = useState<React.ComponentType<{
    pixelDist: number; pageIndex: number; onClose: () => void;
  }> | null>(null);
  const [SessionSetupComp, setSessionSetupComp] = useState<React.ComponentType<{
    toolType: 'linear' | 'area' | 'count'; existingCount: number; onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    import('./ScaleModal').then((m) => setScaleModalComp(() => m.default));
    import('./MeasurementSessionSetup').then((m) => setSessionSetupComp(() => m.default));
  }, []);

  // Reset in-progress when tool changes (but not if a session is active)
  useEffect(() => {
    if (!storeRef.current.activeSession) {
      setInProgress([]);
      setMousePos(null);
      setPendingFinish(null);
    }
  }, [activeTool]);

  // Keyboard handler — uses storeRef so always fresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') return;
      const s = storeRef.current;
      if (e.key === 'Escape') {
        if (s.isCalibrating) s.resetCalibration();
        if (s.isDimensioning) s.clearDimension();
        if (s.activeSession) s.stopSession();
        setInProgress([]);
        setMousePos(null);
        setPendingFinish(null);
        setContextMenu({ x: 0, y: 0, visible: false });
        setShowSessionSetup(false);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
        if (s.selectedMeasurementId) s.deleteMeasurement(s.selectedMeasurementId);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const map: Record<string, typeof s.activeTool> = { s: 'select', l: 'linear', a: 'area', c: 'count', d: 'dimension' };
        const t = map[e.key.toLowerCase()];
        if (t) s.setActiveTool(t);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // no deps — always uses storeRef.current

  // Auto-dismiss pending finish bar after 5s
  useEffect(() => {
    if (pendingFinish) {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        setPendingFinish(null);
        // Only reset tool if no active session
        if (!storeRef.current.activeSession) storeRef.current.setActiveTool('select');
      }, 5000);
    }
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, [pendingFinish]);

  function getPos(stage: Konva.Stage): Point {
    return stage.getPointerPosition() ?? { x: 0, y: 0 };
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    setMousePos(getPos(e.target.getStage()!));
  }

  // Main click — uses storeRef to avoid stale closures
  function handleClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    setContextMenu({ x: 0, y: 0, visible: false });

    const s = storeRef.current;
    const pos = getPos(e.target.getStage()!);
    const stored = toStore(pos, s.zoom);
    const currentScale = s.project?.pages[pageIndex]?.scale ?? null;

    // Calibrate
    if (s.isCalibrating) {
      const newPts = [...s.calibrationPoints, stored];
      s.setCalibrationPoints(newPts);
      if (newPts.length === 2) {
        const p1d = toDisplay(newPts[0], s.zoom);
        const p2d = toDisplay(newPts[1], s.zoom);
        setScalePixelDist(pixelDistance(p1d, p2d));
        setShowScaleModal(true);
      }
      return;
    }

    // Dimension
    if (s.isDimensioning) {
      const newPts = [...s.dimensionPoints, stored];
      s.setDimensionPoints(newPts);
      if (newPts.length >= 2) {
        const p1d = toDisplay(newPts[0], s.zoom);
        const p2d = toDisplay(newPts[1], s.zoom);
        const dist = pixelDistance(p1d, p2d);
        s.setDimensionResult(currentScale ? pixelsToFeet(dist, currentScale.pixelsPerFoot) : dist);
        setTimeout(() => s.setDimensionPoints([]), 2000);
      }
      return;
    }

    if (s.activeTool === 'select') { s.selectMeasurement(null); return; }

    // COUNT
    if (s.activeTool === 'count') {
      if (!s.activeSession) {
        setSessionToolType('count');
        setShowSessionSetup(true);
        return;
      }
      s.addCountPoint(stored, pageIndex);
      return;
    }

    // LINEAR
    if (s.activeTool === 'linear') {
      const cur = inProgressRef.current;
      if (cur.length === 0 && !s.activeSession) {
        // Offer session setup on first point
        setSessionToolType('linear');
        setShowSessionSetup(true);
      }
      setInProgress((prev) => [...prev, stored]);
      return;
    }

    // AREA
    if (s.activeTool === 'area') {
      const cur = inProgressRef.current;
      if (cur.length >= 3) {
        const firstDisp = toDisplay(cur[0], s.zoom);
        if (pixelDistance(pos, firstDisp) < 10) {
          finishArea(cur, pos);
          return;
        }
      }
      if (cur.length === 0 && !s.activeSession) {
        setSessionToolType('area');
        setShowSessionSetup(true);
      }
      setInProgress((prev) => [...prev, stored]);
    }
  }

  function handleDblClick(_e: Konva.KonvaEventObject<MouseEvent>) {
    const s = storeRef.current;
    const cur = inProgressRef.current;
    const mp = mousePosRef.current;
    if (s.activeTool === 'linear' && cur.length >= 2) {
      const pts = cur.length > 1 ? cur.slice(0, -1) : cur;
      finishLinear(pts.length >= 2 ? pts : cur, mp ?? toDisplay(cur[cur.length - 1], s.zoom));
      return;
    }
    if (s.activeTool === 'area' && cur.length >= 3) {
      finishArea(cur, mp ?? toDisplay(cur[cur.length - 1], s.zoom));
    }
  }

  function handleContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault();
    const pos = getPos(e.target.getStage()!);
    if (e.target === e.target.getStage() || e.target.getParent() === e.target.getLayer()) {
      setContextMenu({ x: pos.x, y: pos.y, visible: true });
    }
  }

  function finishLinear(points: Point[], lastScreenPos: Point) {
    if (points.length < 2) { setInProgress([]); return; }
    const s = storeRef.current;
    const currentMs = s.project?.pages[pageIndex]?.measurements ?? [];
    const sess = s.activeSession;
    const { value, unit } = computeValue(points, 'linear', s.project?.pages[pageIndex]?.scale ?? null);
    const drawN = (sess?.drawCount ?? 0) + 1;
    s.addMeasurement({
      id: uuidv4(), type: 'linear',
      name: sess ? `${sess.name} ${drawN}` : `Linear ${countByType(currentMs, 'linear') + 1}`,
      trade: (sess?.trade ?? 'General') as TradeCategory,
      color: sess?.color ?? getNextColor(currentMs.length),
      points, value, unit,
      unitCost: sess?.unitCost ?? 0,
      priceMode: sess?.priceMode as PriceMode | undefined,
      formula: sess?.formula,
      visible: true, pageIndex,
    });
    if (sess) s.bumpSessionCount();
    setInProgress([]);
    setPendingFinish({ type: 'linear', lastPoint: toStore(lastScreenPos, s.zoom), x: lastScreenPos.x, y: lastScreenPos.y });
  }

  function finishArea(points: Point[], lastScreenPos: Point) {
    if (points.length < 3) { setInProgress([]); return; }
    const s = storeRef.current;
    const currentMs = s.project?.pages[pageIndex]?.measurements ?? [];
    const sess = s.activeSession;
    const { value, unit } = computeValue(points, 'area', s.project?.pages[pageIndex]?.scale ?? null);
    const drawN = (sess?.drawCount ?? 0) + 1;
    s.addMeasurement({
      id: uuidv4(), type: 'area',
      name: sess ? `${sess.name} ${drawN}` : `Area ${countByType(currentMs, 'area') + 1}`,
      trade: (sess?.trade ?? 'General') as TradeCategory,
      color: sess?.color ?? getNextColor(currentMs.length),
      points, value, unit,
      unitCost: sess?.unitCost ?? 0,
      priceMode: sess?.priceMode as PriceMode | undefined,
      formula: sess?.formula,
      visible: true, pageIndex,
    });
    if (sess) s.bumpSessionCount();
    setInProgress([]);
    setPendingFinish({ type: 'area', lastPoint: toStore(lastScreenPos, s.zoom), x: lastScreenPos.x, y: lastScreenPos.y });
  }

  function handleContinue() {
    if (!pendingFinish) return;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingFinish(null);
    storeRef.current.setActiveTool(pendingFinish.type);
    if (pendingFinish.type === 'linear') {
      setInProgress([pendingFinish.lastPoint]);
    }
  }

  function handleDone() {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingFinish(null);
    const s = storeRef.current;
    if (!s.activeSession) s.setActiveTool('select');
  }

  function handleMeasurementClick(id: string, e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    if (storeRef.current.activeTool === 'select') storeRef.current.selectMeasurement(id);
  }

  function handleCountRightClick(id: string, e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault();
    storeRef.current.deleteMeasurement(id);
  }

  const lastMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const cursor = (isCalibrating || isDimensioning || activeTool === 'linear' || activeTool === 'area' || activeTool === 'count')
    ? 'crosshair' : 'default';

  function displayPts(pts: Point[]) { return pts.flatMap((p) => [p.x * zoom, p.y * zoom]); }

  function renderMeasurement(m: Measurement) {
    if (!m.visible || hiddenTrades.includes(m.trade)) return null;
    const isSelected = m.id === selectedMeasurementId;
    const pts = m.points.map((p) => toDisplay(p, zoom));
    const r = parseInt(m.color.slice(1, 3), 16);
    const g = parseInt(m.color.slice(3, 5), 16);
    const b = parseInt(m.color.slice(5, 7), 16);

    if (m.type === 'count') {
      const total = pts.length;
      return pts.map((pt, i) => {
        const isLast = i === total - 1;
        const totalLabel = `×${total}`;
        const labelW = totalLabel.length * 6 + 10;
        return (
          <Group key={`${m.id}-${i}`} x={pt.x} y={pt.y}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onContextMenu={(e) => handleCountRightClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Circle radius={12} fill={m.color}
              stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={2}
              shadowBlur={m.id === hoveredId ? 6 : 0} />
            <Text text={String(i + 1)} fontSize={10} fill="#fff" fontStyle="bold"
              align="center" verticalAlign="middle" width={24} height={24} offsetX={12} offsetY={12} />
            {/* Running total badge on the most recently placed dot */}
            {isLast && total > 1 && (
              <Group x={14} y={-18}>
                <Rect x={-2} y={-9} width={labelW} height={15} fill={m.color} cornerRadius={8} opacity={0.9} />
                <Text text={totalLabel} fontSize={9} fill="#fff" fontStyle="bold" x={3} y={-8} />
              </Group>
            )}
          </Group>
        );
      });
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
    const lastPt = pts[pts.length - 1];
    const label = lastPt && mousePos ? liveDist(lastPt, mousePos, scale) : '';
    const mid = lastPt && mousePos ? { x: (lastPt.x + mousePos.x) / 2, y: (lastPt.y + mousePos.y) / 2 } : null;
    return (
      <>
        {activeTool === 'linear' && <Line points={flat} stroke="#2563EB" strokeWidth={2} dash={[6, 3]} opacity={0.8} />}
        {activeTool === 'area' && <Line points={flat} stroke="#2563EB" strokeWidth={2} fill="rgba(37,99,235,0.08)" dash={[6, 3]} />}
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
        {allPts.length >= 2 && <Line points={allPts.flatMap((p) => [p.x, p.y])} stroke="#EF4444" strokeWidth={2} dash={[6, 3]} />}
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
    if (!endPt || pts.length === 0) return null;
    const anchor = pts[0];
    const label = liveDist(anchor, endPt, scale);
    const mid = { x: (anchor.x + endPt.x) / 2, y: (anchor.y + endPt.y) / 2 };
    return (
      <>
        <Circle x={anchor.x} y={anchor.y} radius={5} fill="#16A34A" />
        {pts.length >= 2 && <Circle x={endPt.x} y={endPt.y} radius={5} fill="#16A34A" />}
        <Line points={[anchor.x, anchor.y, endPt.x, endPt.y]} stroke="#16A34A" strokeWidth={2} dash={[8, 4]} />
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
        <Rect fill="rgba(0,0,0,0.78)" cornerRadius={4} width={150} height={34} />
        <Text text={m.name} fill="#fff" fontSize={10} fontStyle="bold" x={7} y={6} />
        <Text text={m.type === 'count' ? `${m.value} ea` : `${m.value.toFixed(2)} ${m.unit}`} fill="#d4d4d4" fontSize={9} x={7} y={19} />
      </Group>
    );
  }

  const sessionColor = activeSession?.color ?? '#2563EB';
  const sessionName = activeSession?.name ?? '';
  const countM = activeSession?.type === 'count'
    ? measurements.find((x) => x.id === activeSession.countMeasurementId)
    : null;

  return (
    <>
      <Stage width={width} height={height}
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

      {/* Continue / Done bar after finishing a linear or area */}
      {pendingFinish && (
        <div
          className="absolute z-20 flex gap-1 items-center bg-white border border-zinc-300 rounded-lg shadow-lg px-2 py-1.5"
          style={{ left: Math.min(pendingFinish.x + 12, width - 200), top: Math.max(pendingFinish.y - 40, 4) }}
        >
          <span className="text-xs text-zinc-500 mr-1">
            {activeSession ? `${activeSession.name}:` : 'Next:'}
          </span>
          <button className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 font-medium" onClick={handleContinue}>
            Continue
          </button>
          <button className="px-2.5 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 text-zinc-700" onClick={handleDone}>
            Done
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu.visible && (
        <div className="absolute z-30 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 min-w-[190px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu({ x: 0, y: 0, visible: false })}
        >
          {(['linear', 'area', 'count'] as const).map((t) => (
            <button key={t} className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-700 capitalize"
              onClick={() => { storeRef.current.setActiveTool(t); setContextMenu({ x: 0, y: 0, visible: false }); }}>
              New {t}
            </button>
          ))}
          {lastMeasurement && (
            <>
              <div className="h-px bg-zinc-100 my-1" />
              <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-blue-600 font-medium"
                onClick={() => {
                  const m = lastMeasurement;
                  storeRef.current.setActiveTool(m.type as 'linear' | 'area' | 'count');
                  if (m.type === 'linear' && m.points.length > 0)
                    setInProgress([m.points[m.points.length - 1]]);
                  setContextMenu({ x: 0, y: 0, visible: false });
                }}>
                Continue "{lastMeasurement.name}"
              </button>
            </>
          )}
          <div className="h-px bg-zinc-100 my-1" />
          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 text-zinc-400"
            onClick={() => setContextMenu({ x: 0, y: 0, visible: false })}>
            Cancel
          </button>
        </div>
      )}

      {/* Scale modal */}
      {showScaleModal && ScaleModalComp && (
        <ScaleModalComp pixelDist={scalePixelDist} pageIndex={pageIndex} onClose={() => setShowScaleModal(false)} />
      )}

      {/* Session setup (count / linear / area) */}
      {showSessionSetup && SessionSetupComp && (
        <SessionSetupComp
          toolType={sessionToolType}
          existingCount={countByType(measurements, sessionToolType)}
          onClose={() => setShowSessionSetup(false)}
        />
      )}

      {/* Active session status bar */}
      {activeSession && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 text-white rounded-full px-4 py-2 shadow-lg text-sm font-medium"
          style={{ background: sessionColor }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <span>
            {activeSession.type === 'count' ? 'Counting' : activeSession.type === 'linear' ? 'Linear' : 'Area'}:{' '}
            <strong>{sessionName}</strong>
            {activeSession.type === 'count' && (
              <> — {countM ? `${countM.value} so far` : 'click to start'}</>
            )}
            {(activeSession.type === 'linear' || activeSession.type === 'area') && activeSession.drawCount > 0 && (
              <> — {activeSession.drawCount} drawn</>
            )}
          </span>
          <button
            className="ml-1 bg-white/20 hover:bg-white/40 rounded-full px-3 py-0.5 text-xs font-semibold transition-colors"
            onClick={() => storeRef.current.stopSession()}
          >
            Stop
          </button>
        </div>
      )}
    </>
  );
}
