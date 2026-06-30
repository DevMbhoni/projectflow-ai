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
import { Sparkles, Copy, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-planner")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — ProjectFlow AI" },
      { name: "description", content: "Generate a prioritized daily or weekly work plan from your task list." },
    ],
  }),
  component: PlannerPage,
});

interface Plan {
  prioritized: { task: string; reason: string; bucket: string }[];
  schedule: { slot: string; task: string }[];
  tips: string[];
  nextSteps: string[];
}

function PlannerPage() {
  const { addOutput } = useStore();
  const [tasks, setTasks] = useState(
    "Finalize homepage wireframes — due Fri — high\nDraft Q3 launch emails — due Wed — medium\nReview CRM data audit — due Mon — medium\nPrep Northwind demo deck — due Thu — critical",
  );
  const [importance, setImportance] = useState("high");
  const [hours, setHours] = useState(6);
  const [range, setRange] = useState("daily");
  const [plan, setPlan] = useState<Plan | null>(null);

  const generate = () => {
    const items = tasks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("—").map((s) => s.trim());
        const t = parts[0] ?? line;
        const due = parts[1] ?? "this week";
        const prio = (parts[2] ?? importance).toLowerCase();
        const score =
          prio.includes("critical") ? 4 : prio.includes("high") ? 3 : prio.includes("medium") ? 2 : 1;
        return { task: t, due, prio, score };
      })
      .sort((a, b) => b.score - a.score);

    if (items.length === 0) return toast.error("Add at least one task");

    const buckets = ["Do first", "Schedule", "Delegate", "Defer"];
    const slotLabels =
      range === "daily"
        ? ["9:00 – 10:30", "10:45 – 12:00", "13:00 – 14:30", "14:45 – 16:00", "16:15 – 17:30"]
        : ["Monday AM", "Monday PM", "Tuesday AM", "Wednesday PM", "Thursday AM"];

    const p: Plan = {
      prioritized: items.map((it, i) => ({
        task: it.task,
        bucket: buckets[Math.min(i, buckets.length - 1)],
        reason:
          it.score >= 3
            ? `High urgency (${it.due}) — protect deep focus time.`
            : `Lower urgency (${it.due}) — batch with similar work.`,
      })),
      schedule: items.slice(0, slotLabels.length).map((it, i) => ({
        slot: slotLabels[i],
        task: it.task,
      })),
      tips: [
        `You have roughly ${hours}h of focus time — protect at least 60% for the top two priorities.`,
        "Batch shallow work (emails, reviews) into one afternoon block.",
        "Add a 15-minute end-of-day review to roll unfinished work into tomorrow.",
      ],
      nextSteps: [
        "Confirm deadlines with stakeholders for any critical items.",
        "Block the recommended slots on your calendar.",
        "Re-run this planner end-of-day to rebalance for tomorrow.",
      ],
    };
    setPlan(p);
    addOutput({ type: "Task Plan", title: `${range === "daily" ? "Daily" : "Weekly"} plan — ${new Date().toISOString().slice(0, 10)}` });
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
      "Tips:",
      ...plan.tips.map((t) => ` - ${t}`),
      "",
      "Next steps:",
      ...plan.nextSteps.map((t) => ` - ${t}`),
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
            <CardDescription>One task per line: title — deadline — priority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Tasks</Label>
              <Textarea rows={8} value={tasks} onChange={(e) => setTasks(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Overall importance</Label>
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
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground">{s.slot}</span>
                        <span>{s.task}</span>
                      </div>
                    ))}
                  </div>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
