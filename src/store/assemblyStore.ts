import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Assembly } from '../types';

interface AssemblyState {
  assemblies: Assembly[];
  saveAssembly: (assembly: Assembly) => void;
  updateAssembly: (id: string, updates: Partial<Assembly>) => void;
  deleteAssembly: (id: string) => void;
}

export const useAssemblyStore = create<AssemblyState>()(
  persist(
    (set) => ({
      assemblies: [],

      saveAssembly: (assembly) =>
        set((state) => ({
          assemblies: [...state.assemblies.filter((a) => a.id !== assembly.id), assembly],
        })),

      updateAssembly: (id, updates) =>
        set((state) => ({
          assemblies: state.assemblies.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      deleteAssembly: (id) =>
        set((state) => ({ assemblies: state.assemblies.filter((a) => a.id !== id) })),
    }),
    { name: 'takeoff-pro-assemblies' }
  )
);
