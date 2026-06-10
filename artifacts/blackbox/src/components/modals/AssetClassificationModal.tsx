import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useListClassifiedAssets } from "@workspace/api-client-react";
import { Shield, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CLASS_CONFIG: Record<string, { color: string; dot: string; bg: string; border: string; desc: string }> = {
  CRITICAL:     { color: "text-red-400",    dot: "bg-red-500",    bg: "bg-red-500/5",    border: "border-red-500/30",    desc: "Highest sensitivity — breach causes severe impact" },
  CONFIDENTIAL: { color: "text-orange-400", dot: "bg-orange-500", bg: "bg-orange-500/5", border: "border-orange-500/30", desc: "Restricted access — business-confidential data" },
  INTERNAL:     { color: "text-yellow-400", dot: "bg-yellow-500", bg: "bg-yellow-500/5", border: "border-yellow-500/30", desc: "Internal use only — not for public disclosure" },
  PUBLIC:       { color: "text-green-400",  dot: "bg-green-500",  bg: "bg-green-500/5",  border: "border-green-500/30",  desc: "Publicly accessible — no confidentiality requirement" },
};

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  NORMAL:      { label: "NORMAL",      cls: "text-green-400 border-green-500/30 bg-green-500/10" },
  DEGRADED:    { label: "DEGRADED",    cls: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  COMPROMISED: { label: "COMPROMISED", cls: "text-red-400 border-red-500/30 bg-red-500/10 animate-pulse" },
};

export function AssetClassificationModal({ open, onClose }: Props) {
  const { data: assets } = useListClassifiedAssets();

  const sorted = [...(assets ?? [])].sort((a, b) => {
    const order = { CRITICAL: 0, CONFIDENTIAL: 1, INTERNAL: 2, PUBLIC: 3 };
    return (order[a.classification as keyof typeof order] ?? 4) - (order[b.classification as keyof typeof order] ?? 4);
  });

  const counts = sorted.reduce<Record<string, number>>((acc, a) => {
    acc[a.classification] = (acc[a.classification] ?? 0) + 1;
    return acc;
  }, {});

  const compromised = sorted.filter(a => a.riskState === "COMPROMISED").length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <Shield className="w-4 h-4" /> Asset Classification Registry
          </DialogTitle>
        </DialogHeader>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-2 pb-3 border-b border-border">
          {(["CRITICAL", "CONFIDENTIAL", "INTERNAL", "PUBLIC"] as const).map(cls => {
            const cfg = CLASS_CONFIG[cls];
            return (
              <div key={cls} className={`flex flex-col items-center p-2 border rounded ${cfg.bg} ${cfg.border}`}>
                <div className={`w-2 h-2 rounded-full ${cfg.dot} mb-1`} />
                <span className={`text-lg font-bold tabular-nums ${cfg.color}`}>{counts[cls] ?? 0}</span>
                <span className={`text-[8px] uppercase tracking-wider ${cfg.color} font-bold`}>{cls}</span>
              </div>
            );
          })}
        </div>

        {compromised > 0 && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            {compromised} asset{compromised > 1 ? "s" : ""} currently COMPROMISED — immediate governance action required
          </div>
        )}

        {/* Asset table */}
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          <div className="grid grid-cols-[1fr_100px_80px_60px] gap-2 text-[8px] text-muted-foreground uppercase tracking-wider px-2 pb-1 border-b border-border/50">
            <span>Asset Name</span>
            <span className="text-center">Classification</span>
            <span className="text-center">Risk State</span>
            <span className="text-right">Trust</span>
          </div>
          {sorted.map(asset => {
            const cls  = CLASS_CONFIG[asset.classification] ?? CLASS_CONFIG.PUBLIC;
            const risk = RISK_BADGE[asset.riskState]        ?? RISK_BADGE.NORMAL;
            return (
              <div key={asset.id} className={`grid grid-cols-[1fr_100px_80px_60px] gap-2 items-center p-2 border rounded ${cls.bg} ${cls.border}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className={`w-3 h-3 shrink-0 ${cls.color}`} />
                  <span className="text-[10px] font-bold truncate">{asset.name}</span>
                </div>
                <div className="flex justify-center">
                  <Badge variant="outline" className={`text-[7px] h-4 px-1.5 border ${cls.border} ${cls.color} ${cls.bg}`}>
                    {asset.classification}
                  </Badge>
                </div>
                <div className="flex justify-center">
                  <Badge variant="outline" className={`text-[7px] h-4 px-1 border ${risk.cls}`}>
                    {risk.label}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold tabular-nums ${asset.trustScore >= 80 ? "text-green-400" : asset.trustScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {asset.trustScore}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Classification guide */}
        <div className="pt-2 border-t border-border/50 space-y-1">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Classification Guide</p>
          {Object.entries(CLASS_CONFIG).map(([cls, cfg]) => (
            <div key={cls} className="flex items-center gap-2 text-[9px]">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <span className={`font-bold w-20 ${cfg.color}`}>{cls}</span>
              <span className="text-muted-foreground">{cfg.desc}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
