import { useEffect, useState } from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const SEVERITY_STYLE: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-warning/40 bg-warning/5",
  low: "border-border",
};
const SEVERITY_ICON: Record<string, any> = { high: AlertCircle, medium: AlertTriangle, low: Info };

export function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { api.notifications.list().then(setItems).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Notifications" description="System alerts computed live from your school's data — fee overdue, low attendance, upcoming exams and more." />
      {!loading && items.length === 0 && <EmptyState title="You're all caught up" description="No notifications right now." />}
      <div className="space-y-2">
        {items.map((n, i) => {
          const Icon = SEVERITY_ICON[n.severity] || Info;
          return (
            <Card key={i} className={cn("cursor-pointer", SEVERITY_STYLE[n.severity])} onClick={() => n.link && navigate(n.link)}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-4 w-4 shrink-0" />
                <p className="text-sm">{n.message}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
