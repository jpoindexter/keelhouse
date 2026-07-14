import type { ComponentType, SVGProps } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  Copy,
  Cpu,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Globe2,
  List,
  LoaderCircle,
  MoreHorizontal,
  ExternalLink,
  PanelBottom,
  PanelsTopLeft,
  Plus,
  Pin,
  Plug,
  RotateCw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Square,
  Target,
  ShieldCheck,
  X,
} from "lucide-react";
import type { TerminalPaneState } from "./terminalPane";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type AppIconName =
  | "agent"
  | "back"
  | "browser"
  | "bookmark"
  | "check"
  | "chevronDown"
  | "chevronRight"
  | "chevronUp"
  | "close"
  | "complete"
  | "connection"
  | "copy"
  | "error"
  | "file"
  | "filePlus"
  | "folder"
  | "folderOpen"
  | "folderPlus"
  | "forward"
  | "git"
  | "idle"
  | "layout"
  | "loading"
  | "logs"
  | "menu"
  | "more"
  | "openExternal"
  | "plus"
  | "pin"
  | "reload"
  | "save"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "stop"
  | "target"
  | "thinking"
  | "terminal"
  | "waiting"
  | "workspace";

export const ICONS: Record<AppIconName, IconComponent> = {
  agent: Cpu,
  back: ArrowLeft,
  browser: Globe2,
  bookmark: Bookmark,
  check: CheckCircle2,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  close: X,
  complete: CheckCircle2,
  connection: Plug,
  copy: Copy,
  error: AlertCircle,
  file: FileText,
  filePlus: FilePlus2,
  folder: Folder,
  folderOpen: FolderOpen,
  folderPlus: FolderPlus,
  forward: ArrowRight,
  git: GitBranch,
  idle: Circle,
  layout: PanelsTopLeft,
  loading: LoaderCircle,
  logs: List,
  menu: List,
  more: MoreHorizontal,
  openExternal: ExternalLink,
  plus: Plus,
  pin: Pin,
  reload: RotateCw,
  save: Save,
  search: Search,
  send: Send,
  settings: SlidersHorizontal,
  shield: ShieldCheck,
  stop: Square,
  target: Target,
  thinking: Brain,
  terminal: PanelBottom,
  waiting: Clock3,
  workspace: Folder,
};

export function AppIcon({ name, label, className = "" }: { name: AppIconName; label?: string; className?: string }) {
  const Icon = ICONS[name];
  return (
    <Icon
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`app-icon ${className}`.trim()}
      focusable="false"
      role={label ? "img" : undefined}
      strokeWidth={1.8}
    />
  );
}

export const paneStateIconName = (state: TerminalPaneState): AppIconName => {
  if (state === "running") return "loading";
  if (state === "starting") return "waiting";
  if (state === "exited" || state === "error") return "error";
  return "idle";
};

export const paneStateAccessibleLabel = (state: TerminalPaneState, label: string) => `${label} terminal pane state: ${state}`;

export type AgentActivityStatus = "thinking" | "running" | "waiting" | "error" | "exited" | "complete";

export const agentActivityIconName = (status: AgentActivityStatus): AppIconName => {
  if (status === "thinking") return "thinking";
  if (status === "running") return "loading";
  if (status === "waiting") return "waiting";
  if (status === "complete") return "complete";
  return "error";
};

export const agentActivityAccessibleLabel = (status: AgentActivityStatus, label: string) => `${label} agent activity status: ${status}`;

export const activityIconNames = ["thinking", "loading", "waiting", "error", "complete"] as const;
