import { useGetTrustAnalytics } from "@workspace/api-client-react";
import { GitBranch, CheckCircle2, AlertTriangle, Scissors } from "lucide-react";

export function TrustPathAnalytics() {
  const { data } = useGetTrustAnalytics();

  const health = data?.trustHealthPercent ?? 100;
  const healthColor =
    health < 60 ? "text-red-400 bg-red-500/10 border-red-500/30"    :
    health < 80 ? "text-orange-400 bg-orange-500/10 border-orange-500/30" :
    "text-green-400 bg-green-500/10 border-green-500/30";

  const barColor =
    health < 60 ? "bg-red-500"    :
    health < 80 ? "bg-orange-500" :
    "bg-green-500";

  return (
    <div className="space-y-2">
      {/* Health bar */}
      <div className={`flex items-center justify-between p-2 border rounded ${healthColor}`}>
        <div className="flex items-center gap-2">
          <GitBranch className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Trust Health</span>
        </div>
        <span className="text-base font-bold tabular-nums">{health}%</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${health}%` }} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { icon: CheckCircle2, label: "Active",      value: data?.activePaths      ?? 0, color: "text-green-400"  },
          { icon: AlertTriangle,label: "Compromised", value: data?.compromisedPaths ?? 0, color: "text-orange-400" },
          { icon: Scissors,     label: "Severed",     value: data?.severedPaths     ?? 0, color: "text-red-400"    },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex flex-col items-center p-1.5 border border-border/50 rounded bg-background/20">
            <Icon className={`w-3 h-3 ${color} mb-0.5`} />
            <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* Node stats */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground px-1 pt-0.5 border-t border-border/50">
        <span>{data?.totalNodes ?? 0} total nodes</span>
        <span className="text-red-400">{data?.compromisedNodes ?? 0} compromised</span>
        <span className="text-yellow-400">{data?.degradedNodes ?? 0} degraded</span>
      </div>
    </div>
  );
}
