import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project, PlanPage, ActiveTool, ScaleConfig,
  Measurement, Point, AppTab, TradeCategory,
} from '../types';
import { getNextColor } from '../utils/measurementUtils';

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
  pendingPresetLabel: string | null;
  hiddenTrades: TradeCategory[];

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
  duplicateMeasurement: (id: string, targetPageIndex: number) => void;
  setCalibrationPoints: (points: Point[]) => void;
  resetCalibration: () => void;
  selectMeasurement: (id: string | null) => void;
  renamePage: (pageIndex: number, name: string) => void;
  renameProject: (name: string) => void;
  addPages: (newPages: PlanPage[]) => void;
  setDimensionPoints: (points: Point[]) => void;
  setDimensionResult: (result: number | null) => void;
  clearDimension: () => void;
  setPendingPreset: (label: string | null) => void;
  toggleTradeVisibility: (trade: TradeCategory) => void;
  setHiddenTrades: (trades: TradeCategory[]) => void;
}

const updatePage = (pages: PlanPage[], pageIndex: number, updater: (p: PlanPage) => PlanPage) =>
  pages.map((p) => (p.pageIndex === pageIndex ? updater(p) : p));

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
      pendingPresetLabel: null,
      hiddenTrades: [],

      setProject: (project) =>
        set({ project, currentPageIndex: 0, selectedMeasurementId: null, activeTab: 'plan', hiddenTrades: [] }),

      setCurrentPage: (index) => set({ currentPageIndex: index, selectedMeasurementId: null }),

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
            pendingPresetLabel: null,
          };
        }),

      setScaleAllPages: (scale) =>
        set((state) => {
          if (!state.project) return state;
          return {
            project: { ...state.project, pages: state.project.pages.map((p) => ({ ...p, scale })) },
            isCalibrating: false,
            calibrationPoints: [],
            activeTool: 'select',
            pendingPresetLabel: null,
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
                measurements: p.measurements.map((m) => m.id === id ? { ...m, ...updates } : m),
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

      duplicateMeasurement: (id, targetPageIndex) =>
        set((state) => {
          if (!state.project) return state;
          let source: Measurement | undefined;
          for (const page of state.project.pages) {
            source = page.measurements.find((m) => m.id === id);
            if (source) break;
          }
          if (!source) return state;
          const allMeasurements = state.project.pages.flatMap((p) => p.measurements);
          const copy: Measurement = {
            ...source,
            id: uuidv4(),
            name: `${source.name} (copy)`,
            pageIndex: targetPageIndex,
            color: getNextColor(allMeasurements.length),
          };
          return {
            project: {
              ...state.project,
              pages: updatePage(state.project.pages, targetPageIndex, (p) => ({
                ...p,
                measurements: [...p.measurements, copy],
              })),
            },
          };
        }),

      setCalibrationPoints: (points) => set({ calibrationPoints: points, isCalibrating: true }),

      resetCalibration: () =>
        set({ calibrationPoints: [], isCalibrating: false, activeTool: 'select', pendingPresetLabel: null }),

      selectMeasurement: (id) => set({ selectedMeasurementId: id }),

      renamePage: (pageIndex, name) =>
        set((state) => {
          if (!state.project) return state;
          return { project: { ...state.project, pages: updatePage(state.project.pages, pageIndex, (p) => ({ ...p, name })) } };
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
          return { project: { ...state.project, pages: [...state.project.pages, ...reindexed] } };
        }),

      setDimensionPoints: (points) => set({ dimensionPoints: points }),
      setDimensionResult: (result) => set({ dimensionResult: result }),
      clearDimension: () =>
        set({ isDimensioning: false, dimensionPoints: [], dimensionResult: null, activeTool: 'select' }),

      setPendingPreset: (label) => set({ pendingPresetLabel: label }),

      toggleTradeVisibility: (trade) =>
        set((state) => ({
          hiddenTrades: state.hiddenTrades.includes(trade)
            ? state.hiddenTrades.filter((t) => t !== trade)
            : [...state.hiddenTrades, trade],
        })),

      setHiddenTrades: (trades) => set({ hiddenTrades: trades }),
    }),
    { name: 'takeoff-pro' }
  )
);
