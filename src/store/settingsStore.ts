import { create } from "zustand";
import { api } from "@/lib/api";

export interface School {
  id: number;
  name: string;
  logo_path: string;
  address: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  principal_name: string;
  motto: string;
  currency: string;
  currency_symbol: string;
  language: string;
  date_format: string;
  time_format: string;
  receipt_prefix: string;
  voucher_prefix: string;
  student_id_prefix: string;
  admission_no_prefix: string;
  employee_id_prefix: string;
  theme_primary_color: string;
  theme_mode: "light" | "dark" | "system";
  receipt_footer: string;
  setup_complete: number;
}

interface SettingsState {
  school: School | null;
  loading: boolean;
  load: () => Promise<void>;
  applyTheme: (school: School) => void;
}

function hexToHslTriplet(hex: string): string {
  const cleaned = hex.replace("#", "");
  const bigint = parseInt(cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  school: null,
  loading: true,
  async load() {
    try {
      const school = await api.settings.getSchool();
      set({ school, loading: false });
      if (school) useSettingsStore.getState().applyTheme(school);
    } catch {
      set({ loading: false });
    }
  },
  applyTheme(school) {
    const root = document.documentElement;
    if (school.theme_primary_color) {
      try {
        root.style.setProperty("--primary", hexToHslTriplet(school.theme_primary_color));
        root.style.setProperty("--ring", hexToHslTriplet(school.theme_primary_color));
      } catch { /* ignore invalid color */ }
    }
    const mode = school.theme_mode || "system";
    if (mode === "dark") root.setAttribute("data-theme", "dark");
    else if (mode === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
  },
}));
