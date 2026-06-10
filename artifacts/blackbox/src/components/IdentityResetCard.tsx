import { useGetIdentityResetStatus } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetIdentityResetStatusQueryKey } from "@workspace/api-client-react";
import { KeyRound, CheckCircle2, Loader2 } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  "admin password rotated":    "Admin PW rotated",
  "analyst password rotated":  "Analyst PW rotated",
  "hr_admin password rotated": "HR Admin PW rotated",
  "dev_lead API key rotated":  "Dev Lead API key rotated",
  "hr_admin API key rotated":  "HR Admin API key rotated",
  "all session tokens revoked":"Session tokens revoked",
  "all active sessions revoked":"Active sessions revoked",
  "AWS access key reset":       "AWS access key reset",
};

export function IdentityResetCard() {
  const { data: status } = useGetIdentityResetStatus();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!status?.active) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetIdentityResetStatusQueryKey() });
    }, 800);
    return () => clearInterval(interval);
  }, [status?.active, queryClient]);

  const hasRun     = !!status?.lastRunAt;
  const isActive   = status?.active ?? false;
  const progress   = status?.progressPercent ?? 0;
  const completed  = status?.completedActions ?? [];
  const total      = status?.totalActions ?? 8;

  if (!hasRun && !isActive) {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/20 border border-border/50 rounded">
        <KeyRound className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Identity Reset Protocol: Standby</span>
      </div>
    );
  }

  return (
    <div className={`p-3 border rounded space-y-2 ${isActive ? "border-yellow-500/40 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-green-400" />
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-yellow-400" : "text-green-400"}`}>
            Identity Reset {isActive ? "In Progress" : "Complete"}
          </span>
        </div>
        <span className={`text-xs font-bold tabular-nums ${isActive ? "text-yellow-400 animate-pulse" : "text-green-400"}`}>
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isActive ? "bg-yellow-500" : "bg-green-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Completed actions */}
      <div className="space-y-0.5 max-h-24 overflow-y-auto">
        {completed.map((action, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[9px]">
            <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0" />
            <span className="text-muted-foreground">{ACTION_LABELS[action] ?? action}</span>
          </div>
        ))}
        {isActive && status?.currentAction && completed.length < total && (
          <div className="flex items-center gap-1.5 text-[9px]">
            <Loader2 className="w-2.5 h-2.5 text-yellow-400 animate-spin shrink-0" />
            <span className="text-yellow-400">{ACTION_LABELS[status.currentAction] ?? status.currentAction}</span>
          </div>
        )}
      </div>

      {!isActive && status?.lastRunAt && (
        <div className="text-[8px] text-muted-foreground border-t border-border/30 pt-1">
          Completed: {new Date(status.lastRunAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
