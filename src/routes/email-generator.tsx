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
import { Sparkles, Copy, Mail, Info } from "lucide-react";
import { toast } from "sonner";
import { DISCLAIMER, NOT_SPECIFIED, splitSentences, keywords } from "@/lib/ai-helpers";

export const Route = createFileRoute("/email-generator")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator — ProjectFlow AI" },
      { name: "description", content: "Draft professional emails in the right tone for any audience." },
    ],
  }),
  component: EmailPage,
});

interface EmailDraft {
  subject: string;
  greeting: string;
  body: string[];
  cta: string;
  closing: string;
  signature: string;
}

function EmailPage() {
  const { addOutput } = useStore();
  const [purpose, setPurpose] = useState("Share a project status update");
  const [recipientName, setRecipientName] = useState("");
  const [audience, setAudience] = useState("client");
  const [tone, setTone] = useState("formal");
  const [details, setDetails] = useState(
    "Acme website redesign is on track. Wireframes shipped this week. Next milestone is the high-fidelity design review on July 12.",
  );
  const [senderName, setSenderName] = useState("Alex Morgan");
  const [out, setOut] = useState<EmailDraft | null>(null);

  const generate = () => {
    if (!purpose.trim() || !details.trim()) return toast.error("Add a purpose and key details");

    const sentences = splitSentences(details);
    const kw = keywords(details, 5);
    const purposeShort = purpose.replace(/\.$/, "").trim();
    const recipient = recipientName.trim() || (audience === "team" ? "team" : audience);
    const recipientDisplay = recipientName.trim() || NOT_SPECIFIED;

    // Subject lines tuned by tone, referencing actual content
    const subject =
      tone === "concise"
        ? purposeShort
        : tone === "persuasive"
          ? `${purposeShort} — worth a quick look`
          : tone === "apologetic"
            ? `Apology and update: ${purposeShort}`
            : tone === "friendly"
              ? `${purposeShort} 👋`
              : `${purposeShort}${kw[0] ? ` — ${kw[0]}` : ""}`;

    // Greeting
    const namePart =
      recipientName.trim() ||
      (audience === "team"
        ? "team"
        : audience.charAt(0).toUpperCase() + audience.slice(1));
    const greeting =
      tone === "friendly"
        ? `Hi ${namePart},`
        : tone === "formal" || audience === "stakeholder"
          ? `Dear ${namePart},`
          : tone === "apologetic"
            ? `Hi ${namePart},`
            : `Hello ${namePart},`;

    // Opener
    const opener =
      tone === "apologetic"
        ? `I wanted to reach out personally regarding ${purposeShort.toLowerCase()} — and to apologize for any disruption this may have caused.`
        : tone === "persuasive"
          ? `I'm writing because there's a meaningful opportunity tied to ${purposeShort.toLowerCase()} that I think is worth your time.`
          : tone === "friendly"
            ? `Hope you're doing well! Quick note about ${purposeShort.toLowerCase()}.`
            : tone === "concise"
              ? `Quick note on ${purposeShort.toLowerCase()}.`
              : `I wanted to share an update regarding ${purposeShort.toLowerCase()}.`;

    // Body: turn each user-provided sentence into its own paragraph or bullet
    const body: string[] = [opener];
    if (sentences.length > 1 && tone !== "concise") {
      body.push("Here's where things stand:");
      body.push(sentences.map((s) => `• ${s}`).join("\n"));
    } else {
      body.push(sentences.join(" "));
    }

    // CTA tuned by tone + audience
    const cta =
      tone === "persuasive"
        ? `Could we set up 15 minutes this week to discuss next steps on ${kw[0] ?? "this"}?`
        : tone === "apologetic"
          ? `Please let me know how you'd like to proceed, and I'll prioritize accordingly.`
          : tone === "concise"
            ? `Let me know if anything needs adjusting.`
            : tone === "friendly"
              ? `Let me know if you have any questions or want to jump on a quick call!`
              : audience === "stakeholder"
                ? `Please advise if any aspect requires further detail before our next review.`
                : `Happy to walk through any of the above in more detail — just let me know what works.`;

    const closingMap: Record<string, string> = {
      formal: "Kind regards,",
      friendly: "Thanks so much,",
      persuasive: "Looking forward to your thoughts,",
      apologetic: "With appreciation,",
      concise: "Best,",
    };
    const closing = closingMap[tone] ?? "Best,";

    const signature = `${senderName.trim() || NOT_SPECIFIED}\nProjectFlow AI`;

    const draft: EmailDraft = { subject, greeting, body, cta, closing, signature };
    setOut(draft);
    addOutput({ type: "Email", title: `${subject} → ${recipientDisplay}` });
    toast.success("Email drafted");
  };

  const renderBody = (d: EmailDraft) =>
    [d.greeting, "", ...d.body, "", d.cta, "", d.closing, d.signature].join("\n\n");

  const copyEmail = () => {
    if (!out) return;
    navigator.clipboard.writeText(`Subject: ${out.subject}\n\n${renderBody(out)}\n\n---\n${DISCLAIMER}`);
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
                <Label>Recipient name (optional)</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Jordan" />
              </div>
              <div className="grid gap-2">
                <Label>Your name</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              </div>
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
{renderBody(out)}
                </pre>
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
