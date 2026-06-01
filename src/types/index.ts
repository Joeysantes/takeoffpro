export type ColorMode = 'full' | 'grayscale' | 'bw';
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
export type ActiveTool = 'select' | 'linear' | 'area' | 'count' | 'calibrate' | 'verify';
export type AppTab = 'plan' | 'estimating';
export type PriceMode = 'per-unit' | 'per-sqft' | 'per-cuft';

export interface Point {
  x: number;
  y: number;
}

export interface ScaleConfig {
  pixelsPerFoot: number;
  label: string;
}

export interface UploadOptions {
  colorMode: ColorMode;
  scale: number; // 0.75 | 1 | 1.5
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
  height?: number;
  priceMode?: PriceMode;
  formula?: string;
}

export interface PlanPage {
  pageIndex: number;
  name?: string;
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
