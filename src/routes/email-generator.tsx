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
import { Sparkles, Copy, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/email-generator")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator — ProjectFlow AI" },
      { name: "description", content: "Draft professional emails in the right tone for any audience." },
    ],
  }),
  component: EmailPage,
});

function EmailPage() {
  const { addOutput } = useStore();
  const [purpose, setPurpose] = useState("Share a project status update");
  const [audience, setAudience] = useState("client");
  const [tone, setTone] = useState("formal");
  const [details, setDetails] = useState(
    "Acme website redesign is on track. Wireframes shipped this week. Next milestone is the high-fidelity design review on July 12.",
  );
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);

  const greetings: Record<string, string> = {
    client: "Hi {audience},",
    manager: "Hi {audience},",
    team: "Hey team,",
    HR: "Hello {audience},",
    stakeholder: "Dear {audience},",
  };
  const closers: Record<string, string> = {
    formal: "Kind regards,",
    friendly: "Thanks so much,",
    persuasive: "Looking forward to your thoughts,",
    apologetic: "With appreciation,",
    concise: "Best,",
  };

  const generate = () => {
    if (!purpose.trim() || !details.trim()) return toast.error("Add a purpose and key details");
    const subject =
      tone === "concise"
        ? purpose.replace(/\.$/, "")
        : `${purpose.replace(/\.$/, "")} — quick update`;
    const greeting = (greetings[audience] ?? "Hello,").replace("{audience}", audience.charAt(0).toUpperCase() + audience.slice(1));
    const opener =
      tone === "apologetic"
        ? "I wanted to reach out personally with an update — and to apologize for any disruption along the way."
        : tone === "persuasive"
          ? "I'm writing because I think there's a real opportunity here that's worth a few minutes of your time."
          : tone === "friendly"
            ? "Hope you're having a good week! Quick note to keep you in the loop."
            : tone === "concise"
              ? "Quick update."
              : "I hope this message finds you well. I wanted to share a brief update on where things stand.";
    const closing = closers[tone] ?? "Best,";

    const body = [
      greeting,
      "",
      opener,
      "",
      details,
      "",
      tone === "concise" ? "Let me know if you have questions." : "Happy to jump on a quick call if it would be useful to walk through anything in more detail.",
      "",
      closing,
      "Alex Morgan",
      "Workspace Owner · ProjectFlow AI",
    ].join("\n");

    setOut({ subject, body });
    addOutput({ type: "Email", title: subject });
    toast.success("Email drafted");
  };

  const copyEmail = () => {
    if (!out) return;
    navigator.clipboard.writeText(`Subject: ${out.subject}\n\n${out.body}`);
    toast.success("Copied");
  };

  return (
    <>
      <PageHeader title="Smart Email Generator" description="Match the right tone to the right audience, fast." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brief</CardTitle>
            <CardDescription>Tell us what you want to say and to whom.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Email purpose</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["client", "manager", "team", "HR", "stakeholder"].map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["formal", "friendly", "persuasive", "apologetic", "concise"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Key details</Label>
              <Textarea rows={6} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <Button onClick={generate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> Generate email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-accent" /> Draft
              </CardTitle>
              <CardDescription>Review before sending.</CardDescription>
            </div>
            {out && (
              <Button variant="outline" size="sm" className="gap-2" onClick={copyEmail}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!out ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-6 w-6 text-accent/60" />
                Your draft email will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-background/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                  <p className="font-medium">{out.subject}</p>
                </div>
                <pre className="whitespace-pre-wrap rounded-lg border bg-background/60 p-4 font-sans text-sm leading-relaxed">
{out.body}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
