import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  AlertTriangle,
  Scale,
  Lock,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/responsible-ai")({
  head: () => ({
    meta: [
      { title: "Responsible AI — ProjectFlow AI" },
      { name: "description", content: "Guidelines for reviewing, validating, and responsibly using AI outputs." },
    ],
  }),
  component: ResponsibleAIPage,
});

const checklist = [
  "I have read the AI output in full.",
  "I verified facts, names, dates, and figures against trusted sources.",
  "I considered whether the output could be biased or one-sided.",
  "I removed any sensitive or private information before sharing.",
  "A qualified human has reviewed and approved the output.",
];

const guidelines = [
  "Treat AI outputs as a first draft, not a final answer.",
  "Never paste secrets, credentials, or regulated data into prompts.",
  "Disclose AI assistance when sharing outputs externally.",
  "Document decisions made with AI help so they can be audited.",
  "Stop and escalate if an output could cause real-world harm.",
];

function ResponsibleAIPage() {
  return (
    <>
      <PageHeader
        title="Responsible AI"
        description="Use AI as a partner, not an authority. Review every output before you act on it."
      />
      <div className="space-y-6 p-6">
        <Alert className="border-accent/30 bg-accent/5">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <AlertTitle className="text-foreground">Disclaimer</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            AI-generated content may contain errors or incomplete information. Users must review, verify, and approve
            outputs before using them in real workplace decisions.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard icon={AlertTriangle} title="AI limitations" tint="bg-amber-100 text-amber-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>May produce plausible but incorrect information.</li>
              <li>Cannot access real-time data unless explicitly integrated.</li>
              <li>Lacks awareness of your private context unless provided.</li>
              <li>Confidence does not equal accuracy.</li>
            </ul>
          </InfoCard>

          <InfoCard icon={Scale} title="Possible bias" tint="bg-violet-100 text-violet-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>Training data can encode social, cultural, or business bias.</li>
              <li>Outputs may favor majority perspectives or popular framings.</li>
              <li>Watch for biased language in performance, hiring, or evaluation contexts.</li>
              <li>Cross-check with diverse human reviewers when stakes are high.</li>
            </ul>
          </InfoCard>

          <InfoCard icon={Lock} title="Privacy warning" tint="bg-red-100 text-red-700">
            <ul className="list-disc space-y-1 pl-5">
              <li>Do not paste customer PII, secrets, or regulated data into prompts.</li>
              <li>Anonymize names, emails, and identifiers when summarizing notes.</li>
              <li>Confirm storage and retention policies for your AI provider.</li>
              <li>Prefer aggregated, de-identified content for AI workflows.</li>
            </ul>
          </InfoCard>

          <InfoCard icon={BookOpen} title="Responsible use guidelines" tint="bg-blue-100 text-blue-700">
            <ul className="list-disc space-y-1 pl-5">
              {guidelines.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </InfoCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-accent" /> Human validation checklist
            </CardTitle>
            <CardDescription>Run this before sharing or acting on any AI output.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border bg-background/60 p-3">
                  <Checkbox id={`c${i}`} className="mt-0.5" />
                  <label htmlFor={`c${i}`} className="text-sm leading-snug">{item}</label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InfoCard({
  icon: Icon,
  title,
  tint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
