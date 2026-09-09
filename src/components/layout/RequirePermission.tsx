import { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { ShieldAlert } from "lucide-react";

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, user } = useAuthStore();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";
  if (isSuper || hasPermission(permission)) return <>{children}</>;
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">You don't have access to this page</p>
        <p className="text-sm text-muted-foreground">Ask an administrator to grant you the required permission.</p>
      </div>
    </div>
  );
}
