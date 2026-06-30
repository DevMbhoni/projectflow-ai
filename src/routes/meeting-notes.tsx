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
  extractDeadline,
  extractOwner,
  toImperative,
  sentenceTopic,
  naturalList,
  dedupe,
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

interface ActionItem { task: string; owner: string; deadline: string }
interface Summary {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  risks: string[];
  followUps: string[];
}

function MeetingNotesPage() {
  const { projects, addOutput } = useStore();
  const [title, setTitle] = useState("Weekly product sync");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("Alex Morgan, Sarah Kim, Diego Alvarez");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [notes, setNotes] = useState(
    "Discussed homepage wireframes and mobile navigation. Sarah will finalize the wireframes by tomorrow afternoon. Decided to ship the v2 navigation behind a feature flag. Booking page is delayed because the loyalty API spec is still pending from the backend team. Diego will follow up with platform by Friday. Client update is due next Monday.",
  );
  const [out, setOut] = useState<Summary | null>(null);

  const generate = () => {
    if (!notes.trim()) return toast.error("Paste your notes first");

    const attendeeList = attendees.split(",").map((s) => s.trim()).filter(Boolean);
    const sentences = splitSentences(notes);
    const { decisions, actions, risks, points } = classifySentences(sentences);
    const project = projects.find((p) => p.id === projectId);

    // Build a human summary from actual topic phrases (not bag-of-words).
    const topicPool = dedupe(
      [...points, ...decisions, ...actions]
        .map(sentenceTopic)
        .map((t) => t.replace(/\s+by\s+.*$/i, "")) // drop deadline tail from topic
        .filter((t) => t.length > 4),
      (s) => s,
    ).slice(0, 4);

    const attendeesPhrase = attendeeList.length
      ? naturalList(attendeeList)
      : "the team";
    const titlePhrase = title.trim() ? ` "${title.trim()}"` : "";
    const projectPhrase = project ? ` for ${project.name}` : "";

    const topicSentence = topicPool.length
      ? `The discussion covered ${naturalList(topicPool)}.`
      : `The notes did not surface a clear set of discussion topics.`;

    const counts: string[] = [];
    if (decisions.length) counts.push(`${decisions.length} decision${decisions.length === 1 ? "" : "s"}`);
    if (actions.length) counts.push(`${actions.length} action item${actions.length === 1 ? "" : "s"}`);
    if (risks.length) counts.push(`${risks.length} risk${risks.length === 1 ? "" : "s"} or blocker${risks.length === 1 ? "" : "s"}`);
    const countsPhrase = counts.length ? ` ${naturalList(counts)} were captured.` : "";

    const summary =
      `On ${date || NOT_SPECIFIED}, ${attendeesPhrase} met${titlePhrase}${projectPhrase}. ` +
      `${topicSentence}${countsPhrase}`;

    // Key points: original wording, deduped, full sentences (no truncation).
    const keyPoints = dedupe(points.length ? points : sentences.slice(0, 5)).slice(0, 6);

    // Action items: only from sentences that actually look like actions.
    const rawActions = dedupe(actions);
    const actionItems: ActionItem[] = rawActions.slice(0, 8).map((s) => {
      const owner = extractOwner(s, attendeeList) ?? NOT_SPECIFIED;
      const deadline = extractDeadline(s) ?? NOT_SPECIFIED;
      return { task: toImperative(s), owner, deadline };
    });

    const riskList = dedupe(risks);

    // Recommendations grounded in what's actually in the notes.
    const followUps: string[] = [];
    if (actionItems.some((a) => a.owner === NOT_SPECIFIED)) {
      followUps.push("Assign owners to any action items currently marked as Not specified.");
    }
    if (actionItems.some((a) => a.deadline === NOT_SPECIFIED)) {
      followUps.push("Confirm deadlines for action items that don't yet have a date.");
    }
    if (riskList.length) {
      followUps.push(`Address the ${riskList.length === 1 ? "blocker" : "blockers"} raised above before the next sync.`);
    }
    if (!decisions.length) {
      followUps.push("No explicit decisions were captured — confirm intent with the group in writing.");
    }
    followUps.push(
      `Circulate this summary to ${attendeeList.length ? naturalList(attendeeList) : "all attendees"} within 24 hours.`,
    );

    setOut({
      summary,
      keyPoints: keyPoints.length ? keyPoints : [NOT_SPECIFIED],
      decisions: decisions.length ? dedupe(decisions) : [NOT_SPECIFIED],
      actionItems: actionItems.length
        ? actionItems
        : [{ task: NOT_SPECIFIED, owner: NOT_SPECIFIED, deadline: NOT_SPECIFIED }],
      risks: riskList.length ? riskList : ["No risks or blockers identified in the notes."],
      followUps,
    });
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
      "Risks / concerns:",
      ...out.risks.map((r) => ` - ${r}`),
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
                <Section title="Risks / concerns">
                  <ul className="list-disc space-y-1 pl-5">
                    {out.risks.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
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
