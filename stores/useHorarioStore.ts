import { create } from 'zustand';
import type { Horario } from '@/lib/supabase/types';

interface HorarioStore {
  horarios: Horario[];
  setHorarios: (horarios: Horario[]) => void;
  addHorario: (horario: Horario) => void;
  updateHorario: (id: string, data: Partial<Horario>) => void;
  removeHorario: (id: string) => void;
}

export const useHorarioStore = create<HorarioStore>((set) => ({
  horarios: [],
  setHorarios: (horarios) => set({ horarios }),
  addHorario: (horario) =>
    set((state) => ({ horarios: [...state.horarios, horario] })),
  updateHorario: (id, data) =>
    set((state) => ({
      horarios: state.horarios.map((h) =>
        h.id === id ? { ...h, ...data } : h
      ),
    })),
  removeHorario: (id) =>
    set((state) => ({
      horarios: state.horarios.filter((h) => h.id !== id),
    })),
}));
