import { create } from 'zustand';
import type { Profile } from '@/lib/supabase/types';

interface UserStore {
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
