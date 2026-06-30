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
import { Sparkles, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

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
    const lines = notes.split(/[\.\n]+/).map((l) => l.trim()).filter(Boolean);
    const attendeeList = attendees.split(",").map((s) => s.trim()).filter(Boolean);
    const owner = (i: number) => attendeeList[i % Math.max(attendeeList.length, 1)] ?? "Unassigned";
    const fmtDate = (d: number) =>
      new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

    const summary: Summary = {
      summary: `On ${date}, the team met to review "${title}". The conversation focused on ${lines[0]?.toLowerCase() ?? "key project updates"}, alignment on next steps, and open risks to address before the next checkpoint.`,
      keyPoints: lines.slice(0, 5).map((l) => l.replace(/^[-•]\s*/, "")),
      decisions: [
        "Move forward with the proposed direction discussed.",
        "Escalate blockers to leadership in the next steering review.",
        "Reconvene next week to confirm progress against owners.",
      ],
      actionItems: lines.slice(0, 4).map((l, i) => ({
        task: l.replace(/^[-•]\s*/, "").slice(0, 120),
        owner: owner(i),
        deadline: fmtDate(3 + i * 2),
      })),
    };
    setOut(summary);
    addOutput({ type: "Meeting Summary", title: `${title} — ${date}` });
    toast.success("Summary generated");
  };

  const copyOut = () => {
    if (!out) return;
    const text = [
      `Summary: ${out.summary}`,
      "",
      "Key points:",
      ...out.keyPoints.map((p) => ` - ${p}`),
      "",
      "Decisions:",
      ...out.decisions.map((p) => ` - ${p}`),
      "",
      "Action items:",
      ...out.actionItems.map((a) => ` - ${a.task} (Owner: ${a.owner}, Due: ${a.deadline})`),
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
