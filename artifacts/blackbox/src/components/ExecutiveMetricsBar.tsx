import { useGetRiskScore, useListTrustScores, useListIncidents, useListDeceptionAssets, useGetTrustAnalytics, useGetTrustScore, useListClassifiedAssets } from "@workspace/api-client-react";
import { ShieldAlert, Users, Database, Activity, Scissors, Zap, Lock } from "lucide-react";

interface MetricProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ElementType;
  pulse?: boolean;
}

function Metric({ label, value, sub, color = "text-primary", icon: Icon, pulse }: MetricProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-r border-border/50 last:border-0 min-w-0">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <div className={`text-base font-bold tabular-nums leading-none ${color} ${pulse ? "animate-pulse" : ""}`}>{value}</div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none mt-0.5">{label}</div>
        {sub && <div className={`text-[9px] ${color} opacity-70 leading-none mt-0.5`}>{sub}</div>}
      </div>
    </div>
  );
}

export function ExecutiveMetricsBar() {
  const { data: riskScore }     = useGetRiskScore();
  const { data: trustScoreData }= useGetTrustScore();
  const { data: trustScores }   = useListTrustScores();
  const { data: incidents }     = useListIncidents();
  const { data: deception }     = useListDeceptionAssets();
  const { data: analytics }     = useGetTrustAnalytics();
  const { data: classified }    = useListClassifiedAssets();

  const openIncidents  = incidents?.filter(i => !i.resolved).length ?? 0;
  const triggered      = deception?.filter(d => d.triggered).length ?? 0;
  const severedPaths   = analytics?.severedPaths ?? 0;
  const criticalAssets = classified?.filter(a => a.classification === "CRITICAL").length ?? 0;
  const activeUsers    = trustScores?.filter(t => t.score > 0).length ?? 0;
  const threatScore    = Math.round(riskScore?.score ?? 0);
  const trustScore     = Math.round(trustScoreData?.score ?? 0);
  const trustLevel     = trustScoreData?.level ?? "HEALTHY";

  const threatColor =
    (riskScore?.threatState === "RED")    ? "text-red-400"    :
    (riskScore?.threatState === "ORANGE") ? "text-orange-400" :
    (riskScore?.threatState === "YELLOW") ? "text-yellow-400" :
    "text-green-400";

  const trustColor =
    trustLevel === "CRITICAL" ? "text-red-400"    :
    trustLevel === "DEGRADED" ? "text-orange-400" :
    "text-green-400";

  return (
    <div className="bg-card/80 border-b border-border flex items-stretch overflow-x-auto shrink-0 h-14">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center px-3 border-r border-border/50 shrink-0 font-bold bg-background/20">
        GOVERNANCE<br/>METRICS
      </div>
      <Metric icon={Activity}  label="Threat Score"  value={threatScore}  sub={riskScore?.threatState}   color={threatColor} pulse={riskScore?.threatState === "RED"} />
      <Metric icon={ShieldAlert} label="Trust Score"  value={trustScore}  sub={trustLevel}               color={trustColor}  pulse={trustLevel === "CRITICAL"} />
      <Metric icon={Database}  label="Total Assets"  value={classified?.length ?? 0} sub={`${criticalAssets} critical`} />
      <Metric icon={Users}     label="Active Users"  value={activeUsers}   sub="monitored"  />
      <Metric icon={Scissors}  label="Severed Paths" value={severedPaths}  color={severedPaths > 0 ? "text-red-400" : "text-muted-foreground"} />
      <Metric icon={Zap}       label="Deception Hits" value={triggered}   color={triggered > 0 ? "text-red-400 animate-pulse" : "text-muted-foreground"} />
      <Metric icon={Lock}      label="Open Incidents" value={openIncidents} color={openIncidents > 0 ? "text-orange-400" : "text-green-400"} />
      <Metric icon={ShieldAlert} label="Trust Health" value={`${analytics?.trustHealthPercent ?? 100}%`} color={
        (analytics?.trustHealthPercent ?? 100) < 60 ? "text-red-400" :
        (analytics?.trustHealthPercent ?? 100) < 80 ? "text-orange-400" : "text-green-400"
      } />
    </div>
  );
}
