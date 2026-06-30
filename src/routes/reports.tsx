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
import {
  DISCLAIMER,
  NOT_SPECIFIED,
  splitSentences,
  classifySentences,
  extractDeadline,
  extractOwner,
  dedupe,
  sentenceTopic,
} from "@/lib/ai-helpers";

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
  executiveSummary: string;
  completed: string[];
  inProgress: string[];
  pending: string[];
  risks: string[];
  recommendations: string[];
  nextSteps: string[];
}

const COMPLETED_RE = /\b(done|completed|finished|shipped|launched|delivered|signed off|approved|merged|deployed|wrapped|closed)\b/i;
const IN_PROGRESS_RE = /\b(in progress|wip|started|drafting|building|reviewing|working on|underway|ongoing)\b/i;
const PENDING_RE = /\b(pending|to do|todo|planned|scheduled|upcoming|not started|next up|awaiting|waiting)\b/i;
const REVIEW_DATE_RE = /\b(review|checkpoint|sync|demo|presentation|meeting)\b/i;

function ReportsPage() {
  const { projects, tasks, addOutput } = useStore();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [notes, setNotes] = useState(
    "Design system tokens complete. Auth screens in progress, owned by Diego. Booking page timeline is at risk because the loyalty API specification is still pending from the backend team. Stakeholder review scheduled for next Tuesday.",
  );
  const [useProjectData, setUseProjectData] = useState(true);
  const [report, setReport] = useState<Report | null>(null);

  const generate = () => {
    const project = projects.find((p) => p.id === projectId);
    if (!notes.trim()) return toast.error("Add progress notes");

    const sentences = splitSentences(notes);
    const { decisions, actions, risks: noteRisks, points } = classifySentences(sentences);

    // Bucket sentences by explicit status words first; otherwise treat "actions" as in-progress.
    const completedFromNotes = dedupe(sentences.filter((s) => COMPLETED_RE.test(s)));
    const inProgressFromNotes = dedupe(
      sentences.filter((s) => IN_PROGRESS_RE.test(s) && !COMPLETED_RE.test(s)),
    );
    const pendingFromNotes = dedupe(
      sentences.filter((s) => PENDING_RE.test(s) && !COMPLETED_RE.test(s) && !IN_PROGRESS_RE.test(s)),
    );

    // Action-shaped sentences that don't already fall into a bucket become "in progress" if they
    // describe ongoing work, or "pending" if they're future-tense.
    const leftoverActions = actions.filter(
      (s) =>
        !completedFromNotes.includes(s) &&
        !inProgressFromNotes.includes(s) &&
        !pendingFromNotes.includes(s),
    );
    for (const s of leftoverActions) {
      if (/\bwill\b|\bgoing to\b|\bplan to\b/i.test(s)) pendingFromNotes.push(s);
      else inProgressFromNotes.push(s);
    }

    // Optionally enrich from real project task data — never invent counts when toggled off.
    const projTasks = useProjectData && project ? tasks.filter((t) => t.projectId === project.id) : [];
    const completedTasks = projTasks.filter((t) => t.status === "Completed");
    const inProgressTasks = projTasks.filter((t) => t.status === "In Progress" || t.status === "Review");
    const pendingTasks = projTasks.filter((t) => t.status === "To Do");

    const fmtTask = (t: (typeof projTasks)[number]) =>
      `${t.title} (owner: ${t.assignee}, due ${t.dueDate})`;

    const completed = dedupe([
      ...completedFromNotes,
      ...completedTasks.map(fmtTask),
    ]);
    const inProgress = dedupe([
      ...inProgressFromNotes,
      ...inProgressTasks.map(fmtTask),
    ]);
    const pending = dedupe([
      ...pendingFromNotes,
      ...pendingTasks.map(fmtTask),
    ]);

    // Executive summary — only mention facts we actually have.
    const parts: string[] = [];
    if (project) {
      const clientPart = project.client && project.client !== "Internal" ? ` for ${project.client}` : "";
      parts.push(
        `${project.name}${clientPart} is currently ${project.status.toLowerCase()} with ${project.priority.toLowerCase()} priority.`,
      );
      if (project.dueDate) parts.push(`Target milestone: ${project.dueDate}.`);
    }
    if (projTasks.length) {
      const pct = Math.round((completedTasks.length / projTasks.length) * 100);
      parts.push(
        `${completedTasks.length} of ${projTasks.length} tracked task${projTasks.length === 1 ? "" : "s"} are complete (${pct}%).`,
      );
    }
    const noteCounts: string[] = [];
    if (completedFromNotes.length) noteCounts.push(`${completedFromNotes.length} completed`);
    if (inProgressFromNotes.length + leftoverActions.filter((s) => !/\bwill\b|\bgoing to\b|\bplan to\b/i.test(s)).length)
      noteCounts.push(`${inProgressFromNotes.length} in progress`);
    if (pendingFromNotes.length) noteCounts.push(`${pendingFromNotes.length} pending`);
    if (noteRisks.length) noteCounts.push(`${noteRisks.length} risk${noteRisks.length === 1 ? "" : "s"}`);
    if (noteCounts.length) parts.push(`Latest notes capture ${noteCounts.join(", ")}.`);
    const executiveSummary = parts.join(" ") || "Status snapshot based on the notes below.";

    // Risks — explain impact when possible.
    const risksOut: string[] = [];
    for (const r of dedupe(noteRisks)) {
      const topic = sentenceTopic(r);
      let impact = "";
      if (/pending|missing|awaiting|blocked/i.test(r)) {
        impact = " This is likely to delay dependent work until it's resolved.";
      } else if (/delay|delayed|slip|behind/i.test(r)) {
        impact = " Timeline impact should be quantified and communicated to stakeholders.";
      } else if (/bug|outage|issue/i.test(r)) {
        impact = " User-facing impact should be assessed before the next release.";
      }
      risksOut.push(`${topic.charAt(0).toUpperCase() + topic.slice(1)}.${impact}`);
    }
    if (project && project.dueDate) {
      const dueInDays = Math.round((new Date(project.dueDate).getTime() - Date.now()) / 86400000);
      if (dueInDays < 0) {
        risksOut.push(`Project is ${Math.abs(dueInDays)} day(s) past the ${project.dueDate} milestone.`);
      } else if (projTasks.length && dueInDays <= 7) {
        const pct = Math.round((completedTasks.length / projTasks.length) * 100);
        if (pct < 80) {
          risksOut.push(
            `Only ${dueInDays} day(s) remain until ${project.dueDate} with completion at ${pct}% — timeline at risk.`,
          );
        }
      }
    }
    const critical = projTasks.filter((t) => t.priority === "Critical" && t.status !== "Completed");
    if (critical.length) {
      risksOut.push(
        `${critical.length} critical task(s) still open: ${critical.map((t) => t.title).join(", ")}.`,
      );
    }
    if (!risksOut.length) risksOut.push("No risks or blockers identified.");

    // Recommendations — practical, derived from what's actually in the notes/data.
    const recommendations: string[] = [];
    for (const r of dedupe(noteRisks).slice(0, 3)) {
      const topic = sentenceTopic(r).replace(/\.$/, "");
      if (/pending|missing|awaiting|blocked/i.test(r)) {
        recommendations.push(`Escalate to unblock: ${topic}.`);
      } else if (/delay|slip|behind/i.test(r)) {
        recommendations.push(`Re-plan affected scope and communicate the new ETA: ${topic}.`);
      } else {
        recommendations.push(`Address before the next checkpoint: ${topic}.`);
      }
    }
    const unowned = inProgress.concat(pending).filter((s) => !/owner:/i.test(s) && !extractOwner(s, []));
    if (unowned.length >= 2) {
      recommendations.push("Assign clear owners to in-flight and pending items that don't have one yet.");
    }
    if (critical.length) {
      recommendations.push(`Re-confirm owners and ETAs for the ${critical.length} open critical task(s).`);
    }
    if (decisions.length) {
      recommendations.push(`Log the ${decisions.length} decision(s) made this period in the project record.`);
    }
    if (!recommendations.length) {
      recommendations.push("Maintain weekly cadence and refresh this report after each working session.");
    }

    // Next steps — include any explicit review/checkpoint date from the notes.
    const nextSteps: string[] = [];
    const reviewSentence = sentences.find((s) => REVIEW_DATE_RE.test(s) && extractDeadline(s));
    if (reviewSentence) {
      const dl = extractDeadline(reviewSentence);
      nextSteps.push(`Prepare for the ${reviewSentence.replace(/\.$/, "")} (${dl}).`);
    }
    const topPending = pending[0] || inProgress[0];
    if (topPending) nextSteps.push(`Drive forward: ${sentenceTopic(topPending).replace(/\.$/, "")}.`);
    if (project) {
      nextSteps.push(
        `Share this report with ${project.client && project.client !== "Internal" ? project.client : "stakeholders"} ahead of the next checkpoint.`,
      );
    } else {
      nextSteps.push("Share this report with stakeholders ahead of the next checkpoint.");
    }

    const empty = [NOT_SPECIFIED];
    const r: Report = {
      executiveSummary,
      completed: completed.length ? completed : empty,
      inProgress: inProgress.length ? inProgress : empty,
      pending: pending.length ? pending : empty,
      risks: risksOut,
      recommendations: dedupe(recommendations),
      nextSteps: dedupe(nextSteps),
    };

    // Strip duplicates that may appear across in-progress and pending due to overlapping cues.
    r.pending = r.pending.filter((p) => !r.inProgress.includes(p));

    // Used point sentences with no other home — append to in-progress only if it's empty.
    if (r.inProgress[0] === NOT_SPECIFIED && points.length) {
      r.inProgress = dedupe(points.slice(0, 4));
    }

    setReport(r);
    addOutput({ type: "Report", title: `${project?.name ?? "Project"} — status report` });
    toast.success("Report generated");
  };

  const copyReport = () => {
    if (!report) return;
    const text = [
      "Executive summary:",
      report.executiveSummary,
      "",
      "Completed work:",
      ...report.completed.map((c) => ` - ${c}`),
      "",
      "Work in progress:",
      ...report.inProgress.map((c) => ` - ${c}`),
      "",
      "Pending work:",
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
                <SelectTrigger><SelectValue placeholder="None — use notes only" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Include real task data?</Label>
              <Select value={useProjectData ? "yes" : "no"} onValueChange={(v) => setUseProjectData(v === "yes")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes — enrich with tracked tasks</SelectItem>
                  <SelectItem value="no">No — use only the notes below</SelectItem>
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
                <Section title="Executive summary"><p>{report.executiveSummary}</p></Section>
                <Section title="Completed work"><Ul items={report.completed} /></Section>
                <Section title="Work in progress"><Ul items={report.inProgress} /></Section>
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
