import { useEffect, useState } from "react";
import { Search, Bell, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { useNavigate } from "react-router-dom";
import { api, isElectron } from "@/lib/api";
import { ChangePasswordDialog } from "@/pages/settings/ChangePasswordDialog";

export function Topbar() {
  const { user, logout } = useAuthStore();
  const { setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);
  const [changePwOpen, setChangePwOpen] = useState(false);

  useEffect(() => {
    api.notifications.list().then((items) => setNotifCount(items.length)).catch(() => {});
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex w-full max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search students, parents, teachers…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> {isElectron ? "Local Database" : "Server Connected"}
        </span>

        <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/notifications")}>
          <Bell className="h-4 w-4" />
          {notifCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
              {notifCount}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user?.displayName || "?").slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden text-left sm:block">
                <span className="block leading-tight">{user?.displayName}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{user?.roleName}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePwOpen(true)}>
              <KeyRound className="h-4 w-4" /> Change password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </header>
  );
}
