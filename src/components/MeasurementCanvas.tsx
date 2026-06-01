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
  return { value: points.length, unit: 'ea' };
}

export default function MeasurementCanvas({ width, height, pageIndex }: Props) {
  const {
    project,
    zoom,
    activeTool,
    selectedMeasurementId,
    isCalibrating,
    isVerifying,
    calibrationPoints,
    verifyPoints,
    addMeasurement,
    deleteMeasurement,
    selectMeasurement,
    setCalibrationPoints,
    setVerifyPoints,
    setVerifyResult,
    clearVerify,
    resetCalibration,
  } = useTakeoffStore();

  const page = project?.pages[pageIndex];
  const measurements = page?.measurements ?? [];
  const scale = page?.scale ?? null;

  const [inProgress, setInProgress] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scalePixelDist, setScalePixelDist] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ScaleModalComp, setScaleModalComp] = useState<React.ComponentType<{
    pixelDist: number; pageIndex: number; onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    import('./ScaleModal').then((m) => setScaleModalComp(() => m.default));
  }, []);

  useEffect(() => {
    setInProgress([]);
    setMousePos(null);
  }, [activeTool]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') return; // handled by PdfViewer for pan
      if (e.key === 'Escape') {
        if (isCalibrating) resetCalibration();
        if (isVerifying) clearVerify();
        setInProgress([]);
        setMousePos(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
        if (selectedMeasurementId) deleteMeasurement(selectedMeasurementId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCalibrating, isVerifying, selectedMeasurementId, resetCalibration, clearVerify, deleteMeasurement]);

  const getPos = useCallback((stage: Konva.Stage): Point => {
    return stage.getPointerPosition() ?? { x: 0, y: 0 };
  }, []);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    setMousePos(getPos(e.target.getStage()!));
  }, [getPos]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
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

    // Verify
    if (isVerifying) {
      const newPts = [...verifyPoints, stored];
      setVerifyPoints(newPts);
      if (newPts.length >= 2) {
        const p1d = toDisplay(newPts[0], zoom);
        const p2d = toDisplay(newPts[1], zoom);
        const dist = pixelDistance(p1d, p2d);
        const feet = scale ? pixelsToFeet(dist, scale.pixelsPerFoot) : null;
        setVerifyResult(feet);
      }
      return;
    }

    if (activeTool === 'select') { selectMeasurement(null); return; }

    if (activeTool === 'count') {
      const color = getNextColor(measurements.length);
      addMeasurement({
        id: uuidv4(), type: 'count',
        name: `Count ${countByType(measurements, 'count') + 1}`,
        trade: 'General', color, points: [stored],
        value: 1, unit: 'ea', unitCost: 0, visible: true, pageIndex,
      });
      return;
    }

    if (activeTool === 'linear') {
      setInProgress([...inProgress, stored]);
      return;
    }

    if (activeTool === 'area') {
      if (inProgress.length >= 3) {
        const firstDisp = toDisplay(inProgress[0], zoom);
        if (pixelDistance(pos, firstDisp) < 10) { finishArea(inProgress); return; }
      }
      setInProgress([...inProgress, stored]);
    }
  }, [activeTool, inProgress, isCalibrating, isVerifying, calibrationPoints, verifyPoints,
      measurements, zoom, pageIndex, scale, getPos, addMeasurement, selectMeasurement,
      setCalibrationPoints, setVerifyPoints, setVerifyResult]);

  const handleDblClick = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'linear' && inProgress.length >= 2) {
      finishLinear(inProgress.slice(0, -1).length > 0 ? inProgress.slice(0, -1) : inProgress);
      return;
    }
    if (activeTool === 'area' && inProgress.length >= 3) {
      finishArea(inProgress);
    }
  }, [activeTool, inProgress]);

  function finishLinear(points: Point[]) {
    if (points.length < 2) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'linear', scale);
    addMeasurement({
      id: uuidv4(), type: 'linear',
      name: `Linear ${countByType(measurements, 'linear') + 1}`,
      trade: 'General', color: getNextColor(measurements.length),
      points, value, unit, unitCost: 0, visible: true, pageIndex,
    });
    setInProgress([]);
  }

  function finishArea(points: Point[]) {
    if (points.length < 3) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'area', scale);
    addMeasurement({
      id: uuidv4(), type: 'area',
      name: `Area ${countByType(measurements, 'area') + 1}`,
      trade: 'General', color: getNextColor(measurements.length),
      points, value, unit, unitCost: 0, visible: true, pageIndex,
    });
    setInProgress([]);
  }

  const handleMeasurementClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (activeTool === 'select') selectMeasurement(id);
  }, [activeTool, selectMeasurement]);

  const handleCountRightClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    deleteMeasurement(id);
  }, [deleteMeasurement]);

  const cursor = (isCalibrating || isVerifying || activeTool === 'linear' || activeTool === 'area' || activeTool === 'count')
    ? 'crosshair' : 'default';

  function displayPts(pts: Point[]) {
    return pts.flatMap((p) => [p.x * zoom, p.y * zoom]);
  }

  function renderMeasurement(m: Measurement) {
    if (!m.visible) return null;
    const isSelected = m.id === selectedMeasurementId;
    const isHovered = m.id === hoveredId;
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
          <Circle radius={12} fill={m.color} stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={2} shadowBlur={isHovered ? 6 : 0} />
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
            hitStrokeWidth={12}
          />
          <Group x={mid.x} y={mid.y}>
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
            onMouseLeave={() => setHoveredId(null)}
          />
          <Group x={centroid.x} y={centroid.y}>
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
    if (activeTool === 'linear') {
      return <Line points={flat} stroke="#2563EB" strokeWidth={2} dash={[6, 3]} opacity={0.8} />;
    }
    if (activeTool === 'area') {
      return <Line points={flat} stroke="#2563EB" strokeWidth={2} fill="rgba(37,99,235,0.08)" dash={[6, 3]} />;
    }
    return null;
  }

  function renderCalibration() {
    if (!isCalibrating || calibrationPoints.length === 0) return null;
    const pts = calibrationPoints.map((p) => toDisplay(p, zoom));
    return (
      <>
        {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={5} fill="#EF4444" />)}
        {pts.length === 2 && (
          <Line points={[pts[0].x, pts[0].y, pts[1].x, pts[1].y]} stroke="#EF4444" strokeWidth={2} />
        )}
      </>
    );
  }

  function renderVerify() {
    if (!isVerifying || verifyPoints.length === 0) return null;
    const pts = verifyPoints.map((p) => toDisplay(p, zoom));
    const allPts = mousePos && verifyPoints.length === 1 ? [...pts, mousePos] : pts;
    const hasResult = verifyPoints.length >= 2;
    const mid = allPts.length >= 2 ? { x: (allPts[0].x + allPts[1].x) / 2, y: (allPts[0].y + allPts[1].y) / 2 } : null;
    const verifyResult = useRef<number | null>(null);
    if (hasResult && scale) {
      const d = pixelDistance(pts[0], pts[1]);
      verifyResult.current = pixelsToFeet(d, scale.pixelsPerFoot);
    }
    const resultFt = verifyResult.current;
    const label = hasResult ? (scale ? `${resultFt?.toFixed(2)} ft` : 'No scale') : '';

    return (
      <>
        {allPts.length >= 2 && (
          <Line
            points={allPts.flatMap((p) => [p.x, p.y])}
            stroke="#16A34A"
            strokeWidth={2}
            dash={[8, 4]}
          />
        )}
        {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={5} fill="#16A34A" />)}
        {hasResult && mid && label && (
          <Group x={mid.x} y={mid.y - 20}>
            <Rect x={-4} y={-12} width={label.length * 7 + 12} height={18} fill="#16A34A" cornerRadius={4} />
            <Text text={label} fontSize={11} fill="#fff" fontStyle="bold" x={2} y={-10} />
          </Group>
        )}
      </>
    );
  }

  function renderTooltip() {
    if (!hoveredId || !mousePos) return null;
    const m = measurements.find((x) => x.id === hoveredId);
    if (!m) return null;
    return (
      <Group x={mousePos.x + 10} y={mousePos.y - 30}>
        <Rect fill="rgba(0,0,0,0.75)" cornerRadius={4} width={130} height={32} />
        <Text text={m.name} fill="#fff" fontSize={10} fontStyle="bold" x={6} y={5} />
        <Text text={`${m.value.toFixed(2)} ${m.unit}`} fill="#d4d4d4" fontSize={9} x={6} y={17} />
      </Group>
    );
  }

  return (
    <>
      <Stage
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, cursor }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onDblClick={handleDblClick}
      >
        <Layer>
          {measurements.map(renderMeasurement)}
          {renderInProgress()}
          {renderCalibration()}
          {renderVerify()}
          {renderTooltip()}
        </Layer>
      </Stage>

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
