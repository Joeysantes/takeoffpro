import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  PlanPage,
  ActiveTool,
  ColorMode,
  ScaleConfig,
  Measurement,
  Point,
} from '../types';

interface TakeoffState {
  project: Project | null;
  currentPageIndex: number;
  activeTool: ActiveTool;
  selectedMeasurementId: string | null;
  zoom: number;
  isCalibrating: boolean;
  calibrationPoints: Point[];

  setProject: (project: Project | null) => void;
  setCurrentPage: (index: number) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setZoom: (zoom: number) => void;
  setColorMode: (pageIndex: number, mode: ColorMode) => void;
  setScale: (pageIndex: number, scale: ScaleConfig) => void;
  addMeasurement: (measurement: Measurement) => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  setCalibrationPoints: (points: Point[]) => void;
  resetCalibration: () => void;
  selectMeasurement: (id: string | null) => void;
}

const updatePage = (pages: PlanPage[], pageIndex: number, updater: (page: PlanPage) => PlanPage): PlanPage[] =>
  pages.map((p) => (p.pageIndex === pageIndex ? updater(p) : p));

export const useTakeoffStore = create<TakeoffState>()(
  persist(
    (set) => ({
      project: null,
      currentPageIndex: 0,
      activeTool: 'select',
      selectedMeasurementId: null,
      zoom: 1,
      isCalibrating: false,
      calibrationPoints: [],

      setProject: (project) => set({ project, currentPageIndex: 0, selectedMeasurementId: null }),
      setCurrentPage: (index) => set({ currentPageIndex: index, selectedMeasurementId: null }),
      setActiveTool: (tool) =>
        set({ activeTool: tool, isCalibrating: tool === 'calibrate', calibrationPoints: [] }),
      setZoom: (zoom) => set({ zoom }),

      setColorMode: (pageIndex, mode) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: updatePage(state.project.pages, pageIndex, (p) => ({ ...p, colorMode: mode })),
            },
          };
        }),

      setScale: (pageIndex, scale) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: updatePage(state.project.pages, pageIndex, (p) => ({ ...p, scale })),
            },
            isCalibrating: false,
            calibrationPoints: [],
            activeTool: 'select',
          };
        }),

      addMeasurement: (measurement) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: updatePage(state.project.pages, measurement.pageIndex, (p) => ({
                ...p,
                measurements: [...p.measurements, measurement],
              })),
            },
          };
        }),

      updateMeasurement: (id, updates) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: state.project.pages.map((p) => ({
                ...p,
                measurements: p.measurements.map((m) => (m.id === id ? { ...m, ...updates } : m)),
              })),
            },
          };
        }),

      deleteMeasurement: (id) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: state.project.pages.map((p) => ({
                ...p,
                measurements: p.measurements.filter((m) => m.id !== id),
              })),
            },
            selectedMeasurementId: state.selectedMeasurementId === id ? null : state.selectedMeasurementId,
          };
        }),

      setCalibrationPoints: (points) =>
        set({ calibrationPoints: points, isCalibrating: true }),

      resetCalibration: () =>
        set({ calibrationPoints: [], isCalibrating: false, activeTool: 'select' }),

      selectMeasurement: (id) => set({ selectedMeasurementId: id }),
    }),
    {
      name: 'takeoff-pro',
    }
  )
);
