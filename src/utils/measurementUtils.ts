import type { Point } from '../types';

export function pixelDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += pixelDistance(points[i - 1], points[i]);
  }
  return total;
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function pixelsToFeet(px: number, pxPerFt: number): number {
  return px / pxPerFt;
}

export function pixelsToSqFt(sqPx: number, pxPerFt: number): number {
  return sqPx / (pxPerFt * pxPerFt);
}

export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

export function formatValue(value: number, unit: string): string {
  return `${value.toFixed(2)} ${unit}`;
}

export const COLOR_CYCLE = [
  '#2563EB',
  '#16A34A',
  '#EA580C',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#CA8A04',
  '#DB2777',
];

export function getNextColor(existingCount: number): string {
  return COLOR_CYCLE[existingCount % COLOR_CYCLE.length];
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
