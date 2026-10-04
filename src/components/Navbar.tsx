import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookingBell } from "@/components/BookingBell";
import { MobileNav } from "@/components/MobileNav";
import { useNavItems } from "@/lib/nav-items";
import { LogOut } from "lucide-react";

export function Navbar() {
  const { user, signout } = useAuth();
  const viewAs = useStore((s) => s.viewAs);
  const setViewAs = useStore((s) => s.setViewAs);
  const location = useLocation();
  const navItems = useNavItems();
  const isAstrologer = user?.role === "Astrologer";

  return (
    <>
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 shrink items-center gap-4 sm:gap-6">
            <Link
              to="/dashboard"
              className="shrink-0 text-base font-bold sm:text-lg"
            >
              SuperTalks
            </Link>
            {/* The links overflow the row next to the bell/avatar cluster on
                phones, so they render in the bottom tab bar below md. */}
            <nav className="hidden min-w-0 items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* this feature is commented out for now, this will be added in future version */}
            {/* {isAstrologer && (
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
            )} */}
            <BookingBell />
            <Avatar className="h-8 w-8">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <AvatarFallback className="text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              )}
            </Avatar>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={signout}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <MobileNav />
    </>
  );
}
