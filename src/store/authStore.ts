import { create } from "zustand";
import { api } from "@/lib/api";

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  roleId: number;
  roleName: string;
  mustChangePassword: boolean;
  permissions: string[];
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  async login(username, password) {
    const user = await api.login({ username, password });
    set({ user });
    return user;
  },
  async logout() {
    await api.logout();
    set({ user: null });
  },
  async hydrate() {
    try {
      const user = await api.currentUser();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  hasPermission(code) {
    const user = get().user;
    if (!user) return false;
    return user.permissions.includes(code);
  },
}));
