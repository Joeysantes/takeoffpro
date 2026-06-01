import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  PlanPage,
  ActiveTool,
  ScaleConfig,
  Measurement,
  Point,
  AppTab,
} from '../types';

interface TakeoffState {
  project: Project | null;
  currentPageIndex: number;
  activeTool: ActiveTool;
  activeTab: AppTab;
  selectedMeasurementId: string | null;
  zoom: number;
  isCalibrating: boolean;
  calibrationPoints: Point[];
  isDimensioning: boolean;
  dimensionPoints: Point[];
  dimensionResult: number | null;

  setProject: (project: Project | null) => void;
  setCurrentPage: (index: number) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setActiveTab: (tab: AppTab) => void;
  setZoom: (zoom: number) => void;
  setScale: (pageIndex: number, scale: ScaleConfig) => void;
  setScaleAllPages: (scale: ScaleConfig) => void;
  addMeasurement: (measurement: Measurement) => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  setCalibrationPoints: (points: Point[]) => void;
  resetCalibration: () => void;
  selectMeasurement: (id: string | null) => void;
  renamePage: (pageIndex: number, name: string) => void;
  renameProject: (name: string) => void;
  addPages: (newPages: PlanPage[]) => void;
  setDimensionPoints: (points: Point[]) => void;
  setDimensionResult: (result: number | null) => void;
  clearDimension: () => void;
}

const updatePage = (
  pages: PlanPage[],
  pageIndex: number,
  updater: (page: PlanPage) => PlanPage
): PlanPage[] => pages.map((p) => (p.pageIndex === pageIndex ? updater(p) : p));

export const useTakeoffStore = create<TakeoffState>()(
  persist(
    (set) => ({
      project: null,
      currentPageIndex: 0,
      activeTool: 'select',
      activeTab: 'plan',
      selectedMeasurementId: null,
      zoom: 1,
      isCalibrating: false,
      calibrationPoints: [],
      isDimensioning: false,
      dimensionPoints: [],
      dimensionResult: null,

      setProject: (project) =>
        set({ project, currentPageIndex: 0, selectedMeasurementId: null, activeTab: 'plan' }),

      setCurrentPage: (index) =>
        set({ currentPageIndex: index, selectedMeasurementId: null }),

      setActiveTool: (tool) =>
        set({
          activeTool: tool,
          isCalibrating: tool === 'calibrate',
          calibrationPoints: [],
          isDimensioning: tool === 'dimension',
          dimensionPoints: [],
          dimensionResult: null,
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),
      setZoom: (zoom) => set({ zoom }),

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

      setScaleAllPages: (scale) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: state.project.pages.map((p) => ({ ...p, scale })),
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
                measurements: p.measurements.map((m) =>
                  m.id === id ? { ...m, ...updates } : m
                ),
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
            selectedMeasurementId:
              state.selectedMeasurementId === id ? null : state.selectedMeasurementId,
          };
        }),

      setCalibrationPoints: (points) =>
        set({ calibrationPoints: points, isCalibrating: true }),

      resetCalibration: () =>
        set({ calibrationPoints: [], isCalibrating: false, activeTool: 'select' }),

      selectMeasurement: (id) => set({ selectedMeasurementId: id }),

      renamePage: (pageIndex, name) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: {
              ...state.project,
              pages: updatePage(state.project.pages, pageIndex, (p) => ({ ...p, name })),
            },
          };
        }),

      renameProject: (name) =>
        set((state) => {
          if (!state.project) return state;
          return { project: { ...state.project, name } };
        }),

      addPages: (newPages) =>
        set((state) => {
          if (!state.project) return state;
          const offset = state.project.pages.length;
          const reindexed = newPages.map((p, i) => ({
            ...p,
            pageIndex: offset + i,
            measurements: p.measurements.map((m) => ({ ...m, pageIndex: offset + i })),
          }));
          return {
            project: {
              ...state.project,
              pages: [...state.project.pages, ...reindexed],
            },
          };
        }),

      setDimensionPoints: (points) => set({ dimensionPoints: points }),
      setDimensionResult: (result) => set({ dimensionResult: result }),
      clearDimension: () =>
        set({ isDimensioning: false, dimensionPoints: [], dimensionResult: null, activeTool: 'select' }),
    }),
    { name: 'takeoff-pro' }
  )
);
