import { useListClassifiedAssets } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

const CLASS_CONFIG: Record<string, { color: string; dot: string; bg: string }> = {
  CRITICAL:     { color: "text-red-400",    dot: "bg-red-500",    bg: "bg-red-500/5 border-red-500/20"    },
  CONFIDENTIAL: { color: "text-orange-400", dot: "bg-orange-500", bg: "bg-orange-500/5 border-orange-500/20" },
  INTERNAL:     { color: "text-yellow-400", dot: "bg-yellow-500", bg: "bg-yellow-500/5 border-yellow-500/20" },
  PUBLIC:       { color: "text-green-400",  dot: "bg-green-500",  bg: "bg-green-500/5 border-green-500/20"  },
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL:      { label: "NORMAL",      color: "text-green-400" },
  DEGRADED:    { label: "DEGRADED",    color: "text-yellow-400" },
  COMPROMISED: { label: "COMPROMISED", color: "text-red-400 animate-pulse" },
};

export function AssetClassificationPanel() {
  const { data: assets } = useListClassifiedAssets();

  const sorted = [...(assets ?? [])].sort((a, b) => {
    const order = { CRITICAL: 0, CONFIDENTIAL: 1, INTERNAL: 2, PUBLIC: 3 };
    return (order[a.classification] ?? 4) - (order[b.classification] ?? 4);
  });

  const counts = assets?.reduce<Record<string, number>>((acc, a) => {
    acc[a.classification] = (acc[a.classification] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-2">
      {/* Classification legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {["CRITICAL", "CONFIDENTIAL", "INTERNAL", "PUBLIC"].map(cls => {
          const cfg = CLASS_CONFIG[cls];
          const count = counts[cls] ?? 0;
          return (
            <div key={cls} className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span className={`text-[8px] font-bold uppercase ${cfg.color}`}>{cls}</span>
              <span className="text-[8px] text-muted-foreground">({count})</span>
            </div>
          );
        })}
      </div>

      {/* Asset list */}
      <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
        {sorted.map(asset => {
          const cls  = CLASS_CONFIG[asset.classification] ?? CLASS_CONFIG.PUBLIC;
          const risk = RISK_CONFIG[asset.riskState]       ?? RISK_CONFIG.NORMAL;
          return (
            <div key={asset.id} className={`flex items-center gap-2 p-1.5 border rounded ${cls.bg}`}>
              <Shield className={`w-3 h-3 shrink-0 ${cls.color}`} />
              <span className="flex-1 text-[10px] font-bold truncate">{asset.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className={`text-[7px] h-3.5 px-1 border-0 ${cls.bg} ${cls.color}`}>
                  {asset.classification}
                </Badge>
                {asset.riskState !== "NORMAL" && (
                  <span className={`text-[7px] font-bold ${risk.color}`}>{risk.label}</span>
                )}
              </div>
            </div>
          );
        })}
        {!sorted.length && (
          <div className="text-[10px] text-muted-foreground text-center py-2">Loading asset registry…</div>
        )}
      </div>
    </div>
  );
}
