import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGetTrustGraph, useSeverTrustEdge } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { GitBranch, Scissors } from "lucide-react";
import { displayUserName } from "@/lib/userLabels";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_ORDER = ["USER", "DEVICE", "APPLICATION", "ASSET"] as const;
const RISK_COLOR: Record<string, string> = {
  NORMAL:      "#22c55e",
  DEGRADED:    "#eab308",
  COMPROMISED: "#ef4444",
};
const CLASS_COLOR: Record<string, string> = {
  CRITICAL:    "#ef4444",
  CONFIDENTIAL:"#f97316",
  INTERNAL:    "#eab308",
  PUBLIC:      "#22c55e",
};
const COL_X: Record<string, number> = {
  USER: 100, DEVICE: 280, APPLICATION: 460, ASSET: 640,
};
const COL_LABEL: Record<string, string> = {
  USER: "USERS", DEVICE: "DEVICES", APPLICATION: "APPS", ASSET: "ASSETS",
};
const NODE_W = 110;
const NODE_H = 30;
const NODE_RX = 4;
const ROW_GAP = 46;
const TOP_PAD = 44;

export function TrustGraphModal({ open, onClose }: Props) {
  const { data, refetch } = useGetTrustGraph();
  const severMutation = useSeverTrustEdge();
  const queryClient = useQueryClient();
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const { nodePositions, svgHeight } = useMemo(() => {
    if (!data) return { nodePositions: {}, svgHeight: 300 };
    const byType: Record<string, typeof data.nodes> = { USER: [], DEVICE: [], APPLICATION: [], ASSET: [] };
    for (const n of data.nodes) { if (byType[n.type]) byType[n.type].push(n); }
    const positions: Record<string, { x: number; y: number }> = {};
    let maxRows = 0;
    for (const type of TYPE_ORDER) {
      const nodes = byType[type] ?? [];
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((n, i) => { positions[n.id] = { x: COL_X[type], y: TOP_PAD + i * ROW_GAP }; });
    }
    return { nodePositions: positions, svgHeight: TOP_PAD + maxRows * ROW_GAP + 30 };
  }, [data]);

  const handleSever = (edgeId: string) => {
    severMutation.mutate({ id: edgeId }, {
      onSuccess: () => {
        toast({ title: "Trust path severed" });
        refetch();
        queryClient.invalidateQueries();
      },
      onError: () => toast({ title: "Failed to sever path", variant: "destructive" }),
    });
  };

  const activeEdges  = data?.edges.filter(e => !e.severed).length ?? 0;
  const severedEdges = data?.edges.filter(e => e.severed).length ?? 0;
  const compromised  = data?.nodes.filter(n => n.riskState === "COMPROMISED").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl bg-card border-border text-foreground font-mono max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Trust Graph — Relationship Map
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          {[
            { label: "TOTAL NODES",   value: String(data?.nodes.length ?? 0),  color: "text-primary"    },
            { label: "ACTIVE PATHS",  value: String(activeEdges),               color: "text-green-400"  },
            { label: "SEVERED PATHS", value: String(severedEdges),              color: "text-red-400"    },
            { label: "COMPROMISED",   value: String(compromised),               color: compromised > 0 ? "text-red-400 animate-pulse" : "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center p-2 border border-border/50 rounded bg-background/30">
              <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Graph SVG */}
        <div className="flex-1 overflow-auto border border-border/50 rounded bg-background/20 p-2">
          <svg width="780" height={svgHeight} className="font-mono" style={{ minWidth: 780 }}>
            {/* Column headers */}
            {TYPE_ORDER.map(type => (
              <text key={type} x={COL_X[type]} y={18} textAnchor="middle" fill="#6b7280" fontSize={9} fontWeight="bold" letterSpacing="0.1em">
                {COL_LABEL[type]}
              </text>
            ))}
            <line x1={20} y1={28} x2={760} y2={28} stroke="#374151" strokeWidth={0.5} />

            {/* Edges */}
            {data?.edges.map(edge => {
              const from = nodePositions[edge.fromNodeId];
              const to   = nodePositions[edge.toNodeId];
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x - NODE_W / 2;
              const y2 = to.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const isHovered = hoveredEdge === edge.id;
              return (
                <g key={edge.id} style={{ cursor: edge.severed ? "default" : "pointer" }}
                  onMouseEnter={() => !edge.severed && setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={() => !edge.severed && handleSever(edge.id)}
                >
                  <path
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={edge.severed ? "#ef444466" : isHovered ? "#ef4444bb" : "rgba(34,197,94,0.3)"}
                    strokeWidth={isHovered ? 2.5 : edge.severed ? 1 : 1.5}
                    strokeDasharray={edge.severed ? "4 3" : undefined}
                  />
                  {/* Hover: show sever icon */}
                  {isHovered && !edge.severed && (
                    <g transform={`translate(${mx - 8}, ${(y1 + y2) / 2 - 8})`}>
                      <rect x={0} y={0} width={16} height={16} rx={3} fill="#1f2937" stroke="#ef4444" strokeWidth={1} />
                      <text x={8} y={11} textAnchor="middle" fill="#ef4444" fontSize={10}>✂</text>
                    </g>
                  )}
                  {/* Trust score label */}
                  {!isHovered && (
                    <text x={mx} y={(y1 + y2) / 2 - 3} textAnchor="middle"
                      fill={edge.severed ? "#ef4444" : "#4b5563"} fontSize={7}>
                      {edge.severed ? "✂" : edge.trustScore}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {data?.nodes.map(node => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const color = RISK_COLOR[node.riskState] ?? "#6b7280";
              const nx = pos.x - NODE_W / 2;
              const ny = pos.y;
              return (
                <g key={node.id}>
                  <rect x={nx} y={ny} width={NODE_W} height={NODE_H} rx={NODE_RX}
                    fill="#111827" stroke={color} strokeWidth={node.riskState === "COMPROMISED" ? 2 : 0.8} opacity={0.95} />
                  {node.riskState === "COMPROMISED" && (
                    <rect x={nx - 2} y={ny - 2} width={NODE_W + 4} height={NODE_H + 4} rx={NODE_RX + 2}
                      fill="none" stroke="#ef4444" strokeWidth={0.5} opacity={0.35} />
                  )}
                  {node.classification && (
                    <circle cx={nx + NODE_W - 8} cy={ny + NODE_H / 2} r={3.5}
                      fill={CLASS_COLOR[node.classification] ?? "#6b7280"} />
                  )}
                  <text x={nx + 7} y={ny + NODE_H / 2 + 1} dominantBaseline="middle"
                    fill={color} fontSize={8.5} fontWeight="bold" letterSpacing="0.02em">
                     {(() => {
                       const label = node.type === "USER" ? displayUserName(node.name) : node.name;
                       return label.length > 13 ? label.slice(0, 12) + "…" : label;
                     })()}
                  </text>
                  <text
                    x={node.classification ? nx + NODE_W - 13 : nx + NODE_W - 5}
                    y={ny + NODE_H - 5} textAnchor="end" fill="#4b5563" fontSize={7}>
                    {node.trustScore}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend + instructions */}
        <div className="flex items-center gap-3 pt-1 flex-wrap shrink-0">
          {[
            { color: "#22c55e", label: "NORMAL" },
            { color: "#eab308", label: "DEGRADED" },
            { color: "#ef4444", label: "COMPROMISED" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
              <span className="text-[8px] text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-4 border-t border-dashed border-red-500" />
            <span className="text-[8px] text-muted-foreground">SEVERED</span>
          </div>
          {["CRITICAL","INTERNAL"].map(c => (
            <div key={c} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />
              <span className="text-[8px] text-muted-foreground">{c}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
            <Scissors className="w-3 h-3 text-red-400" />
            Hover an active path and click to sever it
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
