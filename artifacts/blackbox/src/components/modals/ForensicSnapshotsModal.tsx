import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useListSnapshots, useGetSnapshot } from "@workspace/api-client-react";
import { Camera, ChevronRight, Cpu, Network, FolderOpen, Users } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function JsonSection({ label, icon: Icon, data }: { label: string; icon: React.ElementType; data: string }) {
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { parsed = data; }
  return (
    <div className="border border-border/50 rounded overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/40 border-b border-border/50">
        <Icon className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{label}</span>
      </div>
      <pre className="text-[9px] text-muted-foreground p-3 overflow-x-auto max-h-32 leading-relaxed">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  );
}

function SnapshotDetail({ id }: { id: string }) {
  const { data, isLoading } = useGetSnapshot(id);
  if (isLoading) return <div className="text-[10px] text-muted-foreground text-center py-4">Loading snapshot…</div>;
  if (!data) return <div className="text-[10px] text-muted-foreground text-center py-4">Snapshot not found</div>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 pb-2 border-b border-border/50">
        <div>
          <p className="text-[9px] text-muted-foreground">CAPTURED</p>
          <p className="text-[10px] font-bold">{new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">RISK AT CAPTURE</p>
          <p className="text-[10px] font-bold text-destructive">{data.triggerRiskScore} / 100</p>
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-muted-foreground">SNAPSHOT ID</p>
          <p className="text-[9px] font-mono text-primary truncate">{data.id}</p>
        </div>
      </div>
      <JsonSection label="Memory"          icon={Cpu}       data={data.memorySnapshot}  />
      <JsonSection label="Network"         icon={Network}   data={data.networkSnapshot} />
      <JsonSection label="File Activity"   icon={FolderOpen}data={data.fileSnapshot}    />
      <JsonSection label="Active Users"    icon={Users}     data={data.userSnapshot}    />
    </div>
  );
}

export function ForensicSnapshotsModal({ open, onClose }: Props) {
  const { data: snapshots } = useListSnapshots();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = snapshots?.find(s => s.id === selectedId) ?? snapshots?.[0];
  const activeId = selectedId ?? selected?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl bg-card border-border text-foreground font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <Camera className="w-4 h-4" /> Forensic Snapshots
          </DialogTitle>
        </DialogHeader>

        {!snapshots?.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Camera className="w-8 h-8 opacity-30" />
            <span className="text-xs">No forensic snapshots captured yet.</span>
            <span className="text-[10px] opacity-60">Snapshots are automatically taken when risk exceeds threshold or during lockdown Phase 1.</span>
          </div>
        ) : (
          <div className="flex gap-4 max-h-[60vh]">
            {/* Snapshot list */}
            <div className="w-52 shrink-0 space-y-1 overflow-y-auto pr-1 border-r border-border/50">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider pb-1">{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}</p>
              {snapshots.map(snap => (
                <button
                  key={snap.id}
                  onClick={() => setSelectedId(snap.id)}
                  className={`w-full text-left p-2 rounded border transition-colors ${activeId === snap.id ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/20 hover:bg-background/40'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                    <ChevronRight className={`w-3 h-3 transition-colors ${activeId === snap.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-[9px] text-muted-foreground">{new Date(snap.timestamp).toLocaleDateString()}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[8px] text-muted-foreground">Risk:</span>
                    <Badge
                      variant="outline"
                      className={`text-[8px] h-3.5 px-1 ${snap.triggerRiskScore >= 91 ? 'text-red-400 border-red-500/30' : snap.triggerRiskScore >= 71 ? 'text-orange-400 border-orange-500/30' : 'text-yellow-400 border-yellow-500/30'}`}
                    >
                      {snap.triggerRiskScore}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail pane */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {activeId ? (
                <SnapshotDetail id={activeId} />
              ) : (
                <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
                  Select a snapshot to view details
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
