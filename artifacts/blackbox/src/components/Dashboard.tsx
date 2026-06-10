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
  getGetTrustScoreQueryKey,
  getGetTrustAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { useBlackBoxWS } from "@/hooks/use-blackbox-ws";
import { TrustGraphPanel } from "@/components/TrustGraphPanel";
import { ExecutiveMetricsBar } from "@/components/ExecutiveMetricsBar";
import { DualScoreGauges } from "@/components/DualScoreGauges";
import { TrustPathAnalytics } from "@/components/TrustPathAnalytics";
import { AssetClassificationPanel } from "@/components/AssetClassificationPanel";
import { NarrativePanel } from "@/components/NarrativePanel";
import { IdentityResetCard } from "@/components/IdentityResetCard";
import { UserTrustModal } from "@/components/modals/UserTrustModal";
import { DeceptionAssetsModal } from "@/components/modals/DeceptionAssetsModal";
import { ForensicSnapshotsModal } from "@/components/modals/ForensicSnapshotsModal";
import { TrustGraphModal } from "@/components/modals/TrustGraphModal";
import { AssetClassificationModal } from "@/components/modals/AssetClassificationModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, ShieldAlert, Zap, Lock, Unlock, Shield,
  TerminalSquare, Play, RefreshCw, Cpu, Users, Camera,
  History, GitBranch, ExternalLink, KeyRound, Database,
  Terminal,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  if (status === "connected")
    return <Badge className="bg-green-500/20 text-green-500 border-green-500/50 text-[9px] h-5">LINK ONLINE</Badge>;
  if (status === "connecting")
    return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 animate-pulse text-[9px] h-5">CONNECTING</Badge>;
  return <Badge className="bg-red-500/20 text-red-500 border-red-500/50 animate-pulse text-[9px] h-5">LINK OFFLINE</Badge>;
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
      <span className="uppercase tracking-wider text-[10px] font-bold">{children}</span>
      <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-0 group-hover:opacity-70 transition-opacity text-primary" />
    </button>
  );
}

const PHASE_LABELS = ["", "State Preservation", "Trust Severance", "Asset Protection", "Identity Reset"];

const EVENT_CLASS = (evt: { eventType: string; threatState: string }) => {
  const t = evt.eventType;
  if (t.includes("LOCKDOWN") || t.includes("TRIGGERED") || evt.threatState === "RED" || t.includes("IDENTITY_RESET"))
    return "bg-destructive/10 border-destructive text-destructive-foreground";
  if (t.includes("FAILED") || t.includes("ANOMALY") || evt.threatState === "ORANGE" || t.includes("BREAKER"))
    return "bg-yellow-500/10 border-yellow-500 text-yellow-500";
  return "bg-background/30 border-primary/30 hover:bg-background/50 hover:border-primary";
};

export function Dashboard() {
  const { status } = useBlackBoxWS();
  const queryClient = useQueryClient();

  const { data: riskScore }    = useGetRiskScore({ query: { queryKey: getGetRiskScoreQueryKey() } });
  const { data: breakersData } = useListBreakers({ query: { queryKey: getListBreakersQueryKey() } });
  const { data: eventsData }   = useListEvents({ limit: 100 });
  const { data: lockdown }     = useGetLockdownState({ query: { queryKey: getGetLockdownStateQueryKey() } });
  const { data: assets }       = useListDeceptionAssets();
  const { data: trustScores }  = useListTrustScores();
  const { data: snapshots }    = useListSnapshots();
  const { data: incidents }    = useListIncidents();

  useGetRiskHistory();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetRiskScoreQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBreakersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTrustScoreQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTrustAnalyticsQueryKey() });
    }, 5000);
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
        toast({ title: "System reset to baseline" });
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

  const [trustModal,     setTrustModal]     = useState(false);
  const [deceptionModal, setDeceptionModal] = useState(false);
  const [snapshotModal,  setSnapshotModal]  = useState(false);
  const [graphModal,     setGraphModal]     = useState(false);
  const [assetModal,     setAssetModal]     = useState(false);

  const threatColor =
    riskScore?.threatState === "RED"    ? "bg-threat-RED"    :
    riskScore?.threatState === "ORANGE" ? "bg-threat-ORANGE" :
    riskScore?.threatState === "YELLOW" ? "bg-threat-YELLOW" :
    "bg-threat-GREEN";

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col font-mono text-xs overflow-hidden">

      {/* ── Header ── */}
      <header className="h-10 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card z-10 relative">
        <div className="flex items-center gap-3">
          <TerminalSquare className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold tracking-widest uppercase text-primary">
            BLACKBOX
            <span className="text-muted-foreground text-[9px] ml-2 font-normal">Cyber Governance Layer · v2.1</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground tabular-nums tracking-widest text-[10px]">
            {new Date().toISOString().replace("T", " ").slice(0, -5)}
          </span>
          <StatusBadge status={status} />
        </div>
      </header>

      {/* ── Threat Banner ── */}
      <div className={`h-7 flex items-center justify-center font-bold tracking-[0.25em] text-[11px] transition-colors duration-500 uppercase ${threatColor}`}>
        THREAT CONDITION: {riskScore?.threatState || "UNKNOWN"}
      </div>

      {/* ── Executive Metrics Bar ── */}
      <ExecutiveMetricsBar />

      {/* ── Main Grid ── */}
      <main className="flex-1 p-3 grid grid-cols-12 grid-rows-1 gap-3 overflow-hidden" style={{ height: "calc(100vh - 8.5rem)" }}>

        {/* ═══════════════ LEFT COLUMN ═══════════════ */}
        <div className="col-span-3 flex flex-col gap-3 overflow-y-auto pr-0.5">

          {/* Dual Score Gauges */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-0 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <Activity className="w-3 h-3" /> Threat · Trust Scores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DualScoreGauges />
            </CardContent>
          </Card>

          {/* Trust Path Analytics */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <GitBranch className="w-3 h-3" /> Trust Path Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <TrustPathAnalytics />
            </CardContent>
          </Card>

          {/* Containment Protocol */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <ShieldAlert className="w-3 h-3" /> Containment Protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {lockdown?.active ? (
                <div className="space-y-2">
                  <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive font-bold text-center animate-pulse uppercase tracking-widest text-[10px]">
                    LOCKDOWN ACTIVE
                  </div>
                  <div className="space-y-1">
                    {[1, 2, 3, 4].map((ph) => {
                      const done   = (lockdown.phase ?? 0) >= ph;
                      const active = (lockdown.phase ?? 0) === ph;
                      return (
                        <div key={ph} className={`flex items-center gap-2 text-[9px] transition-colors ${done ? "text-primary" : "text-muted-foreground/40"}`}>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 text-[7px] font-bold
                            ${done ? "border-primary bg-primary/20" : "border-muted-foreground/30"}
                            ${active ? "animate-pulse" : ""}`}>
                            {ph}
                          </div>
                          <span className="uppercase tracking-wider font-bold">{PHASE_LABELS[ph]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm"
                    className="w-full border-primary text-primary hover:bg-primary/20 h-7 text-[10px]"
                    onClick={() => liftLockdown.mutate()} disabled={liftLockdown.isPending}>
                    <Unlock className="w-3 h-3 mr-1.5" /> LIFT LOCKDOWN
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  className={`w-full h-10 text-[11px] font-bold tracking-widest uppercase transition-all ${confirmLockdown ? "bg-red-700 animate-pulse" : ""}`}
                  onClick={handleLockdownClick}
                  disabled={initiateLockdown.isPending}>
                  <Lock className="w-3.5 h-3.5 mr-2" />
                  {confirmLockdown ? "CONFIRM LOCKDOWN" : "INITIATE LOCKDOWN"}
                </Button>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1 h-7 text-[9px]" onClick={handleSimulate} disabled={simulateAttack.isPending}>
                  <Play className="w-2.5 h-2.5 mr-1" /> SIMULATE
                </Button>
                <Button variant="secondary" className="flex-1 h-7 text-[9px]" onClick={handleReset} disabled={simulateReset.isPending}>
                  <RefreshCw className="w-2.5 h-2.5 mr-1" /> RESET
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User Trust Scores — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setTrustModal(true)}>
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground">
                <ClickableCardTitle icon={Users} onClick={() => setTrustModal(true)}>
                  User Trust Scores
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-3 pb-3 max-h-36 overflow-y-auto">
              {trustScores?.map((t) => (
                <div key={t.user} className="flex items-center justify-between">
                  <span className="truncate flex-1 text-[9px]">{t.user}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-14 h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${t.score > 80 ? "bg-green-500" : t.score > 50 ? "bg-yellow-500" : "bg-destructive"}`}
                        style={{ width: `${t.score}%` }}
                      />
                    </div>
                    <span className={`tabular-nums font-bold text-[9px] w-7 text-right ${t.score < 50 ? "text-destructive" : t.score < 80 ? "text-yellow-500" : "text-primary"}`}>
                      {t.score.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>

        {/* ═══════════════ MIDDLE COLUMN ═══════════════ */}
        <div className="col-span-6 flex flex-col gap-3 overflow-hidden min-h-0" style={{ height: "calc(100vh - 8.5rem - 1.5rem)" }}>

          {/* Governance Narrative */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <Terminal className="w-3 h-3 text-primary" />
                <span className="text-primary">Governance Narrative</span>
                <span className="ml-auto text-[8px] text-muted-foreground normal-case font-normal italic">auto-generated · rule-based</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <NarrativePanel />
            </CardContent>
          </Card>

          {/* Event Feed + Incident Timeline — sub-container owns the remaining height */}
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">

            {/* Live Event Feed */}
            <Card className="flex-1 flex flex-col border-border bg-card/50 backdrop-blur overflow-hidden min-h-0">
              <CardHeader className="pb-1 pt-2 px-3 shrink-0">
                <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Live Governance Event Stream
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0 pb-2 min-h-0">
                <div className="space-y-px px-3 font-mono">
                  {eventsData?.events.map((evt) => (
                    <div key={evt.id}
                      className={`text-[9px] p-1 border-l-2 flex items-start gap-2 transition-colors ${EVENT_CLASS(evt)}`}>
                      <span className="text-muted-foreground tabular-nums shrink-0 w-14">{new Date(evt.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                      <span className={`font-bold shrink-0 w-32 truncate ${evt.threatState === "RED" || evt.eventType.includes("LOCKDOWN") ? "text-destructive" : evt.threatState === "ORANGE" ? "text-yellow-500" : "text-primary"}`}>{evt.eventType}</span>
                      <span className="text-muted-foreground shrink-0 w-16 truncate">{evt.user}</span>
                      <span className="flex-1 truncate opacity-80">{evt.details}</span>
                      {evt.riskDelta > 0 && <span className="text-destructive font-bold ml-auto tabular-nums">+{evt.riskDelta}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Incident Command Timeline */}
            <Card className="flex-1 flex flex-col border-border bg-card/50 backdrop-blur overflow-hidden min-h-0">
              <CardHeader className="pb-1 pt-2 px-3 shrink-0">
                <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                  <History className="w-3 h-3" /> Incident Command Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0 pb-2 min-h-0">
                <div className="space-y-px px-3 font-mono">
                  {incidents?.map((inc) => (
                    <div key={inc.id} className="text-[9px] p-1.5 border-b border-border/50 flex flex-col gap-0.5 hover:bg-background/30 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-destructive truncate">{inc.id.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">{new Date(inc.startTime).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Peak state: <span className="font-bold text-primary">{inc.threatStateReached}</span></span>
                        <span className="text-muted-foreground">Risk: <span className="font-bold text-destructive">{inc.peakRiskScore}</span></span>
                        <Badge variant={inc.resolved ? "outline" : "destructive"} className="text-[7px] h-3.5 px-1">
                          {inc.resolved ? "RESOLVED" : "ACTIVE"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {!incidents?.length && (
                    <div className="text-[9px] text-muted-foreground text-center py-3">No governance incidents recorded</div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

        </div>

        {/* ═══════════════ RIGHT COLUMN ═══════════════ */}
        <div className="col-span-3 flex flex-col gap-3 overflow-y-auto pr-0.5">

          {/* Circuit Breakers */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <Shield className="w-3 h-3" /> Trust Path Breakers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-3 pb-3">
              {breakersData?.breakers.map((breaker) => (
                <div key={breaker.name} className={`flex items-center justify-between p-1.5 border rounded transition-colors ${
                  breaker.status === "TRIPPED" ? "border-destructive/40 bg-destructive/5" : "border-border bg-background/50"
                }`}>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider">
                      {breaker.label ?? breaker.name.replace(/_/g, " ")}
                    </div>
                    <div className={`text-[8px] uppercase tracking-widest font-bold ${
                      breaker.status === "TRIPPED" ? "text-destructive animate-pulse" :
                      breaker.status === "RESET"   ? "text-yellow-500" : "text-green-500"}`}>
                      {breaker.status}
                      {breaker.trippedAt && ` · ${new Date(breaker.trippedAt).toLocaleTimeString([], { hour12: false })}`}
                    </div>
                    {breaker.reason && (
                      <div className="text-[7px] text-muted-foreground truncate max-w-[130px]">{breaker.reason}</div>
                    )}
                  </div>
                  {breaker.status === "TRIPPED" ? (
                    <Button size="sm" variant="outline" className="h-5 text-[8px] border-primary text-primary px-1.5"
                      onClick={() => resetBreaker.mutate({ name: breaker.name })}>
                      RESET
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-5 text-[8px] hover:bg-destructive hover:text-white px-1.5"
                      onClick={() => tripBreaker.mutate({ name: breaker.name, data: { reason: "Operator override" } })}>
                      TRIP
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Identity Reset Status */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0">
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
                <KeyRound className="w-3 h-3" /> Identity Reset Protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <IdentityResetCard />
            </CardContent>
          </Card>

          {/* Asset Classification — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setAssetModal(true)}>
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground">
                <ClickableCardTitle icon={Database} onClick={() => setAssetModal(true)}>
                  Asset Classification Registry
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
              <AssetClassificationPanel />
            </CardContent>
          </Card>

          {/* Deception Assets — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setDeceptionModal(true)}>
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground">
                <ClickableCardTitle icon={Cpu} onClick={() => setDeceptionModal(true)}>
                  Deception Assets
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-3 pb-3 max-h-28 overflow-y-auto">
              {assets?.length ? assets.map((asset) => (
                <div key={asset.id} className="text-[9px] flex items-center justify-between border border-border/50 rounded p-1 bg-background/30">
                  <span className="truncate flex-1 font-mono opacity-80">{asset.path.split("/").pop()}</span>
                  {asset.triggered ? (
                    <Badge variant="destructive" className="ml-1 text-[7px] px-1 py-0 h-3.5 animate-pulse">TRIGGERED</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1 border-primary/50 text-primary bg-primary/5 text-[7px] px-1 py-0 h-3.5">ACTIVE</Badge>
                  )}
                </div>
              )) : (
                <div className="text-[9px] text-muted-foreground text-center py-1">No deception assets deployed</div>
              )}
            </CardContent>
          </Card>

          {/* Forensic Snapshots — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSnapshotModal(true)}>
            <CardHeader className="pb-1 pt-2 px-3">
              <CardTitle className="text-[9px] text-muted-foreground">
                <ClickableCardTitle icon={Camera} onClick={() => setSnapshotModal(true)}>
                  State Preservation Snapshots
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-3 pb-3 max-h-24 overflow-y-auto">
              {snapshots?.map((snap) => (
                <div key={snap.id} className="flex items-center justify-between border-b border-border/50 pb-0.5">
                  <span className="text-[8px] text-muted-foreground">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                  <span className="text-[9px] font-bold text-destructive">Risk {snap.triggerRiskScore}</span>
                  <span className="text-[8px] font-mono text-primary truncate max-w-[80px]">{snap.id.slice(0, 8)}…</span>
                </div>
              ))}
              {!snapshots?.length && (
                <div className="text-[9px] text-muted-foreground text-center py-1">No snapshots</div>
              )}
            </CardContent>
          </Card>

          {/* Trust Graph — clickable */}
          <Card className="border-border bg-card/50 backdrop-blur flex-1 flex flex-col min-h-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setGraphModal(true)}>
            <CardHeader className="pb-1 pt-2 px-3 shrink-0">
              <CardTitle className="text-[9px] text-muted-foreground">
                <ClickableCardTitle icon={GitBranch} onClick={() => setGraphModal(true)}>
                  Trust Graph
                </ClickableCardTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 overflow-auto flex-1">
              <TrustGraphPanel />
            </CardContent>
          </Card>

        </div>
      </main>

      {/* ── Detail Modals ── */}
      <UserTrustModal           open={trustModal}     onClose={() => setTrustModal(false)}     />
      <DeceptionAssetsModal     open={deceptionModal} onClose={() => setDeceptionModal(false)} />
      <ForensicSnapshotsModal   open={snapshotModal}  onClose={() => setSnapshotModal(false)}  />
      <TrustGraphModal          open={graphModal}     onClose={() => setGraphModal(false)}     />
      <AssetClassificationModal open={assetModal}     onClose={() => setAssetModal(false)}     />
    </div>
  );
}
