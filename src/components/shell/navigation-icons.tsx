import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Map,
  Network,
  Route,
  Sparkles,
  SunMedium,
  Target,
  Upload,
  UserRoundCog,
  Users,
} from "lucide-react";

const icons = {
  activity: Activity,
  badge: UserRoundCog,
  boxes: Boxes,
  building: Building2,
  calendar: CalendarDays,
  chart: BarChart3,
  clipboard: ClipboardList,
  file: FileText,
  layout: LayoutDashboard,
  map: Map,
  network: Network,
  route: Route,
  sparkles: Sparkles,
  sun: SunMedium,
  target: Target,
  upload: Upload,
  users: Users,
};

export function NavigationIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name as keyof typeof icons] ?? Activity;
  return <Icon aria-hidden="true" className={className} />;
}
