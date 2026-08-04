import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useListUsers } from "@workspace/api-client-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function trustLevel(score: number) {
  if (score >= 90) return { label: "TRUSTED",        color: "text-green-400",   bg: "bg-green-500/10  border-green-500/30"  };
  if (score >= 70) return { label: "CAUTION",        color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30" };
  if (score >= 50) return { label: "ELEVATED RISK",  color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30" };
  return              { label: "COMPROMISED",        color: "text-red-400",     bg: "bg-red-500/10    border-red-500/30"    };
}

export function UserTrustModal({ open, onClose }: Props) {
  const { data: users } = useListUsers();

  const avg     = users?.length ? users.reduce((sum, user) => sum + user.trustScore, 0) / users.length : 0;
  const trusted = users?.filter(user => user.trustScore >= 90).length ?? 0;
  const caution = users?.filter(user => user.trustScore >= 70 && user.trustScore < 90).length ?? 0;
  const high    = users?.filter(user => user.trustScore >= 50 && user.trustScore < 70).length ?? 0;
  const comp    = users?.filter(user => user.trustScore < 50).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            User Trust Score Report
          </DialogTitle>
        </DialogHeader>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2 pb-3 border-b border-border">
          {[
            { label: "AVG SCORE", value: avg.toFixed(1),       color: "text-primary"   },
            { label: "TRUSTED",   value: String(trusted),      color: "text-green-400" },
            { label: "CAUTION",   value: String(caution),      color: "text-yellow-400"},
            { label: "COMPROMISED",value: String(comp + high), color: "text-red-400"   },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center p-2 border border-border/50 rounded bg-background/30">
              <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          <div className="grid grid-cols-[1fr_120px_100px] gap-2 text-[9px] text-muted-foreground uppercase tracking-wider px-2 pb-1 border-b border-border/50">
            <span>User</span><span className="text-center">Score</span><span className="text-center">Trust Level</span>
          </div>
          {[...(users ?? [])].sort((a, b) => b.trustScore - a.trustScore).map(user => {
            const lvl = trustLevel(user.trustScore);
            return (
              <div key={user.name} className={`grid grid-cols-[1fr_120px_100px] gap-2 items-center p-2 border rounded text-[11px] ${lvl.bg}`}>
                <span className="font-bold">{user.name}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${user.trustScore >= 90 ? 'bg-green-500' : user.trustScore >= 70 ? 'bg-yellow-500' : user.trustScore >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${user.trustScore}%` }}
                    />
                  </div>
                  <span className={`tabular-nums font-bold w-8 text-right text-xs ${lvl.color}`}>{user.trustScore.toFixed(1)}</span>
                </div>
                <div className="flex justify-center">
                  <Badge className={`text-[8px] px-1.5 py-0 h-4 border ${lvl.bg} ${lvl.color}`}>{lvl.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-muted-foreground text-center pt-1 border-t border-border/50">
          Trust scores degrade in real time based on behavioral anomalies detected by the flight recorder.
        </p>
      </DialogContent>
    </Dialog>
  );
}
