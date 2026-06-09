import { useEffect, useState } from "react";
import {
  useGetRiskScore,
  useListBreakers,
  useListEvents,
  useGetLockdownState,
  useListSnapshots,
  useListDeceptionAssets,
  useListIncidents,
  useListTrustScores,
  useGetRiskHistory,
  useInitiateLockdown,
  useLiftLockdown,
  useTripBreaker,
  useResetBreaker,
  useSimulateAttack,
  useSimulateReset,
  getGetRiskScoreQueryKey,
  getListBreakersQueryKey,
  getGetLockdownStateQueryKey,
} from "@workspace/api-client-react";
import { useBlackBoxWS } from "@/hooks/use-blackbox-ws";
import { TrustGraphPanel } from "@/components/TrustGraphPanel";
import { UserTrustModal } from "@/components/modals/UserTrustModal";
import { DeceptionAssetsModal } from "@/components/modals/DeceptionAssetsModal";
import { ForensicSnapshotsModal } from "@/components/modals/ForensicSnapshotsModal";
import { TrustGraphModal } from "@/components/modals/TrustGraphModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, ShieldAlert, Zap, Lock, Unlock, Shield,
  TerminalSquare, Play, RefreshCw, Cpu, Users, Camera,
  History, GitBranch, ExternalLink,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  if (status === "connected")
    return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">LINK ONLINE</Badge>;
  if (status === "connecting")
    return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 animate-pulse">CONNECTING</Badge>;
  return <Badge className="bg-red-500/20 text-red-500 border-red-500/50 animate-pulse">LINK OFFLINE</Badge>;
}

function ClickableCardTitle({
  icon: Icon,
  children,
  onClick,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full group hover:text-primary transition-colors"
    >
      <Icon className="w-3 h-3" />
      <span className="uppercase tracking-wider text-xs font-bold">{children}</span>
      <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-70 transition-opacity text-primary" />
    </button>
  );
}

const PHASE_LABELS = [
  "",
  "State Preservation",
  "Trust Severance",
  "Asset Protection",
  "Identity Reset",
];

export function Dashboard() {
  const { status } = useBlackBoxWS();
  const queryClient = useQueryClient();

  const { data: riskScore }   = useGetRiskScore({ query: { queryKey: getGetRiskScoreQueryKey() } });
  const { data: riskHistory } = useGetRiskHistory();
  const { data: breakersData }= useListBreakers({ query: { queryKey: getListBreakersQueryKey() } });
  const { data: eventsData }  = useListEvents({ limit: 100 });
  const { data: lockdown }    = useGetLockdownState({ query: { queryKey: getGetLockdownStateQueryKey() } });
  const { data: assets }      = useListDeceptionAssets();
  const { data: trustScores } = useListTrustScores();
  const { data: snapshots }   = useListSnapshots();
  const { data: incidents }   = useListIncidents();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetRiskScoreQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBreakersQueryKey() });
    }, 3000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const initiateLockdown = useInitiateLockdown();
  const liftLockdown     = useLiftLockdown();
  const tripBreaker      = useTripBreaker();
  const resetBreaker     = useResetBreaker();
  const simulateAttack   = useSimulateAttack();
  const simulateReset    = useSimulateReset();

  const handleSimulate = () => {
    simulateAttack.mutate(undefined, {
      onSuccess: () => toast({ title: "Simulation initiated" }),
      onError:   () => toast({ title: "Simulation failed", variant: "destructive" }),
    });
  };

  const handleReset = () => {
    simulateReset.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "System reset" });
        queryClient.invalidateQueries();
      },
    });
  };

  const [confirmLockdown, setConfirmLockdown] = useState(false);
  const handleLockdownClick = () => {
    if (!confirmLockdown) {
      setConfirmLockdown(true);
      setTimeout(() => setConfirmLockdown(false), 3000);
    } else {
      initiateLockdown.mutate();
      setConfirmLockdown(false);
    }
  };

  // Modal open states
  const [trustModal,     setTrustModal]     = useState(false);
  const [deceptionModal, setDeceptionModal] = useState(false);
  const [snapshotModal,  setSnapshotModal]  = useState(false);
  const [graphModal,     setGraphModal]     = useState(false);

  const threatColor =
    riskScore?.threatState === "RED"    ? "bg-threat-RED"    :
    riskScore?.threatState === "ORANGE" ? "bg-threat-ORANGE" :
    riskScore?.threatState === "YELLOW" ? "bg-threat-YELLOW" :
    "bg-threat-GREEN";

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col font-mono text-xs overflow-hidden">
      {/* Topbar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card z-10 relative">
        <div className="flex items-center gap-3">
          <TerminalSquare className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary">
            BLACKBOX <span className="text-muted-foreground text-[10px] ml-2">SYS.OP</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground tabular-nums tracking-widest">
            {new Date().toISOString().replace("T", " ").slice(0, -5)}
          </div>
          <StatusBadge status={status} />
        </div>
      </header>

      {/* Threat Banner */}
      <div className={`h-8 flex items-center justify-center font-bold tracking-[0.2em] transition-colors duration-500 uppercase ${threatColor}`}>
        THREAT CONDITION: {riskScore?.threatState || "UNKNOWN"}
      </div>

      {/* Main Grid */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden h-[calc(100vh-5rem)]">

        {/* ── Left Column ── */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">

          {/* Risk Gauge */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Activity className="w-3 h-3" /> System Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4 px-4">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted opacity-20" />
                  <circle
                    cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                    className={`transition-all duration-1000 ease-out ${
                      riskScore?.threatState === "RED"    ? "text-destructive"   :
                      riskScore?.threatState === "ORANGE" ? "text-orange-500"    :
                      riskScore?.threatState === "YELLOW" ? "text-yellow-500"    :
                      "text-primary"
                    }`}
                    strokeDasharray={`${(riskScore?.score || 0) * 2.827} 282.7`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-bold tabular-nums tracking-tighter">
                    {Math.round(riskScore?.score || 0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase mt-1">/ 100</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Containment Protocol */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" /> Containment Protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {lockdown?.active ? (
                <div className="space-y-3">
                  <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive font-bold text-center animate-pulse uppercase tracking-widest text-xs">
                    LOCKDOWN ACTIVE
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map((ph) => {
                      const done   = (lockdown.phase ?? 0) >= ph;
                      const active = (lockdown.phase ?? 0) === ph;
                      return (
                        <div key={ph} className={`flex items-center gap-2 text-[10px] transition-colors ${done ? "text-primary" : "text-muted-foreground/40"}`}>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[8px] font-bold
                            ${done ? "border-primary bg-primary/20" : "border-muted-foreground/30"}
                            ${active ? "animate-pulse" : ""}`}>
                            {ph}
                          </div>
                          <span className="uppercase tracking-wider font-bold">{PHASE_LABELS[ph]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="w-full border-primary text-primary hover:bg-primary/20 h-8"
                    onClick={() => liftLockdown.mutate()}
                    disabled={liftLockdown.isPending}
                  >
                    <Unlock className="w-3 h-3 mr-2" /> LIFT LOCKDOWN
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  className={`w-full h-12 text-sm font-bold tracking-widest uppercase transition-all ${confirmLockdown ? "bg-red-700 animate-pulse" : ""}`}
                  onClick={handleLockdownClick}
                  disabled={initiateLockdown.isPending}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {confirmLockdown ? "DOUBLE CLICK TO CONFIRM" : "INITIATE LOCKDOWN"}
                </Button>
              )}

              <div className="pt-3 border-t border-border flex gap-2">
                <Button variant="secondary" className="flex-1 h-8 text-[10px]" onClick={handleSimulate} disabled={simulateAttack.isPending}>
                  <Play className="w-3 h-3 mr-2" /> SIMULATE
                </Button>
                <Button variant="secondary" className="flex-1 h-8 text-[10px]" onClick={handleReset} disabled={simulateReset.isPending}>
                  <RefreshCw className="w-3 h-3 mr-2" /> RESET
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User Trust Scores — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setTrustModal(true)}>
            <CardHeader className="pb-2 pt-3 px-4 shrink-0">
              <CardTitle className="text-xs text-muted-foreground">
                <ClickableCardTitle icon={Users} onClick={() => setTrustModal(true)}>
                  User Trust Scores
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-4 pb-4 overflow-y-auto max-h-[150px]">
              {trustScores?.map((t) => (
                <div key={t.user} className="flex items-center justify-between p-1.5 border-b border-border/50">
                  <span className="truncate flex-1 text-[10px]">{t.user}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${t.score > 80 ? "bg-green-500" : t.score > 50 ? "bg-yellow-500" : "bg-destructive"}`}
                        style={{ width: `${t.score}%` }}
                      />
                    </div>
                    <span className={`tabular-nums font-bold text-[10px] w-8 text-right ${t.score < 50 ? "text-destructive" : t.score < 80 ? "text-yellow-500" : "text-primary"}`}>
                      {t.score.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>

        {/* ── Middle Column ── */}
        <div className="col-span-6 flex flex-col gap-4 overflow-hidden">

          {/* Live Event Feed */}
          <Card className="flex-[2] flex flex-col border-border bg-card/50 backdrop-blur overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 shrink-0">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Zap className="w-3 h-3" /> Live Event Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 pb-4">
              <div className="space-y-px px-4 font-mono">
                {eventsData?.events.map((evt) => {
                  const isAlert   = evt.eventType.includes("LOCKDOWN") || evt.eventType.includes("TRIGGERED") || evt.threatState === "RED" || evt.eventType.includes("IDENTITY_RESET");
                  const isWarning = evt.eventType.includes("FAILED") || evt.eventType.includes("ANOMALY") || evt.threatState === "ORANGE" || evt.eventType.includes("BREAKER");
                  return (
                    <div key={evt.id}
                      className={`text-[10px] p-1.5 border-l-2 flex items-start gap-3 transition-colors
                        ${isAlert   ? "bg-destructive/10 border-destructive text-destructive-foreground" :
                          isWarning ? "bg-yellow-500/10 border-yellow-500 text-yellow-500" :
                          "bg-background/30 border-primary/30 hover:bg-background/50 hover:border-primary"}`}>
                      <span className="text-muted-foreground tabular-nums shrink-0 w-16">{new Date(evt.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                      <span className={`font-bold shrink-0 w-36 truncate ${isAlert ? "text-destructive" : isWarning ? "text-yellow-500" : "text-primary"}`}>{evt.eventType}</span>
                      <span className="text-muted-foreground shrink-0 w-20 truncate">{evt.user}</span>
                      <span className="flex-1 truncate opacity-80">{evt.details}</span>
                      {evt.riskDelta > 0 && <span className="text-destructive font-bold ml-auto tabular-nums">+{evt.riskDelta}</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Incident History */}
          <Card className="flex-[1] flex flex-col border-border bg-card/50 backdrop-blur overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 shrink-0">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <History className="w-3 h-3" /> Incident History
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 pb-4">
              <div className="space-y-px px-4 font-mono">
                {incidents?.map((inc) => (
                  <div key={inc.id} className="text-[10px] p-2 border-b border-border/50 flex flex-col gap-1 hover:bg-background/30 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-destructive truncate">{inc.id.slice(0, 8)}…</span>
                      <span className="text-muted-foreground">{new Date(inc.startTime).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">State: <span className="font-bold text-primary">{inc.threatStateReached}</span></span>
                      <span className="text-muted-foreground">Peak: <span className="font-bold text-destructive">{inc.peakRiskScore}</span></span>
                      <Badge variant={inc.resolved ? "outline" : "destructive"} className="text-[8px] h-4 px-1">
                        {inc.resolved ? "RESOLVED" : "ACTIVE"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {!incidents?.length && (
                  <div className="text-[10px] text-muted-foreground text-center py-4">No recent incidents recorded</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column ── */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">

          {/* Circuit Breakers */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Shield className="w-3 h-3" /> Circuit Breakers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {breakersData?.breakers.map((breaker) => (
                <div key={breaker.name} className="flex items-center justify-between p-2 border border-border rounded bg-background/50">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider">
                      {breaker.label ?? breaker.name.replace(/_/g, " ")}
                    </div>
                    <div className={`text-[9px] uppercase tracking-widest font-bold ${
                      breaker.status === "TRIPPED" ? "text-destructive animate-pulse" :
                      breaker.status === "RESET"   ? "text-yellow-500"               :
                      "text-green-500"}`}>
                      {breaker.status}
                    </div>
                  </div>
                  {breaker.status === "TRIPPED" ? (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] border-primary text-primary px-2"
                      onClick={() => resetBreaker.mutate({ name: breaker.name })}>
                      RESET
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] hover:bg-destructive hover:text-white px-2"
                      onClick={() => tripBreaker.mutate({ name: breaker.name, data: { reason: "Operator trip" } })}>
                      TRIP
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Deception Assets — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setDeceptionModal(true)}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">
                <ClickableCardTitle icon={Cpu} onClick={() => setDeceptionModal(true)}>
                  Deception Assets
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-4 pb-4 max-h-[140px] overflow-y-auto">
              {assets?.length ? assets.map((asset) => (
                <div key={asset.id} className="text-[10px] flex items-center justify-between p-1.5 border border-border/50 rounded bg-background/30">
                  <span className="truncate flex-1 font-mono opacity-80">{asset.path.split("/").pop()}</span>
                  {asset.triggered ? (
                    <Badge variant="destructive" className="ml-2 text-[9px] px-1 py-0 h-4 animate-pulse">TRIGGERED</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 border-primary/50 text-primary bg-primary/5 text-[9px] px-1 py-0 h-4">ACTIVE</Badge>
                  )}
                </div>
              )) : (
                <div className="text-[10px] text-muted-foreground text-center py-2">No deception assets deployed</div>
              )}
            </CardContent>
          </Card>

          {/* Forensic Snapshots — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSnapshotModal(true)}>
            <CardHeader className="pb-2 pt-3 px-4 shrink-0">
              <CardTitle className="text-xs text-muted-foreground">
                <ClickableCardTitle icon={Camera} onClick={() => setSnapshotModal(true)}>
                  Forensic Snapshots
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-4 pb-4 max-h-[120px] overflow-y-auto">
              {snapshots?.map((snap) => (
                <div key={snap.id} className="flex flex-col p-1.5 border-b border-border/50 bg-background/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-muted-foreground">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                    <span className="text-[10px] font-bold text-destructive">Risk: {snap.triggerRiskScore}</span>
                  </div>
                  <span className="text-[9px] font-mono text-primary truncate">{snap.id.slice(0, 16)}…</span>
                </div>
              ))}
              {!snapshots?.length && (
                <div className="text-[10px] text-muted-foreground text-center py-2">No snapshots</div>
              )}
            </CardContent>
          </Card>

          {/* Trust Graph — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur flex-1 flex flex-col min-h-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setGraphModal(true)}>
            <CardHeader className="pb-2 pt-3 px-4 shrink-0">
              <CardTitle className="text-xs text-muted-foreground">
                <ClickableCardTitle icon={GitBranch} onClick={() => setGraphModal(true)}>
                  Trust Graph
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 overflow-auto flex-1">
              <TrustGraphPanel />
            </CardContent>
          </Card>

        </div>
      </main>

      {/* ── Detail Modals ── */}
      <UserTrustModal      open={trustModal}     onClose={() => setTrustModal(false)}     />
      <DeceptionAssetsModal open={deceptionModal} onClose={() => setDeceptionModal(false)} />
      <ForensicSnapshotsModal open={snapshotModal} onClose={() => setSnapshotModal(false)} />
      <TrustGraphModal     open={graphModal}     onClose={() => setGraphModal(false)}     />
    </div>
  );
}
