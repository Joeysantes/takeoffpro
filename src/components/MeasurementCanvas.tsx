import React, { useCallback, useEffect, useRef, useState } from 'react';
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

function getMeasurementCount(measurements: Measurement[], type: string): number {
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
    calibrationPoints,
    addMeasurement,
    deleteMeasurement,
    selectMeasurement,
    setCalibrationPoints,
    setActiveTool,
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
  const stageRef = useRef<Konva.Stage>(null);

  // Dynamically import ScaleModal to avoid circular issues
  const [ScaleModal, setScaleModalComponent] = useState<React.ComponentType<{
    pixelDist: number;
    pageIndex: number;
    onClose: () => void;
  }> | null>(null);

  useEffect(() => {
    import('./ScaleModal').then((m) => setScaleModalComponent(() => m.default));
  }, []);

  // Reset in-progress when tool changes
  useEffect(() => {
    setInProgress([]);
    setMousePos(null);
  }, [activeTool]);

  // Keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCalibrating) {
          resetCalibration();
        }
        setInProgress([]);
        setMousePos(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
        if (selectedMeasurementId) {
          deleteMeasurement(selectedMeasurementId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCalibrating, selectedMeasurementId, resetCalibration, deleteMeasurement]);

  const getPointerPos = useCallback(
    (stage: Konva.Stage): Point => {
      const pos = stage.getPointerPosition() ?? { x: 0, y: 0 };
      return pos;
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = getPointerPos(e.target.getStage()!);
      setMousePos(pos);
    },
    [getPointerPos]
  );

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;
      const stage = e.target.getStage()!;
      const pos = getPointerPos(stage);
      const storedPos = toStore(pos, zoom);

      if (isCalibrating) {
        const newPts = [...calibrationPoints, storedPos];
        setCalibrationPoints(newPts);
        if (newPts.length === 2) {
          const p1d = toDisplay(newPts[0], zoom);
          const p2d = toDisplay(newPts[1], zoom);
          setScalePixelDist(pixelDistance(p1d, p2d));
          setShowScaleModal(true);
        }
        return;
      }

      if (activeTool === 'select') {
        selectMeasurement(null);
        return;
      }

      if (activeTool === 'count') {
        const existingCount = getMeasurementCount(measurements, 'count');
        const color = getNextColor(measurements.length);
        addMeasurement({
          id: uuidv4(),
          type: 'count',
          name: `Count ${existingCount + 1}`,
          trade: 'General',
          color,
          points: [storedPos],
          value: 1,
          unit: 'ea',
          unitCost: 0,
          visible: true,
          pageIndex,
        });
        return;
      }

      if (activeTool === 'linear') {
        const newPts = [...inProgress, storedPos];
        setInProgress(newPts);
        return;
      }

      if (activeTool === 'area') {
        if (inProgress.length >= 3) {
          const firstDisp = toDisplay(inProgress[0], zoom);
          const dist = pixelDistance(pos, firstDisp);
          if (dist < 10) {
            finishArea(inProgress);
            return;
          }
        }
        setInProgress([...inProgress, storedPos]);
        return;
      }
    },
    [
      activeTool,
      inProgress,
      isCalibrating,
      calibrationPoints,
      measurements,
      zoom,
      pageIndex,
      getPointerPos,
      addMeasurement,
      selectMeasurement,
      setCalibrationPoints,
    ]
  );

  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'linear' && inProgress.length >= 2) {
        const pts = inProgress.slice(0, -1); // remove last (duplicate from click)
        finishLinear(pts.length > 0 ? pts : inProgress);
        return;
      }
      if (activeTool === 'area' && inProgress.length >= 3) {
        finishArea(inProgress);
        return;
      }
    },
    [activeTool, inProgress]
  );

  function finishLinear(points: Point[]) {
    if (points.length < 2) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'linear', scale);
    const color = getNextColor(measurements.length);
    const cnt = getMeasurementCount(measurements, 'linear');
    addMeasurement({
      id: uuidv4(),
      type: 'linear',
      name: `Linear ${cnt + 1}`,
      trade: 'General',
      color,
      points,
      value,
      unit,
      unitCost: 0,
      visible: true,
      pageIndex,
    });
    setInProgress([]);
  }

  function finishArea(points: Point[]) {
    if (points.length < 3) { setInProgress([]); return; }
    const { value, unit } = computeValue(points, 'area', scale);
    const color = getNextColor(measurements.length);
    const cnt = getMeasurementCount(measurements, 'area');
    addMeasurement({
      id: uuidv4(),
      type: 'area',
      name: `Area ${cnt + 1}`,
      trade: 'General',
      color,
      points,
      value,
      unit,
      unitCost: 0,
      visible: true,
      pageIndex,
    });
    setInProgress([]);
  }

  const handleMeasurementClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (activeTool === 'select') {
        selectMeasurement(id);
      }
    },
    [activeTool, selectMeasurement]
  );

  const handleCountRightClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      deleteMeasurement(id);
    },
    [deleteMeasurement]
  );

  const cursor =
    activeTool === 'calibrate' || activeTool === 'linear' || activeTool === 'area' || activeTool === 'count'
      ? 'crosshair'
      : 'default';

  const displayPts = (pts: Point[]) => pts.flatMap((p) => [p.x * zoom, p.y * zoom]);

  function renderMeasurement(m: Measurement) {
    if (!m.visible) return null;
    const isSelected = m.id === selectedMeasurementId;
    const isHovered = m.id === hoveredId;
    const pts = m.points.map((p) => toDisplay(p, zoom));

    if (m.type === 'count') {
      return (
        <Group
          key={m.id}
          x={pts[0].x}
          y={pts[0].y}
          onClick={(e) => handleMeasurementClick(m.id, e)}
          onContextMenu={(e) => handleCountRightClick(m.id, e)}
          onMouseEnter={() => setHoveredId(m.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <Circle
            radius={12}
            fill={m.color}
            stroke={isSelected ? '#fff' : 'transparent'}
            strokeWidth={2}
            shadowBlur={isHovered ? 6 : 0}
          />
          <Text
            text={String(measurements.filter((x) => x.type === 'count' && x.id <= m.id && x.pageIndex === pageIndex).length)}
            fontSize={10}
            fill="#fff"
            fontStyle="bold"
            align="center"
            verticalAlign="middle"
            width={24}
            height={24}
            offsetX={12}
            offsetY={12}
          />
        </Group>
      );
    }

    if (m.type === 'linear') {
      const flatPts = displayPts(m.points);
      const midIdx = Math.floor(m.points.length / 2);
      const mid = pts[midIdx] ?? pts[0];
      return (
        <Group key={m.id}>
          <Line
            points={flatPts}
            stroke={m.color}
            strokeWidth={isSelected ? 3 : 2}
            dash={isSelected ? [8, 4] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
            hitStrokeWidth={12}
          />
          <Group x={mid.x} y={mid.y}>
            <Rect
              x={-2}
              y={-9}
              width={`${m.value.toFixed(1)} ${m.unit}`.length * 5 + 8}
              height={14}
              fill={m.color}
              cornerRadius={4}
            />
            <Text
              text={`${m.value.toFixed(1)} ${m.unit}`}
              fontSize={9}
              fill="#fff"
              fontStyle="bold"
              x={2}
              y={-8}
            />
          </Group>
        </Group>
      );
    }

    if (m.type === 'area') {
      const flatPts = displayPts(m.points);
      const centroid = polygonCentroid(pts);
      const hexColor = m.color;
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      return (
        <Group key={m.id}>
          <Line
            points={flatPts}
            closed
            fill={`rgba(${r},${g},${b},0.15)`}
            stroke={m.color}
            strokeWidth={isSelected ? 3 : 2}
            dash={isSelected ? [8, 4] : undefined}
            onClick={(e) => handleMeasurementClick(m.id, e)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
          <Group x={centroid.x} y={centroid.y}>
            <Rect
              x={-2}
              y={-9}
              width={`${m.value.toFixed(1)} ${m.unit}`.length * 5 + 8}
              height={14}
              fill={m.color}
              cornerRadius={4}
            />
            <Text
              text={`${m.value.toFixed(1)} ${m.unit}`}
              fontSize={9}
              fill="#fff"
              fontStyle="bold"
              x={2}
              y={-8}
            />
          </Group>
        </Group>
      );
    }
    return null;
  }

  function renderInProgress() {
    if (inProgress.length === 0) return null;
    const pts = inProgress.map((p) => toDisplay(p, zoom));

    if (activeTool === 'linear') {
      const allPts = mousePos ? [...pts, mousePos] : pts;
      const flatPts = allPts.flatMap((p) => [p.x, p.y]);
      return (
        <Line
          points={flatPts}
          stroke="#2563EB"
          strokeWidth={2}
          dash={[6, 3]}
          opacity={0.8}
        />
      );
    }

    if (activeTool === 'area') {
      const allPts = mousePos ? [...pts, mousePos] : pts;
      const flatPts = allPts.flatMap((p) => [p.x, p.y]);
      return (
        <Line
          points={flatPts}
          closed={false}
          stroke="#2563EB"
          strokeWidth={2}
          fill="rgba(37,99,235,0.1)"
          dash={[6, 3]}
        />
      );
    }

    return null;
  }

  function renderCalibration() {
    if (!isCalibrating) return null;
    const pts = calibrationPoints.map((p) => toDisplay(p, zoom));
    return (
      <>
        {pts.map((p, i) => (
          <Circle key={i} x={p.x} y={p.y} radius={5} fill="#EF4444" />
        ))}
        {pts.length === 2 && (
          <Line
            points={[pts[0].x, pts[0].y, pts[1].x, pts[1].y]}
            stroke="#EF4444"
            strokeWidth={2}
          />
        )}
      </>
    );
  }

  // Tooltip
  function renderTooltip() {
    if (!hoveredId || !mousePos) return null;
    const m = measurements.find((x) => x.id === hoveredId);
    if (!m) return null;
    return (
      <Group x={mousePos.x + 10} y={mousePos.y - 30}>
        <Rect fill="rgba(0,0,0,0.75)" cornerRadius={4} width={120} height={32} />
        <Text text={m.name} fill="#fff" fontSize={10} fontStyle="bold" x={6} y={5} />
        <Text
          text={`${m.value.toFixed(2)} ${m.unit}`}
          fill="#d4d4d4"
          fontSize={9}
          x={6}
          y={17}
        />
      </Group>
    );
  }

  return (
    <>
      <Stage
        ref={stageRef}
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
          {renderTooltip()}
        </Layer>
      </Stage>

      {showScaleModal && ScaleModal && (
        <ScaleModal
          pixelDist={scalePixelDist}
          pageIndex={pageIndex}
          onClose={() => setShowScaleModal(false)}
        />
      )}
    </>
  );
}
