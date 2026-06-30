import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Sparkles, Copy, BarChart3 } from "lucide-react";
import { toast } from "sonner";

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
    const projTasks = tasks.filter((t) => t.projectId === projectId);
    const completed = projTasks.filter((t) => t.status === "Completed").map((t) => t.title);
    const pending = projTasks.filter((t) => t.status !== "Completed").map((t) => t.title);

    const r: Report = {
      summary: `${project.name} for ${project.client} is currently ${project.status.toLowerCase()} with a ${project.priority.toLowerCase()} priority. Based on the latest notes, the team has made measurable progress toward the ${project.dueDate} milestone, with a small number of focused risks to address this week.`,
      completed: completed.length ? completed : ["Initial scoping and kickoff complete."],
      pending: pending.length ? pending : ["No outstanding tracked tasks — confirm scope is captured."],
      risks: [
        notes.includes("Awaiting") || notes.includes("blocker")
          ? "External dependency identified in notes — may delay downstream work."
          : "No critical blockers reported, but watch capacity into next sprint.",
        "Stakeholder availability for upcoming review.",
      ],
      recommendations: [
        "Confirm owners and deadlines for each pending item.",
        "Schedule a 30-minute mid-week sync to unblock the items above.",
        "Communicate status to stakeholders proactively before the next review.",
      ],
      nextSteps: [
        `Push pending work toward the ${project.dueDate} milestone.`,
        "Refresh this report at the end of the week with new progress notes.",
        "Escalate any unresolved risks in the next steering check-in.",
      ],
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
