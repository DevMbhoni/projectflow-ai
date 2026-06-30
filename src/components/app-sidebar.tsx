import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  CalendarClock,
  Mail,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
];

const aiItems = [
  { title: "Meeting Notes AI", url: "/meeting-notes", icon: FileText },
  { title: "AI Task Planner", url: "/ai-planner", icon: CalendarClock },
  { title: "Smart Email Generator", url: "/email-generator", icon: Mail },
  { title: "Project Reports", url: "/reports", icon: BarChart3 },
];

const otherItems = [{ title: "Responsible AI", url: "/responsible-ai", icon: ShieldCheck }];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/60">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">ProjectFlow AI</span>
            <span className="text-xs text-sidebar-foreground/60">Smart workspace</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Workspace", mainItems)}
        {renderGroup("AI Tools", aiItems)}
        {renderGroup("Governance", otherItems)}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">
            AM
          </div>
          <div className="flex flex-col text-xs">
            <span className="font-medium text-sidebar-foreground">Alex Morgan</span>
            <span className="text-sidebar-foreground/60">Workspace owner</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
