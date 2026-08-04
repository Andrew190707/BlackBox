import { useState } from "react";
import {
  useGetFileAccessPolicy,
  getGetFileAccessPolicyQueryKey,
  useEvaluateFileAccess,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FileText,
  User,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Activity,
  Database,
  Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const ACTION_OPTIONS = [
  "READ",
  "DOWNLOAD",
  "MASS_DOWNLOAD",
  "MULTI_FILE_ACCESS",
] as const;

export function FileAccessPanel() {
  const queryClient = useQueryClient();
  const { data: policy, isLoading } = useGetFileAccessPolicy({
    query: { queryKey: getGetFileAccessPolicyQueryKey() },
  });
  const evaluateMutation = useEvaluateFileAccess();

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("READ");
  const [device, setDevice] = useState<string>("laptop-corp-001");
  const [application, setApplication] = useState<string>("FileExplorer");
  const [bytesMb, setBytesMb] = useState<string>("1.5");
  const [fileCount, setFileCount] = useState<string>("1");

  const [lastDecision, setLastDecision] = useState<any>(null);

  const handleEvaluate = () => {
    if (!selectedUser || !selectedFile) return;

    evaluateMutation.mutate(
      {
        data: {
          userName: selectedUser,
          fileId: selectedFile,
          action: selectedAction,
          device: device || undefined,
          application: application || undefined,
          bytesMb: bytesMb ? Number(bytesMb) : undefined,
          fileCount: fileCount ? Number(fileCount) : undefined,
        },
      },
      {
        onSuccess: (decision) => {
          setLastDecision(decision);
          queryClient.invalidateQueries({ queryKey: getGetFileAccessPolicyQueryKey() });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
            <Shield className="w-3 h-3" /> File Access Policy Test
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="text-[9px] text-muted-foreground text-center py-4">
            Loading policy data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!policy) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
            <Shield className="w-3 h-3" /> File Access Policy Test
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="text-[9px] text-destructive text-center py-4">
            Policy data unavailable
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedFileData = policy.files.find((f) => f.id === selectedFile);
  const selectedUserContainment = policy.containments.find(
    (c) => c.userName === selectedUser && c.active
  );
  const selectedUserGrant = policy.grants.find(
    (g) => g.userName === selectedUser && g.fileId === selectedFile
  );
  const recentAttempts = policy.attempts
    .filter((a) => a.userName === selectedUser || a.fileId === selectedFile)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
            <Shield className="w-3 h-3" /> File Access Policy Test
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">
          {/* User + File Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                User
              </Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-7 text-[9px] bg-background/50">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {policy.users.map((user) => (
                    <SelectItem key={user} value={user} className="text-[9px]">
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                File
              </Label>
              <Select value={selectedFile} onValueChange={setSelectedFile}>
                <SelectTrigger className="h-7 text-[9px] bg-background/50">
                  <SelectValue placeholder="Select file" />
                </SelectTrigger>
                <SelectContent>
                  {policy.files.map((file) => (
                    <SelectItem key={file.id} value={file.id} className="text-[9px]">
                      {file.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action + Context */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                Action
              </Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="h-7 text-[9px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((action) => (
                    <SelectItem key={action} value={action} className="text-[9px]">
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                Device
              </Label>
              <Input
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="h-7 text-[9px] bg-background/50"
                placeholder="laptop-corp-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                Application
              </Label>
              <Input
                value={application}
                onChange={(e) => setApplication(e.target.value)}
                className="h-7 text-[9px] bg-background/50"
                placeholder="FileExplorer"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                MB
              </Label>
              <Input
                type="number"
                step="0.1"
                value={bytesMb}
                onChange={(e) => setBytesMb(e.target.value)}
                className="h-7 text-[9px] bg-background/50 tabular-nums"
                placeholder="1.5"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                File Count
              </Label>
              <Input
                type="number"
                value={fileCount}
                onChange={(e) => setFileCount(e.target.value)}
                className="h-7 text-[9px] bg-background/50 tabular-nums"
                placeholder="1"
              />
            </div>
          </div>

          <Button
            onClick={handleEvaluate}
            disabled={!selectedUser || !selectedFile || evaluateMutation.isPending}
            className="w-full h-8 text-[10px] font-bold tracking-widest uppercase bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Activity className="w-3 h-3 mr-1.5" />
            {evaluateMutation.isPending ? "EVALUATING..." : "EVALUATE ACCESS"}
          </Button>
        </CardContent>
      </Card>

      {/* User Trust / Containment State */}
      {selectedUser && (
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
              <User className="w-3 h-3" /> User State: {selectedUser}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {selectedUserContainment ? (
              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase text-destructive">
                    CONTAINED
                  </span>
                  <Badge
                    variant="destructive"
                    className="text-[7px] h-4 px-1 animate-pulse"
                  >
                    ACTIVE
                  </Badge>
                </div>
                <div className="text-[8px] text-muted-foreground">
                  Reason: {selectedUserContainment.reason}
                </div>
                <div className="text-[8px] text-muted-foreground">
                  Severed: {selectedUserContainment.severedConnections}
                </div>
                {selectedUserContainment.startedAt && (
                  <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(selectedUserContainment.startedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 bg-primary/5 border border-primary/30 rounded">
                <div className="text-[9px] font-bold uppercase text-primary">
                  NOT CONTAINED
                </div>
                <div className="text-[8px] text-muted-foreground">
                  User operates with standard trust evaluation
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Classification + Grant */}
      {selectedFileData && (
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
              <FileText className="w-3 h-3" /> File: {selectedFileData.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[8px]">
              <div>
                <span className="text-muted-foreground uppercase tracking-wider">
                  Classification
                </span>
                <div className="font-bold text-primary mt-0.5">
                  {selectedFileData.classification}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider">
                  Department
                </span>
                <div className="font-bold text-foreground mt-0.5">
                  {selectedFileData.department}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider">
                  Owner
                </span>
                <div className="font-bold text-foreground mt-0.5">
                  {selectedFileData.owner}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider">
                  Size
                </span>
                <div className="font-bold text-foreground mt-0.5 tabular-nums">
                  {selectedFileData.sizeMb.toFixed(2)} MB
                </div>
              </div>
            </div>

            {selectedUser && selectedUserGrant && (
              <div className="pt-1 border-t border-border/50">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1">
                  Grant Level
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-bold text-primary">
                    {selectedUserGrant.accessLevel}
                  </div>
                  <Badge
                    variant={selectedUserGrant.granted ? "outline" : "destructive"}
                    className="text-[7px] h-4 px-1"
                  >
                    {selectedUserGrant.granted ? "GRANTED" : "DENIED"}
                  </Badge>
                </div>
                <div className="text-[8px] text-muted-foreground mt-0.5">
                  Role: {selectedUserGrant.role}
                </div>
              </div>
            )}

            {selectedUser && !selectedUserGrant && (
              <div className="pt-1 border-t border-border/50">
                <div className="text-[8px] text-yellow-500 uppercase font-bold">
                  NO EXPLICIT GRANT
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decision Result */}
      {lastDecision && (
        <Card
          className={`border backdrop-blur ${
            lastDecision.allowed
              ? "border-green-500/50 bg-green-500/5"
              : "border-destructive/50 bg-destructive/5"
          }`}
        >
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-[9px] uppercase flex items-center gap-2">
              {lastDecision.allowed ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 text-destructive" />
              )}
              <span
                className={
                  lastDecision.allowed ? "text-green-500" : "text-destructive"
                }
              >
                {lastDecision.allowed ? "ACCESS ALLOWED" : "ACCESS DENIED"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            <div className="text-[9px] text-foreground">{lastDecision.message}</div>

            {lastDecision.indicators && lastDecision.indicators.length > 0 && (
              <div className="space-y-1">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
                  Indicators
                </div>
                <div className="flex flex-wrap gap-1">
                  {lastDecision.indicators.map((ind: string, i: number) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[7px] h-4 px-1 border-yellow-500/50 text-yellow-500"
                    >
                      {ind}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {lastDecision.attempt && (
              <div className="grid grid-cols-3 gap-2 text-[8px] pt-1 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">
                    Threat
                  </span>
                  <div className="font-bold text-destructive tabular-nums mt-0.5">
                    {lastDecision.attempt.effectiveThreatScore.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">
                    Trust Before
                  </span>
                  <div className="font-bold text-primary tabular-nums mt-0.5">
                    {lastDecision.attempt.trustBefore.toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">
                    Trust After
                  </span>
                  <div
                    className={`font-bold tabular-nums mt-0.5 ${
                      lastDecision.attempt.trustAfter <
                      lastDecision.attempt.trustBefore
                        ? "text-yellow-500"
                        : "text-primary"
                    }`}
                  >
                    {lastDecision.attempt.trustAfter.toFixed(1)}
                  </div>
                </div>
              </div>
            )}

            {lastDecision.contained && (
              <div className="pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-destructive">
                  <Lock className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase">
                    USER NOW CONTAINED
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Attempts */}
      {recentAttempts.length > 0 && (
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
              <Clock className="w-3 h-3" /> Recent Attempts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="text-[8px] p-1.5 border-b border-border/50 flex items-center justify-between hover:bg-background/30 transition-colors"
              >
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {attempt.userName}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-primary truncate max-w-[100px]">
                      {policy.files.find((f) => f.id === attempt.fileId)?.name ||
                        attempt.fileId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="uppercase tracking-wider">
                      {attempt.action}
                    </span>
                    <span>·</span>
                    <span>{new Date(attempt.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
                <Badge
                  variant={attempt.allowed ? "outline" : "destructive"}
                  className="text-[7px] h-4 px-1 shrink-0"
                >
                  {attempt.allowed ? "ALLOW" : "DENY"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scoring Formula Constants */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-[9px] text-muted-foreground uppercase flex items-center gap-2">
            <Database className="w-3 h-3" /> Scoring Formula
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-[8px]">
            <div>
              <span className="text-muted-foreground uppercase tracking-wider">
                Gamma
              </span>
              <div className="font-bold text-primary tabular-nums mt-0.5">
                {policy.scoring.gamma.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase tracking-wider">
                Beta
              </span>
              <div className="font-bold text-primary tabular-nums mt-0.5">
                {policy.scoring.beta.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase tracking-wider">
                Kappa
              </span>
              <div className="font-bold text-primary tabular-nums mt-0.5">
                {policy.scoring.kappa.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground uppercase tracking-wider">
                Reward ηr
              </span>
              <div className="font-bold text-green-500 tabular-nums mt-0.5">
                {policy.scoring.rewardRate.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="pt-1 border-t border-border/50 space-y-1">
            <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
              Thresholds
            </div>
            <div className="grid grid-cols-2 gap-2 text-[8px]">
              <div>
                <span className="text-muted-foreground">Trust Baseline</span>
                <div className="font-bold text-primary tabular-nums">
                  {policy.scoring.trustBaseline.toFixed(1)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Containment</span>
                <div className="font-bold text-destructive tabular-nums">
                  {policy.scoring.trustContainmentThreshold.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="text-[8px]">
              <span className="text-muted-foreground">Effective Threat</span>
              <div className="font-bold text-yellow-500 tabular-nums">
                {policy.scoring.effectiveThreatThreshold.toFixed(1)}
              </div>
            </div>
            <div className="text-[8px]">
              <span className="text-muted-foreground">Idle Drift λ</span>
              <div className="font-bold text-yellow-500 tabular-nums">
                {(policy.scoring.lambda ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          {Object.keys(policy.scoring.penaltyRates).length > 0 && (
            <div className="pt-1 border-t border-border/50 space-y-1">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
                Penalty Rates
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(policy.scoring.penaltyRates).map(([key, val]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="text-[7px] h-4 px-1 border-yellow-500/30 font-mono"
                  >
                    {key}: {val}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {Object.keys(policy.scoring.criticalityCosts).length > 0 && (
            <div className="pt-1 border-t border-border/50 space-y-1">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider">
                Criticality Costs
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(policy.scoring.criticalityCosts).map(
                  ([key, val]) => (
                    <Badge
                      key={key}
                      variant="outline"
                      className="text-[7px] h-4 px-1 border-destructive/30 font-mono"
                    >
                      {key}: {val}
                    </Badge>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
