import { createContext, useContext, useState, type ReactNode } from "react";

export type ProjectStatus = "Planning" | "In Progress" | "On Hold" | "Completed";
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type TaskStatus = "To Do" | "In Progress" | "Review" | "Completed";

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  priority: Priority;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignee: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  estimatedHours: number;
}

export interface AIOutput {
  id: string;
  type: "Meeting Summary" | "Task Plan" | "Email" | "Report";
  title: string;
  createdAt: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const seedProjects: Project[] = [
  {
    id: "p1",
    name: "Acme Website Redesign",
    client: "Acme Corp",
    description: "Complete overhaul of the marketing site with new brand system.",
    status: "In Progress",
    startDate: "2026-06-01",
    dueDate: "2026-07-30",
    priority: "High",
  },
  {
    id: "p2",
    name: "Mobile App MVP",
    client: "Northwind Labs",
    description: "Ship a v1 iOS/Android client for the loyalty product.",
    status: "Planning",
    startDate: "2026-07-01",
    dueDate: "2026-09-15",
    priority: "Critical",
  },
  {
    id: "p3",
    name: "Q3 Marketing Campaign",
    client: "Internal",
    description: "Cross-channel campaign for Q3 product launch.",
    status: "In Progress",
    startDate: "2026-06-15",
    dueDate: "2026-08-01",
    priority: "Medium",
  },
  {
    id: "p4",
    name: "CRM Migration",
    client: "Globex",
    description: "Migrate from legacy CRM to HubSpot with data cleanup.",
    status: "On Hold",
    startDate: "2026-05-20",
    dueDate: "2026-08-20",
    priority: "Medium",
  },
  {
    id: "p5",
    name: "Onboarding Flow v2",
    client: "Internal",
    description: "Reduce drop-off in first-run experience.",
    status: "Completed",
    startDate: "2026-04-01",
    dueDate: "2026-06-10",
    priority: "Low",
  },
];

const seedTasks: Task[] = [
  { id: "t1", title: "Finalize homepage wireframes", description: "Hand off to design.", projectId: "p1", assignee: "Sarah Kim", priority: "High", status: "In Progress", dueDate: "2026-07-05", estimatedHours: 6 },
  { id: "t2", title: "Implement auth screens", description: "Sign in, sign up, forgot password.", projectId: "p2", assignee: "Diego Alvarez", priority: "Critical", status: "To Do", dueDate: "2026-07-12", estimatedHours: 12 },
  { id: "t3", title: "Draft launch email sequence", description: "5 emails for the Q3 launch.", projectId: "p3", assignee: "Mei Wong", priority: "Medium", status: "Review", dueDate: "2026-07-02", estimatedHours: 4 },
  { id: "t4", title: "Audit CRM data quality", description: "Identify duplicates and gaps.", projectId: "p4", assignee: "Jordan Lee", priority: "Medium", status: "To Do", dueDate: "2026-07-15", estimatedHours: 8 },
  { id: "t5", title: "Component library setup", description: "Token + Storybook scaffolding.", projectId: "p1", assignee: "Sarah Kim", priority: "High", status: "Completed", dueDate: "2026-06-25", estimatedHours: 10 },
  { id: "t6", title: "Onboarding analytics review", description: "Pull funnel data.", projectId: "p5", assignee: "Priya Patel", priority: "Low", status: "Completed", dueDate: "2026-06-08", estimatedHours: 3 },
  { id: "t7", title: "Push notification spec", description: "Define event taxonomy.", projectId: "p2", assignee: "Diego Alvarez", priority: "High", status: "To Do", dueDate: "2026-06-29", estimatedHours: 5 },
];

const seedOutputs: AIOutput[] = [
  { id: "o1", type: "Meeting Summary", title: "Weekly design sync — Acme", createdAt: "2026-06-28" },
  { id: "o2", type: "Email", title: "Client update — Northwind MVP", createdAt: "2026-06-27" },
  { id: "o3", type: "Task Plan", title: "Sprint plan: week of Jun 30", createdAt: "2026-06-29" },
  { id: "o4", type: "Report", title: "Q3 Marketing — status report", createdAt: "2026-06-26" },
];

interface Store {
  projects: Project[];
  tasks: Task[];
  outputs: AIOutput[];
  addProject: (p: Omit<Project, "id">) => void;
  updateProject: (id: string, p: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (t: Omit<Task, "id">) => void;
  updateTask: (id: string, t: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addOutput: (o: Omit<AIOutput, "id" | "createdAt">) => void;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [outputs, setOutputs] = useState<AIOutput[]>(seedOutputs);

  const value: Store = {
    projects,
    tasks,
    outputs,
    addProject: (p) => setProjects((x) => [{ ...p, id: uid() }, ...x]),
    updateProject: (id, p) => setProjects((x) => x.map((it) => (it.id === id ? { ...it, ...p } : it))),
    deleteProject: (id) => {
      setProjects((x) => x.filter((it) => it.id !== id));
      setTasks((x) => x.filter((it) => it.projectId !== id));
    },
    addTask: (t) => setTasks((x) => [{ ...t, id: uid() }, ...x]),
    updateTask: (id, t) => setTasks((x) => x.map((it) => (it.id === id ? { ...it, ...t } : it))),
    deleteTask: (id) => setTasks((x) => x.filter((it) => it.id !== id)),
    addOutput: (o) =>
      setOutputs((x) => [{ ...o, id: uid(), createdAt: new Date().toISOString().slice(0, 10) }, ...x].slice(0, 50)),
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

export const priorityColor: Record<Priority, string> = {
  Low: "bg-slate-100 text-slate-700 border-slate-200",
  Medium: "bg-blue-100 text-blue-700 border-blue-200",
  High: "bg-amber-100 text-amber-700 border-amber-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

export const projectStatusColor: Record<ProjectStatus, string> = {
  Planning: "bg-slate-100 text-slate-700 border-slate-200",
  "In Progress": "bg-violet-100 text-violet-700 border-violet-200",
  "On Hold": "bg-amber-100 text-amber-700 border-amber-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const taskStatusColor: Record<TaskStatus, string> = {
  "To Do": "bg-slate-100 text-slate-700 border-slate-200",
  "In Progress": "bg-violet-100 text-violet-700 border-violet-200",
  Review: "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
