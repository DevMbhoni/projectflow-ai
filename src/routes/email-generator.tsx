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
import {
  DISCLAIMER,
  NOT_SPECIFIED,
  splitSentences,
  dedupe,
  extractDeadline,
  properNouns,
  sentenceTopic,
} from "@/lib/ai-helpers";

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

// Convert a purpose phrase into a natural verb phrase that fits inside a sentence.
const purposeToPhrase = (raw: string): string => {
  let p = raw.trim().replace(/[.!?]+$/, "");
  // Strip imperative leads: "Share a project status update" → "a project status update"
  p = p.replace(/^(share|send|provide|give|write|draft|deliver|present|announce)\s+(an?\s+|the\s+)?/i, "");
  return p.charAt(0).toLowerCase() + p.slice(1);
};

// Build a natural subject line from the actual situation.
const buildSubject = (purpose: string, details: string, tone: string, sentences: string[]): string => {
  const subject = purpose.trim().replace(/[.!?]+$/, "");
  // Find a concrete anchor: a project name (capitalized noun) or a key noun phrase from details.
  const nouns = properNouns(details).filter((n) => n.length > 2);
  const anchor = nouns[0];
  const deadline = sentences.map((s) => extractDeadline(s)).find(Boolean);

  if (tone === "apologetic") {
    return anchor ? `Apologies and next steps — ${anchor}` : `Apologies and next steps — ${subject}`;
  }
  if (tone === "persuasive") {
    return anchor ? `${subject} — ${anchor}` : subject;
  }
  if (tone === "concise") {
    return anchor ? `${subject}: ${anchor}` : subject;
  }
  if (deadline && anchor) return `${subject} — ${anchor} (${deadline})`;
  if (anchor) return `${subject} — ${anchor}`;
  return subject;
};

function EmailPage() {
  const { addOutput } = useStore();
  const [purpose, setPurpose] = useState("Share a project status update");
  const [recipientName, setRecipientName] = useState("");
  const [audience, setAudience] = useState("client");
  const [tone, setTone] = useState("formal");
  const [details, setDetails] = useState(
    "Acme website redesign is on track. Wireframes shipped this week. High-fidelity design review is scheduled for July 12. Awaiting brand guidelines from the marketing team — could block dev hand-off if not received by Friday.",
  );
  const [senderName, setSenderName] = useState("Alex Morgan");
  const [out, setOut] = useState<EmailDraft | null>(null);

  const generate = () => {
    if (!purpose.trim() || !details.trim()) return toast.error("Add a purpose and key details");

    const sentences = dedupe(splitSentences(details));
    const purposePhrase = purposeToPhrase(purpose);
    const recipientDisplay = recipientName.trim() || NOT_SPECIFIED;

    const subject = buildSubject(purpose, details, tone, sentences);

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

    // Classify the details into status / issue / next-step sentences so the body reads naturally.
    const issues = sentences.filter((s) => /\b(awaiting|waiting|blocked|delay|delayed|risk|issue|concern|pending|missing|behind)\b/i.test(s));
    const completions = sentences.filter((s) => /\b(shipped|completed|done|delivered|launched|signed off|approved|merged|on track)\b/i.test(s));
    const upcoming = sentences.filter((s) => /\b(scheduled|next|upcoming|will|going to|plan to|due)\b/i.test(s));
    const other = sentences.filter((s) => !issues.includes(s) && !completions.includes(s) && !upcoming.includes(s));

    const body: string[] = [];

    // Opener — natural, doesn't echo the purpose verbatim.
    if (tone === "apologetic") {
      const issueTopic = issues[0] ? sentenceTopic(issues[0]).replace(/\.$/, "") : purposePhrase;
      body.push(`I want to acknowledge ${issueTopic}, and apologize for the impact this has had.`);
    } else if (tone === "persuasive") {
      body.push(`I'm writing to flag ${purposePhrase} — there's a clear benefit to acting on this now, and a real cost to waiting.`);
    } else if (tone === "friendly") {
      body.push(`Hope you're doing well. Wanted to give you a quick update on ${purposePhrase}.`);
    } else if (tone === "concise") {
      body.push(`Short update on ${purposePhrase}:`);
    } else {
      body.push(`I'm writing with an update on ${purposePhrase}.`);
    }

    // Tone-shaped body sections.
    if (tone === "apologetic") {
      if (issues.length) {
        body.push("Here's what happened:");
        body.push(issues.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (completions.length || upcoming.length) {
        body.push("To get back on track:");
        body.push([...completions, ...upcoming].map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
    } else if (tone === "persuasive") {
      if (completions.length) {
        body.push("What we've already delivered:");
        body.push(completions.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (issues.length) {
        body.push("Risk of delay:");
        body.push(issues.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (upcoming.length) {
        body.push("What we'd unlock by moving now:");
        body.push(upcoming.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
    } else if (tone === "concise") {
      const all = [...completions, ...issues, ...upcoming, ...other];
      if (all.length) body.push(all.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
    } else {
      // formal / friendly
      if (completions.length) {
        body.push(tone === "friendly" ? "What's done:" : "Progress to date:");
        body.push(completions.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (upcoming.length) {
        body.push(tone === "friendly" ? "What's next:" : "Upcoming milestones:");
        body.push(upcoming.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (issues.length) {
        body.push(tone === "friendly" ? "One thing to flag:" : "Items needing attention:");
        body.push(issues.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
      if (other.length && tone !== "friendly") {
        body.push("Additional context:");
        body.push(other.map((s) => `• ${s.replace(/[.!?]?$/, ".")}`).join("\n"));
      }
    }

    // CTA — derived from the actual situation.
    let cta: string;
    if (tone === "apologetic") {
      const fix = upcoming[0] ? sentenceTopic(upcoming[0]).replace(/\.$/, "") : "the corrective steps above";
      cta = `I'll personally drive ${fix}. Please tell me if there's anything else you'd like us to prioritize.`;
    } else if (tone === "persuasive") {
      const ask = issues[0]
        ? `confirm we can proceed before this slips further`
        : `confirm next steps so we can move forward this week`;
      cta = `Could we take 15 minutes this week to ${ask}?`;
    } else if (tone === "concise") {
      cta = issues.length
        ? `Please reply with any blockers on your side.`
        : `Reply if anything needs adjusting; otherwise we'll proceed as above.`;
    } else if (tone === "friendly") {
      cta = issues.length
        ? `Let me know if you can help unblock the item above — happy to jump on a quick call.`
        : `Let me know if you have any questions on the above!`;
    } else if (audience === "stakeholder") {
      cta = `Please advise if any item requires further detail ahead of the next checkpoint.`;
    } else {
      cta = `Happy to walk through any of the above in more detail — let me know what works.`;
    }

    const closingMap: Record<string, string> = {
      formal: "Kind regards,",
      friendly: "Thanks,",
      persuasive: "Looking forward to your reply,",
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
