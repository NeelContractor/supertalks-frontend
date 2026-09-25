import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  HelpCircle,
  CalendarDays,
  User,
  LogOut,
  LayoutTemplate,
} from "lucide-react";

const allNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, client: true },
  { to: "/questions", label: "Questions", icon: HelpCircle, client: true },
  { to: "/bookings", label: "Bookings", icon: CalendarDays, client: true },
  { to: "/website", label: "Customize", icon: LayoutTemplate, client: false },
  { to: "/profile", label: "Profile", icon: User, client: false },
];

export function Navbar() {
  const { user, signout } = useAuth();
  const viewAs = useStore((s) => s.viewAs);
  const setViewAs = useStore((s) => s.setViewAs);
  const location = useLocation();
  // Provider-only links (Customize/Profile) are hidden while browsing as a
  // customer, even for astrologers who can access both sides.
  const inClientView = viewAs === "client";
  const navItems = allNavItems.filter((item) => item.client || !inClientView);
  const isAstrologer = user?.role === "Astrologer";

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            to="/dashboard"
            className="shrink-0 text-base font-bold sm:text-lg"
          >
            SuperTalks
          </Link>
          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={`flex shrink-0 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isAstrologer && (
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewAs("astrologer")}
                className={`rounded px-2 py-1 transition-colors ${
                  viewAs === "astrologer"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Provider
              </button>
              <button
                type="button"
                onClick={() => setViewAs("client")}
                className={`rounded px-2 py-1 transition-colors ${
                  viewAs === "client"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Customer
              </button>
            </div>
          )}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon-sm" onClick={signout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
