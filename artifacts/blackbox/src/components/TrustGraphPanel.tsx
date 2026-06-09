import { useMemo } from "react";
import { useGetTrustGraph } from "@workspace/api-client-react";

const TYPE_ORDER = ["USER", "DEVICE", "APPLICATION", "ASSET"] as const;

const RISK_COLOR: Record<string, string> = {
  NORMAL:      "#22c55e",
  DEGRADED:    "#eab308",
  COMPROMISED: "#ef4444",
};

const CLASS_COLOR: Record<string, string> = {
  CRITICAL:     "#ef4444",
  CONFIDENTIAL: "#f97316",
  INTERNAL:     "#eab308",
  PUBLIC:       "#22c55e",
};

const COL_X: Record<string, number> = {
  USER:        70,
  DEVICE:      210,
  APPLICATION: 350,
  ASSET:       490,
};

const COL_LABEL: Record<string, string> = {
  USER:        "USERS",
  DEVICE:      "DEVICES",
  APPLICATION: "APPS",
  ASSET:       "ASSETS",
};

const NODE_W = 96;
const NODE_H = 28;
const NODE_RX = 4;
const ROW_GAP = 42;
const TOP_PAD = 40;

export function TrustGraphPanel() {
  const { data } = useGetTrustGraph();

  const { nodePositions, svgHeight } = useMemo(() => {
    if (!data) return { nodePositions: {}, svgHeight: 200 };

    const byType: Record<string, typeof data.nodes> = {
      USER: [], DEVICE: [], APPLICATION: [], ASSET: [],
    };
    for (const n of data.nodes) {
      if (byType[n.type]) byType[n.type].push(n);
    }

    const positions: Record<string, { x: number; y: number }> = {};
    let maxRows = 0;
    for (const type of TYPE_ORDER) {
      const nodes = byType[type] ?? [];
      maxRows = Math.max(maxRows, nodes.length);
      nodes.forEach((n, i) => {
        positions[n.id] = {
          x: COL_X[type],
          y: TOP_PAD + i * ROW_GAP,
        };
      });
    }

    return {
      nodePositions: positions,
      svgHeight: TOP_PAD + maxRows * ROW_GAP + 20,
    };
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-24 text-[10px] text-muted-foreground">
        Loading trust graph…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto w-full">
      <svg
        width="580"
        height={svgHeight}
        className="font-mono"
        style={{ minWidth: 580 }}
      >
        {/* Column headers */}
        {TYPE_ORDER.map((type) => (
          <text
            key={type}
            x={COL_X[type]}
            y={16}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={9}
            fontWeight="bold"
            letterSpacing="0.1em"
          >
            {COL_LABEL[type]}
          </text>
        ))}

        {/* Separator line under headers */}
        <line x1={20} y1={24} x2={560} y2={24} stroke="#374151" strokeWidth={0.5} />

        {/* Edges */}
        {data.edges.map((edge) => {
          const from = nodePositions[edge.fromNodeId];
          const to = nodePositions[edge.toNodeId];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x - NODE_W / 2;
          const y2 = to.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <g key={edge.id}>
              <path
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={edge.severed ? "#ef444488" : `hsl(142,70%,45%,0.35)`}
                strokeWidth={edge.severed ? 1 : 1.5}
                strokeDasharray={edge.severed ? "4 3" : undefined}
              />
              {/* Trust score on edge midpoint */}
              <text
                x={mx}
                y={(y1 + y2) / 2 - 3}
                textAnchor="middle"
                fill={edge.severed ? "#ef4444" : "#4b5563"}
                fontSize={7}
              >
                {edge.severed ? "✂" : `${edge.trustScore}`}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {data.nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const color = RISK_COLOR[node.riskState] ?? "#6b7280";
          const nx = pos.x - NODE_W / 2;
          const ny = pos.y;
          return (
            <g key={node.id}>
              <rect
                x={nx}
                y={ny}
                width={NODE_W}
                height={NODE_H}
                rx={NODE_RX}
                fill="#111827"
                stroke={color}
                strokeWidth={node.riskState === "COMPROMISED" ? 1.5 : 0.8}
                opacity={0.95}
              />
              {/* Pulsing ring for compromised */}
              {node.riskState === "COMPROMISED" && (
                <rect
                  x={nx - 2}
                  y={ny - 2}
                  width={NODE_W + 4}
                  height={NODE_H + 4}
                  rx={NODE_RX + 2}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={0.5}
                  opacity={0.4}
                />
              )}
              {/* Classification dot for assets */}
              {node.classification && (
                <circle
                  cx={nx + NODE_W - 8}
                  cy={ny + NODE_H / 2}
                  r={3}
                  fill={CLASS_COLOR[node.classification] ?? "#6b7280"}
                />
              )}
              {/* Node name */}
              <text
                x={nx + 6}
                y={ny + NODE_H / 2 + 1}
                dominantBaseline="middle"
                fill={color}
                fontSize={8}
                fontWeight="bold"
                letterSpacing="0.03em"
              >
                {node.name.length > 12 ? node.name.slice(0, 11) + "…" : node.name}
              </text>
              {/* Trust score */}
              <text
                x={node.classification ? nx + NODE_W - 14 : nx + NODE_W - 4}
                y={ny + NODE_H - 5}
                textAnchor="end"
                fill="#6b7280"
                fontSize={7}
              >
                {node.trustScore}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50 flex-wrap">
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
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-4 border-t border-dashed border-red-500" />
          <span className="text-[8px] text-muted-foreground">SEVERED</span>
        </div>
        <div className="flex items-center gap-1">
          {["CRITICAL","INTERNAL"].map((c) => (
            <div key={c} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />
              <span className="text-[8px] text-muted-foreground">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
