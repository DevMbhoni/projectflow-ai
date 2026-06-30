import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, projectStatusColor, priorityColor } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileText,
  CalendarClock,
  Mail,
  BarChart3,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ProjectFlow AI" },
      { name: "description", content: "Overview of projects, tasks, deadlines and AI activity." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { projects, tasks, outputs } = useStore();
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);

  const active = tasks.filter((t) => t.status !== "Completed");
  const completed = tasks.filter((t) => t.status === "Completed");
  const overdue = active.filter((t) => new Date(t.dueDate) < today);
  const upcoming = active
    .filter((t) => {
      const d = new Date(t.dueDate);
      return d >= today && d <= in7;
    })
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));

  const stats = [
    { label: "Total projects", value: projects.length, icon: FolderKanban, tint: "bg-primary/10 text-primary" },
    { label: "Active tasks", value: active.length, icon: CheckSquare, tint: "bg-accent/15 text-accent" },
    { label: "Completed", value: completed.length, icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-700" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, tint: "bg-red-100 text-red-700" },
  ];

  const quick = [
    { label: "New project", to: "/projects", icon: Plus },
    { label: "Add task", to: "/tasks", icon: CheckSquare },
    { label: "Summarize meeting", to: "/meeting-notes", icon: FileText },
    { label: "Generate plan", to: "/ai-planner", icon: CalendarClock },
    { label: "Draft email", to: "/email-generator", icon: Mail },
    { label: "Build report", to: "/reports", icon: BarChart3 },
  ];

  return (
    <>
      <PageHeader
        title="Welcome back, Alex"
        description="Here's what's happening across your workspace today."
        actions={
          <Button asChild className="gap-2">
            <Link to="/projects">
              <Plus className="h-4 w-4" /> New project
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">{s.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tint}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-accent" /> Quick actions
            </CardTitle>
            <CardDescription>Jump into the most common workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {quick.map((q) => (
                <Button key={q.label} variant="outline" asChild className="h-auto flex-col gap-2 py-4">
                  <Link to={q.to}>
                    <q.icon className="h-5 w-5 text-accent" />
                    <span className="text-xs font-medium">{q.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent projects</CardTitle>
                <CardDescription>Latest activity across your workspace.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border bg-background/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.client} · due {p.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={priorityColor[p.priority]}>{p.priority}</Badge>
                    <Badge variant="outline" className={projectStatusColor[p.status]}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming deadlines</CardTitle>
              <CardDescription>Next 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing due in the next week. Nice work.</p>
              )}
              {upcoming.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-start justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">Due {t.dueDate} · {t.assignee}</p>
                  </div>
                  <Badge variant="outline" className={priorityColor[t.priority]}>{t.priority}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent AI outputs</CardTitle>
            <CardDescription>Summaries, plans, emails, and reports generated by AI tools.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {outputs.slice(0, 8).map((o) => (
                <div key={o.id} className="rounded-lg border bg-background/60 p-4">
                  <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">{o.type}</Badge>
                  <p className="mt-2 text-sm font-medium leading-snug">{o.title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{o.createdAt}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
