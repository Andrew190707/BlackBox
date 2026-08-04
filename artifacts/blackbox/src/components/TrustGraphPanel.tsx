import { useMemo } from "react";
import { useGetTrustGraph } from "@workspace/api-client-react";
import { displayUserName } from "@/lib/userLabels";

/* ── Types ─────────────────────────────────────────────────── */
type PathState = "TRUSTED" | "SUSPICIOUS" | "ELEVATED" | "COMPROMISED" | "SEVERED" | "RECOVERED" | "CONTAINED";

/* ── Colours ────────────────────────────────────────────────── */
const RISK_BORDER: Record<string, string> = {
  NORMAL:      "#22c55e",
  DEGRADED:    "#eab308",
  COMPROMISED: "#ef4444",
  CONTAINED:   "#6b7280",
  RECOVERED:   "#3b82f6",
};

const PATH_CFG: Record<PathState, { stroke: string; dasharray?: string; opacity: number; animCls?: string }> = {
  TRUSTED:     { stroke: "#22c55e", opacity: 0.55, animCls: "tg-flow-normal" },
  SUSPICIOUS:  { stroke: "#eab308", opacity: 0.75, dasharray: "6 5",  animCls: "tg-flow-suspicious" },
  ELEVATED:    { stroke: "#f97316", opacity: 0.80, dasharray: "5 4",  animCls: "tg-flow-elevated" },
  COMPROMISED: { stroke: "#ef4444", opacity: 0.85, dasharray: "4 3",  animCls: "tg-flow-compromised" },
  SEVERED:     { stroke: "#ef4444", opacity: 0.38, dasharray: "4 3" },
  RECOVERED:   { stroke: "#3b82f6", opacity: 0.70, animCls: "tg-flow-recovered" },
  CONTAINED:   { stroke: "#6b7280", opacity: 0.35, dasharray: "2 5" },
};

const CLASS_BADGE: Record<string, { bg: string; label: string }> = {
  "TOP SECRET":   { bg: "#7c3aed", label: "TS" },
  "CRITICAL":     { bg: "#ef4444", label: "CR" },
  "RESTRICTED":   { bg: "#ea580c", label: "RX" },
  "CONFIDENTIAL": { bg: "#f97316", label: "CF" },
  "INTERNAL":     { bg: "#ca8a04", label: "IN" },
  "PUBLIC":       { bg: "#16a34a", label: "PB" },
};

/* ── Layout constants ───────────────────────────────────────── */
const TYPE_ORDER = ["USER", "DEVICE", "APPLICATION", "ASSET"] as const;
const COL_X:     Record<string, number> = { USER: 70, DEVICE: 210, APPLICATION: 350, ASSET: 490 };
const COL_LABEL: Record<string, string> = { USER: "USERS", DEVICE: "DEVICES", APPLICATION: "APPS", ASSET: "ASSETS" };
const NODE_W = 96, NODE_H = 28, NODE_RX = 4, ROW_GAP = 42, TOP_PAD = 40;

/* ── Path-state helper ──────────────────────────────────────── */
function pathStateFor(
  edge: { severed: boolean; trustScore: number },
  fromNode?: { riskState: string },
  toNode?:   { riskState: string },
): PathState {
  if (edge.severed) return "SEVERED";
  const f = fromNode?.riskState ?? "NORMAL";
  const t = toNode?.riskState   ?? "NORMAL";
  if (f === "CONTAINED"   || t === "CONTAINED")   return "CONTAINED";
  if (f === "COMPROMISED" || t === "COMPROMISED") return "COMPROMISED";
  if (f === "RECOVERED"   || t === "RECOVERED")   return "RECOVERED";
  if (f === "DEGRADED"    || t === "DEGRADED")    return edge.trustScore < 50 ? "ELEVATED" : "SUSPICIOUS";
  if (edge.trustScore < 40) return "ELEVATED";
  if (edge.trustScore < 65) return "SUSPICIOUS";
  return "TRUSTED";
}

/* ── Inline SVG CSS for flow animations ─────────────────────── */
const SVG_STYLE = `
  .tg-flow-normal     { stroke-dasharray:6 14; animation: tgFlowNormal     3.0s linear infinite; }
  .tg-flow-suspicious { stroke-dasharray:5 9;  animation: tgFlowSuspicious 2.2s linear infinite; }
  .tg-flow-elevated   { stroke-dasharray:5 6;  animation: tgFlowElevated   1.6s linear infinite; }
  .tg-flow-compromised{ stroke-dasharray:4 4;  animation: tgFlowComp       0.9s linear infinite; }
  .tg-flow-recovered  { stroke-dasharray:6 12; animation: tgFlowRecov      2.5s linear infinite; }
  .tg-pulse-compromised { animation: tgPulseComp 1.4s ease-in-out infinite; }
  .tg-pulse-degraded    { animation: tgPulseDeg  2.0s ease-in-out infinite; }
  @keyframes tgFlowNormal     { from { stroke-dashoffset:20; } to { stroke-dashoffset:0; } }
  @keyframes tgFlowSuspicious { from { stroke-dashoffset:14; } to { stroke-dashoffset:0; } }
  @keyframes tgFlowElevated   { from { stroke-dashoffset:11; } to { stroke-dashoffset:0; } }
  @keyframes tgFlowComp       { from { stroke-dashoffset: 8; } to { stroke-dashoffset:0; } }
  @keyframes tgFlowRecov      { from { stroke-dashoffset:18; } to { stroke-dashoffset:0; } }
  @keyframes tgPulseComp { 0%,100%{opacity:.25} 50%{opacity:.65} }
  @keyframes tgPulseDeg  { 0%,100%{opacity:.20} 50%{opacity:.50} }
`;

/* ── Component ──────────────────────────────────────────────── */
export function TrustGraphPanel() {
  const { data } = useGetTrustGraph();

  const { nodePositions, svgHeight, nodeById } = useMemo(() => {
    if (!data) return { nodePositions: {} as Record<string, { x: number; y: number }>, svgHeight: 200, nodeById: {} };
    const byType: Record<string, typeof data.nodes> = { USER: [], DEVICE: [], APPLICATION: [], ASSET: [] };
    for (const n of data.nodes) if (byType[n.type]) byType[n.type].push(n);
    const positions: Record<string, { x: number; y: number }> = {};
    let maxRows = 0;
    for (const type of TYPE_ORDER) {
      const nodes = byType[type] ?? [];
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((n, i) => { positions[n.id] = { x: COL_X[type], y: TOP_PAD + i * ROW_GAP }; });
    }
    const byId = Object.fromEntries(data.nodes.map(n => [n.id, n]));
    return { nodePositions: positions, svgHeight: TOP_PAD + maxRows * ROW_GAP + 20, nodeById: byId };
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-24 text-[10px] text-muted-foreground animate-pulse">
        Initialising trust graph…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto w-full">
      <svg width="580" height={svgHeight} className="font-mono" style={{ minWidth: 580 }}>
        <defs><style>{SVG_STYLE}</style></defs>

        {/* Column headers */}
        {TYPE_ORDER.map(type => (
          <text key={type} x={COL_X[type]} y={16} textAnchor="middle"
            fill="#6b7280" fontSize={9} fontWeight="bold" letterSpacing="0.1em">
            {COL_LABEL[type]}
          </text>
        ))}
        <line x1={20} y1={24} x2={560} y2={24} stroke="#374151" strokeWidth={0.5} />

        {/* Edges */}
        {data.edges.map(edge => {
          const from = nodePositions[edge.fromNodeId];
          const to   = nodePositions[edge.toNodeId];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2, y1 = from.y + NODE_H / 2;
          const x2 = to.x   - NODE_W / 2, y2 = to.y   + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const state = pathStateFor(edge, nodeById[edge.fromNodeId], nodeById[edge.toNodeId]);
          const cfg = PATH_CFG[state];
          return (
            <g key={edge.id}>
              <path
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={cfg.stroke}
                strokeWidth={state === "SEVERED" ? 1 : 1.5}
                strokeDasharray={cfg.dasharray}
                opacity={cfg.opacity}
                className={cfg.animCls}
              />
              <text x={mx} y={(y1 + y2) / 2 - 3} textAnchor="middle"
                fill={state === "SEVERED" ? "#ef4444" : "#374151"} fontSize={7}>
                {state === "SEVERED" ? "✂" : `${edge.trustScore}`}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {data.nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const borderColor = RISK_BORDER[node.riskState] ?? "#6b7280";
          const nx = pos.x - NODE_W / 2, ny = pos.y;
          const isComp = node.riskState === "COMPROMISED";
          const isDeg  = node.riskState === "DEGRADED";
          const label  = node.type === "USER" ? displayUserName(node.name) : node.name;
          const badge  = node.classification ? CLASS_BADGE[node.classification] : null;

          return (
            <g key={node.id}>
              {/* Pulse ring */}
              {(isComp || isDeg) && (
                <rect x={nx - 2} y={ny - 2} width={NODE_W + 4} height={NODE_H + 4} rx={NODE_RX + 2}
                  fill="none" stroke={borderColor} strokeWidth={0.6}
                  className={isComp ? "tg-pulse-compromised" : "tg-pulse-degraded"} />
              )}
              {/* Node body */}
              <rect x={nx} y={ny} width={NODE_W} height={NODE_H} rx={NODE_RX}
                fill="#0d1117" stroke={borderColor}
                strokeWidth={isComp ? 1.5 : isDeg ? 1.0 : 0.7} opacity={0.97} />

              {/* Classification badge for assets */}
              {badge && (
                <>
                  <rect x={nx + NODE_W - 18} y={ny + 3} width={14} height={10} rx={2} fill={badge.bg} opacity={0.9} />
                  <text x={nx + NODE_W - 11} y={ny + 11} textAnchor="middle"
                    fill="#fff" fontSize={6} fontWeight="bold">{badge.label}</text>
                </>
              )}

              {/* Node label */}
              <text x={nx + 5} y={ny + NODE_H / 2 + 1} dominantBaseline="middle"
                fill={borderColor} fontSize={8} fontWeight="bold" letterSpacing="0.03em">
                {(label.length > 11 ? label.slice(0, 10) + "…" : label)}
              </text>

              {/* Trust score */}
              <text
                x={badge ? nx + NODE_W - 20 : nx + NODE_W - 4}
                y={ny + NODE_H - 5} textAnchor="end" fill="#4b5563" fontSize={7}>
                {Math.round(node.trustScore)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40 flex-wrap">
        {(["TRUSTED","SUSPICIOUS","ELEVATED","COMPROMISED"] as PathState[]).map(s => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-3 h-1 rounded-sm" style={{ background: PATH_CFG[s].stroke, opacity: 0.8 }} />
            <span className="text-[8px] text-muted-foreground">{s}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 border-t border-dashed border-red-500/60" />
          <span className="text-[8px] text-muted-foreground">SEVERED</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded" style={{ background: "#ef4444" }} />
          <span className="text-[8px] text-muted-foreground">CR</span>
          <div className="w-2 h-2 rounded ml-1" style={{ background: "#ca8a04" }} />
          <span className="text-[8px] text-muted-foreground">IN</span>
        </div>
      </div>
    </div>
  );
}
