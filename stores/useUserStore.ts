import { create } from 'zustand';
import type { Json, Profile } from '@/lib/supabase/types';

interface UserStore {
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  clearUser: () => void;
  esGraduado: boolean;
  setEsGraduado: (value: boolean) => void;
  /** Merge a single UI preference key into the in-memory profile. */
  setUiPreference: (key: string, value: Json) => void;
}

function mergeUiPreference(
  current: Profile['ui_preferences'] | undefined,
  key: string,
  value: Json
): Record<string, Json> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, Json>)
      : {};
  return { ...base, [key]: value };
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  esGraduado: false,
  setEsGraduado: (value) => set({ esGraduado: value }),
  setUiPreference: (key, value) =>
    set((state) =>
      state.user
        ? { user: { ...state.user, ui_preferences: mergeUiPreference(state.user.ui_preferences, key, value) } }
        : {}
    ),
}));
