import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Sparkles, Copy, BarChart3, Info } from "lucide-react";
import { toast } from "sonner";
import { DISCLAIMER, NOT_SPECIFIED, splitSentences, classifySentences } from "@/lib/ai-helpers";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Project Reports — ProjectFlow AI" },
      { name: "description", content: "Generate clear, structured project status reports in seconds." },
    ],
  }),
  component: ReportsPage,
});

interface Report {
  summary: string;
  completed: string[];
  pending: string[];
  risks: string[];
  recommendations: string[];
  nextSteps: string[];
}

const COMPLETED_RE = /\b(done|completed|finished|shipped|launched|delivered|signed off|approved|merged|deployed)\b/i;
const PENDING_RE = /\b(in progress|wip|started|drafting|building|reviewing|pending|to do|todo|planned|scheduled|upcoming)\b/i;

function ReportsPage() {
  const { projects, tasks, addOutput } = useStore();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [notes, setNotes] = useState(
    "Design system tokens complete. Auth screens started. Awaiting API spec for loyalty endpoints. Stakeholder review scheduled next Tuesday.",
  );
  const [report, setReport] = useState<Report | null>(null);

  const generate = () => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return toast.error("Select a project");
    if (!notes.trim()) return toast.error("Add progress notes");

    const sentences = splitSentences(notes);
    const { decisions, actions, risks: noteRisks } = classifySentences(sentences);

    const completedFromNotes = sentences.filter((s) => COMPLETED_RE.test(s));
    const pendingFromNotes = sentences.filter(
      (s) => PENDING_RE.test(s) && !COMPLETED_RE.test(s),
    );

    const projTasks = tasks.filter((t) => t.projectId === projectId);
    const completedTasks = projTasks.filter((t) => t.status === "Completed").map((t) => t.title);
    const pendingTasks = projTasks.filter((t) => t.status !== "Completed").map((t) => `${t.title} (${t.status}, owner: ${t.assignee})`);

    const completed = [...completedFromNotes, ...completedTasks];
    const pending = [...pendingFromNotes, ...pendingTasks, ...actions];

    const dueInDays = Math.round((new Date(project.dueDate).getTime() - Date.now()) / 86400000);
    const dueDescriptor =
      dueInDays < 0
        ? `${Math.abs(dueInDays)} days overdue`
        : dueInDays === 0
          ? "due today"
          : `${dueInDays} days remaining`;

    const completionRate = projTasks.length
      ? Math.round((completedTasks.length / projTasks.length) * 100)
      : 0;

    const summary =
      `${project.name} (client: ${project.client || NOT_SPECIFIED}) is currently ${project.status} ` +
      `with ${project.priority.toLowerCase()} priority. Target milestone: ${project.dueDate} (${dueDescriptor}). ` +
      `${projTasks.length ? `Of ${projTasks.length} tracked tasks, ${completedTasks.length} (${completionRate}%) are complete.` : "No tasks are currently tracked for this project."} ` +
      `Latest notes captured ${completedFromNotes.length} completed item${completedFromNotes.length === 1 ? "" : "s"}, ` +
      `${pendingFromNotes.length + actions.length} in-flight item${pendingFromNotes.length + actions.length === 1 ? "" : "s"}, and ` +
      `${noteRisks.length} risk signal${noteRisks.length === 1 ? "" : "s"}.`;

    const risks: string[] = [];
    if (noteRisks.length) risks.push(...noteRisks);
    if (dueInDays < 0) risks.push(`Project is past its due date (${project.dueDate}).`);
    else if (dueInDays <= 7 && completionRate < 80) {
      risks.push(`Only ${dueInDays} day(s) until ${project.dueDate} with completion at ${completionRate}% — timeline at risk.`);
    }
    const critical = projTasks.filter((t) => t.priority === "Critical" && t.status !== "Completed");
    if (critical.length) {
      risks.push(`${critical.length} critical task(s) still open: ${critical.map((t) => t.title).join(", ")}.`);
    }
    if (!risks.length) risks.push("No critical risks identified from notes or task data.");

    const recommendations: string[] = [];
    if (pending.length === 0) recommendations.push("Confirm scope is fully captured — no in-flight work is recorded.");
    if (critical.length) recommendations.push(`Re-confirm owners and ETAs for the ${critical.length} critical task(s) above.`);
    if (noteRisks.length) recommendations.push(`Resolve or escalate the ${noteRisks.length} flagged risk(s) before the next stakeholder review.`);
    if (decisions.length) recommendations.push(`Document the ${decisions.length} decision(s) made this period in the project log.`);
    if (recommendations.length < 2) {
      recommendations.push("Maintain weekly cadence and refresh this report after each working session.");
    }

    const nextSteps: string[] = [];
    if (pending[0]) nextSteps.push(`Prioritize: ${pending[0]}.`);
    nextSteps.push(`Drive ${project.name} toward the ${project.dueDate} milestone with focus on the open critical items.`);
    nextSteps.push(`Share this report with ${project.client || "stakeholders"} ahead of the next checkpoint.`);

    const r: Report = {
      summary,
      completed: completed.length ? completed : [`${NOT_SPECIFIED} — no completed work captured yet.`],
      pending: pending.length ? pending : [`${NOT_SPECIFIED} — no pending items captured.`],
      risks,
      recommendations,
      nextSteps,
    };
    setReport(r);
    addOutput({ type: "Report", title: `${project.name} — status report` });
    toast.success("Report generated");
  };

  const copyReport = () => {
    if (!report) return;
    const text = [
      `Summary: ${report.summary}`,
      "",
      "Completed:",
      ...report.completed.map((c) => ` - ${c}`),
      "",
      "Pending:",
      ...report.pending.map((c) => ` - ${c}`),
      "",
      "Risks / blockers:",
      ...report.risks.map((c) => ` - ${c}`),
      "",
      "Recommendations:",
      ...report.recommendations.map((c) => ` - ${c}`),
      "",
      "Next steps:",
      ...report.nextSteps.map((c) => ` - ${c}`),
      "",
      DISCLAIMER,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <>
      <PageHeader title="Project Reports" description="Generate structured status reports from progress notes." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs</CardTitle>
            <CardDescription>Pick a project, paste your latest notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Progress notes</Label>
              <Textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={generate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> Generate report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-accent" /> Status report
              </CardTitle>
              <CardDescription>Review and share with stakeholders.</CardDescription>
            </div>
            {report && (
              <Button variant="outline" size="sm" className="gap-2" onClick={copyReport}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!report ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-6 w-6 text-accent/60" />
                Your report will appear here.
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <Section title="Progress summary"><p>{report.summary}</p></Section>
                <Section title="Completed work"><Ul items={report.completed} /></Section>
                <Section title="Pending work"><Ul items={report.pending} /></Section>
                <Section title="Risks & blockers"><Ul items={report.risks} /></Section>
                <Section title="Recommendations"><Ul items={report.recommendations} /></Section>
                <Section title="Next steps"><Ul items={report.nextSteps} /></Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}
