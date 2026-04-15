import {
  CheckSquare,
  Clock,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Timer,

  type LucideIcon,
} from "lucide-react";

export type NavRoute = {
  id: string;
  href: `/${string}`;
  title: string;
  summary: string;
  icon: LucideIcon;
  group: "CORE" | "AGENTS";
};

export type NavGroup = {
  id: "CORE" | "AGENTS";
  label: string;
  routes: NavRoute[];
};

export const NAV_ROUTES: NavRoute[] = [
  // -- CORE --
  {
    id: "home",
    href: "/dashboard",
    title: "Home",
    summary: "Command center -- agents, crons, markets overview.",
    icon: LayoutDashboard,
    group: "CORE",
  },
  {
    id: "tasks",
    href: "/tasks",
    title: "Tasks",
    summary: "Today's focus and task board -- priorities and execution.",
    icon: CheckSquare,
    group: "CORE",
  },
  {
    id: "calendar",
    href: "/calendar",
    title: "Calendar",
    summary: "Schedules, deadlines, and planned runs.",
    icon: Clock,
    group: "CORE",
  },
  {
    id: "crons",
    href: "/crons",
    title: "Cron Jobs",
    summary: "Scheduled automation -- status, logs, next runs.",
    icon: Timer,
    group: "CORE",
  },

  // -- AGENTS --
  {
    id: "digital-office",
    href: "/digital-office",
    title: "Digital Office",
    summary: "Agent workspace -- live sessions and status.",
    icon: Building2,
    group: "AGENTS",
  },
  {
    id: "agent-inbox",
    href: "/agent-inbox",
    title: "Agent Inbox",
    summary: "Multi-agent communications -- threads and workflows.",
    icon: MessageSquare,
    group: "AGENTS",
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "CORE",
    label: "Core",
    routes: NAV_ROUTES.filter((r) => r.group === "CORE"),
  },
  {
    id: "AGENTS",
    label: "Agents",
    routes: NAV_ROUTES.filter((r) => r.group === "AGENTS"),
  },
];
