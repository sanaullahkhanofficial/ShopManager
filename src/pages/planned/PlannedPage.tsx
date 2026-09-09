import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export function PlannedPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="This module is on the roadmap." />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Planned feature — not yet implemented</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {title} is designed into the database schema and navigation, but the full workflow has not been built
            yet in this release. It's clearly marked here rather than offering a non-functional screen.
          </p>
        </div>
      </div>
    </div>
  );
}
