import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Hook-based confirmation dialog used before any destructive action
 * (archive, delete, void voucher, restore backup, etc.) per the spec's
 * "require confirmation for destructive actions" rule.
 */
export function useConfirm() {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const [loading, setLoading] = useState(false);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => setState({ options, resolve }));
  }

  const dialog = state ? (
    <Dialog open onOpenChange={(open) => { if (!open) { state.resolve(false); setState(null); } }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{state.options.title}</DialogTitle>
          <DialogDescription>{state.options.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant={state.options.destructive ? "destructive" : "default"}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              state.resolve(true);
              setLoading(false);
              setState(null);
            }}
          >
            {state.options.confirmLabel || "Confirm"}
          </Button>
          <Button variant="outline" onClick={() => { state.resolve(false); setState(null); }}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, dialog };
}
