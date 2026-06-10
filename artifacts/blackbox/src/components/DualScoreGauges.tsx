import { useGetRiskScore, useGetTrustScore } from "@workspace/api-client-react";

function Gauge({
  value,
  label,
  sublabel,
  color,
  trackClass,
  size = 100,
}: {
  value: number;
  label: string;
  sublabel: string;
  color: string;
  trackClass: string;
  size?: number;
}) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" className={trackClass} />
          <circle
            cx="50" cy="50" r={r} fill="none" strokeWidth="7"
            stroke={color} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>{Math.round(value)}</span>
          <span className="text-[8px] text-muted-foreground mt-0.5">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</div>
        <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{sublabel}</div>
      </div>
    </div>
  );
}

export function DualScoreGauges() {
  const { data: riskScore }      = useGetRiskScore();
  const { data: trustScoreData } = useGetTrustScore();

  const threatScore = riskScore?.score ?? 0;
  const trustScore  = trustScoreData?.score ?? 100;
  const trustLevel  = trustScoreData?.level ?? "HEALTHY";

  const threatColor =
    riskScore?.threatState === "RED"    ? "#ef4444" :
    riskScore?.threatState === "ORANGE" ? "#f97316" :
    riskScore?.threatState === "YELLOW" ? "#eab308" :
    "#22c55e";

  const trustColor =
    trustLevel === "CRITICAL" ? "#ef4444" :
    trustLevel === "DEGRADED" ? "#f97316" :
    "#22c55e";

  return (
    <div className="flex items-center justify-around py-3 px-2">
      <Gauge
        value={threatScore}
        label="Threat"
        sublabel={riskScore?.threatState ?? "GREEN"}
        color={threatColor}
        trackClass="stroke-muted opacity-20"
        size={96}
      />
      <div className="w-px h-16 bg-border/50" />
      <Gauge
        value={trustScore}
        label="Trust"
        sublabel={trustLevel}
        color={trustColor}
        trackClass="stroke-muted opacity-20"
        size={96}
      />
    </div>
  );
}
