import {
  LayoutDashboard,
  HelpCircle,
  CalendarDays,
  LayoutTemplate,
  User,
} from "lucide-react";
import { useStore } from "@/store";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown to customers as well as astrologers. */
  client: boolean;
};

export const allNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, client: true },
  { to: "/questions", label: "Questions", icon: HelpCircle, client: true },
  { to: "/bookings", label: "Bookings", icon: CalendarDays, client: true },
  { to: "/website", label: "Customize", icon: LayoutTemplate, client: false },
  { to: "/profile", label: "Profile", icon: User, client: false },
];

/**
 * Provider-only links (Customize/Profile) are hidden while browsing as a
 * customer, even for astrologers who can access both sides. Shared by the
 * desktop header and the mobile tab bar so the two never drift apart.
 */
export function useNavItems() {
  const viewAs = useStore((s) => s.viewAs);
  return viewAs === "client"
    ? allNavItems.filter((item) => item.client)
    : allNavItems;
}