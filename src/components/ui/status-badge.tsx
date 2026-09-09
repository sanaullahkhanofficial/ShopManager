import { cn, classNamesForStatus } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", classNamesForStatus(status))}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
