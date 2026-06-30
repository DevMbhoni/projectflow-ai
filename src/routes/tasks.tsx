import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, taskStatusColor, priorityColor, type Task, type TaskStatus, type Priority } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — ProjectFlow AI" },
      { name: "description", content: "Track every task by project, priority, and status." },
    ],
  }),
  component: TasksPage,
});

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];

function TasksPage() {
  const { tasks, projects, addTask, updateTask, deleteTask } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  const empty: Omit<Task, "id"> = {
    title: "",
    description: "",
    projectId: projects[0]?.id ?? "",
    assignee: "",
    priority: "Medium",
    status: "To Do",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    estimatedHours: 2,
  };
  const [form, setForm] = useState<Omit<Task, "id">>(empty);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filterStatus === "all" || t.status === filterStatus) &&
          (filterPriority === "all" || t.priority === filterPriority) &&
          (filterProject === "all" || t.projectId === filterProject),
      ),
    [tasks, filterStatus, filterPriority, filterProject],
  );

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    const { id: _id, ...rest } = t;
    setForm(rest);
    setOpen(true);
  };
  const save = () => {
    if (!form.title.trim()) return toast.error("Task title is required");
    if (editing) {
      updateTask(editing.id, form);
      toast.success("Task updated");
    } else {
      addTask(form);
      toast.success("Task created");
    }
    setOpen(false);
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Every actionable item across your projects."
        actions={
          <Button className="gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                  </TableCell>
                  <TableCell className="text-sm">{projectName(t.projectId)}</TableCell>
                  <TableCell className="text-sm">{t.assignee}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={taskStatusColor[t.status]}>{t.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColor[t.priority]}>{t.priority}</Badge>
                  </TableCell>
                  <TableCell>{t.dueDate}</TableCell>
                  <TableCell>{t.estimatedHours}h</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteTask(t.id);
                        toast.success("Task deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No tasks match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Estimated hours</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimatedHours}
                  onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
