import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGetTrustGraph, useSeverTrustEdge, useListUsers,
  useGetFileAccessPolicy, useListIncidents, useGetLockdownState,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  GitBranch, Scissors, Shield, Cpu, AppWindow, Database,
  User, Wifi, AlertTriangle, CheckCircle, X, Activity,
  Brain, ChevronRight, Lock, Zap, Eye, RefreshCw,
} from "lucide-react";
import { displayUserName } from "@/lib/userLabels";

/* ──────────────────────────────────────────────── types ──── */
type PathState = "TRUSTED"|"SUSPICIOUS"|"ELEVATED"|"COMPROMISED"|"SEVERED"|"RECOVERED"|"CONTAINED";
interface TrustNode { id: string; type: string; name: string; trustScore: number; classification: string|null; riskState: string; }
interface TrustEdge { id: string; fromNodeId: string; toNodeId: string; trustScore: number; severed: boolean; severedAt: string|null; }
type SelectedItem = { kind: "node"; node: TrustNode } | { kind: "edge"; edge: TrustEdge; from: TrustNode; to: TrustNode } | null;

/* ──────────────────────────────────────────────── colours ── */
const RISK_BORDER: Record<string,string> = {
  NORMAL:"#22c55e", DEGRADED:"#eab308", COMPROMISED:"#ef4444", CONTAINED:"#6b7280", RECOVERED:"#3b82f6",
};
const PATH_CFG: Record<PathState,{ stroke:string; dasharray?:string; opacity:number; animCls?:string }> = {
  TRUSTED:     { stroke:"#22c55e", opacity:0.50, animCls:"tgm-flow-normal" },
  SUSPICIOUS:  { stroke:"#eab308", opacity:0.75, dasharray:"6 5",  animCls:"tgm-flow-suspicious" },
  ELEVATED:    { stroke:"#f97316", opacity:0.82, dasharray:"5 4",  animCls:"tgm-flow-elevated" },
  COMPROMISED: { stroke:"#ef4444", opacity:0.88, dasharray:"4 3",  animCls:"tgm-flow-compromised" },
  SEVERED:     { stroke:"#ef4444", opacity:0.36, dasharray:"4 3" },
  RECOVERED:   { stroke:"#3b82f6", opacity:0.70, animCls:"tgm-flow-recovered" },
  CONTAINED:   { stroke:"#6b7280", opacity:0.32, dasharray:"2 5" },
};
const CLASS_CFG: Record<string,{ bg:string; color:string; label:string }> = {
  "TOP SECRET":   { bg:"#7c3aed22", color:"#a78bfa", label:"TOP SECRET"   },
  "CRITICAL":     { bg:"#ef444422", color:"#f87171", label:"CRITICAL"      },
  "RESTRICTED":   { bg:"#ea580c22", color:"#fb923c", label:"RESTRICTED"    },
  "CONFIDENTIAL": { bg:"#f9731622", color:"#fb923c", label:"CONFIDENTIAL"  },
  "INTERNAL":     { bg:"#eab30822", color:"#facc15", label:"INTERNAL"      },
  "PUBLIC":       { bg:"#22c55e22", color:"#4ade80", label:"PUBLIC"        },
};
const CLASS_BADGE_SHORT: Record<string,{ bg:string; label:string }> = {
  "TOP SECRET":   { bg:"#7c3aed", label:"TS" },
  "CRITICAL":     { bg:"#ef4444", label:"CR" },
  "RESTRICTED":   { bg:"#ea580c", label:"RX" },
  "CONFIDENTIAL": { bg:"#f97316", label:"CF" },
  "INTERNAL":     { bg:"#ca8a04", label:"IN" },
  "PUBLIC":       { bg:"#16a34a", label:"PB" },
};

/* ──────────────────────────────────────────────── enrichment ── */
const DEVICE_META: Record<string,{ os:string; patch:string; edr:string; lastScan:string; processes:string[] }> = {
  "WKSTN-ADMIN-01":   { os:"Windows 11 Enterprise", patch:"Fully Patched",   edr:"CrowdStrike Active",   lastScan:"2h ago",  processes:["explorer.exe","Excel.exe","winlogon.exe","chrome.exe"] },
  "WKSTN-ANALYST-02": { os:"Windows 11 Enterprise", patch:"Fully Patched",   edr:"CrowdStrike Active",   lastScan:"4h ago",  processes:["ssh.exe","python3.exe","SecurityCenter.exe","chrome.exe"] },
  "UNKNOWN-DEVICE":   { os:"Unknown / Unregistered", patch:"Unknown",        edr:"Not Detected",          lastScan:"Never",   processes:["cmd.exe","powershell.exe"] },
};
const APP_META: Record<string,{ version:string; privilege:string; state:string; risk:string }> = {
  "Excel":      { version:"2405.17029", privilege:"User",          state:"Running",          risk:"Low"  },
  "SSH Client": { version:"OpenSSH 8.9", privilege:"Elevated",    state:"Active Session",   risk:"Medium" },
  "cmd.exe":    { version:"Windows 10.0", privilege:"Administrator", state:"Suspicious",    risk:"High" },
};

/* ──────────────────────────────────────────────── layout ── */
const TYPE_ORDER = ["USER","DEVICE","APPLICATION","ASSET"] as const;
const COL_X: Record<string,number>  = { USER:100, DEVICE:285, APPLICATION:465, ASSET:648 };
const COL_LABEL: Record<string,string> = { USER:"USERS", DEVICE:"DEVICES", APPLICATION:"APPS", ASSET:"ASSETS" };
const NODE_W=114, NODE_H=30, NODE_RX=4, ROW_GAP=46, TOP_PAD=44;

/* ──────────────────────────────────────────────── SVG CSS ── */
const SVG_STYLE = `
  .tgm-flow-normal     { stroke-dasharray:6 14; animation: tgmFlowN  3.0s linear infinite; }
  .tgm-flow-suspicious { stroke-dasharray:5 9;  animation: tgmFlowS  2.2s linear infinite; }
  .tgm-flow-elevated   { stroke-dasharray:5 6;  animation: tgmFlowE  1.6s linear infinite; }
  .tgm-flow-compromised{ stroke-dasharray:4 4;  animation: tgmFlowC  0.9s linear infinite; }
  .tgm-flow-recovered  { stroke-dasharray:6 12; animation: tgmFlowR  2.5s linear infinite; }
  .tgm-pulse-comp { animation: tgmPulseComp 1.3s ease-in-out infinite; }
  .tgm-pulse-deg  { animation: tgmPulseDeg  2.0s ease-in-out infinite; }
  @keyframes tgmFlowN { from{stroke-dashoffset:20} to{stroke-dashoffset:0} }
  @keyframes tgmFlowS { from{stroke-dashoffset:14} to{stroke-dashoffset:0} }
  @keyframes tgmFlowE { from{stroke-dashoffset:11} to{stroke-dashoffset:0} }
  @keyframes tgmFlowC { from{stroke-dashoffset: 8} to{stroke-dashoffset:0} }
  @keyframes tgmFlowR { from{stroke-dashoffset:18} to{stroke-dashoffset:0} }
  @keyframes tgmPulseComp { 0%,100%{opacity:.22} 50%{opacity:.65} }
  @keyframes tgmPulseDeg  { 0%,100%{opacity:.18} 50%{opacity:.48} }
`;

/* ──────────────────────────────────────────────── helpers ── */
function pathStateFor(edge: TrustEdge, from?: TrustNode, to?: TrustNode): PathState {
  if (edge.severed) return "SEVERED";
  const f = from?.riskState ?? "NORMAL", t = to?.riskState ?? "NORMAL";
  if (f==="CONTAINED"   || t==="CONTAINED")   return "CONTAINED";
  if (f==="COMPROMISED" || t==="COMPROMISED") return "COMPROMISED";
  if (f==="RECOVERED"   || t==="RECOVERED")   return "RECOVERED";
  if (f==="DEGRADED"    || t==="DEGRADED")    return edge.trustScore < 50 ? "ELEVATED" : "SUSPICIOUS";
  if (edge.trustScore < 40) return "ELEVATED";
  if (edge.trustScore < 65) return "SUSPICIOUS";
  return "TRUSTED";
}

function stateColor(s: string) {
  const m: Record<string,string> = { NORMAL:"#22c55e", DEGRADED:"#eab308", COMPROMISED:"#ef4444", CONTAINED:"#6b7280", RECOVERED:"#3b82f6" };
  return m[s] ?? "#6b7280";
}

function stateLabel(s: string) {
  const m: Record<string,string> = { NORMAL:"Healthy", DEGRADED:"Suspicious", COMPROMISED:"Compromised", CONTAINED:"Contained", RECOVERED:"Recovered" };
  return m[s] ?? s;
}

function trustTrend(score: number) {
  if (score >= 90) return { icon:"↑", color:"text-green-400"  };
  if (score >= 70) return { icon:"→", color:"text-yellow-400" };
  if (score >= 50) return { icon:"↓", color:"text-orange-400" };
  return { icon:"↓↓", color:"text-red-400" };
}

/* ──────────────────────────────────────────────── AI insights ── */
function generateInsights(nodes: TrustNode[], edges: TrustEdge[]) {
  const insights: { icon: string; message: string; confidence: number; type: string; actions: string[] }[] = [];
  const compromised = nodes.filter(n => n.riskState === "COMPROMISED");
  const degraded    = nodes.filter(n => n.riskState === "DEGRADED");
  const severed     = edges.filter(e => e.severed);
  const lowTrust    = edges.filter(e => !e.severed && e.trustScore < 45);

  if (compromised.length > 0) {
    insights.push({
      icon:"🔴", type:"Active Compromise",
      message:`${compromised.map(n => n.type === "USER" ? displayUserName(n.name) : n.name).join(", ")} in COMPROMISED state.`,
      confidence: 94,
      actions:["Sever all compromised paths","Deploy honeyfiles","Initiate Phase 2 Lockdown","Rotate credentials"],
    });
  }
  if (degraded.length > 0 && compromised.length === 0) {
    insights.push({
      icon:"🟡", type:"Elevated Risk Detected",
      message:`${degraded.map(n => n.type === "USER" ? displayUserName(n.name) : n.name).join(", ")} showing anomalous behaviour.`,
      confidence: 76,
      actions:["Trip User → Asset breaker","Enable enhanced monitoring","Review recent access logs"],
    });
  }
  if (lowTrust.length > 0) {
    insights.push({
      icon:"🟠", type:"High-Risk Trust Relationships",
      message:`${lowTrust.length} active relationship(s) operating below 45% trust.`,
      confidence: 81,
      actions:["Review low-trust edges","Consider path containment","Deploy deception assets near critical resources"],
    });
  }
  if (severed.length > 0 && compromised.length === 0 && degraded.length === 0) {
    insights.push({
      icon:"🔵", type:"Recovery In Progress",
      message:`${severed.length} severed path(s) detected. System appears to be recovering.`,
      confidence: 88,
      actions:["Verify containment effectiveness","Monitor for lateral movement","Confirm identity resets complete"],
    });
  }
  if (insights.length === 0) {
    insights.push({
      icon:"🟢", type:"No Active Threats",
      message:"All trust relationships are healthy. No anomalous activity detected across the graph.",
      confidence: 97,
      actions:["Continue standard monitoring","Maintain current trust baselines"],
    });
  }
  return insights;
}

/* ──────────────────────────────────────────────── Node detail ── */
function NodeDetail({ node, users, policy, onClose }: {
  node: TrustNode;
  users: any[];
  policy: any;
  onClose: () => void;
}) {
  const user    = users.find(u => u.name === node.name);
  const profile = policy?.profiles?.find((p: any) => p.userName === node.name);
  const deviceMeta = DEVICE_META[node.name];
  const appMeta    = APP_META[node.name];
  const trend      = trustTrend(node.trustScore);
  const badge      = node.classification ? CLASS_CFG[node.classification] : null;

  const rows: [string, string | undefined][] = [];
  if (node.type === "USER") {
    rows.push(
      ["Display Name", user?.displayName ?? displayUserName(node.name)],
      ["Role",         profile?.role ?? "—"],
      ["Department",   user?.department ?? profile?.department ?? "—"],
      ["Trust Score",  `${Math.round(node.trustScore)} / 100`],
      ["Risk Score",   `${Math.round(100 - node.trustScore)} / 100`],
      ["Status",       user?.status ?? stateLabel(node.riskState)],
      ["IP Address",   profile?.currentIp ?? "—"],
      ["Location",     profile?.currentLocation ?? "—"],
    );
  } else if (node.type === "DEVICE") {
    rows.push(
      ["Hostname",   node.name],
      ["OS",         deviceMeta?.os ?? "—"],
      ["Patch Level",deviceMeta?.patch ?? "—"],
      ["EDR Status", deviceMeta?.edr ?? "—"],
      ["Last Scan",  deviceMeta?.lastScan ?? "—"],
      ["Health",     `${Math.round(node.trustScore)}%`],
    );
  } else if (node.type === "APPLICATION") {
    rows.push(
      ["Application", node.name],
      ["Version",     appMeta?.version ?? "—"],
      ["Privilege",   appMeta?.privilege ?? "—"],
      ["Running State",appMeta?.state ?? "—"],
      ["Risk Level",  appMeta?.risk ?? "—"],
      ["Trust Score", `${Math.round(node.trustScore)} / 100`],
    );
  } else if (node.type === "ASSET") {
    rows.push(
      ["Asset",          node.name],
      ["Classification", node.classification ?? "—"],
      ["Trust Score",    `${Math.round(node.trustScore)} / 100`],
      ["Risk State",     stateLabel(node.riskState)],
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {node.type==="USER"        && <User      className="w-4 h-4" style={{ color: stateColor(node.riskState) }} />}
          {node.type==="DEVICE"      && <Cpu       className="w-4 h-4" style={{ color: stateColor(node.riskState) }} />}
          {node.type==="APPLICATION" && <AppWindow className="w-4 h-4" style={{ color: stateColor(node.riskState) }} />}
          {node.type==="ASSET"       && <Database  className="w-4 h-4" style={{ color: stateColor(node.riskState) }} />}
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: stateColor(node.riskState) }}>
            {node.type === "USER" ? displayUserName(node.name) : node.name}
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* State badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase"
          style={{ borderColor: stateColor(node.riskState)+"55", color: stateColor(node.riskState), background: stateColor(node.riskState)+"11" }}>
          {stateLabel(node.riskState)}
        </span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
        <span className={`text-[9px] font-bold ml-auto tabular-nums ${trend.color}`}>
          {trend.icon} {Math.round(node.trustScore)}
        </span>
      </div>

      {/* Trust bar */}
      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width:`${node.trustScore}%`, background: stateColor(node.riskState) }} />
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-1 mt-1 overflow-y-auto flex-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between items-start gap-2 py-0.5 border-b border-border/20">
            <span className="text-[9px] text-muted-foreground shrink-0">{k}</span>
            <span className="text-[9px] text-foreground/90 font-mono text-right break-all">{v ?? "—"}</span>
          </div>
        ))}

        {/* Device processes */}
        {node.type === "DEVICE" && deviceMeta?.processes && (
          <div className="mt-1">
            <div className="text-[9px] text-muted-foreground mb-0.5">Running Processes</div>
            {deviceMeta.processes.map(p => (
              <div key={p} className="text-[9px] font-mono text-foreground/70 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500/60 inline-block" /> {p}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────── Edge detail ── */
function EdgeDetail({ edge, from, to, onSever, severing, onClose }: {
  edge: TrustEdge; from: TrustNode; to: TrustNode;
  onSever: () => void; severing: boolean; onClose: () => void;
}) {
  const state = pathStateFor(edge, from, to);
  const cfg   = PATH_CFG[state];
  const fromLabel = from.type==="USER" ? displayUserName(from.name) : from.name;
  const toLabel   = to.type  ==="USER" ? displayUserName(to.name)   : to.name;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Wifi className="w-4 h-4" style={{ color: cfg.stroke }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.stroke }}>
            Trust Path
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <span className="text-foreground/80 font-mono">{fromLabel}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground/80 font-mono">{toLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase"
          style={{ borderColor: cfg.stroke+"55", color: cfg.stroke, background: cfg.stroke+"11" }}>
          {state}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width:`${edge.trustScore}%`, background: cfg.stroke }} />
      </div>

      <div className="flex flex-col gap-1 mt-1">
        {[
          ["Relationship", `${from.type} → ${to.type}`],
          ["Trust %",      `${edge.trustScore}%`],
          ["Status",       state],
          ...(edge.severedAt ? [["Severed At", new Date(edge.severedAt).toLocaleString()]] as [string,string][] : []),
          ...(edge.severed   ? [["Reason", "Circuit breaker / containment"]] as [string,string][] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-start py-0.5 border-b border-border/20">
            <span className="text-[9px] text-muted-foreground">{k}</span>
            <span className="text-[9px] font-mono text-foreground/90">{v}</span>
          </div>
        ))}
      </div>

      {!edge.severed && (
        <Button size="sm" variant="destructive" onClick={onSever} disabled={severing}
          className="mt-auto text-[10px] h-7 gap-1">
          <Scissors className="w-3 h-3" />
          {severing ? "Severing…" : "Sever this path"}
        </Button>
      )}
      {edge.severed && (
        <div className="mt-auto text-[9px] text-red-400/70 flex items-center gap-1 border border-red-500/20 rounded px-2 py-1.5">
          <Scissors className="w-3 h-3" /> Path severed — reset to restore
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────── AI panel ── */
function AIInsightsPanel({ nodes, edges }: { nodes: TrustNode[]; edges: TrustEdge[] }) {
  const insights = useMemo(() => generateInsights(nodes, edges), [nodes, edges]);
  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      <div className="flex items-center gap-2 shrink-0">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AI Security Insights</span>
      </div>
      {insights.map((ins, i) => (
        <div key={i} className="border border-border/40 rounded p-2 flex flex-col gap-1.5 bg-background/30">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[9px] font-bold text-foreground/90 leading-tight">{ins.icon} {ins.type}</div>
            <span className="text-[9px] tabular-nums shrink-0 text-green-400 font-mono">{ins.confidence}%</span>
          </div>
          <div className="text-[9px] text-muted-foreground leading-snug">{ins.message}</div>
          <div className="mt-0.5 flex flex-col gap-0.5">
            {ins.actions.map(a => (
              <div key={a} className="text-[9px] text-primary/80 flex items-center gap-1">
                <ChevronRight className="w-2.5 h-2.5 shrink-0" /> {a}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────── Main modal ── */
interface Props { open: boolean; onClose: () => void; }

export function TrustGraphModal({ open, onClose }: Props) {
  const { data, refetch }    = useGetTrustGraph();
  const { data: usersData }  = useListUsers();
  const { data: policyData } = useGetFileAccessPolicy();
  const { data: lockdown }   = useGetLockdownState();
  const severMutation        = useSeverTrustEdge();
  const queryClient          = useQueryClient();
  const [selected, setSelected] = useState<SelectedItem>(null);

  /* build lookup maps */
  const { nodePositions, svgHeight, nodeById } = useMemo(() => {
    if (!data) return { nodePositions:{} as Record<string,{x:number;y:number}>, svgHeight:300, nodeById:{} as Record<string,TrustNode> };
    const byType: Record<string,TrustNode[]> = { USER:[], DEVICE:[], APPLICATION:[], ASSET:[] };
    for (const n of data.nodes) if (byType[n.type]) byType[n.type].push(n as TrustNode);
    const positions: Record<string,{x:number;y:number}> = {};
    let maxRows = 0;
    for (const type of TYPE_ORDER) {
      const nodes = byType[type] ?? [];
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((n,i) => { positions[n.id]={ x:COL_X[type], y:TOP_PAD+i*ROW_GAP }; });
    }
    const byId = Object.fromEntries(data.nodes.map(n=>[n.id, n])) as Record<string,TrustNode>;
    return { nodePositions:positions, svgHeight:TOP_PAD+maxRows*ROW_GAP+30, nodeById:byId };
  }, [data]);

  const handleSever = (edgeId: string) => {
    severMutation.mutate({ id: edgeId }, {
      onSuccess: () => {
        toast({ title:"Trust path severed" });
        refetch();
        queryClient.invalidateQueries();
      },
      onError: () => toast({ title:"Failed to sever path", variant:"destructive" }),
    });
  };

  const handleNodeClick = (node: TrustNode) => {
    setSelected(prev => prev?.kind==="node" && prev.node.id===node.id ? null : { kind:"node", node });
  };

  const handleEdgeClick = (edge: TrustEdge) => {
    if (edge.severed && selected?.kind==="edge" && selected.edge.id===edge.id) { setSelected(null); return; }
    const from = nodeById[edge.fromNodeId];
    const to   = nodeById[edge.toNodeId];
    if (!from || !to) return;
    setSelected(prev => prev?.kind==="edge" && prev.edge.id===edge.id ? null : { kind:"edge", edge: edge as TrustEdge, from, to });
  };

  const activeEdges   = data?.edges.filter(e => !e.severed).length ?? 0;
  const severedEdges  = data?.edges.filter(e => e.severed).length  ?? 0;
  const compromised   = data?.nodes.filter(n => n.riskState==="COMPROMISED").length ?? 0;
  const degraded      = data?.nodes.filter(n => n.riskState==="DEGRADED").length    ?? 0;
  const trustHealth   = data?.edges.length
    ? Math.round((activeEdges / data.edges.length) * 100) : 100;

  const isLockdown    = lockdown?.active;
  const nodes = (data?.nodes ?? []) as TrustNode[];
  const edges = (data?.edges ?? []) as TrustEdge[];
  const users = usersData ?? [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1100px] bg-card border-border text-foreground font-mono max-h-[92vh] flex flex-col gap-2 p-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Trust Graph — Zero Trust Relationship Map
            {isLockdown && (
              <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/40 text-[9px] animate-pulse">
                LOCKDOWN ACTIVE
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-6 gap-1.5 shrink-0">
          {[
            { label:"TOTAL NODES",   value:String(data?.nodes.length ?? 0),   color:"text-primary"     },
            { label:"ACTIVE PATHS",  value:String(activeEdges),                color:"text-green-400"   },
            { label:"SEVERED PATHS", value:String(severedEdges),               color: severedEdges>0 ? "text-red-400" : "text-muted-foreground" },
            { label:"COMPROMISED",   value:String(compromised),                color: compromised>0 ? "text-red-400 animate-pulse" : "text-muted-foreground" },
            { label:"DEGRADED",      value:String(degraded),                   color: degraded>0    ? "text-yellow-400" : "text-muted-foreground" },
            { label:"TRUST HEALTH",  value:`${trustHealth}%`,                  color: trustHealth>=80 ? "text-green-400" : trustHealth>=50 ? "text-yellow-400" : "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center p-1.5 border border-border/50 rounded bg-background/30">
              <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Main content: graph + side panel */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Graph */}
          <div className={`${selected ? "flex-1" : "w-full"} overflow-auto border border-border/40 rounded bg-background/20 p-2 transition-all duration-200`}>
            <svg width="780" height={svgHeight} className="font-mono" style={{ minWidth:740 }}>
              <defs><style>{SVG_STYLE}</style></defs>

              {/* Col headers */}
              {TYPE_ORDER.map(type => (
                <text key={type} x={COL_X[type]} y={18} textAnchor="middle"
                  fill="#6b7280" fontSize={9} fontWeight="bold" letterSpacing="0.1em">
                  {COL_LABEL[type]}
                </text>
              ))}
              <line x1={20} y1={28} x2={760} y2={28} stroke="#374151" strokeWidth={0.5} />

              {/* Edges */}
              {edges.map(edge => {
                const from = nodePositions[edge.fromNodeId];
                const to   = nodePositions[edge.toNodeId];
                if (!from || !to) return null;
                const x1=from.x+NODE_W/2, y1=from.y+NODE_H/2;
                const x2=to.x-NODE_W/2,   y2=to.y+NODE_H/2;
                const mx=(x1+x2)/2;
                const state  = pathStateFor(edge, nodeById[edge.fromNodeId], nodeById[edge.toNodeId]);
                const cfg    = PATH_CFG[state];
                const isSel  = selected?.kind==="edge" && selected.edge.id===edge.id;

                return (
                  <g key={edge.id} style={{ cursor:"pointer" }}
                    onClick={() => handleEdgeClick(edge)}>
                    {/* fat invisible hit target */}
                    <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                      fill="none" stroke="transparent" strokeWidth={12} />
                    <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                      fill="none" stroke={cfg.stroke}
                      strokeWidth={isSel ? 2.5 : state==="SEVERED" ? 1 : 1.5}
                      strokeDasharray={cfg.dasharray}
                      opacity={isSel ? 1 : cfg.opacity}
                      className={cfg.animCls} />
                    {isSel && (
                      <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                        fill="none" stroke={cfg.stroke} strokeWidth={5} opacity={0.12} />
                    )}
                    <text x={mx} y={(y1+y2)/2-3} textAnchor="middle"
                      fill={state==="SEVERED" ? "#ef4444" : "#4b5563"} fontSize={7}>
                      {state==="SEVERED" ? "✂" : edge.trustScore}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const borderColor = RISK_BORDER[node.riskState] ?? "#6b7280";
                const nx=pos.x-NODE_W/2, ny=pos.y;
                const isComp = node.riskState==="COMPROMISED";
                const isDeg  = node.riskState==="DEGRADED";
                const isSel  = selected?.kind==="node" && selected.node.id===node.id;
                const label  = node.type==="USER" ? displayUserName(node.name) : node.name;
                const badge  = node.classification ? CLASS_BADGE_SHORT[node.classification] : null;
                const isLocked = isLockdown && (isComp || isDeg);

                return (
                  <g key={node.id} style={{ cursor:"pointer" }} onClick={() => handleNodeClick(node)}>
                    {/* Pulse ring */}
                    {(isComp||isDeg) && (
                      <rect x={nx-2} y={ny-2} width={NODE_W+4} height={NODE_H+4} rx={NODE_RX+2}
                        fill="none" stroke={borderColor} strokeWidth={0.7}
                        className={isComp ? "tgm-pulse-comp" : "tgm-pulse-deg"} />
                    )}
                    {/* Selection ring */}
                    {isSel && (
                      <rect x={nx-3} y={ny-3} width={NODE_W+6} height={NODE_H+6} rx={NODE_RX+3}
                        fill="none" stroke={borderColor} strokeWidth={1.5} opacity={0.6} />
                    )}
                    {/* Node body */}
                    <rect x={nx} y={ny} width={NODE_W} height={NODE_H} rx={NODE_RX}
                      fill={isLocked ? "#1a1f2e" : "#0d1117"}
                      stroke={isSel ? borderColor : borderColor}
                      strokeWidth={isComp ? 1.8 : isSel ? 1.4 : 0.75}
                      opacity={isLocked ? 0.65 : 0.97} />

                    {/* Classification badge */}
                    {badge && (
                      <>
                        <rect x={nx+NODE_W-19} y={ny+3} width={15} height={11} rx={2} fill={badge.bg} opacity={0.88} />
                        <text x={nx+NODE_W-11.5} y={ny+11.5} textAnchor="middle"
                          fill="#fff" fontSize={6} fontWeight="bold">{badge.label}</text>
                      </>
                    )}

                    {/* Lockdown badge */}
                    {isLocked && (
                      <text x={nx+NODE_W-3} y={ny+8} textAnchor="end" fill="#6b7280" fontSize={7}>🔒</text>
                    )}

                    {/* Label */}
                    <text x={nx+6} y={ny+NODE_H/2+1} dominantBaseline="middle"
                      fill={isLocked ? "#6b7280" : borderColor}
                      fontSize={8.5} fontWeight="bold" letterSpacing="0.02em">
                      {label.length>13 ? label.slice(0,12)+"…" : label}
                    </text>

                    {/* Trust score */}
                    <text
                      x={badge ? nx+NODE_W-22 : nx+NODE_W-5}
                      y={ny+NODE_H-5} textAnchor="end" fill="#4b5563" fontSize={7}>
                      {Math.round(node.trustScore)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Side panel */}
          {selected && (
            <div className="w-64 shrink-0 border border-border/40 rounded bg-background/30 p-3 overflow-y-auto">
              {selected.kind==="node" && (
                <NodeDetail
                  node={selected.node}
                  users={users}
                  policy={policyData}
                  onClose={() => setSelected(null)} />
              )}
              {selected.kind==="edge" && (
                <EdgeDetail
                  edge={selected.edge}
                  from={selected.from}
                  to={selected.to}
                  severing={severMutation.isPending}
                  onSever={() => handleSever(selected.edge.id)}
                  onClose={() => setSelected(null)} />
              )}
            </div>
          )}

          {/* AI Insights — shown when nothing selected */}
          {!selected && (
            <div className="w-60 shrink-0 border border-border/40 rounded bg-background/30 p-3 overflow-y-auto">
              <AIInsightsPanel nodes={nodes} edges={edges} />
            </div>
          )}
        </div>

        {/* Legend + controls */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/30 flex-wrap shrink-0">
          {(["TRUSTED","SUSPICIOUS","ELEVATED","COMPROMISED"] as PathState[]).map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className="w-3.5 h-1 rounded-sm" style={{ background:PATH_CFG[s].stroke, opacity:0.8 }} />
              <span className="text-[8px] text-muted-foreground">{s}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-3.5 border-t border-dashed border-red-500/60" />
            <span className="text-[8px] text-muted-foreground">SEVERED</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded" style={{ background:"#3b82f6" }} />
            <span className="text-[8px] text-muted-foreground">RECOVERED</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[9px] text-muted-foreground">
            <Activity className="w-3 h-3 text-primary" />
            Click node or path to inspect
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
