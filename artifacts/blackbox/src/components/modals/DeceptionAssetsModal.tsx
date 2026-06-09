import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListDeceptionAssets, useDeployDeception } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, Clock, FileWarning } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ASSET_DESCRIPTIONS: Record<string, string> = {
  "Payroll_2026.xlsx":     "High-value payroll bait — access indicates credential compromise or insider threat",
  "ExecutivePasswords.txt":"Executive credential lure — access triggers immediate CRITICAL alert",
  "CryptoWalletBackup.txt":"Cryptocurrency wallet decoy — monitored for exfiltration attempts",
  "AWS_AccessKeys.csv":    "Cloud access key honeypot — access indicates cloud account targeting",
};

export function DeceptionAssetsModal({ open, onClose }: Props) {
  const { data: assets, refetch } = useListDeceptionAssets();
  const deployMutation = useDeployDeception();
  const queryClient = useQueryClient();

  const triggered  = assets?.filter(a => a.triggered).length ?? 0;
  const active     = assets?.filter(a => a.deployed && !a.triggered).length ?? 0;
  const undeployed = assets?.filter(a => !a.deployed).length ?? 0;

  const handleDeploy = () => {
    deployMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Deception assets deployed" });
        refetch();
        queryClient.invalidateQueries();
      },
      onError: () => toast({ title: "Deployment failed", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-primary">
            Deception Assets Report
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 pb-3 border-b border-border">
          {[
            { label: "TRIGGERED", value: String(triggered), color: triggered > 0 ? "text-red-400" : "text-muted-foreground" },
            { label: "ACTIVE",    value: String(active),    color: "text-green-400"   },
            { label: "STANDBY",   value: String(undeployed),color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center p-2 border border-border/50 rounded bg-background/30">
              <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Asset list */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {!assets?.length && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <FileWarning className="w-8 h-8 opacity-40" />
              <span className="text-xs">No deception assets deployed yet.</span>
              <Button size="sm" onClick={handleDeploy} disabled={deployMutation.isPending} className="text-xs">
                Deploy Now
              </Button>
            </div>
          )}
          {assets?.map(asset => {
            const filename = asset.path.split('/').pop() ?? asset.path;
            const desc = ASSET_DESCRIPTIONS[filename] ?? "Honeypot asset — access generates DECEPTION_TRIGGERED event";
            return (
              <div key={asset.id} className={`p-3 border rounded space-y-2 ${asset.triggered ? 'border-red-500/40 bg-red-500/5' : 'border-border/50 bg-background/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`w-3.5 h-3.5 ${asset.triggered ? 'text-red-400' : 'text-primary'}`} />
                    <span className="text-xs font-bold">{filename}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-border">{asset.type}</Badge>
                    {asset.triggered ? (
                      <Badge className="text-[8px] h-4 px-1 bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">TRIGGERED</Badge>
                    ) : (
                      <Badge className="text-[8px] h-4 px-1 bg-green-500/10 text-green-400 border-green-500/30">ACTIVE</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="font-mono opacity-60">{asset.path}</span>
                </div>
                {asset.triggered && asset.triggeredAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                    <Clock className="w-3 h-3" />
                    Triggered: {new Date(asset.triggeredAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {assets && assets.length > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-[9px] text-muted-foreground">Manual deployment overwrites existing assets</span>
            <Button size="sm" variant="outline" onClick={handleDeploy} disabled={deployMutation.isPending} className="text-[10px] h-7 border-primary text-primary">
              Redeploy Assets
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
