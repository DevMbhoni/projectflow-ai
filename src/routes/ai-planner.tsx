import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Sparkles, Copy, CalendarClock, Info } from "lucide-react";
import { toast } from "sonner";
import { DISCLAIMER, NOT_SPECIFIED } from "@/lib/ai-helpers";

export const Route = createFileRoute("/ai-planner")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — ProjectFlow AI" },
      { name: "description", content: "Generate a prioritized daily or weekly work plan from your task list." },
    ],
  }),
  component: PlannerPage,
});

type Bucket = "Do first" | "Schedule today" | "Schedule later" | "Delegate" | "Defer";

interface ParsedTask {
  task: string;
  dueRaw: string;     // user's original phrase
  dueLabel: string;   // friendly label e.g. "Due: Friday" or "No deadline"
  prio: string;
  hours: number;
  daysToDue: number;  // estimated days; Infinity if unknown
  score: number;
}

interface ScheduleBlock { slot: string; task: string; hours: number }
interface PrioritizedItem { task: string; reason: string; bucket: Bucket; due: string; hours: number }

interface Plan {
  prioritized: PrioritizedItem[];
  schedule: ScheduleBlock[];
  capacity: { total: number; used: number; required: number; fits: string[]; movedLater: string[] };
  tips: string[];
  risks: string[];
  nextSteps: string[];
}

const prioScore = (p: string) =>
  p.includes("critical") ? 4 : p.includes("high") ? 3 : p.includes("medium") || p.includes("med") ? 2 : 1;

const parseDueToDays = (s: string): number => {
  const lower = s.toLowerCase().trim();
  if (!lower || lower === "n/a" || lower === "none") return Infinity;
  if (/\btoday\b|\beod\b/.test(lower)) return 0;
  if (/\btomorrow\b/.test(lower)) return 1;
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return Math.max(0, Math.round((new Date(iso[0]).getTime() - Date.now()) / 86400000));
  const wd = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const isNext = /\bnext\b/.test(lower);
  const idx = wd.findIndex((d) => new RegExp(`\\b${d}\\b|\\b${d.slice(0,3)}\\b`).test(lower));
  if (idx >= 0) {
    const today = new Date().getDay();
    let diff = idx - today;
    if (diff <= 0) diff += 7;
    if (isNext) diff += 7;
    return diff;
  }
  if (/\bthis week\b|\beow\b|\bend of week\b/.test(lower)) return 4;
  if (/\bnext week\b/.test(lower)) return 9;
  return Infinity;
};

const parseHours = (s: string): number => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\b/i);
  return m ? parseFloat(m[1]) : 2;
};

const titleCaseDue = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return NOT_SPECIFIED;
  return trimmed
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
};

// Format hours as "1h", "1.5h", "30m"
const fmtHours = (h: number): string => {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return Number.isInteger(h) ? `${h}h` : `${h}h`;
};

function PlannerPage() {
  const { addOutput } = useStore();
  const [tasks, setTasks] = useState(
    "Finalize homepage wireframes — Friday — high — 4h\nDraft Q3 launch emails — Wednesday — medium — 2h\nReview CRM data audit — Monday — medium — 1.5h\nPrep Northwind demo deck — tomorrow — critical — 3h",
  );
  const [importance, setImportance] = useState("high");
  const [hours, setHours] = useState(6);
  const [range, setRange] = useState("daily");
  const [plan, setPlan] = useState<Plan | null>(null);

  const generate = () => {
    const items: ParsedTask[] = tasks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+[—–-]\s+/).map((s) => s.trim());
        const t = parts[0] || line;
        const dueRaw = parts[1] || "";
        const prio = (parts[2] || importance).toLowerCase();
        const hoursStr = parts[3] || "";
        const h = parseHours(hoursStr);
        const daysToDue = dueRaw ? parseDueToDays(dueRaw) : Infinity;
        const dueLabel = dueRaw ? `Due: ${titleCaseDue(dueRaw)}` : "No deadline set";
        // Urgency-first scoring: urgency dominates importance.
        let urgency = 0;
        if (daysToDue === 0) urgency = 5;
        else if (daysToDue === 1) urgency = 4;
        else if (daysToDue <= 3) urgency = 3;
        else if (daysToDue <= 7) urgency = 2;
        else if (Number.isFinite(daysToDue)) urgency = 1;
        const score = urgency * 3 + prioScore(prio) - Math.min(h, 4) * 0.1;
        return { task: t, dueRaw, dueLabel, prio, hours: h, daysToDue, score };
      })
      .sort((a, b) => b.score - a.score);

    if (items.length === 0) return toast.error("Add at least one task");

    const bucketFor = (it: ParsedTask): Bucket => {
      const pri = prioScore(it.prio);
      if (it.daysToDue <= 1 && pri >= 3) return "Do first";
      if (it.daysToDue <= 1) return "Schedule today";
      if (it.daysToDue <= 3 && pri >= 3) return "Schedule today";
      if (it.daysToDue <= 7) return "Schedule later";
      if (pri <= 1 && (it.daysToDue > 7 || !Number.isFinite(it.daysToDue))) return "Defer";
      if (pri <= 2 && it.hours >= 4) return "Delegate";
      return "Schedule later";
    };

    const reasonFor = (it: ParsedTask): string => {
      const urgency =
        it.daysToDue === 0
          ? "due today"
          : it.daysToDue === 1
            ? "due tomorrow"
            : !Number.isFinite(it.daysToDue)
              ? "no deadline set"
              : `${it.dueLabel.replace(/^Due:\s*/, "due ")}`;
      return `${it.prio.charAt(0).toUpperCase() + it.prio.slice(1)} priority, ${urgency}, ~${fmtHours(it.hours)} of effort.`;
    };

    // Capacity-aware schedule packing.
    const totalCapacity = range === "daily" ? hours : hours * 5;
    const slotLabels =
      range === "daily"
        ? ["9:00 – 10:30", "10:45 – 12:00", "13:00 – 14:30", "14:45 – 16:00", "16:15 – 17:30"]
        : ["Mon AM", "Mon PM", "Tue AM", "Tue PM", "Wed AM", "Wed PM", "Thu AM", "Thu PM", "Fri AM"];
    const slotHours = range === "daily" ? 1.5 : 3;

    let remaining = totalCapacity;
    const schedule: ScheduleBlock[] = [];
    const fits: string[] = [];
    const movedLater: string[] = [];
    let slotIdx = 0;

    // Only items eligible for today's schedule get blocks.
    const schedulable = items.filter((i) => {
      const b = bucketFor(i);
      return b === "Do first" || b === "Schedule today";
    });
    const overflowEligible = items.filter((i) => !schedulable.includes(i));

    for (const it of schedulable) {
      if (remaining <= 0 || slotIdx >= slotLabels.length) {
        movedLater.push(it.task);
        continue;
      }
      let needed = it.hours;
      let sessionNum = 0;
      const sessions: number[] = [];
      while (needed > 0 && remaining > 0 && slotIdx < slotLabels.length) {
        const block = Math.min(needed, slotHours, remaining);
        sessions.push(block);
        schedule.push({
          slot: slotLabels[slotIdx++],
          task:
            sessions.length > 1 || needed - block > 0
              ? `${it.task} — session ${++sessionNum} of ${Math.ceil(it.hours / slotHours)} (${fmtHours(block)})`
              : `${it.task} (${fmtHours(block)})`,
          hours: block,
        });
        needed -= block;
        remaining -= block;
      }
      if (needed > 0) {
        movedLater.push(`${it.task} — ${fmtHours(needed)} remaining`);
      } else {
        fits.push(it.task);
      }
    }
    for (const it of overflowEligible) movedLater.push(it.task);

    const totalRequired = items.reduce((s, it) => s + it.hours, 0);
    const used = totalCapacity - remaining;
    const overload = totalRequired > totalCapacity;

    // Risks
    const risks: string[] = [];
    if (overload) {
      risks.push(
        `Total required effort is ${fmtHours(totalRequired)} but only ${fmtHours(totalCapacity)} are available — ${movedLater.length} item(s) need to move.`,
      );
    }
    const dueToday = items.filter((i) => i.daysToDue === 0);
    if (dueToday.length > 1) risks.push(`${dueToday.length} tasks are due today — risk of context-switching loss.`);
    const noDue = items.filter((i) => !Number.isFinite(i.daysToDue));
    if (noDue.length) risks.push(`${noDue.length} task(s) have no deadline — clarify before they slip.`);
    const overdueLike = items.filter((i) => i.daysToDue < 0);
    if (overdueLike.length) risks.push(`${overdueLike.length} task(s) appear to be past their deadline.`);
    if (!risks.length) risks.push("Current load fits within available capacity.");

    // Tips
    const tips: string[] = [];
    const top = items[0];
    if (top) tips.push(`Protect your first focus block for "${top.task}" — it scores highest on urgency and priority.`);
    const shallow = items.filter((i) => /email|review|update|reply|admin|chase|ping/i.test(i.task));
    if (shallow.length >= 2) {
      tips.push(`Batch shallow work (${shallow.map((s) => s.task).join(", ")}) into one afternoon block.`);
    }
    tips.push(`Keep ~${Math.max(0.5, hours - used).toFixed(1)}h unbooked for unplanned requests and recovery.`);

    const nextSteps: string[] = [];
    if (schedule.length) nextSteps.push(`Block the ${schedule.length} suggested slot(s) on your calendar now.`);
    if (top) nextSteps.push(`Start with "${top.task}" while energy is highest.`);
    if (movedLater.length) {
      nextSteps.push(`Reschedule or delegate: ${movedLater.join("; ")}.`);
    } else {
      nextSteps.push(`Re-run this planner at end-of-${range === "daily" ? "day" : "week"} to rebalance.`);
    }

    const prioritized: PrioritizedItem[] = items.map((it) => ({
      task: it.task,
      bucket: bucketFor(it),
      reason: reasonFor(it),
      due: it.dueRaw ? titleCaseDue(it.dueRaw) : NOT_SPECIFIED,
      hours: it.hours,
    }));

    setPlan({
      prioritized,
      schedule,
      capacity: { total: totalCapacity, used, required: totalRequired, fits, movedLater },
      tips,
      risks,
      nextSteps,
    });
    addOutput({
      type: "Task Plan",
      title: `${range === "daily" ? "Daily" : "Weekly"} plan — ${new Date().toISOString().slice(0, 10)}`,
    });
    toast.success("Plan generated");
  };

  const copyPlan = () => {
    if (!plan) return;
    const text = [
      "Capacity:",
      ` - Available: ${fmtHours(plan.capacity.total)}`,
      ` - Required: ${fmtHours(plan.capacity.required)}`,
      ` - Scheduled: ${fmtHours(plan.capacity.used)}`,
      ...(plan.capacity.fits.length ? [" - Fits today:", ...plan.capacity.fits.map((f) => `    • ${f}`)] : []),
      ...(plan.capacity.movedLater.length ? [" - Moved later:", ...plan.capacity.movedLater.map((f) => `    • ${f}`)] : []),
      "",
      "Prioritized:",
      ...plan.prioritized.map((p) => ` - [${p.bucket}] ${p.task} — ${p.reason} (Due: ${p.due})`),
      "",
      "Schedule:",
      ...plan.schedule.map((s) => ` - ${s.slot}: ${s.task}`),
      "",
      "Risks / blockers:",
      ...plan.risks.map((t) => ` - ${t}`),
      "",
      "Time optimization tips:",
      ...plan.tips.map((t) => ` - ${t}`),
      "",
      "Next steps:",
      ...plan.nextSteps.map((t) => ` - ${t}`),
      "",
      DISCLAIMER,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const bucketColor: Record<Bucket, string> = {
    "Do first": "border-red-200 bg-red-50 text-red-700",
    "Schedule today": "border-accent/30 bg-accent/10 text-accent",
    "Schedule later": "border-blue-200 bg-blue-50 text-blue-700",
    Delegate: "border-amber-200 bg-amber-50 text-amber-800",
    Defer: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <>
      <PageHeader title="AI Task Planner" description="Turn a list of tasks into a focused, prioritized plan." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs</CardTitle>
            <CardDescription>One task per line: title — deadline — priority — hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Tasks</Label>
              <Textarea rows={8} value={tasks} onChange={(e) => setTasks(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Default priority</Label>
                <Select value={importance} onValueChange={setImportance}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Hours available</Label>
                <Input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Plan range</Label>
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={generate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> Generate plan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-accent" /> Generated plan
              </CardTitle>
              <CardDescription>Review reasoning before committing.</CardDescription>
            </div>
            {plan && (
              <Button variant="outline" size="sm" className="gap-2" onClick={copyPlan}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!plan ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-6 w-6 text-accent/60" />
                Your plan will appear here.
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capacity check</h3>
                  <div className="rounded-lg border bg-background/60 p-3 space-y-2">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <span><span className="text-muted-foreground">Available:</span> <strong>{fmtHours(plan.capacity.total)}</strong></span>
                      <span><span className="text-muted-foreground">Required:</span> <strong>{fmtHours(plan.capacity.required)}</strong></span>
                      <span><span className="text-muted-foreground">Scheduled:</span> <strong>{fmtHours(plan.capacity.used)}</strong></span>
                    </div>
                    {plan.capacity.fits.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-emerald-700">Fits today</p>
                        <ul className="list-disc pl-5 text-xs">{plan.capacity.fits.map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}
                    {plan.capacity.movedLater.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-amber-700">Move later</p>
                        <ul className="list-disc pl-5 text-xs">{plan.capacity.movedLater.map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioritized list</h3>
                  <div className="space-y-2">
                    {plan.prioritized.map((p, i) => (
                      <div key={i} className="rounded-lg border bg-background/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{p.task}</p>
                          <Badge variant="outline" className={bucketColor[p.bucket]}>{p.bucket}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.reason} · Due: {p.due}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended schedule</h3>
                  {plan.schedule.length ? (
                    <div className="divide-y rounded-lg border">
                      {plan.schedule.map((s, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-xs font-medium text-muted-foreground">{s.slot}</span>
                          <span className="text-right">{s.task}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tasks scheduled for today — all items are scheduled later or deferred.</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks &amp; blockers</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {plan.risks.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time optimization tips</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {plan.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested next steps</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {plan.nextSteps.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{DISCLAIMER}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
