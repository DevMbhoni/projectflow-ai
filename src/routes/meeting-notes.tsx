import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { Sparkles, Copy, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import {
  DISCLAIMER,
  NOT_SPECIFIED,
  splitSentences,
  classifySentences,
  keywords,
  extractDeadline,
  extractOwner,
  toImperative,
  inDays,
  properNouns,
} from "@/lib/ai-helpers";

export const Route = createFileRoute("/meeting-notes")({
  head: () => ({
    meta: [
      { title: "Meeting Notes AI — ProjectFlow AI" },
      { name: "description", content: "Turn raw meeting notes into a structured summary with action items." },
    ],
  }),
  component: MeetingNotesPage,
});

interface Summary {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: { task: string; owner: string; deadline: string }[];
  followUps: string[];
}

function MeetingNotesPage() {
  const { projects, addOutput } = useStore();
  const [title, setTitle] = useState("Weekly product sync");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("Alex Morgan, Sarah Kim, Diego Alvarez");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [notes, setNotes] = useState(
    "Discussed homepage hero variants and CTA copy. Sarah will finalize the wireframes by Friday. Decided to ship the v2 navigation behind a feature flag. Diego raised concerns about API rate limits on the loyalty endpoints — needs follow-up with platform team next week.",
  );
  const [out, setOut] = useState<Summary | null>(null);

  const generate = () => {
    if (!notes.trim()) return toast.error("Paste your notes first");

    const attendeeList = attendees.split(",").map((s) => s.trim()).filter(Boolean);
    const sentences = splitSentences(notes);
    const { decisions, actions, risks, points } = classifySentences(sentences);
    const kw = keywords(notes, 6);
    const mentioned = properNouns(notes).filter(
      (n) => !attendeeList.some((a) => a.toLowerCase().includes(n.toLowerCase())),
    );
    const project = projects.find((p) => p.id === projectId);

    const topic =
      kw.length > 0
        ? kw.slice(0, 3).join(", ")
        : sentences[0]?.slice(0, 60).toLowerCase() ?? "the agenda";

    const summary =
      `On ${date || NOT_SPECIFIED}, ${attendeeList.length ? attendeeList.join(", ") : "the team"} met` +
      `${title ? ` for "${title}"` : ""}${project ? ` (project: ${project.name})` : ""}. ` +
      `Discussion focused on ${topic}. ` +
      `${decisions.length} decision${decisions.length === 1 ? "" : "s"} were recorded, ` +
      `${actions.length} action item${actions.length === 1 ? "" : "s"} captured, and ` +
      `${risks.length} risk${risks.length === 1 ? "" : "s"} flagged for follow-up.`;

    const keyPoints =
      points.length > 0
        ? points.slice(0, 6)
        : sentences.slice(0, 4);

    const actionItems = (actions.length ? actions : sentences.slice(0, 3)).slice(0, 6).map((s, i) => {
      const owner =
        extractOwner(s, attendeeList) ??
        (mentioned[0] ? mentioned[0] : attendeeList[i % Math.max(attendeeList.length, 1)] ?? NOT_SPECIFIED);
      const dl = extractDeadline(s) ?? inDays(3 + i * 2);
      return { task: toImperative(s).slice(0, 160), owner, deadline: dl };
    });

    const followUps: string[] = [];
    if (risks.length) {
      followUps.push(
        `Address the flagged ${risks.length === 1 ? "risk" : "risks"}: ${risks
          .map((r) => r.slice(0, 90))
          .join("; ")}.`,
      );
    }
    if (mentioned.length) {
      followUps.push(`Loop in ${mentioned.slice(0, 3).join(", ")} on the relevant action items.`);
    }
    if (decisions.length === 0) {
      followUps.push("No clear decisions were captured — confirm intent with the group before the next sync.");
    }
    followUps.push(`Circulate this summary to ${attendeeList.length ? attendeeList.join(", ") : "attendees"} within 24 hours.`);

    const summaryObj: Summary = {
      summary,
      keyPoints,
      decisions: decisions.length ? decisions : [`${NOT_SPECIFIED} — no explicit decisions detected in the notes.`],
      actionItems: actionItems.length
        ? actionItems
        : [{ task: NOT_SPECIFIED, owner: NOT_SPECIFIED, deadline: NOT_SPECIFIED }],
      followUps,
    };
    setOut(summaryObj);
    addOutput({ type: "Meeting Summary", title: `${title || "Meeting"} — ${date}` });
    toast.success("Summary generated");
  };

  const copyOut = () => {
    if (!out) return;
    const text = [
      `Summary: ${out.summary}`,
      "",
      "Key discussion points:",
      ...out.keyPoints.map((p) => ` - ${p}`),
      "",
      "Decisions:",
      ...out.decisions.map((p) => ` - ${p}`),
      "",
      "Action items:",
      ...out.actionItems.map((a) => ` - ${a.task} (Owner: ${a.owner}, Due: ${a.deadline})`),
      "",
      "Follow-up recommendations:",
      ...out.followUps.map((f) => ` - ${f}`),
      "",
      DISCLAIMER,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <>
      <PageHeader
        title="Meeting Notes AI"
        description="Paste raw notes and get a structured, shareable summary."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meeting details</CardTitle>
            <CardDescription>Add context so the summary is on-point.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2 col-span-2">
                <Label>Meeting title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Attendees (comma separated)</Label>
                <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Raw notes</Label>
                <Textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <Button onClick={generate} className="gap-2 w-full">
              <Sparkles className="h-4 w-4" /> Generate summary
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-accent" /> AI summary
              </CardTitle>
              <CardDescription>Review carefully before sharing.</CardDescription>
            </div>
            {out && (
              <Button variant="outline" size="sm" className="gap-2" onClick={copyOut}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!out ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-6 w-6 text-accent/60" />
                Generated summary will appear here.
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <Section title="Summary"><p>{out.summary}</p></Section>
                <Section title="Key discussion points">
                  <ul className="list-disc space-y-1 pl-5">
                    {out.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </Section>
                <Section title="Decisions made">
                  <ul className="list-disc space-y-1 pl-5">
                    {out.decisions.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </Section>
                <Section title="Action items">
                  <div className="space-y-2">
                    {out.actionItems.map((a, i) => (
                      <div key={i} className="rounded-lg border bg-background/60 p-3">
                        <p className="font-medium">{a.task}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Owner: {a.owner} · Due: {a.deadline}</p>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Follow-up recommendations">
                  <ul className="list-disc space-y-1 pl-5">
                    {out.followUps.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </Section>
                <Disclaimer />
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

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{DISCLAIMER}</span>
    </div>
  );
}
