import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useListUsers } from "@workspace/api-client-react";
import { Loader2, CircleDot, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onStart: (attackerName: string) => void;
  lastSelected?: string | null;
}

export function AttackerSelectModal({ open, onClose, onStart, lastSelected }: Props) {
  const { data: users, isLoading } = useListUsers();
  const [selected, setSelected] = useState<string | null>(lastSelected ?? null);

  useEffect(() => {
    if (open && lastSelected) setSelected(lastSelected);
  }, [open, lastSelected]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && selected) onStart(selected);
    },
    [open, selected, onClose, onStart]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg w-full border border-primary/30 bg-[#0a0a0a]/95 backdrop-blur-sm shadow-[0_0_60px_rgba(0,255,136,0.15)] text-foreground p-0 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-primary/10">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
            <Zap className="w-4 h-4 text-primary" />
            Select the Attacker
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-0.5">
            Choose an internal user to simulate as the attacker. All events, honeypots, and timeline entries will reference this identity.
          </DialogDescription>
        </DialogHeader>

        {/* User Grid */}
        <div className="px-5 py-3 max-h-[320px] overflow-y-auto space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] uppercase tracking-wider">Loading users…</span>
            </div>
          )}
          {users?.map((u) => {
            const isSel = selected === u.name;
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u.name)}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 group
                  ${isSel
                    ? "border-[#00aaff] bg-[#00aaff]/10 shadow-[0_0_12px_rgba(0,170,255,0.3)]"
                    : "border-border/50 bg-card/30 hover:border-primary/30 hover:bg-card/60"
                  }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-9 h-9 rounded-full"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a]
                      ${u.status === "Online" ? "bg-green-500" : "bg-red-500"}`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                      {u.name}
                    </span>
                    <span className={`text-[8px] uppercase px-1 py-0.5 rounded ${u.status === "Online" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {u.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[9px] text-muted-foreground font-mono">{u.empId}</span>
                    <span className="text-[9px] text-muted-foreground">{u.department}</span>
                  </div>
                </div>

                {/* Scores */}
                <div className="shrink-0 flex gap-3 text-right">
                  <div>
                    <div className="text-[8px] text-muted-foreground uppercase">Risk</div>
                    <div className={`text-[11px] font-bold tabular-nums ${u.riskScore > 60 ? "text-red-400" : u.riskScore > 40 ? "text-yellow-400" : "text-green-400"}`}>
                      {u.riskScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-muted-foreground uppercase">Trust</div>
                    <div className={`text-[11px] font-bold tabular-nums ${u.trustScore > 80 ? "text-green-400" : u.trustScore > 50 ? "text-yellow-400" : "text-red-400"}`}>
                      {u.trustScore}
                    </div>
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
                  ${isSel ? "border-[#00aaff] bg-[#00aaff]" : "border-muted-foreground/30"}`}
                >
                  {isSel && <CircleDot className="w-2.5 h-2.5 text-black" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-primary/10 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected}
            onClick={() => selected && onStart(selected)}
            className={`h-8 text-[10px] uppercase tracking-widest font-bold transition-all
              ${selected
                ? "bg-primary text-black hover:bg-primary/80"
                : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
          >
            Start Simulation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
