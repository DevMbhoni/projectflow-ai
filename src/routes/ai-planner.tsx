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

interface ParsedTask {
  task: string;
  due: string;
  prio: string;
  hours: number;
  score: number;
  daysToDue: number;
}

interface Plan {
  prioritized: { task: string; reason: string; bucket: string; due: string; hours: number }[];
  schedule: { slot: string; task: string }[];
  tips: string[];
  risks: string[];
  nextSteps: string[];
}

const prioScore = (p: string) =>
  p.includes("critical") ? 4 : p.includes("high") ? 3 : p.includes("medium") || p.includes("med") ? 2 : 1;

const parseDueToDays = (s: string): number => {
  const lower = s.toLowerCase();
  if (/today|eod/.test(lower)) return 0;
  if (/tomorrow/.test(lower)) return 1;
  const wd = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const idx = wd.findIndex((d) => lower.includes(d));
  if (idx >= 0) {
    const today = new Date().getDay();
    let diff = idx - today;
    if (diff <= 0) diff += 7;
    return diff;
  }
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return Math.max(0, Math.round((new Date(iso[0]).getTime() - Date.now()) / 86400000));
  if (/this week|eow|end of week/.test(lower)) return 4;
  if (/next week/.test(lower)) return 9;
  return 7;
};

const parseHours = (s: string): number => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\b/i);
  return m ? parseFloat(m[1]) : 2;
};

function PlannerPage() {
  const { addOutput } = useStore();
  const [tasks, setTasks] = useState(
    "Finalize homepage wireframes — Fri — high — 4h\nDraft Q3 launch emails — Wed — medium — 2h\nReview CRM data audit — Mon — medium — 1.5h\nPrep Northwind demo deck — Thu — critical — 3h",
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
        const parts = line.split(/[—–-]/).map((s) => s.trim());
        const t = parts[0] || line;
        const due = parts[1] || NOT_SPECIFIED;
        const prio = (parts[2] || importance).toLowerCase();
        const hoursStr = parts[3] || "";
        const h = parseHours(hoursStr);
        const daysToDue = due === NOT_SPECIFIED ? 7 : parseDueToDays(due);
        const urgencyBoost = daysToDue <= 1 ? 2 : daysToDue <= 3 ? 1 : 0;
        return { task: t, due, prio, hours: h, daysToDue, score: prioScore(prio) * 2 + urgencyBoost };
      })
      .sort((a, b) => b.score - a.score);

    if (items.length === 0) return toast.error("Add at least one task");

    const bucketFor = (it: ParsedTask): string => {
      if (it.score >= 7) return "Do first";
      if (it.score >= 5) return "Schedule";
      if (it.score >= 3) return "Delegate";
      return "Defer";
    };

    const reasonFor = (it: ParsedTask): string => {
      const urgency =
        it.daysToDue === 0
          ? `due today`
          : it.daysToDue === 1
            ? `due tomorrow`
            : it.due === NOT_SPECIFIED
              ? `no deadline set`
              : `due in ${it.daysToDue} day${it.daysToDue === 1 ? "" : "s"} (${it.due})`;
      return `${it.prio} priority, ${urgency}, ~${it.hours}h of effort.`;
    };

    // Schedule packing: fit tasks into the hours budget per day or week
    const totalCapacity = range === "daily" ? hours : hours * 5;
    let remaining = totalCapacity;
    const slotLabels =
      range === "daily"
        ? ["9:00 – 10:30", "10:45 – 12:00", "13:00 – 14:30", "14:45 – 16:00", "16:15 – 17:30"]
        : ["Mon AM", "Mon PM", "Tue AM", "Tue PM", "Wed AM", "Wed PM", "Thu AM", "Thu PM", "Fri AM"];

    const schedule: { slot: string; task: string }[] = [];
    let slotIdx = 0;
    for (const it of items) {
      if (slotIdx >= slotLabels.length) break;
      if (remaining <= 0) break;
      const fitted = Math.min(it.hours, remaining);
      schedule.push({
        slot: slotLabels[slotIdx++],
        task: `${it.task} (${fitted}h${fitted < it.hours ? " — partial; continue next session" : ""})`,
      });
      remaining -= fitted;
    }

    const totalEffort = items.reduce((s, it) => s + it.hours, 0);
    const overload = totalEffort > totalCapacity;

    const risks: string[] = [];
    if (overload) {
      risks.push(
        `Total effort (${totalEffort}h) exceeds available capacity (${totalCapacity}h) — consider deferring or delegating lower-priority items.`,
      );
    }
    const today = items.filter((i) => i.daysToDue === 0);
    if (today.length > 1) risks.push(`${today.length} tasks are due today — risk of context-switching loss.`);
    const noDue = items.filter((i) => i.due === NOT_SPECIFIED);
    if (noDue.length) risks.push(`${noDue.length} task(s) have no deadline — clarify before they slip.`);
    if (!risks.length) risks.push("No major risks detected with the current load.");

    const tips: string[] = [];
    const topTwo = items.slice(0, 2).map((i) => i.task).join(" and ");
    if (topTwo) tips.push(`Protect your first deep-focus block for ${topTwo}.`);
    const shallow = items.filter((i) => /email|review|update|reply|admin/i.test(i.task));
    if (shallow.length) {
      tips.push(`Batch shallow work (${shallow.map((s) => s.task).join(", ")}) into one afternoon block.`);
    }
    tips.push(
      `You have ${hours}h per day available — aim to keep 1h unbooked for unplanned requests and recovery.`,
    );

    const p: Plan = {
      prioritized: items.map((it) => ({
        task: it.task,
        bucket: bucketFor(it),
        reason: reasonFor(it),
        due: it.due,
        hours: it.hours,
      })),
      schedule,
      tips,
      risks,
      nextSteps: [
        `Block the ${schedule.length} suggested slot${schedule.length === 1 ? "" : "s"} on your calendar now.`,
        items[0] ? `Start with "${items[0].task}" while energy is highest.` : "Pick a starting task.",
        overload
          ? `Negotiate scope on ${items[items.length - 1].task} — it's the lowest-leverage item this ${range === "daily" ? "day" : "week"}.`
          : `Re-run this planner at end-of-${range === "daily" ? "day" : "week"} to rebalance.`,
      ],
    };
    setPlan(p);
    addOutput({
      type: "Task Plan",
      title: `${range === "daily" ? "Daily" : "Weekly"} plan — ${new Date().toISOString().slice(0, 10)}`,
    });
    toast.success("Plan generated");
  };

  const copyPlan = () => {
    if (!plan) return;
    const text = [
      "Prioritized:",
      ...plan.prioritized.map((p) => ` - [${p.bucket}] ${p.task} — ${p.reason}`),
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioritized list</h3>
                  <div className="space-y-2">
                    {plan.prioritized.map((p, i) => (
                      <div key={i} className="rounded-lg border bg-background/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{p.task}</p>
                          <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">{p.bucket}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended schedule</h3>
                  <div className="divide-y rounded-lg border">
                    {plan.schedule.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground">{s.slot}</span>
                        <span className="text-right">{s.task}</span>
                      </div>
                    ))}
                  </div>
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
