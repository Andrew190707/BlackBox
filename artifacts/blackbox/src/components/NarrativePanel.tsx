import { useGetNarrative } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";

export function NarrativePanel() {
  const { data, refetch } = useGetNarrative();
  const [displayed, setDisplayed] = useState("");
  const [idx, setIdx] = useState(0);

  const summary = data?.summary ?? "";

  useEffect(() => {
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    setDisplayed("");
    setIdx(0);
  }, [summary]);

  useEffect(() => {
    if (idx >= summary.length) return;
    const t = setTimeout(() => {
      setDisplayed((prev) => prev + summary[idx]);
      setIdx((i) => i + 1);
    }, 12);
    return () => clearTimeout(t);
  }, [idx, summary]);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded min-h-[64px]">
        <Terminal className="w-3 h-3 text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-foreground/90">
          {displayed}
          {idx < summary.length && (
            <span className="inline-block w-1.5 h-3 bg-primary ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
      {data && (
        <div className="flex items-center justify-between text-[8px] text-muted-foreground px-1">
          <span>Generated {new Date(data.generatedAt).toLocaleTimeString()}</span>
          <span>{data.eventCount} events analyzed</span>
        </div>
      )}
    </div>
  );
}
