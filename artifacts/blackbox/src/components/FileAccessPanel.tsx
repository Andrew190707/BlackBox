import { useMemo, useState } from "react";
import {
  getGetFileAccessPolicyQueryKey,
  useEvaluateFileAccess,
  useGetFileAccessPolicy,
  type FileAccessPolicy,
  type CompanyFile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Globe2,
  KeyRound,
  Lock,
  MapPin,
  Search,
  Shield,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";

const ACTION_OPTIONS = ["READ", "DOWNLOAD", "COPY", "SHARE"] as const;
const CLASSIFICATIONS = ["ALL", "PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "TOP SECRET"];

function classificationStyle(classification: string) {
  if (classification === "TOP SECRET") return "border-red-500/50 text-red-400 bg-red-500/10";
  if (classification === "RESTRICTED") return "border-orange-500/50 text-orange-400 bg-orange-500/10";
  if (classification === "CONFIDENTIAL") return "border-yellow-500/50 text-yellow-400 bg-yellow-500/10";
  if (classification === "PUBLIC") return "border-green-500/50 text-green-400 bg-green-500/10";
  return "border-primary/30 text-primary bg-primary/5";
}

function displayClassification(classification: string) {
  return classification === "TOP SECRET" ? "TOP SECRET" : classification;
}

function FileRow({
  file,
  allowed,
  selected,
  onClick,
}: {
  file: CompanyFile;
  allowed: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={allowed ? `Open ${file.name} — permission granted` : `Restricted: ${file.name} — clicking triggers a policy violation`}
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 rounded border p-2 transition-colors ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_18px_rgba(0,255,136,0.08)]"
          : allowed
            ? "border-border/60 bg-background/30 hover:border-primary/50 hover:bg-primary/5"
            : "border-red-500/20 bg-red-500/5 hover:border-red-500/60 hover:bg-red-500/10"
      }`}
    >
      <div className={`shrink-0 ${allowed ? "text-muted-foreground" : "text-red-400"}`}>
        {allowed ? <Lock className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-[10px] font-bold ${allowed ? "text-foreground" : "text-red-200"}`}>
            {file.name}
          </span>
          <Badge variant="outline" className={`h-4 shrink-0 px-1 text-[7px] ${classificationStyle(file.classification)}`}>
            {displayClassification(file.classification)}
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-2 truncate text-[8px] text-muted-foreground">
          <span>{file.department}</span>
          <span>·</span>
          <span>{file.sizeMb.toFixed(2)} MB</span>
        </div>
      </div>
      <span className={`shrink-0 text-[7px] font-bold uppercase tracking-wider ${allowed ? "text-primary" : "text-red-400"}`}>
        {allowed ? "OPEN" : "RESTRICTED"}
      </span>
    </button>
  );
}

function AccessManagerModal({
  open,
  onClose,
  policy,
}: {
  open: boolean;
  onClose: () => void;
  policy: FileAccessPolicy;
}) {
  const queryClient = useQueryClient();
  const evaluateMutation = useEvaluateFileAccess();
  const [selectedUser, setSelectedUser] = useState(policy.users[0] ?? "");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("READ");
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [lastDecision, setLastDecision] = useState<any>(null);

  const profile = policy.profiles.find((candidate) => candidate.userName === selectedUser);
  const containment = policy.containments.find((candidate) => candidate.userName === selectedUser);
  const departments = useMemo(
    () => ["ALL", ...Array.from(new Set(policy.files.map((file) => file.department))).sort()],
    [policy.files],
  );
  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return policy.files.filter((file) => {
      const matchesSearch = !query || `${file.name} ${file.description} ${file.path}`.toLowerCase().includes(query);
      const matchesClassification = classification === "ALL" || file.classification === classification;
      const matchesDepartment = department === "ALL" || file.department === department;
      return matchesSearch && matchesClassification && matchesDepartment;
    });
  }, [classification, department, policy.files, search]);
  const grantsForUser = policy.grants.filter((grant) => grant.userName === selectedUser);
  const allowedCount = grantsForUser.filter((grant) => grant.granted).length;
  const selectedFileData = policy.files.find((file) => file.id === selectedFile);
  const selectedGrant = selectedFileData
    ? policy.grants.find((grant) => grant.userName === selectedUser && grant.fileId === selectedFileData.id)
    : undefined;
  const recentAttempts = policy.attempts.filter((attempt) => attempt.userName === selectedUser).slice(0, 6);

  const setUser = (value: string) => {
    setSelectedUser(value);
    setSelectedFile(null);
    setLastDecision(null);
  };

  const openFile = (file: CompanyFile) => {
    setSelectedFile(file.id);
    evaluateMutation.mutate(
      {
        data: {
          userName: selectedUser,
          fileId: file.id,
          action: selectedAction,
          device: profile?.currentIp ?? "WKSTN-ACCESS-MANAGER",
          application: "BlackBox Access Manager",
          bytesMb: selectedAction === "READ" ? file.sizeMb : file.sizeMb,
          fileCount: 1,
        },
      },
      {
        onSuccess: (decision) => {
          setLastDecision(decision);
          queryClient.invalidateQueries({ queryKey: getGetFileAccessPolicyQueryKey() });
          queryClient.invalidateQueries();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden border-primary/30 bg-[#080b0d]/[.98] p-0 text-foreground shadow-[0_0_70px_rgba(0,255,136,0.12)]">
        <DialogHeader className="border-b border-primary/15 px-5 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3 pr-7">
            <div>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
                <Shield className="h-4 w-4 text-primary" />
                Enterprise Access Manager
              </DialogTitle>
              <DialogDescription className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                Zero Trust file explorer · role-based permissions · behavioral monitoring
              </DialogDescription>
            </div>
            <Badge variant="outline" className="border-primary/30 text-[8px] text-primary">
              LIVE POLICY
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-12 gap-3 overflow-y-auto p-4">
          <aside className="col-span-12 space-y-3 lg:col-span-3">
            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-widest text-muted-foreground">Identity</Label>
              <Select value={selectedUser} onValueChange={setUser}>
                <SelectTrigger className="h-8 bg-background/60 text-[10px]">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {policy.users.map((user) => {
                    const candidate = policy.profiles.find((item) => item.userName === user);
                    return <SelectItem key={user} value={user} className="text-[10px]">{candidate?.displayName ?? user}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className={`rounded border p-3 ${containment?.active ? "border-red-500/50 bg-red-500/10" : "border-primary/20 bg-primary/5"}`}>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold uppercase">{profile?.displayName ?? selectedUser}</div>
                  <div className="truncate text-[8px] text-muted-foreground">{profile?.role ?? "Role profile"} · {profile?.department ?? "Unknown department"}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]">
                <div><span className="text-muted-foreground">TRUST</span><div className="text-lg font-bold text-primary">{profile?.trustScore.toFixed(0) ?? "—"}</div></div>
                <div><span className="text-muted-foreground">STATUS</span><div className={`mt-1 font-bold ${containment?.active ? "text-red-400" : "text-green-400"}`}>{containment?.active ? "CONTAINED" : profile?.riskStatus ?? "NORMAL"}</div></div>
              </div>
              <div className="mt-3 space-y-1 border-t border-border/50 pt-2 text-[8px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> Last login: {profile ? new Date(profile.lastLogin).toLocaleString() : "—"}</div>
                <div className="flex items-center gap-1.5"><Globe2 className="h-3 w-3" /> IP: {profile?.currentIp ?? "—"}</div>
                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {profile?.currentLocation ?? "—"}</div>
              </div>
            </div>

            <div className="rounded border border-border/60 bg-background/30 p-3 text-[8px]">
              <div className="mb-2 flex items-center justify-between uppercase tracking-widest text-muted-foreground">
                <span>Permissions</span><KeyRound className="h-3 w-3" />
              </div>
              <div className="flex justify-between"><span>Allowed files</span><b className="text-primary">{allowedCount}</b></div>
              <div className="mt-1 flex justify-between"><span>Restricted files</span><b className="text-red-400">{Math.max(0, policy.files.length - allowedCount)}</b></div>
              <div className="mt-1 flex justify-between"><span>Current session</span><b className="text-green-400">ACTIVE</b></div>
            </div>
          </aside>

          <section className="col-span-12 min-h-0 space-y-2 lg:col-span-5">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files..." className="h-7 pl-7 text-[9px] bg-background/50" />
              </div>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger className="h-7 w-[145px] text-[9px]"><Filter className="mr-1 h-3 w-3" /><SelectValue /></SelectTrigger>
                <SelectContent>{CLASSIFICATIONS.map((item) => <SelectItem key={item} value={item} className="text-[9px]">{item}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-7 w-[145px] text-[9px]"><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((item) => <SelectItem key={item} value={item} className="text-[9px]">{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-widest text-muted-foreground">
              <span>Company file explorer</span><span>{visibleFiles.length} / {policy.files.length} files</span>
            </div>
            <div className="max-h-[58vh] space-y-1 overflow-y-auto pr-1">
              {visibleFiles.map((file) => {
                const grant = policy.grants.find((candidate) => candidate.userName === selectedUser && candidate.fileId === file.id);
                return <FileRow key={file.id} file={file} allowed={Boolean(grant?.granted)} selected={selectedFile === file.id} onClick={() => openFile(file)} />;
              })}
              {!visibleFiles.length && <div className="rounded border border-dashed border-border p-8 text-center text-[9px] text-muted-foreground">No files match the active filters.</div>}
            </div>
          </section>

          <aside className="col-span-12 space-y-3 lg:col-span-4">
            <div className="rounded border border-border/60 bg-background/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Interaction policy</span>
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger className="h-6 w-[105px] text-[8px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTION_OPTIONS.map((action) => <SelectItem key={action} value={action} className="text-[9px]">{action}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="text-[8px] text-muted-foreground">Select an action, then click any file. Restricted files remain visible for policy transparency and trigger the existing trust/event pipeline when tested.</div>
            </div>

            {selectedFileData && (
              <div className="rounded border border-primary/25 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold">{selectedFileData.name}</div>
                    <div className="mt-0.5 break-all text-[8px] text-muted-foreground">{selectedFileData.path}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[8px]">
                  <div><span className="text-muted-foreground">OWNER</span><div className="font-bold">{selectedFileData.owner}</div></div>
                  <div><span className="text-muted-foreground">SIZE</span><div className="font-bold">{selectedFileData.sizeMb.toFixed(2)} MB</div></div>
                  <div><span className="text-muted-foreground">DEPARTMENT</span><div className="font-bold">{selectedFileData.department}</div></div>
                  <div><span className="text-muted-foreground">GRANT</span><div className={`font-bold ${selectedGrant?.granted ? "text-primary" : "text-red-400"}`}>{selectedGrant?.accessLevel ?? "DENIED"}</div></div>
                </div>
                <p className="mt-3 border-t border-border/50 pt-2 text-[8px] text-muted-foreground">{selectedFileData.description}</p>
              </div>
            )}

            {lastDecision && (
              <div className={`rounded border p-3 ${lastDecision.allowed ? "border-green-500/50 bg-green-500/10" : "border-red-500/60 bg-red-500/10"}`}>
                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${lastDecision.allowed ? "text-green-400" : "text-red-400"}`}>
                  {lastDecision.allowed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {lastDecision.allowed ? "File opened" : "Access denied"}
                </div>
                <div className="mt-2 text-[8px]">{lastDecision.message}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-[8px]">
                  <div><span className="text-muted-foreground">THREAT</span><div className="font-bold text-red-400">{lastDecision.attempt.effectiveThreatScore.toFixed(1)}</div></div>
                  <div><span className="text-muted-foreground">TRUST BEFORE</span><div className="font-bold text-primary">{lastDecision.attempt.trustBefore.toFixed(1)}</div></div>
                  <div><span className="text-muted-foreground">TRUST AFTER</span><div className="font-bold text-yellow-400">{lastDecision.attempt.trustAfter.toFixed(1)}</div></div>
                </div>
                {lastDecision.indicators?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{lastDecision.indicators.map((indicator: string) => <Badge key={indicator} variant="outline" className="h-4 border-red-500/40 px-1 text-[7px] text-red-400">{indicator}</Badge>)}</div>}
                {lastDecision.contained && <div className="mt-2 text-[8px] font-bold uppercase text-red-400">User contained · trust paths severed</div>}
              </div>
            )}

            <div className="rounded border border-border/60 bg-background/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-[8px] uppercase tracking-widest text-muted-foreground"><Activity className="h-3 w-3" /> Recent user activity</div>
              <div className="space-y-1.5">
                {recentAttempts.map((attempt) => <div key={attempt.id} className="flex items-center justify-between gap-2 text-[8px]"><span className="truncate text-muted-foreground">{policy.files.find((file) => file.id === attempt.fileId)?.name ?? attempt.fileId}</span><Badge variant={attempt.allowed ? "outline" : "destructive"} className="h-4 px-1 text-[7px]">{attempt.allowed ? "ALLOW" : "DENY"}</Badge></div>)}
                {!recentAttempts.length && <div className="text-[8px] text-muted-foreground">No access attempts for this identity.</div>}
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FileAccessPanel() {
  const [open, setOpen] = useState(false);
  const { data: policy, isLoading } = useGetFileAccessPolicy({
    query: { queryKey: getGetFileAccessPolicyQueryKey() },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full shrink-0 rounded border border-border bg-card/50 p-3 text-left backdrop-blur transition-colors hover:border-primary/60 hover:bg-primary/5"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Enterprise Access Manager</span>
          <span className="ml-auto text-[8px] text-muted-foreground">OPEN →</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground">
          <span>{isLoading ? "Loading policy..." : `${policy?.files.length ?? 0} files · ${policy?.profiles.length ?? 0} identities`}</span>
          <span className="text-primary">ROLE-BASED IAM</span>
        </div>
      </button>
      {policy && <AccessManagerModal open={open} onClose={() => setOpen(false)} policy={policy} />}
    </>
  );
}