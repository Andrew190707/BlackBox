import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useGetIdentityResetStatus, useGetNarrative, useGetTrustAnalytics } from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  History,
  KeyRound,
  Lock,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";

export type DashboardModule =
  | "containment"
  | "trustAnalytics"
  | "narrative"
  | "events"
  | "incidents"
  | "breakers"
  | "identity";

interface Props {
  open: boolean;
  module: DashboardModule | null;
  onClose: () => void;
  lockdown?: any;
  breakers?: any[];
  events?: any[];
  incidents?: any[];
}

const ACTION_LABELS: Record<string, string> = {
  "admin password rotated": "Admin password rotated",
  "analyst password rotated": "SOC Analyst password rotated",
  "hr_admin password rotated": "HR Manager password rotated",
  "dev_lead API key rotated": "Security Engineer API key rotated",
  "hr_admin API key rotated": "HR Manager API key rotated",
  "all session tokens revoked": "Session tokens revoked",
  "all active sessions revoked": "Active sessions revoked",
  "AWS access key reset": "AWS access key reset",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-[10px] font-bold text-foreground">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">{children}</div>;
}

function IdentityDetails() {
  const { data: status } = useGetIdentityResetStatus();
  const completed = status?.completedActions ?? [];
  const total = status?.totalActions ?? 8;
  const progress = status?.progressPercent ?? 0;
  const isActive = status?.active ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 p-3">
        <KeyRound className="h-4 w-4 text-primary" />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Credential & Session Protection</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Rotates exposed credentials and revokes active sessions after a confirmed compromise.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-border/50 bg-background/30 p-2 text-center">
          <div className="text-lg font-bold text-primary">{progress}%</div>
          <div className="text-[9px] text-muted-foreground">PROGRESS</div>
        </div>
        <div className="rounded border border-border/50 bg-background/30 p-2 text-center">
          <div className={`text-lg font-bold ${isActive ? "text-yellow-400" : "text-green-400"}`}>
            {isActive ? "ACTIVE" : status?.lastRunAt ? "COMPLETE" : "STANDBY"}
          </div>
          <div className="text-[9px] text-muted-foreground">STATUS</div>
        </div>
        <div className="rounded border border-border/50 bg-background/30 p-2 text-center">
          <div className="text-lg font-bold text-foreground">{completed.length}/{total}</div>
          <div className="text-[9px] text-muted-foreground">ACTIONS</div>
        </div>
      </div>
      <div>
        <SectionTitle>Protocol actions</SectionTitle>
        <div className="space-y-1">
          {completed.map((action) => (
            <div key={action} className="flex items-center gap-2 rounded border border-green-500/20 bg-green-500/5 px-2 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
              <span className="text-[10px] text-muted-foreground">{ACTION_LABELS[action] ?? action}</span>
            </div>
          ))}
          {isActive && status?.currentAction && (
            <div className="flex items-center gap-2 rounded border border-yellow-500/30 bg-yellow-500/5 px-2 py-1.5">
              <Activity className="h-3.5 w-3.5 shrink-0 animate-pulse text-yellow-400" />
              <span className="text-[10px] text-yellow-400">
                In progress: {ACTION_LABELS[status.currentAction] ?? status.currentAction}
              </span>
            </div>
          )}
          {!completed.length && !isActive && (
            <div className="rounded border border-border/40 bg-background/20 px-2 py-3 text-center text-[10px] text-muted-foreground">
              No reset has been run. The protocol activates during Phase 4 Identity Reset.
            </div>
          )}
        </div>
      </div>
      <DetailRow label="Last completed" value={status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : "Never"} />
    </div>
  );
}

function BreakerDetails({ breakers = [] }: { breakers?: any[] }) {
  const tripped = breakers.filter((breaker) => breaker.status === "TRIPPED").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded border border-orange-500/30 bg-orange-500/5 p-3">
        <Shield className="h-4 w-4 text-orange-400" />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Trust Path Circuit Breakers</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Automatic guardrails that stop risky user, device, application, remote, and transfer paths.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DetailRow label="Registered breakers" value={breakers.length} />
        <DetailRow label="Currently tripped" value={<span className={tripped ? "text-red-400" : "text-green-400"}>{tripped}</span>} />
      </div>
      <div>
        <SectionTitle>Current breaker state</SectionTitle>
        <div className="space-y-2">
          {!breakers.length && <div className="text-[10px] text-muted-foreground">Loading breaker state…</div>}
          {breakers.map((breaker) => {
            const isTripped = breaker.status === "TRIPPED";
            return (
              <div key={breaker.name} className={`rounded border p-2 ${isTripped ? "border-red-500/40 bg-red-500/5" : "border-border/40 bg-background/20"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase">{breaker.label ?? breaker.name?.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className={`text-[8px] ${isTripped ? "border-red-500/40 text-red-400" : "border-green-500/40 text-green-400"}`}>
                    {breaker.status}
                  </Badge>
                </div>
                {breaker.reason && <div className="mt-1 text-[9px] text-muted-foreground">{breaker.reason}</div>}
                {breaker.trippedAt && <div className="mt-1 text-[9px] text-red-400">Tripped {new Date(breaker.trippedAt).toLocaleString()}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContainmentDetails({ lockdown }: { lockdown?: any }) {
  const phases = ["State Preservation", "Trust Severance", "Asset Protection", "Identity Reset"];
  const phase = lockdown?.phase ?? 0;
  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 rounded border p-3 ${lockdown?.active ? "border-red-500/40 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
        <Lock className={`h-4 w-4 ${lockdown?.active ? "text-red-400" : "text-green-400"}`} />
        <div>
          <div className={`text-xs font-bold uppercase tracking-wider ${lockdown?.active ? "text-red-400" : "text-green-400"}`}>
            {lockdown?.active ? "Lockdown active" : "Containment standby"}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Four-phase response used to preserve evidence, sever trust, protect assets, and reset identities.
          </div>
        </div>
      </div>
      <div>
        <SectionTitle>Lockdown phases</SectionTitle>
        <div className="space-y-2">
          {phases.map((label, index) => {
            const phaseNumber = index + 1;
            const complete = phase >= phaseNumber;
            return (
              <div key={label} className="flex items-center gap-3 rounded border border-border/40 bg-background/20 p-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}>
                  {phaseNumber}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${complete ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{complete ? "COMPLETE" : "STANDBY"}</span>
              </div>
            );
          })}
        </div>
      </div>
      <DetailRow label="Current phase" value={phase ? `${phase}: ${phases[phase - 1]}` : "Not active"} />
      <DetailRow label="Initiated" value={lockdown?.initiatedAt ? new Date(lockdown.initiatedAt).toLocaleString() : "Not initiated"} />
      <DetailRow label="Snapshot ID" value={lockdown?.snapshotId ?? "None"} />
    </div>
  );
}

function TrustAnalyticsDetails() {
  const { data } = useGetTrustAnalytics();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 p-3">
        <GitBranch className="h-4 w-4 text-primary" />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Trust Relationship Health</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Aggregates active, compromised, and severed paths across the trust graph.</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Trust health", `${data?.trustHealthPercent ?? 100}%`, "text-green-400"],
          ["Active paths", data?.activePaths ?? 0, "text-green-400"],
          ["Severed paths", data?.severedPaths ?? 0, "text-red-400"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded border border-border/50 bg-background/30 p-2 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[9px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <DetailRow label="Total nodes" value={data?.totalNodes ?? 0} />
      <DetailRow label="Compromised paths" value={data?.compromisedPaths ?? 0} />
      <DetailRow label="Compromised nodes" value={data?.compromisedNodes ?? 0} />
      <DetailRow label="Degraded nodes" value={data?.degradedNodes ?? 0} />
    </div>
  );
}

function NarrativeDetails() {
  const { data } = useGetNarrative();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Governance Narrative</span>
      </div>
      <div className="rounded border border-primary/30 bg-black p-4 text-[11px] leading-relaxed text-[#abfc81]">
        {data?.summary ?? "Loading governance narrative…"}
      </div>
      <DetailRow label="Generated" value={data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"} />
      <DetailRow label="Events analyzed" value={data?.eventCount ?? 0} />
      <div className="text-[10px] text-muted-foreground">
        This summary is rule-based and is updated from the current governance event stream.
      </div>
    </div>
  );
}

function EventsDetails({ events = [] }: { events?: any[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Live Governance Event Stream</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{events.length} recent events currently loaded. New events appear through the live feed.</div>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {events.map((event) => (
          <div key={event.id} className="grid grid-cols-[70px_140px_100px_1fr] gap-2 rounded border border-border/40 bg-background/20 p-2 text-[9px]">
            <span className="text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}</span>
            <span className="font-bold text-primary">{event.eventType}</span>
            <span className="truncate text-muted-foreground">{event.user}</span>
            <span className="truncate text-foreground/80">{event.details}</span>
          </div>
        ))}
        {!events.length && <div className="py-6 text-center text-[10px] text-muted-foreground">No events available.</div>}
      </div>
    </div>
  );
}

function IncidentsDetails({ incidents = [] }: { incidents?: any[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Incident Command Timeline</span>
      </div>
      <div className="text-[10px] text-muted-foreground">Historical and active governance incidents recorded by the flight recorder.</div>
      <div className="space-y-2">
        {incidents.map((incident) => (
          <div key={incident.id} className="rounded border border-border/40 bg-background/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-destructive">{incident.id.slice(0, 8)}…</span>
              <Badge variant={incident.resolved ? "outline" : "destructive"} className="text-[8px]">{incident.resolved ? "RESOLVED" : "ACTIVE"}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
              <span>Started: {new Date(incident.startTime).toLocaleString()}</span>
              <span>Peak: {incident.threatStateReached}</span>
              <span>Risk: {incident.peakRiskScore}</span>
            </div>
            {incident.summary && <div className="mt-2 text-[10px] text-muted-foreground">{incident.summary}</div>}
          </div>
        ))}
        {!incidents.length && <div className="py-6 text-center text-[10px] text-muted-foreground">No incidents recorded.</div>}
      </div>
    </div>
  );
}

export function ModuleDetailsModal({ open, module, onClose, lockdown, breakers, events, incidents }: Props) {
  const config: Record<DashboardModule, { title: string; icon: typeof Activity }> = {
    containment: { title: "Containment Protocol Details", icon: Lock },
    trustAnalytics: { title: "Trust Path Analytics Details", icon: GitBranch },
    narrative: { title: "Governance Narrative Details", icon: Terminal },
    events: { title: "Governance Event Stream Details", icon: Zap },
    incidents: { title: "Incident Command Timeline Details", icon: History },
    breakers: { title: "Trust Path Breakers Details", icon: Shield },
    identity: { title: "Identity Reset Protocol Details", icon: KeyRound },
  };
  const selected = module ? config[module] : config.containment;
  const Icon = selected.icon;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-widest text-primary">
            <Icon className="h-4 w-4" />
            {selected.title}
          </DialogTitle>
        </DialogHeader>
        {module === "containment" && <ContainmentDetails lockdown={lockdown} />}
        {module === "trustAnalytics" && <TrustAnalyticsDetails />}
        {module === "narrative" && <NarrativeDetails />}
        {module === "events" && <EventsDetails events={events} />}
        {module === "incidents" && <IncidentsDetails incidents={incidents} />}
        {module === "breakers" && <BreakerDetails breakers={breakers} />}
        {module === "identity" && <IdentityDetails />}
      </DialogContent>
    </Dialog>
  );
}