export type ColorMode = 'full' | 'grayscale' | 'bw' | 'half';
export type TradeCategory =
  | 'General'
  | 'Concrete'
  | 'Drywall'
  | 'Electrical'
  | 'HVAC'
  | 'Plumbing'
  | 'Framing'
  | 'Painting'
  | 'Flooring';
export type MeasurementType = 'linear' | 'area' | 'count';
export type ActiveTool = 'select' | 'linear' | 'area' | 'count' | 'calibrate';

export interface Point {
  x: number;
  y: number;
}

export interface ScaleConfig {
  pixelsPerFoot: number;
  label: string;
}

export interface Measurement {
  id: string;
  type: MeasurementType;
  name: string;
  trade: TradeCategory;
  color: string;
  points: Point[];
  value: number;
  unit: string;
  unitCost: number;
  visible: boolean;
  pageIndex: number;
}

export interface PlanPage {
  pageIndex: number;
  imageDataUrl: string;
  width: number;
  height: number;
  scale: ScaleConfig | null;
  colorMode: ColorMode;
  measurements: Measurement[];
}

export interface Project {
  id: string;
  name: string;
  pages: PlanPage[];
  createdAt: string;
}
