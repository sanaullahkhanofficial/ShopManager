import { NavLink } from "react-router-dom";
import { GraduationCap, ChevronsLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

export function Sidebar() {
  const { hasPermission, user } = useAuthStore();
  const school = useSettingsStore((s) => s.school);
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all",
        sidebarCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{school?.name || "EduManage"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">School ERP</p>
          </div>
        )}
        <button onClick={toggleSidebar} className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            {section.label && !sidebarCollapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const allowed = isSuper || !item.permission || hasPermission(item.permission);
                if (item.planned) {
                  return (
                    <div
                      key={item.label}
                      title="Planned feature — not yet available"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/35"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="flex flex-1 items-center justify-between truncate">
                          {item.label}
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  );
                }
                if (!allowed || !item.to) return null;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
