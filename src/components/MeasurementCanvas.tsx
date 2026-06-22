import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useTakeoffStore } from '../store/takeoffStore';
import type { Annotation, Measurement, Point, TradeCategory, PriceMode } from '../types';
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
  stageScale: number;
  stagePos: { x: number; y: number };
  onTransformChange: (scale: number, pos: { x: number; y: number }) => void;
  spaceDown: boolean;
}

interface ContextMenu { x: number; y: number; visible: boolean; }
interface PendingFinish { type: 'linear' | 'area'; lastPoint: Point; screenX: number; screenY: number; }
interface PendingNote { contentX: number; contentY: number; screenX: number; screenY: number; }

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

function countByType(ms: Measurement[], t: string) { return ms.filter((m) => m.type === t).length; }
function countAnnotByType(anns: Annotation[], t: string) { return anns.filter((a) => a.type === t).length; }

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

function flat(pts: Point[]): number[] { return pts.flatMap((p) => [p.x, p.y]); }

export default function MeasurementCanvas({ width, height, pageIndex, stageScale, stagePos, onTransformChange, spaceDown }: Props) {
  const store = useTakeoffStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  const {
    project, activeTool, selectedMeasurementId,
    isCalibrating, isDimensioning, calibrationPoints, dimensionPoints,
    hiddenTrades, activeSession, highlightColor,
  } = store;

  const page = project?.pages[pageIndex];
  const measurements = page?.measurements ?? [];
  const annotations = page?.annotations ?? [];
  const scale = page?.scale ?? null;

  const [inProgress, setInProgress] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null); // content coords
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scalePixelDist, setScalePixelDist] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, visible: false });
  const [pendingFinish, setPendingFinish] = useState<PendingFinish | null>(null);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [sessionToolType, setSessionToolType] = useState<'linear' | 'area' | 'count'>('count');
  const [pendingNote, setPendingNote] = useState<PendingNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [highlightPath, setHighlightPath] = useState<Point[]>([]);
  const [selectedAnnotId, setSelectedAnnotId] = useState<string | null>(null);
  const [editingAnnotId, setEditingAnnotId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  const inProgressRef = useRef<Point[]>([]);
  const mousePosRef = useRef<Point | null>(null);
  const isHighlightDragging = useRef(false);
  const highlightPathRef = useRef<Point[]>([]);
  const panRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 });
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

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

  // Reset in-progress when tool changes
  useEffect(() => {
    if (!storeRef.current.activeSession) {
      setInProgress([]);
      setMousePos(null);
      setPendingFinish(null);
    }
    setHighlightPath([]);
    isHighlightDragging.current = false;
  }, [activeTool]);

  // Focus note input when it appears
  useEffect(() => {
    if (pendingNote) setTimeout(() => noteInputRef.current?.focus(), 30);
  }, [pendingNote]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        setPendingNote(null);
        setHighlightPath([]);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
        if (selectedAnnotId) { s.deleteAnnotation(selectedAnnotId); setSelectedAnnotId(null); return; }
        if (s.selectedMeasurementId) s.deleteMeasurement(s.selectedMeasurementId);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code !== 'Space') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const map: Record<string, typeof s.activeTool> = {
          s: 'select', l: 'linear', a: 'area', c: 'count', d: 'dimension', n: 'note', h: 'highlight',
        };
        const t = map[e.key.toLowerCase()];
        if (t) s.setActiveTool(t);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedAnnotId]);

  // Auto-dismiss pending finish bar
  useEffect(() => {
    if (pendingFinish) {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        setPendingFinish(null);
        if (!storeRef.current.activeSession) storeRef.current.setActiveTool('select');
      }, 5000);
    }
    return () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); };
  }, [pendingFinish]);

  // Convert screen position on stage canvas to content coordinates
  function toContent(screenPt: { x: number; y: number }): Point {
    return {
      x: (screenPt.x - stagePos.x) / stageScale,
      y: (screenPt.y - stagePos.y) / stageScale,
    };
  }

  // Convert content coord to screen coord (for positioning HTML overlays)
  function toScreen(pt: Point): { x: number; y: number } {
    return { x: pt.x * stageScale + stagePos.x, y: pt.y * stageScale + stagePos.y };
  }

  function getStagePos(stage: Konva.Stage): { x: number; y: number } {
    return stage.getPointerPosition() ?? { x: 0, y: 0 };
  }

  // ── Wheel: zoom toward cursor (mouse) or pan (trackpad two-finger) ──────────
  function handleWheelCorrected(e: React.WheelEvent) {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const isMouseWheel = e.deltaMode === 1 || Math.abs(e.deltaY) >= 100;

    if (e.ctrlKey || e.metaKey || isMouseWheel) {
      // Zoom toward cursor
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = isMouseWheel ? 1.12 : 1.06;
      const oldScale = stageScale;
      const newScale = Math.min(Math.max(oldScale * (direction > 0 ? factor : 1 / factor), MIN_SCALE), MAX_SCALE);
      const mousePointTo = {
        x: (pointerPos.x - stagePos.x) / oldScale,
        y: (pointerPos.y - stagePos.y) / oldScale,
      };
      onTransformChange(newScale, {
        x: pointerPos.x - mousePointTo.x * newScale,
        y: pointerPos.y - mousePointTo.y * newScale,
      });
    } else {
      // Trackpad pan
      onTransformChange(stageScale, { x: stagePos.x - e.deltaX, y: stagePos.y - e.deltaY });
    }
  }

  // ── Middle mouse pan ────────────────────────────────────────────────────────
  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      panRef.current = { active: true, lastX: e.evt.clientX, lastY: e.evt.clientY };
      return;
    }
    if (e.evt.button === 0 && spaceDown) {
      panRef.current = { active: true, lastX: e.evt.clientX, lastY: e.evt.clientY };
      return;
    }
    // Highlight tool: start freehand drag
    if (storeRef.current.activeTool === 'highlight' && e.evt.button === 0) {
      const stage = e.target.getStage();
      if (!stage) return;
      const raw = getStagePos(stage);
      const pt = toContent(raw);
      isHighlightDragging.current = true;
      highlightPathRef.current = [pt];
      setHighlightPath([pt]);
    }
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    if (!stage) return;
    const raw = getStagePos(stage);
    const contentPt = toContent(raw);

    // Pan
    if (panRef.current.active) {
      const dx = e.evt.clientX - panRef.current.lastX;
      const dy = e.evt.clientY - panRef.current.lastY;
      panRef.current.lastX = e.evt.clientX;
      panRef.current.lastY = e.evt.clientY;
      onTransformChange(stageScale, { x: stagePos.x + dx, y: stagePos.y + dy });
      return;
    }

    setMousePos(contentPt);

    // Highlight dragging
    if (isHighlightDragging.current && storeRef.current.activeTool === 'highlight') {
      highlightPathRef.current = [...highlightPathRef.current, contentPt];
      // Throttle state update
      if (highlightPathRef.current.length % 3 === 0) {
        setHighlightPath([...highlightPathRef.current]);
      }
    }
  }

  function handleStageMouseUp(_e: Konva.KonvaEventObject<MouseEvent>) {
    panRef.current.active = false;

    if (isHighlightDragging.current && storeRef.current.activeTool === 'highlight') {
      isHighlightDragging.current = false;
      const pts = highlightPathRef.current;
      if (pts.length >= 2) {
        const s = storeRef.current;
        const count = countAnnotByType(page?.annotations ?? [], 'highlight') + 1;
        s.addAnnotation({
          id: uuidv4(),
          type: 'highlight',
          pageIndex,
          position: pts[0],
          points: pts,
          color: s.highlightColor,
          visible: true,
          text: `Highlight ${count}`,
        });
      }
      setHighlightPath([]);
      highlightPathRef.current = [];
    }
  }

  function handleStageMouseLeave() {
    panRef.current.active = false;
    setMousePos(null);
  }

  // ── Main click ───────────────────────────────────────────────────────────────
  function handleClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    if (panRef.current.active) return;
    if (spaceDown) return;
    setContextMenu({ x: 0, y: 0, visible: false });

    const s = storeRef.current;
    const stage = e.target.getStage();
    if (!stage) return;
    const raw = getStagePos(stage);
    const contentPt = toContent(raw);
    const currentScale = s.project?.pages[pageIndex]?.scale ?? null;

    // Note tool
    if (s.activeTool === 'note') {
      const screen = toScreen(contentPt);
      setPendingNote({ contentX: contentPt.x, contentY: contentPt.y, screenX: screen.x, screenY: screen.y });
      setNoteText('');
      return;
    }

    // Calibrate
    if (s.isCalibrating) {
      const newPts = [...s.calibrationPoints, contentPt];
      s.setCalibrationPoints(newPts);
      if (newPts.length === 2) {
        setScalePixelDist(pixelDistance(newPts[0], newPts[1]));
        setShowScaleModal(true);
      }
      return;
    }

    // Dimension
    if (s.isDimensioning) {
      const newPts = [...s.dimensionPoints, contentPt];
      s.setDimensionPoints(newPts);
      if (newPts.length >= 2) {
        const dist = pixelDistance(newPts[0], newPts[1]);
        s.setDimensionResult(currentScale ? pixelsToFeet(dist, currentScale.pixelsPerFoot) : dist);
        setTimeout(() => s.setDimensionPoints([]), 2000);
      }
      return;
    }

    if (s.activeTool === 'select') { s.selectMeasurement(null); setSelectedAnnotId(null); return; }

    if (s.activeTool === 'count') {
      if (!s.activeSession) { setSessionToolType('count'); setShowSessionSetup(true); return; }
      s.addCountPoint(contentPt, pageIndex);
      return;
    }

    if (s.activeTool === 'linear') {
      const cur = inProgressRef.current;
      if (cur.length === 0 && !s.activeSession) { setSessionToolType('linear'); setShowSessionSetup(true); }
      setInProgress((prev) => [...prev, contentPt]);
      return;
    }

    if (s.activeTool === 'area') {
      const cur = inProgressRef.current;
      if (cur.length >= 3) {
        const first = cur[0];
        if (pixelDistance(contentPt, first) * stageScale < 10) {
          finishArea(cur, contentPt, raw);
          return;
        }
      }
      if (cur.length === 0 && !s.activeSession) { setSessionToolType('area'); setShowSessionSetup(true); }
      setInProgress((prev) => [...prev, contentPt]);
    }
  }

  function handleDblClick(_e: Konva.KonvaEventObject<MouseEvent>) {
    const s = storeRef.current;
    const cur = inProgressRef.current;
    const mp = mousePosRef.current;
    if (s.activeTool === 'linear' && cur.length >= 2) {
      const pts = cur.length > 1 ? cur.slice(0, -1) : cur;
      finishLinear(pts.length >= 2 ? pts : cur, mp ?? cur[cur.length - 1]);
      return;
    }
    if (s.activeTool === 'area' && cur.length >= 3) {
      finishArea(cur, mp ?? cur[cur.length - 1], mp ? toScreen(mp) : toScreen(cur[cur.length - 1]));
    }
  }

  function handleContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const raw = getStagePos(stage);
    if (e.target === stage || e.target.getParent() === e.target.getLayer()) {
      setContextMenu({ x: raw.x, y: raw.y, visible: true });
    }
  }

  function finishLinear(points: Point[], lastPt: Point) {
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
    const screen = toScreen(lastPt);
    setPendingFinish({ type: 'linear', lastPoint: lastPt, screenX: screen.x, screenY: screen.y });
  }

  function finishArea(points: Point[], lastPt: Point, _screenPos: { x: number; y: number }) {
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
    const screen = toScreen(lastPt);
    setPendingFinish({ type: 'area', lastPoint: lastPt, screenX: screen.x, screenY: screen.y });
  }

  function handleContinue() {
    if (!pendingFinish) return;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingFinish(null);
    storeRef.current.setActiveTool(pendingFinish.type);
    if (pendingFinish.type === 'linear') setInProgress([pendingFinish.lastPoint]);
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

  function commitNote() {
    if (!pendingNote) return;
    const text = noteText.trim();
    if (text) {
      const count = countAnnotByType(page?.annotations ?? [], 'note') + 1;
      storeRef.current.addAnnotation({
        id: uuidv4(),
        type: 'note',
        pageIndex,
        position: { x: pendingNote.contentX, y: pendingNote.contentY },
        text,
        color: '#27272a',
        visible: true,
      });
      void count;
    }
    setPendingNote(null);
    setNoteText('');
  }

  function commitEditNote() {
    if (!editingAnnotId) return;
    storeRef.current.updateAnnotation(editingAnnotId, { text: editNoteText.trim() || undefined });
    setEditingAnnotId(null);
  }

  // ── Cursor ──────────────────────────────────────────────────────────────────
  const isPanning = panRef.current.active;
  let cursor = 'default';
  if (isPanning || (spaceDown && panRef.current.active)) cursor = 'grabbing';
  else if (spaceDown) cursor = 'grab';
  else if (isCalibrating || isDimensioning || activeTool === 'linear' || activeTool === 'area' || activeTool === 'count' || activeTool === 'note') cursor = 'crosshair';
  else if (activeTool === 'highlight') cursor = 'crosshair';

  // ── Rendering helpers ────────────────────────────────────────────────────────
  // labelScale: renders text/UI at constant screen size regardless of zoom
  const ls = 1 / stageScale;

  function renderMeasurement(m: Measurement) {
    if (!m.visible || hiddenTrades.includes(m.trade)) return null;
    const isSelected = m.id === selectedMeasurementId;
    const r = parseInt(m.color.slice(1, 3), 16);
    const g = parseInt(m.color.slice(3, 5), 16);
    const b = parseInt(m.color.slice(5, 7), 16);

    if (m.type === 'count') {
      const total = m.points.length;
      const dotR = 12 * ls;
      return m.points.map((pt, i) => {
        const isLast = i === total - 1;
        const totalLabel = `×${total}`;
        const labelW = totalLabel.length * 6 * ls + 10 * ls;
        return (
          <Group key={`${m.id}-${i}`} x={pt.x} y={pt.y}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onContextMenu={(e) => handleCountRightClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Circle radius={dotR} fill={m.color}
              stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={2 * ls}
              shadowBlur={m.id === hoveredId ? 6 : 0} />
            <Text text={String(i + 1)} fontSize={10 * ls} fill="#fff" fontStyle="bold"
              align="center" verticalAlign="middle"
              width={dotR * 2} height={dotR * 2} offsetX={dotR} offsetY={dotR} />
            {isLast && total > 1 && (
              <Group x={14 * ls} y={-18 * ls}>
                <Rect x={-2 * ls} y={-9 * ls} width={labelW} height={15 * ls} fill={m.color} cornerRadius={8 * ls} opacity={0.9} />
                <Text text={totalLabel} fontSize={9 * ls} fill="#fff" fontStyle="bold" x={3 * ls} y={-8 * ls} />
              </Group>
            )}
          </Group>
        );
      });
    }

    if (m.type === 'linear') {
      const pts = m.points;
      const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
      const label = `${m.value.toFixed(1)} ${m.unit}`;
      const lw = label.length * 5 * ls + 8 * ls;
      return (
        <Group key={m.id}>
          <Line points={flat(pts)} stroke={m.color} strokeWidth={isSelected ? 3 * ls : 2 * ls}
            dash={isSelected ? [8 * ls, 4 * ls] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
            hitStrokeWidth={12 * ls} />
          {mid && (
            <Group x={mid.x} y={mid.y - 14 * ls}>
              <Rect x={-2 * ls} y={-9 * ls} width={lw} height={14 * ls} fill={m.color} cornerRadius={4 * ls} />
              <Text text={label} fontSize={9 * ls} fill="#fff" fontStyle="bold" x={2 * ls} y={-8 * ls} />
            </Group>
          )}
        </Group>
      );
    }

    if (m.type === 'area') {
      const pts = m.points;
      const centroid = polygonCentroid(pts);
      const label = `${m.value.toFixed(1)} ${m.unit}`;
      const lw = label.length * 5 * ls + 8 * ls;
      return (
        <Group key={m.id}>
          <Line points={flat(pts)} closed fill={`rgba(${r},${g},${b},0.15)`}
            stroke={m.color} strokeWidth={isSelected ? 3 * ls : 2 * ls}
            dash={isSelected ? [8 * ls, 4 * ls] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)} />
          <Group x={centroid.x} y={centroid.y - 8 * ls}>
            <Rect x={-2 * ls} y={-9 * ls} width={lw} height={14 * ls} fill={m.color} cornerRadius={4 * ls} />
            <Text text={label} fontSize={9 * ls} fill="#fff" fontStyle="bold" x={2 * ls} y={-8 * ls} />
          </Group>
        </Group>
      );
    }
    return null;
  }

  function renderAnnotation(ann: Annotation) {
    if (!ann.visible) return null;
    const isSelected = ann.id === selectedAnnotId;

    if (ann.type === 'highlight' && ann.points && ann.points.length >= 2) {
      const r = parseInt(ann.color.slice(1, 3), 16);
      const g = parseInt(ann.color.slice(3, 5), 16);
      const b = parseInt(ann.color.slice(5, 7), 16);
      return (
        <Line
          key={ann.id}
          points={flat(ann.points)}
          stroke={`rgba(${r},${g},${b},0.45)`}
          strokeWidth={20 * ls}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
          onClick={(e) => { e.cancelBubble = true; setSelectedAnnotId(ann.id); storeRef.current.selectMeasurement(null); }}
          dash={isSelected ? [8 * ls, 4 * ls] : undefined}
        />
      );
    }

    if (ann.type === 'note' && ann.text) {
      const text = ann.text;
      const fontSize = 12 * ls;
      const padX = 8 * ls;
      const padY = 5 * ls;
      const pillW = text.length * fontSize * 0.6 + padX * 2;
      const pillH = fontSize + padY * 2;
      const triSize = 6 * ls;
      return (
        <Group
          key={ann.id}
          x={ann.position.x}
          y={ann.position.y}
          onClick={(e) => { e.cancelBubble = true; setSelectedAnnotId(ann.id); storeRef.current.selectMeasurement(null); }}
          onDblClick={() => {
            setEditingAnnotId(ann.id);
            setEditNoteText(ann.text ?? '');
          }}
        >
          {/* Callout pointer triangle */}
          <Line
            points={[-triSize, -triSize, triSize, -triSize, 0, 0]}
            closed
            fill="white"
            stroke={isSelected ? '#3B82F6' : '#D4D4D8'}
            strokeWidth={ls}
            y={-pillH}
          />
          {/* Pill background */}
          <Rect
            x={-pillW / 2}
            y={-pillH - triSize}
            width={pillW}
            height={pillH}
            fill="white"
            stroke={isSelected ? '#3B82F6' : '#D4D4D8'}
            strokeWidth={isSelected ? 2 * ls : ls}
            cornerRadius={4 * ls}
            shadowBlur={4}
            shadowOpacity={0.15}
          />
          <Text
            text={text}
            fontSize={fontSize}
            fill="#3F3F46"
            x={-pillW / 2 + padX}
            y={-pillH - triSize + padY}
          />
        </Group>
      );
    }
    return null;
  }

  function renderInProgress() {
    if (inProgress.length === 0) return null;
    const allPts = mousePos ? [...inProgress, mousePos] : inProgress;
    const lastPt = inProgress[inProgress.length - 1];
    const label = lastPt && mousePos ? liveDist(lastPt, mousePos, scale) : '';
    const mid = lastPt && mousePos ? { x: (lastPt.x + mousePos.x) / 2, y: (lastPt.y + mousePos.y) / 2 } : null;
    const lw = label.length * 5.5 * ls + 8 * ls;
    return (
      <>
        {activeTool === 'linear' && <Line points={flat(allPts)} stroke="#2563EB" strokeWidth={2 * ls} dash={[6 * ls, 3 * ls]} opacity={0.8} />}
        {activeTool === 'area' && <Line points={flat(allPts)} stroke="#2563EB" strokeWidth={2 * ls} fill="rgba(37,99,235,0.08)" dash={[6 * ls, 3 * ls]} />}
        {mid && label && (
          <Group x={mid.x} y={mid.y - 14 * ls}>
            <Rect x={-2 * ls} y={-9 * ls} width={lw} height={14 * ls} fill="#2563EB" cornerRadius={4 * ls} opacity={0.9} />
            <Text text={label} fontSize={9 * ls} fill="#fff" fontStyle="bold" x={2 * ls} y={-8 * ls} />
          </Group>
        )}
      </>
    );
  }

  function renderCalibration() {
    if (!isCalibrating || calibrationPoints.length === 0) return null;
    const allPts = mousePos && calibrationPoints.length === 1 ? [...calibrationPoints, mousePos] : calibrationPoints;
    return (
      <>
        {calibrationPoints.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={5 * ls} fill="#EF4444" />)}
        {allPts.length >= 2 && <Line points={flat(allPts)} stroke="#EF4444" strokeWidth={2 * ls} dash={[6 * ls, 3 * ls]} />}
        {mousePos && calibrationPoints.length === 1 && (() => {
          const label = liveDist(calibrationPoints[0], mousePos, scale);
          const mid = { x: (calibrationPoints[0].x + mousePos.x) / 2, y: (calibrationPoints[0].y + mousePos.y) / 2 };
          const lw = label.length * 5.5 * ls + 8 * ls;
          return (
            <Group x={mid.x} y={mid.y - 14 * ls}>
              <Rect x={-2 * ls} y={-9 * ls} width={lw} height={14 * ls} fill="#EF4444" cornerRadius={4 * ls} opacity={0.9} />
              <Text text={label} fontSize={9 * ls} fill="#fff" fontStyle="bold" x={2 * ls} y={-8 * ls} />
            </Group>
          );
        })()}
      </>
    );
  }

  function renderDimension() {
    if (!isDimensioning) return null;
    const pts = dimensionPoints;
    const endPt = pts.length >= 2 ? pts[1] : mousePos;
    if (!endPt || pts.length === 0) return null;
    const anchor = pts[0];
    const label = liveDist(anchor, endPt, scale);
    const mid = { x: (anchor.x + endPt.x) / 2, y: (anchor.y + endPt.y) / 2 };
    const lw = label.length * 7 * ls + 14 * ls;
    return (
      <>
        <Circle x={anchor.x} y={anchor.y} radius={5 * ls} fill="#16A34A" />
        {pts.length >= 2 && <Circle x={endPt.x} y={endPt.y} radius={5 * ls} fill="#16A34A" />}
        <Line points={[anchor.x, anchor.y, endPt.x, endPt.y]} stroke="#16A34A" strokeWidth={2 * ls} dash={[8 * ls, 4 * ls]} />
        <Group x={mid.x} y={mid.y - 18 * ls}>
          <Rect x={-4 * ls} y={-11 * ls} width={lw} height={18 * ls} fill="#16A34A" cornerRadius={5 * ls} />
          <Text text={label} fontSize={11 * ls} fill="#fff" fontStyle="bold" x={3 * ls} y={-9 * ls} />
        </Group>
      </>
    );
  }

  function renderTooltip() {
    if (!hoveredId || !mousePos) return null;
    const m = measurements.find((x) => x.id === hoveredId);
    if (!m) return null;
    const lw = 150 * ls;
    return (
      <Group x={mousePos.x + 12 * ls} y={mousePos.y - 32 * ls}>
        <Rect fill="rgba(0,0,0,0.78)" cornerRadius={4 * ls} width={lw} height={34 * ls} />
        <Text text={m.name} fill="#fff" fontSize={10 * ls} fontStyle="bold" x={7 * ls} y={6 * ls} />
        <Text text={m.type === 'count' ? `${m.value} ea` : `${m.value.toFixed(2)} ${m.unit}`} fill="#d4d4d4" fontSize={9 * ls} x={7 * ls} y={19 * ls} />
      </Group>
    );
  }

  function renderHighlightInProgress() {
    if (highlightPath.length < 2) return null;
    const r = parseInt(highlightColor.slice(1, 3), 16);
    const g = parseInt(highlightColor.slice(3, 5), 16);
    const b = parseInt(highlightColor.slice(5, 7), 16);
    return (
      <Line
        points={flat(highlightPath)}
        stroke={`rgba(${r},${g},${b},0.45)`}
        strokeWidth={20 * ls}
        lineCap="round"
        lineJoin="round"
        tension={0.4}
      />
    );
  }

  const sessionColor = activeSession?.color ?? '#2563EB';
  const sessionName = activeSession?.name ?? '';
  const countM = activeSession?.type === 'count'
    ? measurements.find((x) => x.id === activeSession.countMeasurementId)
    : null;

  return (
    <>
      {/* Konva Stage */}
      <div
        style={{ position: 'absolute', top: 0, left: 0, width, height, cursor }}
        onWheel={handleWheelCorrected}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={handleStageMouseLeave}
          onClick={handleClick}
          onDblClick={handleDblClick}
          onContextMenu={handleContextMenu}
        >
          <Layer>
            {annotations.map(renderAnnotation)}
            {measurements.map(renderMeasurement)}
            {renderHighlightInProgress()}
            {renderInProgress()}
            {renderCalibration()}
            {renderDimension()}
            {renderTooltip()}
          </Layer>
        </Stage>
      </div>

      {/* Inline note textarea overlay */}
      {pendingNote && (
        <textarea
          ref={noteInputRef}
          className="absolute z-50 border-2 border-blue-400 rounded-lg bg-white text-sm text-zinc-800 px-2 py-1 shadow-xl resize-none focus:outline-none"
          style={{
            left: pendingNote.screenX + 8,
            top: pendingNote.screenY - 60,
            width: 200,
            height: 60,
          }}
          placeholder="Type a note… (Enter to save)"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNote(); }
            if (e.key === 'Escape') { setPendingNote(null); setNoteText(''); }
          }}
          onBlur={commitNote}
        />
      )}

      {/* Inline note edit textarea */}
      {editingAnnotId && (() => {
        const ann = annotations.find((a) => a.id === editingAnnotId);
        if (!ann) return null;
        const screen = toScreen(ann.position);
        return (
          <textarea
            autoFocus
            className="absolute z-50 border-2 border-blue-400 rounded-lg bg-white text-sm text-zinc-800 px-2 py-1 shadow-xl resize-none focus:outline-none"
            style={{ left: screen.x + 8, top: screen.y - 60, width: 200, height: 60 }}
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditNote(); }
              if (e.key === 'Escape') setEditingAnnotId(null);
            }}
            onBlur={commitEditNote}
          />
        );
      })()}

      {/* Continue / Done bar */}
      {pendingFinish && (
        <div
          className="absolute z-20 flex gap-1 items-center bg-white border border-zinc-300 rounded-lg shadow-lg px-2 py-1.5"
          style={{ left: Math.min(pendingFinish.screenX + 12, width - 200), top: Math.max(pendingFinish.screenY - 40, 4) }}
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

      {/* Session setup */}
      {showSessionSetup && SessionSetupComp && (
        <SessionSetupComp
          toolType={sessionToolType}
          existingCount={countByType(measurements, sessionToolType)}
          onClose={() => setShowSessionSetup(false)}
        />
      )}

      {/* Active session bar */}
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
